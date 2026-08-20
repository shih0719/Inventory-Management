const db = require("../config/database");
const quantityStateService = require("../services/quantityStateService");
const auditService = require("../services/auditService");
const { formatTimestamps } = require("../utils/formatTimestamps");
const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

/**
 * Build the SELECT + WHERE for transaction listing (shared by getAll and exportCSV).
 * Filters out pagination; caller appends ORDER BY / LIMIT.
 */
function buildTransactionQuery(query, warehouseId) {
  const {
    from, to, quantity_type, direction, product_id,
    batch_id, created_by_user, sku, tag_id, min_quantity, max_quantity,
  } = query || {};

  let sql = `
    SELECT t.*,
           p.name as product_name,
           p.sku,
           tg.display_name as tag_name,
           tg.color as tag_color,
           b.batch_number,
           loc.name as location_tag
    FROM transactions t
    JOIN products p ON t.product_id = p.id
    JOIN tags tg ON t.tag_id = tg.id
    LEFT JOIN batches b ON t.batch_id = b.id
    LEFT JOIN locations loc ON t.location_id = loc.id
    WHERE 1=1
  `;
  const params = [];
  sql += " AND p.warehouse_id = ?";
  params.push(warehouseId);

  if (sku) { sql += " AND p.sku LIKE ?"; params.push(`%${sku}%`); }
  if (tag_id) { sql += " AND t.tag_id = ?"; params.push(parseInt(tag_id)); }
  if (min_quantity !== undefined) { sql += " AND t.quantity_change >= ?"; params.push(parseInt(min_quantity)); }
  if (max_quantity !== undefined) { sql += " AND t.quantity_change <= ?"; params.push(parseInt(max_quantity)); }
  if (from) { sql += " AND date(t.created_at) >= date(?)"; params.push(from); }
  if (to) { sql += " AND date(t.created_at) <= date(?)"; params.push(to); }
  if (quantity_type) { sql += " AND t.quantity_type = ?"; params.push(quantity_type); }
  if (direction === "in") { sql += " AND t.quantity_change > 0"; }
  else if (direction === "out") { sql += " AND t.quantity_change < 0"; }
  if (product_id) { sql += " AND t.product_id = ?"; params.push(parseInt(product_id)); }
  if (batch_id) { sql += " AND t.batch_id = ?"; params.push(parseInt(batch_id)); }
  if (created_by_user) { sql += " AND t.created_by_user = ?"; params.push(created_by_user); }

  return { sql, params };
}

// Allowed sort columns mapped to safe SQL identifiers (avoids SQL injection).
const SORT_COLUMNS = {
  created_at: "t.created_at",
  quantity_change: "t.quantity_change",
  sku: "p.sku",
  product_name: "p.name",
  tag_name: "tg.display_name",
  quantity_type: "t.quantity_type",
  created_by_user: "t.created_by_user",
};

function resolveSort(query) {
  const { sort, order } = query || {};
  const col = SORT_COLUMNS[sort];
  if (!col) return " ORDER BY t.created_at DESC";
  const dir = order === "asc" ? "ASC" : "DESC";
  return ` ORDER BY ${col} ${dir}, t.id DESC`;
}

// Create new transaction and update product quantity
async function create(req, res) {
  try {
    const { product_id, tag_id, quantity_change, quantity_type, remarks, location_id, source = 'manual' } =
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
      // Insert transaction record with created_by_user, quantity snapshot & source
      const createdByUser = req.user?.username || "unknown";
      const result = await db.run(
        `INSERT INTO transactions (product_id, tag_id, quantity_change, quantity_type, quantity_before, quantity_after, source, location_id, remarks, created_by_user)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product_id,
          tag_id,
          quantity_change,
            quantity_type,
          currentQuantity,
          newQuantity,
          source,
          location_id ?? null,
          `[${quantity_type === "accountable" ? "有帳" : "無帳"}] ${
            remarks || ""
          }`,
          createdByUser,
        ],
      );

      auditService.logAction(
        req.user?.id,
        "CREATE",
        "transaction",
        result.id,
        req.warehouseId
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
              b.batch_number,
              loc.name as location_tag
       FROM transactions t
       JOIN products p ON t.product_id = p.id
       JOIN tags tg ON t.tag_id = tg.id
       LEFT JOIN batches b ON t.batch_id = b.id
       LEFT JOIN locations loc ON t.location_id = loc.id
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
      page = 1,
    } = req.query;

    const { sql: baseSql, params } = buildTransactionQuery(req.query, req.warehouseId);

    // Count by wrapping the filtered query (baseSql has no ORDER BY/LIMIT).
    const countRow = await db.get(
      `SELECT COUNT(*) as total FROM (${baseSql}) AS filtered`,
      params,
    );
    const total = countRow?.total || 0;

    const pageNum = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 100;
    const offsetCalc = (pageNum - 1) * pageSize;

    const sql = `${baseSql}${resolveSort(req.query)} LIMIT ? OFFSET ?`;
    const queryParams = [...params, pageSize, offsetCalc];
    const transactions = await db.all(sql, queryParams);

    const totalPages = Math.ceil(total / pageSize);

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

      res.json({
        success: true,
        data: formatTimestamps(transactions),
        pagination: {
          total,
          page: pageNum,
          limit: pageSize,
          totalPages,
        },
      });
      return;
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
              b.batch_number,
              loc.name as location_tag
       FROM transactions t
       JOIN products p ON t.product_id = p.id
       JOIN tags tg ON t.tag_id = tg.id
       LEFT JOIN batches b ON t.batch_id = b.id
       LEFT JOIN locations loc ON t.location_id = loc.id
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

// Export filtered transaction history as a CSV file (Big5 for Excel).
async function exportCSV(req, res) {
  try {
    const { sql, params } = buildTransactionQuery(req.query, req.warehouseId);
    const fullSql = `${sql}${resolveSort(req.query)}`;
    const transactions = await db.all(fullSql, params);

    const exportData = transactions.map((tx) => ({
      id: tx.id,
      created_at: tx.created_at,
      sku: tx.sku || "",
      product_name: tx.product_name || "",
      tag_name: tx.tag_name || "",
      quantity_type: tx.quantity_type,
      quantity_change: tx.quantity_change,
      quantity_before: tx.quantity_before != null ? tx.quantity_before : "",
      quantity_after: tx.quantity_after != null ? tx.quantity_after : "",
      source: tx.source || "",
      location_tag: tx.location_tag || "",
      batch_number: tx.batch_number || "",
      created_by_user: tx.created_by_user || "",
      remarks: tx.remarks || "",
    }));

    const uploadsDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const filename = `transactions_export_${timestamp}.csv`;
    const filepath = path.join(uploadsDir, filename);

    const csvWriter = createCsvWriter({
      path: filepath,
      header: [
        { id: "id", title: "ID" },
        { id: "created_at", title: "CreatedAt" },
        { id: "sku", title: "SKU" },
        { id: "product_name", title: "ProductName" },
        { id: "tag_name", title: "Tag" },
        { id: "quantity_type", title: "QuantityType" },
        { id: "quantity_change", title: "QtyChange" },
        { id: "quantity_before", title: "QtyBefore" },
        { id: "quantity_after", title: "QtyAfter" },
        { id: "source", title: "Source" },
        { id: "location_tag", title: "Location" },
        { id: "batch_number", title: "Batch" },
        { id: "created_by_user", title: "Operator" },
        { id: "remarks", title: "Remarks" },
      ],
    });

    await csvWriter.writeRecords(exportData);

    // Convert to Big5 for Excel compatibility in Traditional Chinese environments.
    const content = fs.readFileSync(filepath, "utf8");
    const big5Buffer = iconv.encode(content, "big5");
    fs.writeFileSync(filepath, big5Buffer);

    res.download(filepath, filename, (err) => {
      if (err) console.error("Error downloading transactions CSV:", err);
      fs.unlinkSync(filepath);
    });
  } catch (error) {
    console.error("Error exporting transactions CSV:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  create,
  getByProduct,
  getAll,
  getById,
  exportCSV,
};
