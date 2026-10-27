const db = require("../config/database");
const shipmentService = require("../services/shipmentService");
const { buildShipmentWorkbook } = require("../services/shipmentExportService");

function sendError(res, error, action) {
  if (error instanceof shipmentService.ShipmentError) {
    const body = { success: false, error: error.message };
    if (error.errors.length > 0) body.errors = error.errors;
    return res.status(error.status).json(body);
  }
  console.error(`Error ${action} shipment:`, error);
  res.status(500).json({ success: false, error: error.message });
}

async function sendDetail(res, id, warehouseId, status = 200) {
  const detail = await shipmentService.getDetail(db, id, warehouseId);
  if (!detail) {
    return res.status(404).json({ success: false, error: "Shipment not found" });
  }
  const { shipment, transactionIds, items } = detail;
  res.status(status).json({
    success: true,
    data: {
      id: shipment.id,
      shipment_number: shipment.shipment_number,
      customer: shipment.customer,
      project_case: shipment.project_case,
      shipment_date: shipment.shipment_date,
      transaction_ids: transactionIds,
      items_summary: items,
      created_at: shipment.created_at,
      updated_at: shipment.updated_at,
    },
  });
}

// Create new shipment
async function create(req, res) {
  try {
    const { transaction_ids, customer, project_case, shipment_date } = req.body;

    if (!transaction_ids || !Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: "transaction_ids array is required and must not be empty",
      });
    }

    const actor = { userId: req.user?.id, username: req.user?.username, warehouseId: req.warehouseId };
    const { id } = await db.transaction((tx) => shipmentService.create(
      tx,
      { transactionIds: transaction_ids, customer, projectCase: project_case, shipmentDate: shipment_date },
      actor,
    ));
    await sendDetail(res, id, req.warehouseId, 201);
  } catch (error) {
    sendError(res, error, "creating");
  }
}

// Get all shipments
async function getAll(req, res) {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const shipments = await shipmentService.list(db, req.warehouseId, { limit: parseInt(limit), offset: parseInt(offset) });

    res.json({ success: true, data: shipments });
  } catch (error) {
    console.error("Error fetching shipments:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get shipment by ID with transaction details
async function getById(req, res) {
  try {
    await sendDetail(res, req.params.id, req.warehouseId);
  } catch (error) {
    sendError(res, error, "fetching");
  }
}

// Export one shipment as .xlsx (sheets: 出貨明細, 序號表)
async function exportXlsx(req, res) {
  try {
    const result = await buildShipmentWorkbook(req.params.id, req.warehouseId);
    if (!result) {
      return res.status(404).json({ success: false, error: "Shipment not found" });
    }
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    await result.workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting shipment:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Update shipment; transaction_ids, when given, replaces the bound transactions
async function update(req, res) {
  try {
    const { transaction_ids, customer, project_case, shipment_date } = req.body;
    if (transaction_ids !== undefined && !Array.isArray(transaction_ids)) {
      return res.status(400).json({ success: false, error: "transaction_ids must be an array" });
    }

    await db.transaction((tx) => shipmentService.update(
      tx,
      req.params.id,
      { transactionIds: transaction_ids, customer, projectCase: project_case, shipmentDate: shipment_date },
      req.warehouseId,
    ));
    await sendDetail(res, req.params.id, req.warehouseId);
  } catch (error) {
    sendError(res, error, "updating");
  }
}

// Delete shipment (soft delete)
async function delete_(req, res) {
  try {
    const shipment = await db.transaction((tx) => shipmentService.remove(tx, req.params.id, req.warehouseId));
    res.json({
      success: true,
      message: "Shipment deleted successfully",
      data: { id: req.params.id, shipment_number: shipment.shipment_number },
    });
  } catch (error) {
    sendError(res, error, "deleting");
  }
}

module.exports = {
  create,
  getAll,
  getById,
  exportXlsx,
  update,
  delete: delete_,
};
