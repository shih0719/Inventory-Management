const db = require("../config/database");

// Create new transaction and update product quantity
async function create(req, res) {
  try {
    const { product_id, tag_id, quantity_change, remarks } = req.body;

    if (!product_id || !tag_id || quantity_change === undefined) {
      return res.status(400).json({
        success: false,
        error: "product_id, tag_id, and quantity_change are required",
      });
    }

    // Check if product exists
    const product = await db.get(
      "SELECT * FROM products WHERE id = ? AND is_deleted = 0",
      [product_id],
    );

    if (!product) {
      return res
        .status(404)
        .json({ success: false, error: "Product not found" });
    }

    // Calculate new quantity
    const newQuantity = product.quantity + parseInt(quantity_change);

    if (newQuantity < 0) {
      return res.status(400).json({
        success: false,
        error: "Insufficient quantity in stock",
      });
    }

    // Start transaction
    await db.run("BEGIN TRANSACTION");

    try {
      // Insert transaction record
      const result = await db.run(
        `INSERT INTO transactions (product_id, tag_id, quantity_change, remarks) 
                 VALUES (?, ?, ?, ?)`,
        [product_id, tag_id, quantity_change, remarks || ""],
      );

      // Update product quantity
      await db.run("UPDATE products SET quantity = ? WHERE id = ?", [
        newQuantity,
        product_id,
      ]);

      // Commit transaction
      await db.run("COMMIT");

      const transaction = await db.get(
        "SELECT * FROM transactions WHERE id = ?",
        [result.id],
      );
      res.status(201).json({ success: true, data: transaction });
    } catch (error) {
      await db.run("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("Error creating transaction:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get transactions for a specific product
async function getByProduct(req, res) {
  try {
    const { productId } = req.params;

    const transactions = await db.all(
      `SELECT t.*, p.name as product_name, p.sku, tg.display_name as tag_name, tg.color as tag_color
             FROM transactions t
             JOIN products p ON t.product_id = p.id
             JOIN tags tg ON t.tag_id = tg.id
             WHERE t.product_id = ?
             ORDER BY t.created_at DESC`,
      [productId],
    );

    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get all transactions with optional filtering
async function getAll(req, res) {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const transactions = await db.all(
      `SELECT t.*, p.name as product_name, p.sku, tg.display_name as tag_name, tg.color as tag_color
             FROM transactions t
             JOIN products p ON t.product_id = p.id
             JOIN tags tg ON t.tag_id = tg.id
             ORDER BY t.created_at DESC
             LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)],
    );

    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  create,
  getByProduct,
  getAll,
};
