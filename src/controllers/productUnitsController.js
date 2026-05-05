const db = require("../config/database");
const iconv = require("iconv-lite");

function normalizeSerial(sn) {
  return sn.trim().toUpperCase();
}

// GET /api/product-units
async function getAll(req, res) {
  try {
    const {
      product_id, sku, status, serial_number, sold_to, project_case,
      page = 1, limit = 20,
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = "WHERE 1=1";
    const params = [];
    const countParams = [];

    if (product_id) { where += " AND pu.product_id = ?"; params.push(product_id); countParams.push(product_id); }
    if (sku) { where += " AND p.sku LIKE ?"; params.push(`%${sku}%`); countParams.push(`%${sku}%`); }
    if (status) { where += " AND pu.status = ?"; params.push(status); countParams.push(status); }
    if (serial_number) { where += " AND pu.serial_number LIKE ?"; params.push(`%${serial_number}%`); countParams.push(`%${serial_number}%`); }
    if (sold_to) { where += " AND pu.sold_to LIKE ?"; params.push(`%${sold_to}%`); countParams.push(`%${sold_to}%`); }
    if (project_case) { where += " AND pu.project_case LIKE ?"; params.push(`%${project_case}%`); countParams.push(`%${project_case}%`); }

    const countSql = `SELECT COUNT(*) as total FROM product_units pu JOIN products p ON pu.product_id = p.id ${where}`;
    const sql = `
      SELECT pu.*, p.sku, p.name AS product_name
      FROM product_units pu
      JOIN products p ON pu.product_id = p.id
      ${where}
      ORDER BY pu.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const totalResult = await db.get(countSql, countParams);
    params.push(parseInt(limit), offset);
    const rows = await db.all(sql, params);

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: totalResult.total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalResult.total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching product units:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// POST /api/product-units
async function create(req, res) {
  try {
    const { product_id, serial_number, remarks } = req.body;

    if (!product_id || !serial_number) {
      return res.status(400).json({ success: false, error: "product_id 和 serial_number 為必填" });
    }

    const sn = normalizeSerial(serial_number);
    if (!sn) return res.status(400).json({ success: false, error: "serial_number 不可為空" });

    const product = await db.get("SELECT * FROM products WHERE id = ? AND is_deleted = 0", [product_id]);
    if (!product) return res.status(400).json({ success: false, error: "商品不存在" });
    if (!product.track_serial) return res.status(400).json({ success: false, error: "該商品未開啟序號追蹤" });

    const result = await db.run(
      "INSERT INTO product_units (product_id, serial_number, remarks) VALUES (?, ?, ?)",
      [product_id, sn, remarks || null],
    );
    const unit = await db.get("SELECT pu.*, p.sku, p.name AS product_name FROM product_units pu JOIN products p ON pu.product_id = p.id WHERE pu.id = ?", [result.id]);
    res.status(201).json({ success: true, data: unit });
  } catch (error) {
    if (error.message.includes("UNIQUE constraint failed")) {
      return res.status(400).json({ success: false, error: "序號已存在" });
    }
    console.error("Error creating product unit:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// POST /api/product-units/bulk
async function bulkCreate(req, res) {
  try {
    const { product_id, serial_numbers, remarks } = req.body;

    if (!product_id || !Array.isArray(serial_numbers) || serial_numbers.length === 0) {
      return res.status(400).json({ success: false, error: "product_id 和 serial_numbers 陣列為必填" });
    }

    const product = await db.get("SELECT * FROM products WHERE id = ? AND is_deleted = 0", [product_id]);
    if (!product) return res.status(400).json({ success: false, error: "商品不存在" });
    if (!product.track_serial) return res.status(400).json({ success: false, error: "該商品未開啟序號追蹤" });

    let inserted = 0;
    const errors = [];
    const seenInBatch = new Set();

    for (let i = 0; i < serial_numbers.length; i++) {
      const raw = serial_numbers[i];
      if (!raw || !raw.trim()) {
        errors.push({ index: i, serial_number: raw, reason: "序號不可為空" });
        continue;
      }
      const sn = normalizeSerial(raw);
      if (seenInBatch.has(sn)) {
        errors.push({ index: i, serial_number: sn, reason: "批次內序號重複" });
        continue;
      }
      seenInBatch.add(sn);
      try {
        await db.run(
          "INSERT INTO product_units (product_id, serial_number, remarks) VALUES (?, ?, ?)",
          [product_id, sn, remarks || null],
        );
        inserted++;
      } catch (e) {
        if (e.message.includes("UNIQUE constraint failed")) {
          errors.push({ index: i, serial_number: sn, reason: "序號已存在" });
        } else {
          errors.push({ index: i, serial_number: sn, reason: e.message });
        }
      }
    }

    if (inserted === 0 && errors.length > 0) {
      return res.status(400).json({ success: false, inserted: 0, failed: errors.length, errors });
    }

    res.status(201).json({ success: true, inserted, failed: errors.length, errors });
  } catch (error) {
    console.error("Error bulk creating product units:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// PUT /api/product-units/:id
async function update(req, res) {
  try {
    const { id } = req.params;
    const { status, project_case, sold_to, remarks } = req.body;

    const unit = await db.get("SELECT * FROM product_units WHERE id = ?", [id]);
    if (!unit) return res.status(404).json({ success: false, error: "序號品不存在" });

    let newStatus = status || unit.status;
    let newProjectCase = project_case !== undefined ? project_case : unit.project_case;
    let newSoldTo = sold_to !== undefined ? sold_to : unit.sold_to;
    let newSoldAt = unit.sold_at;
    let newRemarks = remarks !== undefined ? remarks : unit.remarks;

    if (newStatus === "sold") {
      if (!newProjectCase || !newProjectCase.trim()) {
        return res.status(400).json({ success: false, error: "案子（project_case）為必填" });
      }
      if (unit.status !== "sold") newSoldAt = new Date().toISOString();
    } else if (newStatus === "in_stock") {
      newProjectCase = null;
      newSoldTo = null;
      newSoldAt = null;
    }

    await db.run(
      "UPDATE product_units SET status = ?, project_case = ?, sold_to = ?, sold_at = ?, remarks = ? WHERE id = ?",
      [newStatus, newProjectCase || null, newSoldTo || null, newSoldAt, newRemarks || null, id],
    );

    const updated = await db.get(
      "SELECT pu.*, p.sku, p.name AS product_name FROM product_units pu JOIN products p ON pu.product_id = p.id WHERE pu.id = ?",
      [id],
    );
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating product unit:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// DELETE /api/product-units/:id
async function remove(req, res) {
  try {
    const { id } = req.params;
    const unit = await db.get("SELECT * FROM product_units WHERE id = ?", [id]);
    if (!unit) return res.status(404).json({ success: false, error: "序號品不存在" });

    await db.run("DELETE FROM product_units WHERE id = ?", [id]);
    res.json({ success: true, message: "序號品已刪除" });
  } catch (error) {
    console.error("Error deleting product unit:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// GET /api/product-units/export
async function exportCSV(req, res) {
  try {
    const {
      product_id, sku, status, serial_number, sold_to, project_case,
      sold_at_from, sold_at_to, created_at_from, created_at_to,
    } = req.query;

    let where = "WHERE 1=1";
    const params = [];

    if (product_id) { where += " AND pu.product_id = ?"; params.push(product_id); }
    if (sku) { where += " AND p.sku LIKE ?"; params.push(`%${sku}%`); }
    if (status) { where += " AND pu.status = ?"; params.push(status); }
    if (serial_number) { where += " AND pu.serial_number LIKE ?"; params.push(`%${serial_number}%`); }
    if (sold_to) { where += " AND pu.sold_to LIKE ?"; params.push(`%${sold_to}%`); }
    if (project_case) { where += " AND pu.project_case LIKE ?"; params.push(`%${project_case}%`); }
    if (sold_at_from) { where += " AND pu.sold_at >= ?"; params.push(sold_at_from); }
    if (sold_at_to) { where += " AND pu.sold_at <= ?"; params.push(sold_at_to); }
    if (created_at_from) { where += " AND pu.created_at >= ?"; params.push(created_at_from); }
    if (created_at_to) { where += " AND pu.created_at <= ?"; params.push(created_at_to); }

    const rows = await db.all(`
      SELECT pu.*, p.sku, p.name AS product_name
      FROM product_units pu
      JOIN products p ON pu.product_id = p.id
      ${where}
      ORDER BY pu.created_at DESC
    `, params);

    const headers = "SKU,ProductName,SerialNumber,Status,ProjectCase,SoldTo,SoldAt,Remarks,CreatedAt\r\n";
    const dataRows = rows.map((r) => {
      const cols = [
        r.sku, r.product_name, r.serial_number, r.status,
        r.project_case || "", r.sold_to || "", r.sold_at || "",
        r.remarks || "", r.created_at,
      ];
      return cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
    });
    const csvContent = headers + dataRows.join("\r\n");

    const buf = iconv.encode(csvContent, "big5");
    res.setHeader("Content-Type", "text/csv; charset=big5");
    res.setHeader("Content-Disposition", `attachment; filename="product_units_${Date.now()}.csv"`);
    res.send(buf);
  } catch (error) {
    console.error("Error exporting product units CSV:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getById(req, res) {
  try {
    const { id } = req.params;
    const unit = await db.get(
      "SELECT pu.*, p.sku, p.name AS product_name FROM product_units pu JOIN products p ON pu.product_id = p.id WHERE pu.id = ?",
      [id],
    );
    if (!unit) return res.status(404).json({ success: false, error: "序號品不存在" });
    res.json({ success: true, data: unit });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { getAll, getById, create, bulkCreate, update, remove, exportCSV };
