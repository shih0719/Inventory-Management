const db = require("../config/database");

// Create new transaction and update product quantity
async function create(req, res) {
  try {
    const { product_id, tag_id, quantity_change, quantity_type, remarks } =
      req.body;

    if (
      !product_id ||
      !tag_id ||
      quantity_change === undefined ||
      !quantity_type
    ) {
      return res.status(400).json({
        success: false,
        error:
          "product_id, tag_id, quantity_change, and quantity_type are required",
      });
    }

    if (!["accountable", "non_accountable"].includes(quantity_type)) {
      return res.status(400).json({
        success: false,
        error: "quantity_type must be 'accountable' or 'non_accountable'",
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
      return res.status(400).json({
        success: false,
        error: `Insufficient ${
          quantity_type === "accountable" ? "有帳" : "無帳"
        } quantity in stock`,
      });
    }

    // Start transaction
    await db.run("BEGIN TRANSACTION");

    try {
      // Insert transaction record
      const result = await db.run(
        `INSERT INTO transactions (product_id, tag_id, quantity_change, remarks) 
                 VALUES (?, ?, ?, ?)`,
        [
          product_id,
          tag_id,
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
      `SELECT t.*, 
              p.name as product_name, 
              p.sku, 
              tg.display_name as tag_name, 
              tg.color as tag_color,
              b.batch_number
       FROM transactions t
       JOIN products p ON t.product_id = p.id
       JOIN tags tg ON t.tag_id = tg.id
       LEFT JOIN batches b ON t.batch_id = b.id
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
    const {
      limit = 100,
      offset = 0,
      sku,
      tag_id,
      min_quantity,
      max_quantity,
    } = req.query;

    let sql = `
      SELECT t.*, 
             p.name as product_name, 
             p.sku, 
             tg.display_name as tag_name, 
             tg.color as tag_color,
             b.batch_number
      FROM transactions t
      JOIN products p ON t.product_id = p.id
      JOIN tags tg ON t.tag_id = tg.id
      LEFT JOIN batches b ON t.batch_id = b.id
      WHERE 1=1
    `;

    const params = [];

    // Filter by SKU
    if (sku) {
      sql += " AND p.sku LIKE ?";
      params.push(`%${sku}%`);
    }

    // Filter by tag
    if (tag_id) {
      sql += " AND t.tag_id = ?";
      params.push(parseInt(tag_id));
    }

    // Filter by minimum quantity (for in-stock/positive changes)
    if (min_quantity !== undefined) {
      sql += " AND t.quantity_change >= ?";
      params.push(parseInt(min_quantity));
    }

    // Filter by maximum quantity (for out-of-stock/negative changes)
    if (max_quantity !== undefined) {
      sql += " AND t.quantity_change <= ?";
      params.push(parseInt(max_quantity));
    }

    sql += " ORDER BY t.created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));

    const transactions = await db.all(sql, params);

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
