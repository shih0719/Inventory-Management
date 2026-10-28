const db = require("../config/database");
const stockLedger = require("./stockLedger");
const auditService = require("./auditService");
const apUnits = require("./apUnits");
const shipmentService = require("./shipmentService");
const stockNotifier = require("./stockNotifier");
const { errorItem } = require("../utils/errorItem");

/** Messages are English; `code` + `params` let the frontend show its own text (vite-app/src/lib/i18n.ts). */
class OutboundError extends Error {
  /** @param {Array<{label:string, code:string, params:Object, error:string}>} errors  see utils/errorItem */
  constructor(code, message, params = {}, errors = []) {
    super(message);
    this.name = "OutboundError";
    this.code = code;
    this.params = params;
    this.errors = errors;
  }
}

/** One error in the list, about `label` (a line or an AP SKU). */
const issue = (label, code, params, reason) => errorItem(label, { code, params, reason });

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
    throw new OutboundError("OUTBOUND_EMPTY", "At least one item or serial is required");
  }

  // Validation reads and writes share one DB transaction, so what was checked is what gets written.
  return db.transaction(async (tx) => {
    const tag = await tx.get("SELECT id, name FROM tags WHERE id = ?", [tagId]);
    if (!tag) throw new OutboundError("TAG_NOT_FOUND", `Tag ${tagId} not found`, { tag: tagId });

    const errors = [];

    // ── Phase 1a: regular lines ──────────────────────────────────────────────
    const lineMovements = [];
    const lineLabels = [];
    for (let i = 0; i < items.length; i++) {
      const { product_id, quantity, quantity_type, remarks } = items[i];
      const label = `#${i + 1}`;
      const count = parseInt(quantity, 10);

      if (!product_id || !Number.isInteger(count) || count <= 0) {
        errors.push(issue(label, "LINE_QUANTITY_REQUIRED", {}, "A product and a quantity greater than 0 are required"));
        continue;
      }
      if (!["accountable", "non_accountable"].includes(quantity_type)) {
        errors.push(issue(label, "INVALID_QUANTITY_TYPE", {}, "quantity_type must be accountable or non_accountable"));
        continue;
      }
      const product = await tx.get(
        "SELECT * FROM products WHERE id = ? AND warehouse_id = ? AND is_deleted = 0",
        [product_id, actor.warehouseId]
      );
      if (!product) {
        errors.push(issue(label, "PRODUCT_NOT_IN_WAREHOUSE", { productId: product_id },
          `Product ${product_id} not found in this warehouse`));
        continue;
      }
      if (product.track_serial) {
        errors.push(issue(`${label} (${product.sku})`, "AP_SCAN_SERIALS", {}, "Scan serials to ship an AP product"));
        continue;
      }
      lineMovements.push({ productId: product.id, quantityType: quantity_type, delta: -count, remarks: remarks || description });
      lineLabels.push(`${label} (${product.sku})`);
    }

    const createShipment = tag.name === 'OUTBOUND';
    const shipmentDate = shipment.shipment_date || new Date().toISOString().split('T')[0];
    if (createShipment) {
      const validDate = /^\d{4}-\d{2}-\d{2}$/.test(shipmentDate) && !Number.isNaN(new Date(shipmentDate).getTime());
      if (!validDate) {
        errors.push({ code: "INVALID_SHIPMENT_DATE", params: {}, error: "shipment_date must be YYYY-MM-DD" });
      }
    }

    // ── Phase 1b: AP serials ─────────────────────────────────────────────────
    if (serials.length > 0 && !projectCase) {
      errors.push({ code: "PROJECT_CASE_REQUIRED", params: {}, error: "project_case is required when shipping AP serials" });
    }
    const serialPlan = await apUnits.planOutbound(tx, serials, actor.warehouseId);
    errors.push(...serialPlan.errors.map((e) => errorItem(e.serial_number, e)));
    const apMovements = serialPlan.groups.map(({ productId, unitIds }) => ({
      productId, quantityType: "accountable", delta: -unitIds.length, remarks: description, unitIds,
    }));
    const apLabels = serialPlan.groups.map((g) => g.sku);

    // Quantity rules come from the Stock Ledger; report them together with the errors above.
    for (const { index, code, params, reason } of await stockLedger.check(tx, lineMovements)) {
      errors.push(issue(lineLabels[index], code, params, reason));
    }
    for (const { index, code, params, reason } of await stockLedger.check(tx, apMovements)) {
      errors.push(issue(apLabels[index], code, params, reason));
    }

    if (errors.length > 0) {
      throw new OutboundError("VALIDATION_FAILED", `Validation failed with ${errors.length} error(s); nothing was saved`,
        { count: errors.length }, errors);
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
      stockNotifier.annotate({ shipment: { id: shipmentId, shipmentNumber, customer, projectCase, shipmentDate } });
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
