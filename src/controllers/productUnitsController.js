const db = require("../config/database");
const iconv = require("iconv-lite");
const quantityStateService = require("../services/quantityStateService");

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
    const { product_id, serial_numbers, remarks, warehouse_id } = req.body;

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
          "INSERT INTO product_units (product_id, serial_number, remarks, warehouse_id) VALUES (?, ?, ?, ?)",
          [product_id, sn, remarks || null, warehouse_id || null],
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
      const errorMsg = errors.map((e) => `${e.serial_number}: ${e.reason}`).join('; ');
      return res.status(400).json({ success: false, error: errorMsg, errors });
    }

    if (inserted > 0) {
      const inboundTag = await db.get("SELECT id FROM tags WHERE name = 'INBOUND'");
      if (inboundTag) {
        // Validate quantity change using QuantityState module
        const validation = quantityStateService.validate(
          product.accountable_quantity,
          inserted,
          { quantityType: 'accountable' }
        );
        if (validation.ok) {
          // Get the IDs of newly created product units
          const newUnits = await db.all(
            "SELECT id FROM product_units WHERE product_id = ? ORDER BY created_at DESC LIMIT ?",
            [product_id, inserted]
          );
          const productUnitIds = JSON.stringify(newUnits.map(u => u.id));

          await db.run(
            "INSERT INTO transactions (product_id, tag_id, quantity_change, remarks, product_unit_ids) VALUES (?, ?, ?, ?, ?)",
            [product_id, inboundTag.id, inserted, "系統自動", productUnitIds],
          );
          await db.run(
            "UPDATE products SET accountable_quantity = accountable_quantity + ? WHERE id = ?",
            [inserted, product_id],
          );
        }
      }
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

// POST /api/product-units/bulk-sell
async function bulkSell(req, res) {
  try {
    const { serial_numbers, project_case, sold_to, remarks } = req.body;

    if (!Array.isArray(serial_numbers) || serial_numbers.length === 0) {
      return res.status(400).json({ success: false, error: "serial_numbers 為必填陣列" });
    }
    if (!project_case || !project_case.trim()) {
      return res.status(400).json({ success: false, error: "project_case 為必填" });
    }

    const errors = [];
    const seenInBatch = new Set();
    const validUnits = [];

    for (const raw of serial_numbers) {
      if (!raw || !raw.trim()) {
        errors.push({ serial_number: raw || "", reason: "序號不可為空" });
        continue;
      }
      const sn = normalizeSerial(raw);
      if (seenInBatch.has(sn)) {
        errors.push({ serial_number: sn, reason: "批次內序號重複" });
        continue;
      }
      seenInBatch.add(sn);

      const unit = await db.get("SELECT * FROM product_units WHERE serial_number = ?", [sn]);
      if (!unit) {
        errors.push({ serial_number: sn, reason: "序號不存在" });
      } else if (unit.status !== "in_stock") {
        errors.push({ serial_number: sn, reason: "已出庫" });
      } else {
        validUnits.push(unit);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    // All-or-nothing: all valid, proceed
    const soldAt = new Date().toISOString();
    for (const unit of validUnits) {
      await db.run(
        "UPDATE product_units SET status = 'sold', project_case = ?, sold_to = ?, sold_at = ?, remarks = CASE WHEN ? IS NOT NULL THEN ? ELSE remarks END WHERE id = ?",
        [project_case.trim(), sold_to || null, soldAt, remarks || null, remarks || null, unit.id],
      );
    }

    // Group by product_id and create OUTBOUND transactions
    const outboundTag = await db.get("SELECT id FROM tags WHERE name = 'OUTBOUND'");
    let transactionsCreated = 0;
    if (outboundTag) {
      const grouped = {};
      for (const unit of validUnits) {
        if (!grouped[unit.product_id]) grouped[unit.product_id] = [];
        grouped[unit.product_id].push(unit.id);
      }
      for (const [productId, unitIds] of Object.entries(grouped)) {
        const count = unitIds.length;
        const productForValidation = await db.get("SELECT accountable_quantity FROM products WHERE id = ?", [productId]);
        if (productForValidation) {
          // Validate outbound using QuantityState module
          const validation = quantityStateService.validate(
            productForValidation.accountable_quantity,
            -count,
            { quantityType: 'accountable' }
          );
          if (validation.ok) {
            const productUnitIdsJson = JSON.stringify(unitIds);
            await db.run(
              "INSERT INTO transactions (product_id, tag_id, quantity_change, remarks, product_unit_ids) VALUES (?, ?, ?, ?, ?)",
              [productId, outboundTag.id, -count, "系統自動", productUnitIdsJson],
            );
            await db.run(
              "UPDATE products SET accountable_quantity = accountable_quantity - ? WHERE id = ?",
              [count, productId],
            );
            transactionsCreated++;
          }
        }
      }
    }

    res.json({
      success: true,
      data: {
        sold: validUnits.length,
        transactions_created: transactionsCreated,
        message: `${validUnits.length} unit${validUnits.length !== 1 ? 's' : ''} have been marked as sold.`
      }
    });
  } catch (error) {
    console.error("Error bulk selling product units:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// POST /api/product-units/transfer
async function transfer(req, res) {
  try {
    const { serial_numbers, target_warehouse_id } = req.body;

    if (!Array.isArray(serial_numbers) || serial_numbers.length === 0) {
      return res.status(400).json({ success: false, error: "serial_numbers 為必填陣列" });
    }
    if (!target_warehouse_id) {
      return res.status(400).json({ success: false, error: "target_warehouse_id 為必填" });
    }

    const warehouse = await db.get("SELECT id, name FROM warehouses WHERE id = ?", [target_warehouse_id]);
    if (!warehouse) return res.status(400).json({ success: false, error: "目標倉庫不存在" });

    const errors = [];
    const validUnits = [];

    for (const raw of serial_numbers) {
      const sn = normalizeSerial(raw);
      const unit = await db.get(
        "SELECT pu.*, p.sku, p.warehouse_id AS src_warehouse_id FROM product_units pu JOIN products p ON pu.product_id = p.id WHERE pu.serial_number = ?",
        [sn]
      );
      if (!unit) {
        errors.push({ serial_number: sn, reason: "序號不存在" });
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
          // Ensure target product is AP type with serial tracking enabled
          if (!targetProduct.track_serial || targetProduct.type !== 'ap') {
            await db.run(
              "UPDATE products SET type = 'ap', track_serial = 1 WHERE id = ?",
              [targetProduct.id]
            );
            targetProduct.type = 'ap';
            targetProduct.track_serial = 1;
          }
          validUnits.push({ ...unit, targetProduct });
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    // Group by source product for quantity adjustments
    const bySourceProduct = {};
    const byTargetProduct = {};
    for (const unit of validUnits) {
      if (!bySourceProduct[unit.product_id]) bySourceProduct[unit.product_id] = [];
      bySourceProduct[unit.product_id].push(unit);
      if (!byTargetProduct[unit.targetProduct.id]) byTargetProduct[unit.targetProduct.id] = [];
      byTargetProduct[unit.targetProduct.id].push(unit);
    }

    // Update each unit to new product + warehouse
    for (const unit of validUnits) {
      await db.run(
        "UPDATE product_units SET product_id = ?, warehouse_id = ? WHERE id = ?",
        [unit.targetProduct.id, target_warehouse_id, unit.id]
      );
    }

    // Adjust accountable_quantity on both sides
    for (const [productId, units] of Object.entries(bySourceProduct)) {
      await db.run(
        "UPDATE products SET accountable_quantity = accountable_quantity - ? WHERE id = ?",
        [units.length, productId]
      );
    }
    for (const [productId, units] of Object.entries(byTargetProduct)) {
      await db.run(
        "UPDATE products SET accountable_quantity = accountable_quantity + ? WHERE id = ?",
        [units.length, productId]
      );
    }

    // Create TRANSFER transactions on both sides
    const transferTag = await db.get("SELECT id FROM tags WHERE name = 'TRANSFER'");
    if (transferTag) {
      // Collect unique source warehouse IDs and fetch their names
      const srcWarehouseIds = [...new Set(validUnits.map(u => u.src_warehouse_id))];
      const srcWarehouseNames = {};
      for (const wid of srcWarehouseIds) {
        const wh = await db.get("SELECT name FROM warehouses WHERE id = ?", [wid]);
        srcWarehouseNames[wid] = wh ? wh.name : String(wid);
      }

      for (const [productId, units] of Object.entries(bySourceProduct)) {
        const unitIds = units.map(u => u.id);
        await db.run(
          "INSERT INTO transactions (product_id, tag_id, quantity_change, remarks, product_unit_ids, warehouse_id) VALUES (?, ?, ?, ?, ?, ?)",
          [productId, transferTag.id, -units.length, `移倉至 ${warehouse.name}`, JSON.stringify(unitIds), units[0].src_warehouse_id],
        );
      }
      for (const [productId, units] of Object.entries(byTargetProduct)) {
        const unitIds = units.map(u => u.id);
        const srcName = srcWarehouseNames[units[0].src_warehouse_id];
        await db.run(
          "INSERT INTO transactions (product_id, tag_id, quantity_change, remarks, product_unit_ids, warehouse_id) VALUES (?, ?, ?, ?, ?, ?)",
          [productId, transferTag.id, units.length, `從 ${srcName} 移入`, JSON.stringify(unitIds), target_warehouse_id],
        );
      }
    }

    res.json({ success: true, data: { transferred: validUnits.length } });
  } catch (error) {
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

module.exports = { getAll, getById, create, bulkCreate, bulkSell, transfer, update, remove, exportCSV };
