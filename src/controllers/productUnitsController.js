const db = require("../config/database");
const iconv = require("iconv-lite");
const stockLedger = require("../services/stockLedger");
const apUnits = require("../services/apUnits");

function sendError(res, error, context) {
  if (error instanceof apUnits.ApUnitError) {
    return res.status(error.status).json({ success: false, error: error.message });
  }
  if (error instanceof stockLedger.LedgerError) {
    return res.status(400).json({ success: false, error: error.errors.map((e) => e.reason).join("; ") || error.message });
  }
  console.error(`Error ${context}:`, error);
  res.status(500).json({ success: false, error: error.message });
}

// GET /api/product-units
async function getAll(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { total, rows } = await apUnits.list(db, req.warehouseId, req.query, { limit, offset: (page - 1) * limit });

    res.json({
      success: true,
      data: rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    sendError(res, error, "fetching product units");
  }
}

// GET /api/product-units/:id
async function getById(req, res) {
  try {
    res.json({ success: true, data: await apUnits.getById(db, req.params.id, req.warehouseId) });
  } catch (error) {
    sendError(res, error, "fetching product unit");
  }
}

// GET /api/product-units/lookup/:serial — exact serial in the current warehouse
async function lookupBySerial(req, res) {
  try {
    const unit = await apUnits.findBySerial(db, req.params.serial, req.warehouseId);
    if (!unit) return res.status(404).json({ success: false, error: "此倉庫找不到序號" });
    res.json({ success: true, data: unit });
  } catch (error) {
    sendError(res, error, "looking up serial");
  }
}

// POST /api/product-units — single unit, no quantity change (see CONTEXT.md)
async function create(req, res) {
  try {
    const { product_id, serial_number, remarks } = req.body;
    if (!product_id || !serial_number) {
      return res.status(400).json({ success: false, error: "product_id 和 serial_number 為必填" });
    }

    const product = await apUnits.getApProduct(db, product_id, req.warehouseId);
    const id = await apUnits.create(db, product, serial_number, remarks);
    res.status(201).json({ success: true, data: await apUnits.getById(db, id, req.warehouseId) });
  } catch (error) {
    sendError(res, error, "creating product unit");
  }
}

// POST /api/product-units/bulk — new serials plus one INBOUND movement
async function bulkCreate(req, res) {
  try {
    const { product_id, serial_numbers, remarks } = req.body;
    const createdByUser = req.user?.username || "unknown";

    if (!product_id || !Array.isArray(serial_numbers) || serial_numbers.length === 0) {
      return res.status(400).json({ success: false, error: "product_id 和 serial_numbers 陣列為必填" });
    }

    const product = await apUnits.getApProduct(db, product_id, req.warehouseId);

    // Serial inserts and the inbound movement commit together.
    const { ids, errors } = await db.transaction(async (tx) => {
      const created = await apUnits.createMany(tx, product, serial_numbers, remarks);
      if (created.ids.length > 0) {
        await stockLedger.apply(
          tx,
          [{ productId: product.id, quantityType: "accountable", delta: created.ids.length, unitIds: created.ids, remarks: "系統自動" }],
          { tag: { name: "INBOUND" }, source: "ap-bulk", actor: { userId: req.user?.id, username: createdByUser } },
        );
      }
      return created;
    });

    const inserted = ids.length;
    if (inserted === 0 && errors.length > 0) {
      const errorMsg = errors.map((e) => `${e.serial_number}: ${e.reason}`).join('; ');
      return res.status(400).json({ success: false, error: errorMsg, errors });
    }

    const message = errors.length > 0
      ? `${inserted} unit${inserted !== 1 ? 's' : ''} created successfully. ${errors.length} failed: ${errors.map((e) => `${e.serial_number} (${e.reason})`).join(', ')}`
      : `${inserted} unit${inserted !== 1 ? 's' : ''} created successfully.`;

    res.status(201).json({ success: true, data: { inserted, failed: errors.length, errors, message } });
  } catch (error) {
    sendError(res, error, "bulk creating product units");
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

    const { errors, units } = await apUnits.planTransfer(db, serial_numbers, req.warehouseId, warehouse.id);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    await db.transaction(async (tx) => {
      const movements = await apUnits.applyTransfer(tx, units, warehouse);
      await stockLedger.apply(tx, movements, {
        tag: { name: "TRANSFER" },
        source: "ap-transfer",
        actor: { userId: req.user?.id, username: createdByUser },
      });
    });

    res.json({ success: true, data: { transferred: units.length } });
  } catch (error) {
    sendError(res, error, "transferring product units");
  }
}

// PUT /api/product-units/:id
async function update(req, res) {
  try {
    // 狀態只能經由出貨／退貨流程改變（數量才會經過 Stock Ledger）
    if (req.body.status !== undefined) {
      return res.status(400).json({ success: false, error: "不能直接修改狀態，請使用出貨或退貨流程" });
    }

    const unit = await apUnits.getById(db, req.params.id, req.warehouseId);
    await apUnits.edit(db, unit, req.body);
    res.json({ success: true, data: await apUnits.getById(db, unit.id, req.warehouseId) });
  } catch (error) {
    sendError(res, error, "updating product unit");
  }
}

// DELETE /api/product-units/:id — no quantity change (see CONTEXT.md)
async function remove(req, res) {
  try {
    const unit = await apUnits.getById(db, req.params.id, req.warehouseId);
    await apUnits.remove(db, unit);
    res.json({ success: true, message: "序號品已刪除" });
  } catch (error) {
    sendError(res, error, "deleting product unit");
  }
}

// GET /api/product-units/export
async function exportCSV(req, res) {
  try {
    const { rows } = await apUnits.list(db, req.warehouseId, req.query);

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
    sendError(res, error, "exporting product units CSV");
  }
}

module.exports = { getAll, getById, lookupBySerial, create, bulkCreate, transfer, update, remove, exportCSV };
