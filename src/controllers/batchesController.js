const db = require("../config/database");
const quantityStateService = require("../services/quantityStateService");
const auditService = require("../services/auditService");
const { formatTimestamps } = require("../utils/formatTimestamps");

// Create batch transaction (multiple products at once) — Strict Mode
async function createBatch(req, res) {
  try {
    const { items, tag_id, description } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Items array is required and must not be empty",
      });
    }

    if (!tag_id) {
      return res.status(400).json({
        success: false,
        error: "tag_id is required",
      });
    }

    // ── Phase 1: Pre-validate ALL items before touching the DB ──────────────
    const validationErrors = [];
    const validatedItems = []; // Enriched items ready for execution

    for (let i = 0; i < items.length; i++) {
      const { product_id, quantity_change, quantity_type, remarks } = items[i];
      const index = `Item[${i}] (product_id: ${product_id ?? "N/A"})`;

      if (!product_id || quantity_change === undefined || !quantity_type) {
        validationErrors.push(`${index}: Missing product_id, quantity_change, or quantity_type`);
        continue;
      }

      if (!["accountable", "non_accountable"].includes(quantity_type)) {
        validationErrors.push(`${index}: quantity_type must be 'accountable' or 'non_accountable'`);
        continue;
      }

      const product = await db.get(
        "SELECT * FROM products WHERE id = ? AND is_deleted = 0",
        [product_id],
      );

      if (!product) {
        validationErrors.push(`${index}: Product not found`);
        continue;
      }

      const currentQuantity =
        quantity_type === "accountable"
          ? product.accountable_quantity
          : product.non_accountable_quantity;

      // Validate using QuantityState module
      const validation = quantityStateService.validate(currentQuantity, quantity_change, {
        quantityType: quantity_type,
      });

      if (!validation.ok) {
        validationErrors.push(`${index} (${product.name}): ${validation.reason}`);
        continue;
      }

      const newQuantity = validation.newQuantity;

      validatedItems.push({
        product_id,
        product_name: product.name,
        quantity_type,
        quantity_change: parseInt(quantity_change),
        remarks: remarks || "",
        quantityField: quantity_type === "accountable" ? "accountable_quantity" : "non_accountable_quantity",
        newQuantity,
      });
    }

    // If ANY item failed validation → reject the entire batch
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: `批次驗證失敗，共 ${validationErrors.length} 筆錯誤，整批取消`,
        errors: validationErrors,
      });
    }

    // ── Phase 2: All items passed — execute atomically ──────────────────────
    const timestamp = new Date().getTime();
    const batchNumber = `BATCH-${timestamp}`;

    await db.run("BEGIN TRANSACTION");

    try {
      const createdByUser = req.user?.username || "unknown";
      const batchResult = await db.run(
        "INSERT INTO batches (batch_number, description, created_by_user) VALUES (?, ?, ?)",
        [batchNumber, description || "", createdByUser],
      );
      const batchId = batchResult.id;

      auditService.logAction(
        req.user?.id,
        "CREATE",
        "batch",
        batchId,
        req.warehouseId
      );

      for (const item of validatedItems) {
        const txResult = await db.run(
          `INSERT INTO transactions (product_id, tag_id, batch_id, quantity_change, quantity_type, remarks, created_by_user)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            item.product_id,
            tag_id,
            batchId,
            item.quantity_change,
              item.quantity_type,
            `[${item.quantity_type === "accountable" ? "有帳" : "無帳"}] ${item.remarks}`,
            createdByUser,
          ],
        );

        // Log transaction creation
        auditService.logAction(
          req.user?.id,
          "CREATE",
          "transaction",
          txResult.id
        );

        await db.run(
          `UPDATE products SET ${item.quantityField} = ? WHERE id = ?`,
          [item.newQuantity, item.product_id],
        );
      }

      await db.run("COMMIT");

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
      await db.run("ROLLBACK");
      throw error;
    }
  } catch (error) {
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
       GROUP BY b.id
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)],
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

    const batch = await db.get("SELECT * FROM batches WHERE id = ?", [id]);

    if (!batch) {
      return res.status(404).json({ success: false, error: "Batch not found" });
    }

    const transactions = await db.all(
      `SELECT t.*, 
              p.name as product_name, 
              p.sku, 
              tg.display_name as tag_name, 
              tg.color as tag_color
       FROM transactions t
       JOIN products p ON t.product_id = p.id
       JOIN tags tg ON t.tag_id = tg.id
       WHERE t.batch_id = ?
       ORDER BY t.created_at ASC`,
      [id],
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
