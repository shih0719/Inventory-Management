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

class ApUnitError extends Error {
  /** @param {number} status HTTP status the controller should answer with */
  constructor(message, status = 400) {
    super(message);
    this.name = "ApUnitError";
    this.status = status;
  }
}

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
  if (!unit) throw new ApUnitError("序號品不存在", 404);
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
  if (!product) throw new ApUnitError("商品不存在");
  if (!product.track_serial) throw new ApUnitError("該商品未開啟序號追蹤");
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
  if (!sn) throw new ApUnitError("serial_number 不可為空");
  try {
    return await insertUnit(conn, product, sn, remarks);
  } catch (e) {
    if (isDuplicate(e)) throw new ApUnitError("序號已存在");
    throw e;
  }
}

/** Shipping fields only on sold units, remarks on any; status never changes here. */
async function edit(conn, unit, { project_case, sold_to, remarks }) {
  const projectCase = project_case !== undefined ? project_case : unit.project_case;
  const soldTo = sold_to !== undefined ? sold_to : unit.sold_to;
  const newRemarks = remarks !== undefined ? remarks : unit.remarks;

  if (unit.status === "sold") {
    if (!projectCase || !projectCase.trim()) throw new ApUnitError("案子（project_case）為必填");
  } else if (project_case !== undefined || sold_to !== undefined) {
    throw new ApUnitError("在庫的序號品沒有出貨資訊可修改");
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
 * Returns the inserted ids and per-serial errors.
 */
async function createMany(conn, product, rawSerials, remarks) {
  const ids = [];
  const errors = [];
  const seen = new Set();
  for (let i = 0; i < rawSerials.length; i++) {
    const sn = normalizeSerial(rawSerials[i]);
    if (!sn) { errors.push({ index: i, serial_number: rawSerials[i], reason: "序號不可為空" }); continue; }
    if (seen.has(sn)) { errors.push({ index: i, serial_number: sn, reason: "批次內序號重複" }); continue; }
    seen.add(sn);
    try {
      ids.push(await insertUnit(conn, product, sn, remarks));
    } catch (e) {
      if (!isDuplicate(e)) throw e;
      errors.push({ index: i, serial_number: sn, reason: "序號已存在" });
    }
  }
  return { ids, errors };
}

/**
 * Validate the serials of one inbound line. New serials are created; a sold
 * serial of the same product comes back to stock only under the RETURN tag.
 * `seen` collects serials across the whole batch.
 * Returns { errors: string[], plan: Array<{ serial } | { returnUnitId }> }.
 */
async function planInbound(conn, product, { quantityChange, quantityType, serials, tagName }, seen) {
  if (serials.length === 0) return { errors: ["AP 商品必須掃描序號進貨"], plan: [] };
  if (parseInt(quantityChange) <= 0) return { errors: ["AP 商品出庫請使用出貨頁"], plan: [] };
  if (quantityType !== "accountable") return { errors: ["AP 商品只能計入有帳數量"], plan: [] };
  if (parseInt(quantityChange) !== serials.length) {
    return { errors: [`數量 ${quantityChange} 與序號數 ${serials.length} 不符`], plan: [] };
  }

  const errors = [];
  const plan = [];
  for (const raw of serials) {
    const sn = normalizeSerial(raw);
    if (!sn) { errors.push("序號不可為空"); continue; }
    if (seen.has(sn)) { errors.push(`${sn} 批次內序號重複`); continue; }
    seen.add(sn);

    // serial_number is globally unique, so a new serial must not exist in any warehouse.
    const unit = await conn.get("SELECT id, status, product_id FROM product_units WHERE serial_number = ?", [sn]);
    if (!unit) {
      plan.push({ serial: sn });
    } else if (unit.status === "in_stock") {
      errors.push(`${sn} 已在庫`);
    } else if (tagName !== "RETURN") {
      errors.push(`${sn} 已出庫，退貨請選「退貨」標籤`);
    } else if (unit.product_id !== product.id) {
      errors.push(`${sn} 屬於其他商品`);
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
    if (!sn) { errors.push({ serial_number: "", reason: "序號不可為空" }); continue; }
    if (seen.has(sn)) { errors.push({ serial_number: sn, reason: "批次內序號重複" }); continue; }
    seen.add(sn);

    const unit = await findBySerial(conn, sn, warehouseId);
    if (!unit) {
      errors.push({ serial_number: sn, reason: "此倉庫找不到序號" });
    } else if (unit.status !== "in_stock") {
      errors.push({ serial_number: sn, reason: "已出庫" });
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
      errors.push({ serial_number: sn, reason: "此倉庫找不到序號" });
    } else if (unit.status !== "in_stock") {
      errors.push({ serial_number: sn, reason: "非在庫狀態" });
    } else if (unit.src_warehouse_id === toWarehouseId) {
      errors.push({ serial_number: sn, reason: "已在目標倉庫" });
    } else {
      const targetProduct = await conn.get(
        "SELECT * FROM products WHERE sku = ? AND warehouse_id = ? AND is_deleted = 0",
        [unit.sku, toWarehouseId],
      );
      if (!targetProduct) {
        errors.push({ serial_number: sn, reason: `目標倉庫無此 SKU (${unit.sku})` });
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
