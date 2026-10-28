/**
 * AP units (序號品) — the only module that writes product_units.
 *
 * Owns serial normalization, warehouse scoping (a unit belongs to its product's
 * warehouse) and the in_stock ↔ sold lifecycle: in_stock → sold only through
 * outbound, sold → in_stock only through RETURN inbound.
 *
 * Quantity changes stay with the Stock Ledger: the plan* functions return what
 * callers need to build movements, and callers apply them in the same `tx`.
 * Every function takes `conn` — `db`, or the `tx` from db.transaction().
 */

/** Messages are English; `code` + `params` let the frontend show its own text (vite-app/src/lib/i18n.ts). */
class ApUnitError extends Error {
  /** @param {number} status HTTP status the controller should answer with */
  constructor(code, message, status = 400, params = {}) {
    super(message);
    this.name = "ApUnitError";
    this.code = code;
    this.params = params;
    this.status = status;
  }
}

/**
 * A per-serial validation error. `serial_number` is omitted when the error is about the whole line.
 * @typedef {{serial_number?:string, code:string, params:Object, reason:string}} SerialIssue
 */
const serialIssue = (serial_number, code, reason, params = {}) => ({ serial_number, code, params, reason });

function normalizeSerial(raw) {
  return String(raw ?? "").trim().toUpperCase();
}

const UNIT_SELECT = "SELECT pu.*, p.sku, p.name AS product_name FROM product_units pu JOIN products p ON pu.product_id = p.id";

// ── Queries ──────────────────────────────────────────────────────────────────

/** WHERE clause for list/export: the warehouse plus the optional query filters. */
function buildFilter(warehouseId, query) {
  const { product_id, sku, status, serial_number, sold_to, project_case,
    sold_at_from, sold_at_to, created_at_from, created_at_to } = query;
  let where = "WHERE p.warehouse_id = ?";
  const params = [warehouseId];
  const add = (cond, value) => { where += ` AND ${cond}`; params.push(value); };

  if (product_id) add("pu.product_id = ?", product_id);
  if (sku) add("p.sku LIKE ?", `%${sku}%`);
  if (status) add("pu.status = ?", status);
  if (serial_number) add("pu.serial_number LIKE ?", `%${serial_number}%`);
  if (sold_to) add("pu.sold_to LIKE ?", `%${sold_to}%`);
  if (project_case) add("pu.project_case LIKE ?", `%${project_case}%`);
  if (sold_at_from) add("pu.sold_at >= ?", sold_at_from);
  if (sold_at_to) add("pu.sold_at <= ?", sold_at_to);
  if (created_at_from) add("pu.created_at >= ?", created_at_from);
  if (created_at_to) add("pu.created_at <= ?", created_at_to);
  return { where, params };
}

async function list(conn, warehouseId, query, { limit, offset } = {}) {
  const { where, params } = buildFilter(warehouseId, query);
  const { total } = await conn.get(
    `SELECT COUNT(*) AS total FROM product_units pu JOIN products p ON pu.product_id = p.id ${where}`,
    params,
  );
  let sql = `${UNIT_SELECT} ${where} ORDER BY pu.created_at DESC`;
  const rowParams = [...params];
  if (limit !== undefined) { sql += " LIMIT ? OFFSET ?"; rowParams.push(limit, offset || 0); }
  return { total, rows: await conn.all(sql, rowParams) };
}

/** Unit by id in the warehouse; throws 404 otherwise. */
async function getById(conn, id, warehouseId) {
  const unit = await conn.get(`${UNIT_SELECT} WHERE pu.id = ? AND p.warehouse_id = ?`, [id, warehouseId]);
  if (!unit) throw new ApUnitError("UNIT_NOT_FOUND", "Product unit not found", 404);
  return unit;
}

/** Exact serial in the warehouse (live products only), or undefined. */
async function findBySerial(conn, serial, warehouseId) {
  return conn.get(
    `SELECT pu.id, pu.serial_number, pu.status, pu.product_id, p.sku, p.name AS product_name
     FROM product_units pu JOIN products p ON pu.product_id = p.id
     WHERE pu.serial_number = ? AND p.warehouse_id = ? AND p.is_deleted = 0`,
    [normalizeSerial(serial), warehouseId],
  );
}

/** Serial-tracked product in the warehouse; throws 400 otherwise. */
async function getApProduct(conn, productId, warehouseId) {
  const product = await conn.get(
    "SELECT * FROM products WHERE id = ? AND warehouse_id = ? AND is_deleted = 0",
    [productId, warehouseId],
  );
  if (!product) throw new ApUnitError("PRODUCT_NOT_FOUND", "Product not found");
  if (!product.track_serial) throw new ApUnitError("PRODUCT_NOT_SERIAL_TRACKED", "Serial tracking is off for this product");
  return product;
}

// ── Single-unit maintenance (no quantity change, see CONTEXT.md) ─────────────

async function insertUnit(conn, product, serial, remarks) {
  const result = await conn.run(
    "INSERT INTO product_units (product_id, serial_number, remarks, warehouse_id) VALUES (?, ?, ?, ?)",
    [product.id, serial, remarks || null, product.warehouse_id],
  );
  return result.id;
}

const isDuplicate = (e) => e.message.includes("UNIQUE constraint failed");

async function create(conn, product, rawSerial, remarks) {
  const sn = normalizeSerial(rawSerial);
  if (!sn) throw new ApUnitError("SERIAL_EMPTY", "Serial number is empty");
  try {
    return await insertUnit(conn, product, sn, remarks);
  } catch (e) {
    if (isDuplicate(e)) throw new ApUnitError("SERIAL_EXISTS", "Serial number already exists");
    throw e;
  }
}

/** Shipping fields only on sold units, remarks on any; status never changes here. */
async function edit(conn, unit, { project_case, sold_to, remarks }) {
  const projectCase = project_case !== undefined ? project_case : unit.project_case;
  const soldTo = sold_to !== undefined ? sold_to : unit.sold_to;
  const newRemarks = remarks !== undefined ? remarks : unit.remarks;

  if (unit.status === "sold") {
    if (!projectCase || !projectCase.trim()) {
      throw new ApUnitError("UNIT_PROJECT_CASE_REQUIRED", "project_case is required for a shipped unit");
    }
  } else if (project_case !== undefined || sold_to !== undefined) {
    throw new ApUnitError("UNIT_IN_STOCK_NO_SHIPMENT", "An in-stock unit has no shipment details to edit");
  }

  await conn.run(
    "UPDATE product_units SET project_case = ?, sold_to = ?, remarks = ? WHERE id = ?",
    [projectCase || null, soldTo || null, newRemarks || null, unit.id],
  );
}

async function remove(conn, unit) {
  await conn.run("DELETE FROM product_units WHERE id = ?", [unit.id]);
}

// ── Inbound ──────────────────────────────────────────────────────────────────

/**
 * Insert new serials for one product, skipping bad ones (partial success).
 * Returns the inserted ids and per-serial errors (Array<SerialIssue>).
 */
async function createMany(conn, product, rawSerials, remarks) {
  const ids = [];
  const errors = [];
  const seen = new Set();
  for (let i = 0; i < rawSerials.length; i++) {
    const sn = normalizeSerial(rawSerials[i]);
    if (!sn) { errors.push(serialIssue(`#${i + 1}`, "SERIAL_EMPTY", "Serial number is empty")); continue; }
    if (seen.has(sn)) { errors.push(serialIssue(sn, "SERIAL_DUPLICATE_IN_BATCH", "Duplicate serial in this batch")); continue; }
    seen.add(sn);
    try {
      ids.push(await insertUnit(conn, product, sn, remarks));
    } catch (e) {
      if (!isDuplicate(e)) throw e;
      errors.push(serialIssue(sn, "SERIAL_EXISTS", "Serial number already exists"));
    }
  }
  return { ids, errors };
}

/**
 * Validate the serials of one inbound line. New serials are created; a sold
 * serial of the same product comes back to stock only under the RETURN tag.
 * `seen` collects serials across the whole batch.
 * Returns { errors: Array<SerialIssue>, plan: Array<{ serial } | { returnUnitId }> }.
 */
async function planInbound(conn, product, { quantityChange, quantityType, serials, tagName }, seen) {
  const lineError = (code, reason, params) => ({ errors: [serialIssue(undefined, code, reason, params)], plan: [] });
  if (serials.length === 0) return lineError("AP_INBOUND_SERIALS_REQUIRED", "Scan serials to receive an AP product");
  if (parseInt(quantityChange) <= 0) return lineError("AP_OUTBOUND_USE_SHIPMENT", "Use the Outbound page to ship an AP product");
  if (quantityType !== "accountable") {
    return lineError("AP_ACCOUNTABLE_ONLY", "AP products count toward the accountable quantity only");
  }
  if (parseInt(quantityChange) !== serials.length) {
    return lineError("SERIAL_COUNT_MISMATCH", `Quantity ${quantityChange} does not match the serial count ${serials.length}`,
      { quantity: parseInt(quantityChange), serials: serials.length });
  }

  const errors = [];
  const plan = [];
  for (const raw of serials) {
    const sn = normalizeSerial(raw);
    if (!sn) { errors.push(serialIssue(undefined, "SERIAL_EMPTY", "Serial number is empty")); continue; }
    if (seen.has(sn)) { errors.push(serialIssue(sn, "SERIAL_DUPLICATE_IN_BATCH", "Duplicate serial in this batch")); continue; }
    seen.add(sn);

    // serial_number is globally unique, so a new serial must not exist in any warehouse.
    const unit = await conn.get("SELECT id, status, product_id FROM product_units WHERE serial_number = ?", [sn]);
    if (!unit) {
      plan.push({ serial: sn });
    } else if (unit.status === "in_stock") {
      errors.push(serialIssue(sn, "SERIAL_IN_STOCK", "Already in stock"));
    } else if (tagName !== "RETURN") {
      errors.push(serialIssue(sn, "SERIAL_SOLD_USE_RETURN", "Already shipped; use the RETURN tag to take it back"));
    } else if (unit.product_id !== product.id) {
      errors.push(serialIssue(sn, "SERIAL_OTHER_PRODUCT", "Belongs to another product"));
    } else {
      plan.push({ returnUnitId: unit.id });
    }
  }
  return { errors, plan };
}

/** Write a planned inbound line; returns the unit ids for the ledger movement. */
async function applyInbound(conn, plan, product) {
  const ids = [];
  for (const p of plan) {
    if (p.returnUnitId) {
      await conn.run(
        "UPDATE product_units SET status = 'in_stock', project_case = NULL, sold_to = NULL, sold_at = NULL WHERE id = ?",
        [p.returnUnitId],
      );
      ids.push(p.returnUnitId);
    } else {
      ids.push(await insertUnit(conn, product, p.serial));
    }
  }
  return ids;
}

// ── Outbound ─────────────────────────────────────────────────────────────────

/**
 * Validate serials to ship from the warehouse. Returns per-serial errors and the
 * in-stock units grouped by product: [{ productId, sku, unitIds }].
 */
async function planOutbound(conn, rawSerials, warehouseId) {
  const errors = [];
  const groups = new Map();
  const seen = new Set();
  for (const raw of rawSerials) {
    const sn = normalizeSerial(raw);
    if (!sn) { errors.push(serialIssue(undefined, "SERIAL_EMPTY", "Serial number is empty")); continue; }
    if (seen.has(sn)) { errors.push(serialIssue(sn, "SERIAL_DUPLICATE_IN_BATCH", "Duplicate serial in this batch")); continue; }
    seen.add(sn);

    const unit = await findBySerial(conn, sn, warehouseId);
    if (!unit) {
      errors.push(serialIssue(sn, "SERIAL_NOT_IN_WAREHOUSE", "Serial not found in this warehouse"));
    } else if (unit.status !== "in_stock") {
      errors.push(serialIssue(sn, "SERIAL_SOLD", "Already shipped"));
    } else {
      if (!groups.has(unit.product_id)) groups.set(unit.product_id, { productId: unit.product_id, sku: unit.sku, unitIds: [] });
      groups.get(unit.product_id).unitIds.push(unit.id);
    }
  }
  return { errors, groups: [...groups.values()] };
}

async function markSold(conn, unitIds, { projectCase, soldTo, soldAt }) {
  for (const id of unitIds) {
    await conn.run(
      "UPDATE product_units SET status = 'sold', project_case = ?, sold_to = ?, sold_at = ? WHERE id = ?",
      [projectCase, soldTo, soldAt, id],
    );
  }
}

// ── Transfer ─────────────────────────────────────────────────────────────────

/**
 * Validate in-stock serials of the source warehouse against the same SKU in the
 * target warehouse. Returns per-serial errors and the units with their targetProduct.
 */
async function planTransfer(conn, rawSerials, fromWarehouseId, toWarehouseId) {
  const errors = [];
  const units = [];
  for (const raw of rawSerials) {
    const sn = normalizeSerial(raw);
    const unit = await conn.get(
      "SELECT pu.*, p.sku, p.warehouse_id AS src_warehouse_id FROM product_units pu JOIN products p ON pu.product_id = p.id WHERE pu.serial_number = ? AND p.warehouse_id = ?",
      [sn, fromWarehouseId],
    );
    if (!unit) {
      errors.push(serialIssue(sn, "SERIAL_NOT_IN_WAREHOUSE", "Serial not found in this warehouse"));
    } else if (unit.status !== "in_stock") {
      errors.push(serialIssue(sn, "SERIAL_NOT_IN_STOCK", "Not in stock"));
    } else if (unit.src_warehouse_id === toWarehouseId) {
      errors.push(serialIssue(sn, "SERIAL_ALREADY_IN_TARGET", "Already in the target warehouse"));
    } else {
      const targetProduct = await conn.get(
        "SELECT * FROM products WHERE sku = ? AND warehouse_id = ? AND is_deleted = 0",
        [unit.sku, toWarehouseId],
      );
      if (!targetProduct) {
        errors.push(serialIssue(sn, "TARGET_SKU_MISSING", `The target warehouse has no product ${unit.sku}`, { sku: unit.sku }));
      } else {
        units.push({ ...unit, targetProduct });
      }
    }
  }
  return { errors, units };
}

/**
 * Move planned units to their target products (turning those into AP products
 * if needed). Returns the TRANSFER movements: out per source product, in per target.
 */
async function applyTransfer(conn, units, toWarehouse) {
  for (const { targetProduct } of units) {
    if (!targetProduct.track_serial || targetProduct.type !== "ap") {
      await conn.run("UPDATE products SET type = 'ap', track_serial = 1 WHERE id = ?", [targetProduct.id]);
      targetProduct.type = "ap";
      targetProduct.track_serial = 1;
    }
  }
  for (const unit of units) {
    await conn.run(
      "UPDATE product_units SET product_id = ?, warehouse_id = ? WHERE id = ?",
      [unit.targetProduct.id, toWarehouse.id, unit.id],
    );
  }

  const bySource = new Map();
  const byTarget = new Map();
  for (const unit of units) {
    if (!bySource.has(unit.product_id)) bySource.set(unit.product_id, []);
    bySource.get(unit.product_id).push(unit);
    if (!byTarget.has(unit.targetProduct.id)) byTarget.set(unit.targetProduct.id, []);
    byTarget.get(unit.targetProduct.id).push(unit);
  }
  const srcNames = {};
  for (const wid of new Set(units.map((u) => u.src_warehouse_id))) {
    const wh = await conn.get("SELECT name FROM warehouses WHERE id = ?", [wid]);
    srcNames[wid] = wh ? wh.name : String(wid);
  }

  const movements = [];
  for (const [productId, group] of bySource) {
    movements.push({ productId, quantityType: "accountable", delta: -group.length, unitIds: group.map((u) => u.id), remarks: `移倉至 ${toWarehouse.name}` });
  }
  for (const [productId, group] of byTarget) {
    movements.push({ productId, quantityType: "accountable", delta: group.length, unitIds: group.map((u) => u.id), remarks: `從 ${srcNames[group[0].src_warehouse_id]} 移入` });
  }
  return movements;
}

module.exports = {
  ApUnitError,
  normalizeSerial,
  list,
  getById,
  findBySerial,
  getApProduct,
  create,
  edit,
  remove,
  createMany,
  planInbound,
  applyInbound,
  planOutbound,
  markSold,
  planTransfer,
  applyTransfer,
};
