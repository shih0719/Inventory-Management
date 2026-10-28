const db = require("../config/database");
const stockLedger = require("../services/stockLedger");
const auditService = require("../services/auditService");
const apUnits = require("../services/apUnits");
const transactionQuery = require("../services/transactionQuery");
const { formatTimestamps } = require("../utils/formatTimestamps");
const { errorItem } = require("../utils/errorItem");

// Create batch transaction (multiple products at once) — Strict Mode
async function createBatch(req, res) {
  try {
    const { items, tag_id, description } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        code: "ITEMS_REQUIRED",
        params: {},
        error: "Items array is required and must not be empty",
      });
    }

    if (!tag_id) {
      return res.status(400).json({
        success: false,
        code: "TAG_ID_REQUIRED",
        params: {},
        error: "tag_id is required",
      });
    }

    // One error in the list, about `label` (a batch line); `code` lets the frontend translate it.
    const issue = (label, code, params, reason) => errorItem(label, { code, params, reason });

    // ── Phase 1: Pre-validate ALL items before touching the DB ──────────────
    const validationErrors = [];
    const validatedItems = []; // Enriched items ready for execution
    const tag = await db.get("SELECT name FROM tags WHERE id = ?", [tag_id]);
    const seenSerials = new Set(); // AP serials across the whole batch

    for (let i = 0; i < items.length; i++) {
      const { product_id, quantity_change, quantity_type, remarks, serial_numbers } = items[i];
      const index = `#${i + 1}`;

      if (!product_id || quantity_change === undefined || !quantity_type) {
        validationErrors.push(issue(index, "BATCH_ITEM_FIELDS_REQUIRED", {}, "Missing product_id, quantity_change, or quantity_type"));
        continue;
      }

      if (!["accountable", "non_accountable"].includes(quantity_type)) {
        validationErrors.push(issue(index, "INVALID_QUANTITY_TYPE", {}, "quantity_type must be accountable or non_accountable"));
        continue;
      }

      const product = await db.get(
        "SELECT * FROM products WHERE id = ? AND warehouse_id = ? AND is_deleted = 0",
        [product_id, req.warehouseId],
      );

      if (!product) {
        validationErrors.push(issue(index, "PRODUCT_NOT_IN_WAREHOUSE", { productId: product_id },
          `Product ${product_id} not found in this warehouse`));
        continue;
      }

      // AP (serial-tracked) products come in by serial only; see apUnits.planInbound.
      const serialList = Array.isArray(serial_numbers) ? serial_numbers : [];
      let serialPlan = null;
      if (product.track_serial) {
        const planned = await apUnits.planInbound(
          db,
          product,
          { quantityChange: quantity_change, quantityType: quantity_type, serials: serialList, tagName: tag?.name },
          seenSerials,
        );
        if (planned.errors.length > 0) {
          const line = `${index} (${product.name})`;
          validationErrors.push(...planned.errors.map((e) => errorItem(e.serial_number ? `${line} ${e.serial_number}` : line, e)));
          continue;
        }
        serialPlan = planned.plan;
      } else if (serialList.length > 0) {
        validationErrors.push(issue(`${index} (${product.name})`, "NON_AP_SERIALS", {}, "Only AP products can carry serials"));
        continue;
      }

      validatedItems.push({
        label: index,
        product_id,
        product_name: product.name,
        quantity_type,
        quantity_change: parseInt(quantity_change),
        remarks: remarks || "",
        product,
        serialPlan,
      });
    }

    // Quantity rules (non-negative, running balance per product) come from the Stock Ledger.
    // An AP line's serials don't exist yet, so its plan stands in for unitIds — same count.
    const toMovement = (item, unitIds) => ({
      productId: item.product_id,
      quantityType: item.quantity_type,
      delta: item.quantity_change,
      remarks: item.remarks,
      unitIds,
    });
    const quantityErrors = await stockLedger.check(db, validatedItems.map((item) => toMovement(item, item.serialPlan || undefined)));
    for (const { index, code, params, reason } of quantityErrors) {
      const item = validatedItems[index];
      validationErrors.push(issue(`${item.label} (${item.product_name})`, code, params, reason));
    }

    // If ANY item failed validation → reject the entire batch
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_FAILED",
        params: { count: validationErrors.length },
        error: `Validation failed with ${validationErrors.length} error(s); nothing was saved`,
        errors: validationErrors,
      });
    }

    // ── Phase 2: All items passed — execute atomically ──────────────────────
    const timestamp = new Date().getTime();
    const batchNumber = `BATCH-${timestamp}`;

    const batchId = await db.transaction(async (tx) => {
      const createdByUser = req.user?.username || "unknown";
      const batchResult = await tx.run(
        "INSERT INTO batches (batch_number, description, created_by_user, warehouse_id) VALUES (?, ?, ?, ?)",
        [batchNumber, description || "", createdByUser, req.warehouseId],
      );

      await auditService.logAction(
        req.user?.id,
        "CREATE",
        "batch",
        batchResult.id,
        req.warehouseId
      );

      const movements = [];
      for (const item of validatedItems) {
        const unitIds = item.serialPlan ? await apUnits.applyInbound(tx, item.serialPlan, item.product) : undefined;
        movements.push(toMovement(item, unitIds));
      }
      await stockLedger.apply(tx, movements, {
        tag: { id: tag_id },
        source: "batch",
        batchId: batchResult.id,
        actor: { userId: req.user?.id, username: createdByUser },
      });
      return batchResult.id;
    });

    const processedItems = validatedItems.map(({ product_id, product_name, quantity_type, quantity_change }) => ({
      product_id, product_name, quantity_type, quantity_change,
    }));

    res.status(201).json({
      success: true,
      message: `Batch created successfully. Processed ${processedItems.length} items.`,
      data: {
        batch_id: batchId,
        batch_number: batchNumber,
        processed_items: processedItems,
      },
    });
  } catch (error) {
    if (error instanceof stockLedger.LedgerError) {
      return res.status(400).json({
        success: false,
        code: error.code,
        params: error.params,
        error: error.message,
        errors: error.errors.map(({ code, params, reason }) => ({ code, params, error: reason })),
      });
    }
    console.error("Error creating batch:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get all batches
async function getAllBatches(req, res) {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const batches = await db.all(
      `SELECT b.*, 
              COUNT(t.id) as item_count,
              SUM(CASE WHEN t.quantity_change > 0 THEN t.quantity_change ELSE 0 END) as total_in,
              SUM(CASE WHEN t.quantity_change < 0 THEN ABS(t.quantity_change) ELSE 0 END) as total_out
       FROM batches b
       LEFT JOIN transactions t ON b.id = t.batch_id
       WHERE b.warehouse_id = ?
       GROUP BY b.id
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.warehouseId, parseInt(limit), parseInt(offset)],
    );

    res.json({ success: true, data: formatTimestamps(batches) });
  } catch (error) {
    console.error("Error fetching batches:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get batch details with all transactions
async function getBatchById(req, res) {
  try {
    const { id } = req.params;

    const batch = await db.get("SELECT * FROM batches WHERE id = ? AND warehouse_id = ?", [id, req.warehouseId]);

    if (!batch) {
      return res.status(404).json({ success: false, code: "BATCH_NOT_FOUND", params: {}, error: "Batch not found" });
    }

    const transactions = await transactionQuery.list(
      db,
      req.warehouseId,
      { batch_id: id },
      { sort: "created_at", order: "asc" },
    );

    res.json({
      success: true,
      data: {
        ...batch,
        transactions,
      },
    });
  } catch (error) {
    console.error("Error fetching batch:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  createBatch,
  getAllBatches,
  getBatchById,
};
