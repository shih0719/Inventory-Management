const db = require("../config/database");

// Get all products with optional filtering
async function getAll(req, res) {
  try {
    const { sku, name, tag, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let countSql = `
            SELECT COUNT(DISTINCT p.id) as total
            FROM products p
            LEFT JOIN transactions t ON p.id = t.product_id
            WHERE p.is_deleted = 0
        `;
    let sql = `
            SELECT DISTINCT p.* 
            FROM products p
            LEFT JOIN transactions t ON p.id = t.product_id
            WHERE p.is_deleted = 0
        `;
    const params = [];
    const countParams = [];

    // If both sku and name are provided with the same value (from search),
    // use OR logic to search in both fields
    if (sku && name && sku === name) {
      sql += " AND (p.sku LIKE ? OR p.name LIKE ?)";
      countSql += " AND (p.sku LIKE ? OR p.name LIKE ?)";
      const searchPattern = `%${sku}%`;
      params.push(searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern);
    } else {
      // Separate filters use AND logic
      if (sku) {
        sql += " AND p.sku LIKE ?";
        countSql += " AND p.sku LIKE ?";
        params.push(`%${sku}%`);
        countParams.push(`%${sku}%`);
      }

      if (name) {
        sql += " AND p.name LIKE ?";
        countSql += " AND p.name LIKE ?";
        params.push(`%${name}%`);
        countParams.push(`%${name}%`);
      }
    }

    if (tag) {
      sql += " AND t.tag_id = ?";
      countSql += " AND t.tag_id = ?";
      params.push(tag);
      countParams.push(tag);
    }

    sql += " ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), offset);

    const totalResult = await db.get(countSql, countParams);
    const products = await db.all(sql, params);

    res.json({
      success: true,
      data: products,
      pagination: {
        total: totalResult.total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalResult.total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get single product by ID
async function getById(req, res) {
  try {
    const { id } = req.params;
    const product = await db.get(
      "SELECT * FROM products WHERE id = ? AND is_deleted = 0",
      [id],
    );

    if (!product) {
      return res
        .status(404)
        .json({ success: false, error: "Product not found" });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Create new product
async function create(req, res) {
  try {
    const {
      type,
      sku,
      name,
      model,
      accountable_quantity,
      non_accountable_quantity,
    } = req.body;

    if (!type || !sku || !name) {
      return res.status(400).json({
        success: false,
        error: "Type, SKU, and Name are required",
      });
    }

    // Check if SKU already exists
    const existing = await db.get(
      "SELECT id FROM products WHERE sku = ? AND is_deleted = 0",
      [sku],
    );

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "此 SKU 已存在",
      });
    }

    const result = await db.run(
      `INSERT INTO products (type, sku, name, model, accountable_quantity, non_accountable_quantity) 
             VALUES (?, ?, ?, ?, ?, ?)`,
      [
        type,
        sku,
        name,
        model || "",
        accountable_quantity || 0,
        non_accountable_quantity || 0,
      ],
    );

    const newProduct = await db.get("SELECT * FROM products WHERE id = ?", [
      result.id,
    ]);
    res.status(201).json({ success: true, data: newProduct });
  } catch (error) {
    console.error("Error creating product:", error);
    if (error.message.includes("UNIQUE constraint failed")) {
      return res.status(400).json({
        success: false,
        error: "此 SKU 已存在",
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
}

// Update product
async function update(req, res) {
  try {
    const { id } = req.params;
    const { type, name, model } = req.body;

    const product = await db.get(
      "SELECT * FROM products WHERE id = ? AND is_deleted = 0",
      [id],
    );
    if (!product) {
      return res
        .status(404)
        .json({ success: false, error: "Product not found" });
    }

    await db.run(
      `UPDATE products 
             SET type = ?, name = ?, model = ?
             WHERE id = ?`,
      [type || product.type, name || product.name, model || product.model, id],
    );

    const updatedProduct = await db.get("SELECT * FROM products WHERE id = ?", [
      id,
    ]);
    res.json({ success: true, data: updatedProduct });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Soft delete product
async function softDelete(req, res) {
  try {
    const { id } = req.params;

    const product = await db.get(
      "SELECT * FROM products WHERE id = ? AND is_deleted = 0",
      [id],
    );
    if (!product) {
      return res
        .status(404)
        .json({ success: false, error: "Product not found" });
    }

    await db.run("UPDATE products SET is_deleted = 1 WHERE id = ?", [id]);
    res.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  softDelete,
};
