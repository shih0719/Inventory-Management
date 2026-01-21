const db = require("../config/database");

// Create batch transaction (multiple products at once)
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

    // Generate batch number
    const timestamp = new Date().getTime();
    const batchNumber = `BATCH-${timestamp}`;

    // Start transaction
    await db.run("BEGIN TRANSACTION");

    try {
      // Create batch record
      const batchResult = await db.run(
        "INSERT INTO batches (batch_number, description) VALUES (?, ?)",
        [batchNumber, description || ""],
      );

      const batchId = batchResult.id;
      const processedItems = [];
      const errors = [];

      // Process each item
      for (const item of items) {
        const { product_id, quantity_change, quantity_type, remarks } = item;

        if (!product_id || quantity_change === undefined || !quantity_type) {
          errors.push(
            `Product ID ${product_id}: Missing product_id, quantity_change, or quantity_type`,
          );
          continue;
        }

        if (!["accountable", "non_accountable"].includes(quantity_type)) {
          errors.push(
            `Product ID ${product_id}: quantity_type must be 'accountable' or 'non_accountable'`,
          );
          continue;
        }

        // Check if product exists
        const product = await db.get(
          "SELECT * FROM products WHERE id = ? AND is_deleted = 0",
          [product_id],
        );

        if (!product) {
          errors.push(`Product ID ${product_id}: Product not found`);
          continue;
        }

        // Determine which quantity field to update
        const quantityField =
          quantity_type === "accountable"
            ? "accountable_quantity"
            : "non_accountable_quantity";
        const currentQuantity =
          quantity_type === "accountable"
            ? product.accountable_quantity
            : product.non_accountable_quantity;

        // Calculate new quantity
        const newQuantity = currentQuantity + parseInt(quantity_change);

        if (newQuantity < 0) {
          errors.push(
            `Product ID ${product_id}: Insufficient ${
              quantity_type === "accountable" ? "有帳" : "無帳"
            } quantity in stock`,
          );
          continue;
        }

        // Insert transaction record
        await db.run(
          `INSERT INTO transactions (product_id, tag_id, batch_id, quantity_change, remarks) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            product_id,
            tag_id,
            batchId,
            quantity_change,
            `[${quantity_type === "accountable" ? "有帳" : "無帳"}] ${
              remarks || ""
            }`,
          ],
        );

        // Update product quantity
        await db.run(`UPDATE products SET ${quantityField} = ? WHERE id = ?`, [
          newQuantity,
          product_id,
        ]);

        processedItems.push({
          product_id,
          product_name: product.name,
          quantity_type,
          quantity_change,
        });
      }

      // If all items failed, rollback
      if (processedItems.length === 0) {
        await db.run("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: "All items failed to process",
          errors,
        });
      }

      // Commit transaction
      await db.run("COMMIT");

      res.status(201).json({
        success: true,
        message: `Batch created successfully. Processed ${processedItems.length} items.`,
        data: {
          batch_id: batchId,
          batch_number: batchNumber,
          processed_items: processedItems,
          errors: errors.length > 0 ? errors : undefined,
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

    res.json({ success: true, data: batches });
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
