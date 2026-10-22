const db = require("../config/database");
const iconv = require("iconv-lite");
const stockLedger = require("../services/stockLedger");

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

// GET /api/product-units/lookup/:serial — exact serial in the current warehouse
async function lookupBySerial(req, res) {
  try {
    const sn = normalizeSerial(req.params.serial);
    const unit = await db.get(
      `SELECT pu.id, pu.serial_number, pu.status, pu.product_id, p.sku, p.name AS product_name
       FROM product_units pu JOIN products p ON pu.product_id = p.id
       WHERE pu.serial_number = ? AND p.warehouse_id = ? AND p.is_deleted = 0`,
      [sn, req.warehouseId]
    );
    if (!unit) return res.status(404).json({ success: false, error: "此倉庫找不到序號" });
    res.json({ success: true, data: unit });
  } catch (error) {
    console.error("Error looking up serial:", error);
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
    const { product_id, serial_numbers, remarks, warehouse_id } = req.body;
    const createdByUser = req.user?.username || "unknown";

    if (!product_id || !Array.isArray(serial_numbers) || serial_numbers.length === 0) {
      return res.status(400).json({ success: false, error: "product_id 和 serial_numbers 陣列為必填" });
    }

    const product = await db.get("SELECT * FROM products WHERE id = ? AND is_deleted = 0", [product_id]);
    if (!product) return res.status(400).json({ success: false, error: "商品不存在" });
    if (!product.track_serial) return res.status(400).json({ success: false, error: "該商品未開啟序號追蹤" });

    const insertedIds = [];
    const errors = [];
    const seenInBatch = new Set();

    // Serial inserts and the inbound movement commit together.
    await db.transaction(async (tx) => {
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
          const result = await tx.run(
            "INSERT INTO product_units (product_id, serial_number, remarks, warehouse_id) VALUES (?, ?, ?, ?)",
            [product_id, sn, remarks || null, warehouse_id || null],
          );
          insertedIds.push(result.id);
        } catch (e) {
          if (e.message.includes("UNIQUE constraint failed")) {
            errors.push({ index: i, serial_number: sn, reason: "序號已存在" });
          } else {
            throw e;
          }
        }
      }

      if (insertedIds.length > 0) {
        await stockLedger.apply(
          tx,
          [{ productId: product.id, quantityType: "accountable", delta: insertedIds.length, unitIds: insertedIds, remarks: "系統自動" }],
          { tag: { name: "INBOUND" }, source: "ap-bulk", actor: { userId: req.user?.id, username: createdByUser } },
        );
      }
    });

    const inserted = insertedIds.length;
    if (inserted === 0 && errors.length > 0) {
      const errorMsg = errors.map((e) => `${e.serial_number}: ${e.reason}`).join('; ');
      return res.status(400).json({ success: false, error: errorMsg, errors });
    }

    const message = errors.length > 0
      ? `${inserted} unit${inserted !== 1 ? 's' : ''} created successfully. ${errors.length} failed: ${errors.map((e) => `${e.serial_number} (${e.reason})`).join(', ')}`
      : `${inserted} unit${inserted !== 1 ? 's' : ''} created successfully.`;

    res.status(201).json({ success: true, data: { inserted, failed: errors.length, errors, message } });
  } catch (error) {
    console.error("Error bulk creating product units:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// POST /api/product-units/transfer
async function transfer(req, res) {
  try {
    const { serial_numbers, target_warehouse_id } = req.body;
    const createdByUser = req.user?.username || "unknown";

    if (!Array.isArray(serial_numbers) || serial_numbers.length === 0) {
      return res.status(400).json({ success: false, error: "serial_numbers 為必填陣列" });
    }
    if (!target_warehouse_id) {
      return res.status(400).json({ success: false, error: "target_warehouse_id 為必填" });
    }

    const warehouse = await db.get("SELECT id, name FROM warehouses WHERE id = ?", [target_warehouse_id]);
    if (!warehouse) return res.status(400).json({ success: false, error: "目標倉庫不存在" });
    if (!(req.user?.warehouses || []).includes(Number(target_warehouse_id))) {
      return res.status(403).json({ success: false, error: "無目標倉庫的存取權限" });
    }

    const errors = [];
    const validUnits = [];

    for (const raw of serial_numbers) {
      const sn = normalizeSerial(raw);
      // Only units in the current warehouse can be moved out.
      const unit = await db.get(
        "SELECT pu.*, p.sku, p.warehouse_id AS src_warehouse_id FROM product_units pu JOIN products p ON pu.product_id = p.id WHERE pu.serial_number = ? AND p.warehouse_id = ?",
        [sn, req.warehouseId]
      );
      if (!unit) {
        errors.push({ serial_number: sn, reason: "此倉庫找不到序號" });
      } else if (unit.status !== "in_stock") {
        errors.push({ serial_number: sn, reason: "非在庫狀態" });
      } else if (unit.src_warehouse_id === Number(target_warehouse_id)) {
        errors.push({ serial_number: sn, reason: "已在目標倉庫" });
      } else {
        // Find the same SKU product in the target warehouse
        const targetProduct = await db.get(
          "SELECT * FROM products WHERE sku = ? AND warehouse_id = ? AND is_deleted = 0",
          [unit.sku, target_warehouse_id]
        );
        if (!targetProduct) {
          errors.push({ serial_number: sn, reason: `目標倉庫無此 SKU (${unit.sku})` });
        } else {
          validUnits.push({ ...unit, targetProduct });
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    await db.transaction(async (tx) => {
      // Ensure target products are AP type with serial tracking enabled
      for (const { targetProduct } of validUnits) {
        if (!targetProduct.track_serial || targetProduct.type !== 'ap') {
          await tx.run(
            "UPDATE products SET type = 'ap', track_serial = 1 WHERE id = ?",
            [targetProduct.id]
          );
          targetProduct.type = 'ap';
          targetProduct.track_serial = 1;
        }
      }

      // Update each unit to new product + warehouse
      for (const unit of validUnits) {
        await tx.run(
          "UPDATE product_units SET product_id = ?, warehouse_id = ? WHERE id = ?",
          [unit.targetProduct.id, target_warehouse_id, unit.id]
        );
      }

      // One TRANSFER movement per source product (out) and per target product (in)
      const bySourceProduct = new Map();
      const byTargetProduct = new Map();
      for (const unit of validUnits) {
        if (!bySourceProduct.has(unit.product_id)) bySourceProduct.set(unit.product_id, []);
        bySourceProduct.get(unit.product_id).push(unit);
        if (!byTargetProduct.has(unit.targetProduct.id)) byTargetProduct.set(unit.targetProduct.id, []);
        byTargetProduct.get(unit.targetProduct.id).push(unit);
      }
      const srcWarehouseNames = {};
      for (const wid of new Set(validUnits.map((u) => u.src_warehouse_id))) {
        const wh = await tx.get("SELECT name FROM warehouses WHERE id = ?", [wid]);
        srcWarehouseNames[wid] = wh ? wh.name : String(wid);
      }

      const movements = [];
      for (const [productId, units] of bySourceProduct) {
        movements.push({ productId, quantityType: "accountable", delta: -units.length, unitIds: units.map((u) => u.id), remarks: `移倉至 ${warehouse.name}` });
      }
      for (const [productId, units] of byTargetProduct) {
        const srcName = srcWarehouseNames[units[0].src_warehouse_id];
        movements.push({ productId, quantityType: "accountable", delta: units.length, unitIds: units.map((u) => u.id), remarks: `從 ${srcName} 移入` });
      }
      await stockLedger.apply(tx, movements, {
        tag: { name: "TRANSFER" },
        source: "ap-transfer",
        actor: { userId: req.user?.id, username: createdByUser },
      });
    });

    res.json({ success: true, data: { transferred: validUnits.length } });
  } catch (error) {
    if (error instanceof stockLedger.LedgerError) {
      return res.status(400).json({ success: false, error: error.errors.map((e) => e.reason).join("; ") || error.message });
    }
    console.error("Error transferring product units:", error);
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

module.exports = { getAll, getById, lookupBySerial, create, bulkCreate, transfer, update, remove, exportCSV };
