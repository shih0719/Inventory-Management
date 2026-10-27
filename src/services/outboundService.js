const db = require("../config/database");
const stockLedger = require("./stockLedger");
const auditService = require("./auditService");
const apUnits = require("./apUnits");
const shipmentService = require("./shipmentService");

class OutboundError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = "OutboundError";
    this.errors = errors;
  }
}

/**
 * Validate and execute one outbound (Strict Mode: all-or-nothing).
 *
 * Side effects, inside one DB transaction: inserts a batch, marks AP units sold,
 * writes the quantity changes through the Stock Ledger, and — when the tag is
 * OUTBOUND — inserts a shipment bound to every created transaction.
 *
 * @param {Object} input
 * @param {number} input.tagId
 * @param {string} [input.description]
 * @param {Array<{product_id:number, quantity:number, quantity_type:string, remarks?:string}>} [input.items]
 *        Non-AP lines; quantity is a positive number of units going out.
 * @param {string[]} [input.serials] AP serial numbers.
 * @param {{customer?:string, project_case?:string, shipment_date?:string}} [input.shipment]
 * @param {{userId:number, username:string, warehouseId:number}} actor
 * @throws {OutboundError} when any validation fails (nothing is written).
 */
async function createOutbound(input, actor) {
  const { tagId, description = "", items = [], serials = [], shipment = {} } = input;
  const customer = (shipment.customer || "").trim() || null;
  const projectCase = (shipment.project_case || "").trim() || null;

  if (items.length === 0 && serials.length === 0) {
    throw new OutboundError("至少需要一筆商品或序號");
  }

  // Validation reads and writes share one DB transaction, so what was checked is what gets written.
  return db.transaction(async (tx) => {
    const tag = await tx.get("SELECT id, name FROM tags WHERE id = ?", [tagId]);
    if (!tag) throw new OutboundError(`tag_id ${tagId} 不存在`);

    const errors = [];

    // ── Phase 1a: regular lines ──────────────────────────────────────────────
    const lineMovements = [];
    const lineLabels = [];
    for (let i = 0; i < items.length; i++) {
      const { product_id, quantity, quantity_type, remarks } = items[i];
      const label = `第 ${i + 1} 行`;
      const count = parseInt(quantity, 10);

      if (!product_id || !Number.isInteger(count) || count <= 0) {
        errors.push(`${label}：需要商品與大於 0 的數量`);
        continue;
      }
      if (!["accountable", "non_accountable"].includes(quantity_type)) {
        errors.push(`${label}：quantity_type 必須是 accountable 或 non_accountable`);
        continue;
      }
      const product = await tx.get(
        "SELECT * FROM products WHERE id = ? AND warehouse_id = ? AND is_deleted = 0",
        [product_id, actor.warehouseId]
      );
      if (!product) {
        errors.push(`${label}：此倉庫找不到商品 ${product_id}`);
        continue;
      }
      if (product.track_serial) {
        errors.push(`${label}（${product.sku}）：AP 商品請掃描序號出貨`);
        continue;
      }
      lineMovements.push({ productId: product.id, quantityType: quantity_type, delta: -count, remarks: remarks || description });
      lineLabels.push(`${label}（${product.sku}）`);
    }

    const createShipment = tag.name === 'OUTBOUND';
    const shipmentDate = shipment.shipment_date || new Date().toISOString().split('T')[0];
    if (createShipment) {
      const validDate = /^\d{4}-\d{2}-\d{2}$/.test(shipmentDate) && !Number.isNaN(new Date(shipmentDate).getTime());
      if (!validDate) errors.push('shipment_date 格式錯誤（需為 YYYY-MM-DD）');
    }

    // ── Phase 1b: AP serials ─────────────────────────────────────────────────
    if (serials.length > 0 && !projectCase) {
      errors.push("出貨含 AP 序號時，案子（project_case）為必填");
    }
    const serialPlan = await apUnits.planOutbound(tx, serials, actor.warehouseId);
    errors.push(...serialPlan.errors);
    const apMovements = serialPlan.groups.map(({ productId, unitIds }) => ({
      productId, quantityType: "accountable", delta: -unitIds.length, remarks: description, unitIds,
    }));
    const apLabels = serialPlan.groups.map((g) => g.sku);

    // Quantity rules come from the Stock Ledger; report them together with the errors above.
    for (const { index, reason } of await stockLedger.check(tx, lineMovements)) {
      errors.push(`${lineLabels[index]}：${reason}`);
    }
    for (const { index, reason } of await stockLedger.check(tx, apMovements)) {
      errors.push(`${apLabels[index]}：${reason}（序號品數量與帳面不一致）`);
    }

    if (errors.length > 0) {
      throw new OutboundError(`驗證失敗，共 ${errors.length} 筆錯誤，整批取消`, errors);
    }

    // ── Phase 2: write everything ────────────────────────────────────────────
    const soldAt = new Date().toISOString();
    const batchNumber = `BATCH-${Date.now()}`;
    const batch = await tx.run(
      "INSERT INTO batches (batch_number, description, created_by_user, warehouse_id) VALUES (?, ?, ?, ?)",
      [batchNumber, description, actor.username, actor.warehouseId]
    );
    await auditService.logAction(actor.userId, "CREATE", "batch", batch.id, actor.warehouseId);

    for (const { unitIds } of apMovements) {
      await apUnits.markSold(tx, unitIds, { projectCase, soldTo: customer, soldAt });
    }

    const ctx = { tag: { id: tag.id }, batchId: batch.id, actor };
    const written = [
      ...(await stockLedger.apply(tx, lineMovements, { ...ctx, source: "batch" })),
      ...(await stockLedger.apply(tx, apMovements, { ...ctx, source: "ap-sell" })),
    ];
    const transactionIds = written.map((w) => w.transactionId);

    let shipmentId = null;
    let shipmentNumber = null;
    if (createShipment) {
      ({ id: shipmentId, shipment_number: shipmentNumber } = await shipmentService.create(
        tx,
        { transactionIds, customer, projectCase, shipmentDate },
        actor,
      ));
    }

    return {
      batch_id: batch.id,
      batch_number: batchNumber,
      transaction_ids: transactionIds,
      shipment_id: shipmentId,
      shipment_number: shipmentNumber,
    };
  });
}

module.exports = { createOutbound, OutboundError };
