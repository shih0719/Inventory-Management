const db = require("../config/database");

async function getInventory(req, res) {
  try {
    const warehouseId = req.warehouseId;

    const products = await db.all(
      `SELECT sku, name, type, model,
              accountable_quantity, non_accountable_quantity, min_stock
       FROM products
       WHERE warehouse_id = ? AND is_deleted = 0
       ORDER BY sku ASC`,
      [warehouseId]
    );

    const lowStock = products.filter(
      (p) => p.min_stock > 0 &&
             (p.accountable_quantity + p.non_accountable_quantity) < p.min_stock
    );

    return res.json({
      success: true,
      data: {
        products,
        summary: {
          total: products.length,
          low_stock_count: lowStock.length,
          low_stock_items: lowStock,
        },
      },
    });
  } catch (err) {
    console.error("❌ Get inventory report error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { getInventory };
