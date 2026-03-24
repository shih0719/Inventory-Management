const db = require("../config/database");

// Get all locations
async function getAll(req, res) {
  try {
    const locations = await db.all("SELECT * FROM locations ORDER BY name ASC");
    res.json({ success: true, data: locations });
  } catch (error) {
    console.error("Error fetching locations:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Create new location
async function create(req, res) {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: "Name is required",
      });
    }

    const existing = await db.get(
      "SELECT id FROM locations WHERE name = ?",
      [name]
    );

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "此櫃位名稱已存在",
      });
    }

    const result = await db.run(
      `INSERT INTO locations (name, description) VALUES (?, ?)`,
      [name, description || ""]
    );

    const newLocation = await db.get("SELECT * FROM locations WHERE id = ?", [
      result.id,
    ]);
    res.status(201).json({ success: true, data: newLocation });
  } catch (error) {
    console.error("Error creating location:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Location Content Query: Get products inside a location
async function getContent(req, res) {
  try {
    const { tag } = req.params; // Using tag/name as identifier as per requirements

    // First find the location ID
    const location = await db.get("SELECT * FROM locations WHERE name = ?", [tag]);
    
    if (!location) {
      return res.status(404).json({ success: false, error: "Location not found" });
    }

    const sql = `
      SELECT p.* 
      FROM products p
      JOIN product_locations pl ON p.id = pl.product_id
      WHERE pl.location_id = ? AND p.is_deleted = 0
      ORDER BY p.name ASC
    `;
    
    const products = await db.all(sql, [location.id]);

    res.json({ 
      success: true, 
      data: {
        location,
        products
      } 
    });
  } catch (error) {
    console.error("Error fetching location content:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Assign product to location
async function assignProduct(req, res) {
  try {
    const { tag } = req.params;
    const { product_id } = req.body;

    if (!product_id) {
      return res.status(400).json({ success: false, error: "product_id is required" });
    }

    const location = await db.get("SELECT id FROM locations WHERE name = ?", [tag]);
    if (!location) {
      return res.status(404).json({ success: false, error: "Location not found" });
    }

    // Insert or ignore if it already exists
    await db.run(
      `INSERT OR IGNORE INTO product_locations (product_id, location_id) VALUES (?, ?)`,
      [product_id, location.id]
    );

    res.json({ success: true, message: "Product assigned to location successfully" });
  } catch (error) {
    console.error("Error assigning product:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Remove product from location
async function unassignProduct(req, res) {
  try {
    const { tag, productId } = req.params;

    const location = await db.get("SELECT id FROM locations WHERE name = ?", [tag]);
    if (!location) {
      return res.status(404).json({ success: false, error: "Location not found" });
    }

    await db.run(
      `DELETE FROM product_locations WHERE product_id = ? AND location_id = ?`,
      [productId, location.id]
    );

    res.json({ success: true, message: "Product removed from location successfully" });
  } catch (error) {
    console.error("Error unassigning product:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getAll,
  create,
  getContent,
  assignProduct,
  unassignProduct
};
