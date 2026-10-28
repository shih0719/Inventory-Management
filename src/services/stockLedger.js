/**
 * Stock Ledger — the only module that changes Product quantities.
 *
 * Every quantity change is a movement. `apply` validates all movements of a call
 * together, then writes one Transaction per movement, updates the product's
 * quantity field and records the audit log. See docs/adr/0003-stock-ledger.md.
 *
 * It does not open a DB transaction: callers pass the `tx` from db.transaction(),
 * so the ledger's writes commit together with their own (batch, AP status, shipment).
 * It does not check AP serial status — only that AP accountable stock moves with serials.
 * Its changes are recorded for stockNotifier.js, which notifies only when the transaction also creates a shipment.
 */
const auditService = require("./auditService");
const stockNotifier = require("./stockNotifier");

/**
 * Messages are English; `code` + `params` let the frontend show its own text (vite-app/src/lib/i18n.ts).
 * @typedef {{index:number, productId:number, code:string, params:Object, reason:string}} Issue
 */
class LedgerError extends Error {
  /** @param {Array<Issue>} errors  per-movement issues */
  constructor(code, message, params = {}, errors = []) {
    super(message);
    this.name = "LedgerError";
    this.code = code;
    this.params = params;
    this.errors = errors;
  }

  /** 400 response body: the first movement's issue, or the error itself when no movement failed. */
  toBody() {
    const [first] = this.errors;
    return first
      ? { success: false, code: first.code, params: first.params, error: first.reason }
      : { success: false, code: this.code, params: this.params, error: this.message };
  }
}

const QUANTITY_FIELDS = {
  accountable: "accountable_quantity",
  non_accountable: "non_accountable_quantity",
};
const TYPE_LABELS = { accountable: "有帳", non_accountable: "無帳" };
const TYPE_NAMES = { accountable: "accountable", non_accountable: "non-accountable" };

/**
 * Validate movements against current stock without writing anything.
 *
 * @param {{get:Function}} tx
 * @param {Array<Movement>} movements
 * @returns {Promise<{errors: Array<Issue>, planned: Array}>}
 */
async function plan(tx, movements) {
  const errors = [];
  const planned = [];
  const products = new Map();
  const running = new Map(); // `${productId}:${quantityType}` → balance after earlier movements
  const fail = (index, productId, code, params, reason) => errors.push({ index, productId, code, params, reason });

  for (let index = 0; index < movements.length; index++) {
    const { productId, quantityType, delta, unitIds, kind } = movements[index];
    const field = QUANTITY_FIELDS[quantityType];
    if (!field) {
      fail(index, productId, "INVALID_QUANTITY_TYPE", {}, "quantity_type must be accountable or non_accountable");
      continue;
    }
    if (!Number.isInteger(delta) || delta === 0) {
      fail(index, productId, "INVALID_DELTA", {}, "Quantity change must be a non-zero integer");
      continue;
    }
    if (!products.has(productId)) {
      products.set(productId, await tx.get("SELECT * FROM products WHERE id = ? AND is_deleted = 0", [productId]));
    }
    const product = products.get(productId);
    if (!product) {
      fail(index, productId, "PRODUCT_NOT_FOUND", {}, "Product not found");
      continue;
    }

    const key = `${productId}:${quantityType}`;
    const before = running.has(key) ? running.get(key) : product[field];
    const after = before + delta;
    if (after < 0) {
      fail(index, productId, "INSUFFICIENT_STOCK", { quantityType, current: before, requested: -delta },
        `Insufficient ${TYPE_NAMES[quantityType]} stock (current: ${before}, requested: ${-delta})`);
      continue;
    }

    const apAccountable = Boolean(product.track_serial) && quantityType === "accountable";
    if (unitIds && !apAccountable) {
      fail(index, productId, "SERIALS_NOT_ALLOWED", {}, "Only the accountable quantity of an AP product can carry serials");
      continue;
    }
    if (apAccountable && kind === "reconcile") {
      const { inStock } = await tx.get(
        "SELECT COUNT(*) AS inStock FROM product_units WHERE product_id = ? AND status = 'in_stock'",
        [productId],
      );
      if (Math.abs(after - inStock) >= Math.abs(before - inStock)) {
        fail(index, productId, "AP_RECONCILE_DIRECTION", { inStock },
          `AP accountable quantity can only move toward the in-stock serial count (${inStock}); scan serials on the Inbound/Outbound page for regular stock movements`);
        continue;
      }
    } else if (apAccountable && (!Array.isArray(unitIds) || unitIds.length !== Math.abs(delta))) {
      fail(index, productId, "AP_SERIALS_REQUIRED", {},
        "AP accountable quantity must move with serials (serial count must equal the quantity)");
      continue;
    }

    running.set(key, after);
    planned.push({ movement: movements[index], product, field, before, after });
  }
  return { errors, planned };
}

/**
 * Validation errors for `movements`, or [] if `apply` would accept them.
 * Callers use it to report quantity errors together with their own before writing.
 */
async function check(tx, movements) {
  return (await plan(tx, movements)).errors;
}

/**
 * @typedef {Object} Movement
 * @property {number} productId
 * @property {'accountable'|'non_accountable'} quantityType
 * @property {number} delta          Signed, non-zero integer.
 * @property {number[]} [unitIds]    AP serials moved; required for AP accountable stock.
 * @property {'reconcile'} [kind]    AP accountable change without serials, only toward the in-stock serial count.
 * @property {string} [remarks]
 * @property {number} [locationId]
 */

/**
 * Validate and write `movements` inside the caller's DB transaction.
 *
 * @param {{run:Function, get:Function, all:Function}} tx  from db.transaction()
 * @param {Array<Movement>} movements
 * @param {Object} ctx
 * @param {{id:number}|{name:string}} ctx.tag
 * @param {string} ctx.source
 * @param {{userId:number, username:string}} ctx.actor
 * @param {number} [ctx.batchId]
 * @returns {Promise<Array<{transactionId:number, productId:number, before:number, after:number}>>}
 * @throws {LedgerError} when any movement fails validation (nothing is written).
 */
async function apply(tx, movements, ctx) {
  const { tag: tagRef, source, actor, batchId = null } = ctx;
  const tag = tagRef.id != null
    ? await tx.get("SELECT id, name FROM tags WHERE id = ?", [tagRef.id])
    : await tx.get("SELECT id, name FROM tags WHERE name = ?", [tagRef.name]);
  if (!tag) {
    throw new LedgerError("TAG_NOT_FOUND", `Tag ${tagRef.id ?? tagRef.name} not found`, { tag: tagRef.id ?? tagRef.name });
  }

  const { errors, planned } = await plan(tx, movements);
  if (errors.length > 0) {
    throw new LedgerError("LEDGER_INVALID", `${errors.length} stock movement(s) failed validation`, { count: errors.length }, errors);
  }

  const results = [];
  const notified = [];
  for (const { movement, product, field, before, after } of planned) {
    const inserted = await tx.run(
      `INSERT INTO transactions (product_id, tag_id, batch_id, quantity_change, quantity_type, quantity_before, quantity_after, source, location_id, remarks, product_unit_ids, warehouse_id, created_by_user)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product.id, tag.id, batchId, movement.delta, movement.quantityType, before, after, source,
        movement.locationId ?? null,
        `[${TYPE_LABELS[movement.quantityType]}] ${movement.remarks || ""}`,
        movement.unitIds ? JSON.stringify(movement.unitIds) : null,
        product.warehouse_id, actor.username,
      ],
    );
    // Guarded by the balance we validated against, so a stale read can never overwrite stock.
    const updated = await tx.run(
      `UPDATE products SET ${field} = ? WHERE id = ? AND ${field} = ?`,
      [after, product.id, before],
    );
    if (updated.changes !== 1) {
      throw new LedgerError("STOCK_CHANGED", `Stock of ${product.sku} changed, please submit again`, { sku: product.sku });
    }
    await auditService.logAction(actor.userId, "CREATE", "transaction", inserted.id, product.warehouse_id);
    results.push({ transactionId: inserted.id, productId: product.id, before, after });
    notified.push({
      transactionId: inserted.id, sku: product.sku, name: product.name, warehouseId: product.warehouse_id,
      quantityType: movement.quantityType, delta: movement.delta, before, after, remarks: movement.remarks || "",
    });
  }
  if (notified.length === 0) return results;

  const warehouseIds =[...new Set(notified.map((m) => m.warehouseId))];
  const warehouses = await tx.all(
    `SELECT id, name FROM warehouses WHERE id IN (${warehouseIds.map(() => "?").join(", ")})`,
    warehouseIds,
  );
  const warehouseNames = new Map(warehouses.map((w) => [w.id, w.name]));
  for (const m of notified) m.warehouse = warehouseNames.get(m.warehouseId) ?? null;
  stockNotifier.record({ source, tag: tag.name, actor: actor.username, batchId, movements: notified });
  return results;
}

module.exports = { apply, check, LedgerError };
