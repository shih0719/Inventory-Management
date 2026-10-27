const db = require("../config/database");
const stockLedger = require("../services/stockLedger");
const transactionQuery = require("../services/transactionQuery");
const { formatTimestamps } = require("../utils/formatTimestamps");
const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

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
      "SELECT id, track_serial FROM products WHERE id = ? AND warehouse_id = ? AND is_deleted = 0",
      [product_id, req.warehouseId],
    );

    if (!product) {
      return res
        .status(404)
        .json({ success: false, error: "Product not found" });
    }

    // AP accountable stock moves with serials (inbound/outbound pages). Here it may only
    // be reconciled toward the in-stock serial count — the ledger enforces that.
    const movement = {
      productId: product.id,
      quantityType: quantity_type,
      delta: Number(quantity_change),
      remarks,
      locationId: location_id,
      kind: product.track_serial && quantity_type === "accountable" ? "reconcile" : undefined,
    };

    const [{ transactionId }] = await db.transaction((tx) =>
      stockLedger.apply(tx, [movement], {
        tag: { id: tag_id },
        source,
        actor: { userId: req.user?.id, username: req.user?.username || "unknown" },
      }),
    );

    const transaction = await db.get(
      "SELECT * FROM transactions WHERE id = ?",
      [transactionId],
    );

    res.status(201).json({ success: true, data: formatTimestamps(transaction) });
  } catch (error) {
    if (error instanceof stockLedger.LedgerError) {
      return res.status(400).json({ success: false, error: error.errors[0]?.reason || error.message });
    }
    console.error("Error creating transaction:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get transactions for a specific product
async function getByProduct(req, res) {
  try {
    const { productId } = req.params;

    const product = await db.get("SELECT id FROM products WHERE id = ? AND warehouse_id = ?", [productId, req.warehouseId]);
    if (!product) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    const transactions = await transactionQuery.list(db, req.warehouseId, { product_id: productId });
    res.json({ success: true, data: formatTimestamps(transactions) });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get all transactions with optional filtering
async function getAll(req, res) {
  try {
    const pageNum = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.limit) || 100;

    const total = await transactionQuery.count(db, req.warehouseId, req.query);
    const transactions = await transactionQuery.list(db, req.warehouseId, req.query, {
      sort: req.query.sort,
      order: req.query.order,
      limit: pageSize,
      offset: (pageNum - 1) * pageSize,
    });

    res.json({
      success: true,
      data: formatTimestamps(transactions),
      pagination: {
        total,
        page: pageNum,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get single transaction by ID
async function getById(req, res) {
  try {
    const transaction = await transactionQuery.getById(db, req.warehouseId, req.params.id);
    if (!transaction) {
      return res.status(404).json({ success: false, error: "Transaction not found" });
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
    const transactions = await transactionQuery.list(db, req.warehouseId, req.query, {
      sort: req.query.sort,
      order: req.query.order,
      withUnits: false,
    });

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
