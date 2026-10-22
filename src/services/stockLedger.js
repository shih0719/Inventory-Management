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
 */
const auditService = require("./auditService");

class LedgerError extends Error {
  /** @param {Array<{index:number, productId:number, reason:string}>} errors */
  constructor(message, errors = []) {
    super(message);
    this.name = "LedgerError";
    this.errors = errors;
  }
}

const QUANTITY_FIELDS = {
  accountable: "accountable_quantity",
  non_accountable: "non_accountable_quantity",
};
const TYPE_LABELS = { accountable: "有帳", non_accountable: "無帳" };

/**
 * Validate movements against current stock without writing anything.
 *
 * @param {{get:Function}} tx
 * @param {Array<Movement>} movements
 * @returns {Promise<{errors: Array<{index:number, productId:number, reason:string}>, planned: Array}>}
 */
async function plan(tx, movements) {
  const errors = [];
  const planned = [];
  const products = new Map();
  const running = new Map(); // `${productId}:${quantityType}` → balance after earlier movements
  const fail = (index, productId, reason) => errors.push({ index, productId, reason });

  for (let index = 0; index < movements.length; index++) {
    const { productId, quantityType, delta, unitIds, kind } = movements[index];
    const field = QUANTITY_FIELDS[quantityType];
    if (!field) {
      fail(index, productId, "quantity_type 必須是 accountable 或 non_accountable");
      continue;
    }
    if (!Number.isInteger(delta) || delta === 0) {
      fail(index, productId, "數量變動必須是非 0 的整數");
      continue;
    }
    if (!products.has(productId)) {
      products.set(productId, await tx.get("SELECT * FROM products WHERE id = ? AND is_deleted = 0", [productId]));
    }
    const product = products.get(productId);
    if (!product) {
      fail(index, productId, "商品不存在");
      continue;
    }

    const key = `${productId}:${quantityType}`;
    const before = running.has(key) ? running.get(key) : product[field];
    const after = before + delta;
    const label = TYPE_LABELS[quantityType];
    if (after < 0) {
      fail(index, productId, `無法出庫：${label}庫存不足（目前：${before}，要出庫：${-delta}）`);
      continue;
    }

    const apAccountable = Boolean(product.track_serial) && quantityType === "accountable";
    if (unitIds && !apAccountable) {
      fail(index, productId, "只有 AP 商品的有帳數量可以帶序號");
      continue;
    }
    if (apAccountable && kind === "reconcile") {
      const { inStock } = await tx.get(
        "SELECT COUNT(*) AS inStock FROM product_units WHERE product_id = ? AND status = 'in_stock'",
        [productId],
      );
      if (Math.abs(after - inStock) >= Math.abs(before - inStock)) {
        fail(index, productId, `AP 商品的有帳數量只能朝在庫序號數（${inStock}）對齊；一般進出貨請在進貨/出貨頁掃描序號`);
        continue;
      }
    } else if (apAccountable && (!Array.isArray(unitIds) || unitIds.length !== Math.abs(delta))) {
      fail(index, productId, "AP 商品的有帳數量必須隨序號異動（序號數需等於數量）");
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
 * @param {{run:Function, get:Function}} tx  from db.transaction()
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
    ? await tx.get("SELECT id FROM tags WHERE id = ?", [tagRef.id])
    : await tx.get("SELECT id FROM tags WHERE name = ?", [tagRef.name]);
  if (!tag) throw new LedgerError(`Tag ${tagRef.id ?? tagRef.name} 不存在`);

  const { errors, planned } = await plan(tx, movements);
  if (errors.length > 0) {
    throw new LedgerError(`庫存異動驗證失敗，共 ${errors.length} 筆錯誤`, errors);
  }

  const results = [];
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
      throw new LedgerError(`商品 ${product.sku} 庫存已變動，請重新送出`);
    }
    await auditService.logAction(actor.userId, "CREATE", "transaction", inserted.id, product.warehouse_id);
    results.push({ transactionId: inserted.id, productId: product.id, before, after });
  }
  return results;
}

module.exports = { apply, check, LedgerError };
