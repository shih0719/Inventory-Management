const db = require("../config/database");
const auditService = require("../services/auditService");

// GET /api/products/lookup?sku=X&warehouse_id=Y
async function lookup(req, res) {
  try {
    const { sku, warehouse_id } = req.query;
    if (!sku || !warehouse_id) {
      return res.status(400).json({ success: false, error: "sku 和 warehouse_id 為必填" });
    }
    const product = await db.get(
      "SELECT * FROM products WHERE sku = ? AND warehouse_id = ? AND is_deleted = 0",
      [sku.trim().toUpperCase(), warehouse_id]
    );
    res.json({ success: true, data: product || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get all products with optional filtering
async function getAll(req, res) {
  try {
    const { sku, name, model, tag, low_stock, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const warehouseId = req.warehouseId;

    let countSql = `
            SELECT COUNT(DISTINCT p.id) as total
            FROM products p
            LEFT JOIN transactions t ON p.id = t.product_id
            WHERE p.is_deleted = 0 AND p.warehouse_id = ?
        `;
    let sql = `
            SELECT DISTINCT p.*,
              (SELECT COUNT(*) FROM product_units pu WHERE pu.product_id = p.id AND pu.status = 'in_stock') AS ap_in_stock_count
            FROM products p
            LEFT JOIN transactions t ON p.id = t.product_id
            WHERE p.is_deleted = 0 AND p.warehouse_id = ?
        `;
    const params = [warehouseId];
    const countParams = [warehouseId];

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

      if (model) {
        sql += " AND p.model LIKE ?";
        countSql += " AND p.model LIKE ?";
        params.push(`%${model}%`);
        countParams.push(`%${model}%`);
      }
    }

    if (tag) {
      sql += " AND t.tag_id = ?";
      countSql += " AND t.tag_id = ?";
      params.push(tag);
      countParams.push(tag);
    }

    if (low_stock === "true") {
      sql += " AND p.min_stock > 0 AND p.accountable_quantity < p.min_stock";
      countSql += " AND p.min_stock > 0 AND p.accountable_quantity < p.min_stock";
    }

    sql += " ORDER BY CASE WHEN p.min_stock > 0 AND p.accountable_quantity < p.min_stock THEN 0 ELSE 1 END ASC, p.created_at DESC LIMIT ? OFFSET ?";
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
      min_stock,
      track_serial,
      warehouse_id: bodyWarehouseId,
    } = req.body;

    if (!sku || !name) {
      return res.status(400).json({
        success: false,
        error: "SKU and Name are required",
      });
    }

    // type is derived from track_serial (they describe the same concept:
    // AP serial-number tracking). type='ap' iff track_serial is truthy.
    const resolvedType = track_serial ? "ap" : "normal";

    // Resolve warehouse_id: from body, or header (Phase 2), or Default warehouse
    let warehouse_id = bodyWarehouseId || (req.warehouseId) || null;
    if (!warehouse_id) {
      const defaultWh = await db.get("SELECT id FROM warehouses WHERE name = 'Default'");
      warehouse_id = defaultWh ? defaultWh.id : null;
    }

    // Check if SKU already exists in same warehouse
    const existing = await db.get(
      "SELECT id FROM products WHERE sku = ? AND warehouse_id = ? AND is_deleted = 0",
      [sku, warehouse_id],
    );

    if (existing) {
      return res.status(409).json({
        success: false,
        error: "此 SKU 已存在",
      });
    }

    const result = await db.run(
      `INSERT INTO products (warehouse_id, type, sku, name, model, accountable_quantity, non_accountable_quantity, min_stock, track_serial)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        warehouse_id,
        resolvedType,
        sku,
        name,
        model || "",
        accountable_quantity || 0,
        non_accountable_quantity || 0,
        min_stock != null ? parseInt(min_stock) : 0,
        track_serial ? 1 : 0,
      ],
    );

    const newProduct = await db.get("SELECT * FROM products WHERE id = ?", [
      result.id,
    ]);
    await auditService.logAction(req.user?.id, "CREATE", "product", result.id, newProduct.warehouse_id);
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
    const { type, name, model, min_stock, track_serial } = req.body;

    const product = await db.get(
      "SELECT * FROM products WHERE id = ? AND is_deleted = 0",
      [id],
    );
    if (!product) {
      return res
        .status(404)
        .json({ success: false, error: "Product not found" });
    }

    // Protect: cannot turn off track_serial if APs exist
    if (track_serial === false || track_serial === 0 || track_serial === "false" || track_serial === "0") {
      if (product.track_serial === 1) {
        const apCount = await db.get(
          "SELECT COUNT(*) as cnt FROM product_units WHERE product_id = ?",
          [id],
        );
        if (apCount.cnt > 0) {
          return res.status(400).json({
            success: false,
            error: `該商品仍有 ${apCount.cnt} 筆序號紀錄，請先全部刪除後再關閉序號追蹤`,
          });
        }
      }
    }

    const newTrackSerial = track_serial != null
      ? (track_serial === true || track_serial === 1 || track_serial === "true" || track_serial === "1" ? 1 : 0)
      : product.track_serial;

    // type is derived from track_serial so the two stay in sync.
    const resolvedType = newTrackSerial ? "ap" : "normal";

    await db.run(
      `UPDATE products
             SET type = ?, name = ?, model = ?, min_stock = ?, track_serial = ?
             WHERE id = ?`,
      [
        resolvedType,
        name || product.name,
        model !== undefined ? model : product.model,
        min_stock != null ? parseInt(min_stock) : product.min_stock,
        newTrackSerial,
        id,
      ],
    );

    const updatedProduct = await db.get("SELECT * FROM products WHERE id = ?", [
      id,
    ]);
    await auditService.logAction(req.user?.id, "UPDATE", "product", parseInt(id), updatedProduct.warehouse_id);
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

    // Protect: cannot delete product if any APs exist
    const apCount = await db.get(
      "SELECT COUNT(*) as cnt FROM product_units WHERE product_id = ?",
      [id],
    );
    if (apCount.cnt > 0) {
      return res.status(400).json({
        success: false,
        error: `該商品仍有 ${apCount.cnt} 筆序號紀錄，請先全部刪除後再下架商品`,
      });
    }

    await db.run("UPDATE products SET is_deleted = 1 WHERE id = ?", [id]);
    res.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Product Location Query: Get all locations where a product is stored
async function getProductLocations(req, res) {
  try {
    const { sku } = req.params;

    const product = await db.get("SELECT id, name, sku FROM products WHERE sku = ? AND is_deleted = 0", [sku]);
    if (!product) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    const sql = `
      SELECT l.* 
      FROM locations l
      JOIN product_locations pl ON l.id = pl.location_id
      WHERE pl.product_id = ?
      ORDER BY l.name ASC
    `;

    const locations = await db.all(sql, [product.id]);

    res.json({ success: true, data: { product, locations } });
  } catch (error) {
    console.error("Error fetching product locations:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  lookup,
  getAll,
  getById,
  create,
  update,
  softDelete,
  getProductLocations,
};
