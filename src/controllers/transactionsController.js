const db = require("../config/database");
const quantityStateService = require("../services/quantityStateService");
const auditService = require("../services/auditService");
const { formatTimestamps } = require("../utils/formatTimestamps");

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

    // Validate quantity change using QuantityState module
    const validation = quantityStateService.validate(currentQuantity, quantity_change, {
      quantityType: quantity_type,
    });

    if (!validation.ok) {
      return res.status(400).json({
        success: false,
        error: validation.reason,
      });
    }

    const newQuantity = validation.newQuantity;

    // Start transaction
    await db.run("BEGIN TRANSACTION");

    try {
      // Insert transaction record with created_by_user
      const createdByUser = req.user?.username || "unknown";
      const result = await db.run(
        `INSERT INTO transactions (product_id, tag_id, quantity_change, remarks, created_by_user)
                 VALUES (?, ?, ?, ?, ?)`,
        [
          product_id,
          tag_id,
          quantity_change,
          `[${quantity_type === "accountable" ? "有帳" : "無帳"}] ${
            remarks || ""
          }`,
          createdByUser,
        ],
      );

      // Log audit action
      auditService.logAction(
        req.user?.id,
        "CREATE",
        "transaction",
        result.id
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

      res.status(201).json({ success: true, data: formatTimestamps(transaction) });
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

    // Enrich transactions with product_units details
    for (const tx of transactions) {
      if (tx.product_unit_ids) {
        try {
          const unitIds = JSON.parse(tx.product_unit_ids);
          if (Array.isArray(unitIds) && unitIds.length > 0) {
            const placeholders = unitIds.map(() => '?').join(',');
            const units = await db.all(
              `SELECT id, serial_number, status FROM product_units WHERE id IN (${placeholders})`,
              unitIds
            );
            tx.product_units = units;
          }
        } catch (e) {
          console.error("Error parsing product_unit_ids:", e);
          tx.product_units = [];
        }
      } else {
        tx.product_units = null;
      }
    }

    res.json({ success: true, data: formatTimestamps(transactions) });
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

    // Enrich transactions with product_units details
    for (const tx of transactions) {
      if (tx.product_unit_ids) {
        try {
          const unitIds = JSON.parse(tx.product_unit_ids);
          if (Array.isArray(unitIds) && unitIds.length > 0) {
            const placeholders = unitIds.map(() => '?').join(',');
            const units = await db.all(
              `SELECT id, serial_number, status FROM product_units WHERE id IN (${placeholders})`,
              unitIds
            );
            tx.product_units = units;
          }
        } catch (e) {
          console.error("Error parsing product_unit_ids:", e);
          tx.product_units = [];
        }
      } else {
        tx.product_units = null;
      }
    }

    res.json({ success: true, data: formatTimestamps(transactions) });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get single transaction by ID
async function getById(req, res) {
  try {
    const { id } = req.params;

    const transaction = await db.get(
      `SELECT t.*,
              p.name as product_name,
              p.sku,
              p.type as product_type,
              tg.display_name as tag_name,
              tg.color as tag_color,
              b.batch_number
       FROM transactions t
       JOIN products p ON t.product_id = p.id
       JOIN tags tg ON t.tag_id = tg.id
       LEFT JOIN batches b ON t.batch_id = b.id
       WHERE t.id = ?`,
      [id],
    );

    if (!transaction) {
      return res.status(404).json({ success: false, error: "Transaction not found" });
    }

    // Enrich with product_units details
    if (transaction.product_unit_ids) {
      try {
        const unitIds = JSON.parse(transaction.product_unit_ids);
        if (Array.isArray(unitIds) && unitIds.length > 0) {
          const placeholders = unitIds.map(() => '?').join(',');
          const units = await db.all(
            `SELECT id, serial_number, status FROM product_units WHERE id IN (${placeholders})`,
            unitIds
          );
          transaction.product_units = units;
        }
      } catch (e) {
        console.error("Error parsing product_unit_ids:", e);
        transaction.product_units = [];
      }
    } else {
      transaction.product_units = null;
    }

    res.json({ success: true, data: transaction });
  } catch (error) {
    console.error("Error fetching transaction:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  create,
  getByProduct,
  getAll,
  getById,
};
