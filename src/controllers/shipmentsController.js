const db = require("../config/database");
const auditService = require("../services/auditService");
const { generateShipmentNumber } = require("../services/shipmentService");
const { buildShipmentWorkbook } = require("../services/shipmentExportService");
const transactionQuery = require("../services/transactionQuery");

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

    const finalDate = shipment_date || new Date().toISOString().split('T')[0];

    // Phase 1: Validate all transactions exist and none are already in another shipment
    const validationErrors = [];
    const validatedTransactionIds = [];

    for (const txId of transaction_ids) {
      const transaction = await db.get(
        `SELECT st.shipment_id FROM transactions t
         JOIN products p ON p.id = t.product_id
         LEFT JOIN shipment_transactions st ON t.id = st.transaction_id
         WHERE t.id = ? AND p.warehouse_id = ?`,
        [txId, req.warehouseId]
      );

      if (!transaction) {
        validationErrors.push(`Transaction ${txId}: not found`);
        continue;
      }

      if (transaction.shipment_id) {
        validationErrors.push(`Transaction ${txId}: already belongs to shipment ${transaction.shipment_id}`);
        continue;
      }

      validatedTransactionIds.push(txId);
    }

    if (validationErrors.length > 0) {
      return res.status(409).json({
        success: false,
        error: "Conflict: Some transactions are already assigned to other shipments",
        errors: validationErrors,
      });
    }

    if (validatedTransactionIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No valid transactions provided",
      });
    }

    // Phase 2: Create shipment atomically
    const shipmentNumber = await generateShipmentNumber(finalDate);

    const shipmentId = await db.transaction(async (tx) => {
      const createdByUser = req.user?.username || "unknown";
      const result = await tx.run(
        `INSERT INTO shipments (shipment_number, customer, project_case, shipment_date, created_by_user, warehouse_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [shipmentNumber, customer || null, project_case || null, finalDate, createdByUser, req.warehouseId]
      );

      await auditService.logAction(
        req.user?.id,
        "CREATE",
        "shipment",
        result.id,
        req.warehouseId
      );

      // Insert shipment-transaction relationships
      for (const txId of validatedTransactionIds) {
        await tx.run(
          `INSERT INTO shipment_transactions (shipment_id, transaction_id) VALUES (?, ?)`,
          [result.id, txId]
        );
      }
      return result.id;
    });

    const shipment = await db.get(
      "SELECT * FROM shipments WHERE id = ?",
      [shipmentId]
    );

    // Fetch items_summary
    const itemsSummary = await db.all(
      `SELECT t.* FROM transactions t
       WHERE t.id IN (${validatedTransactionIds.join(',')})
       ORDER BY t.created_at ASC`
    );

    res.status(201).json({
      success: true,
      data: {
        id: shipment.id,
        shipment_number: shipment.shipment_number,
        customer: shipment.customer,
        project_case: shipment.project_case,
        shipment_date: shipment.shipment_date,
        transaction_ids: validatedTransactionIds,
        items_summary: itemsSummary,
        created_at: shipment.created_at,
      },
    });
  } catch (error) {
    console.error("Error creating shipment:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get all shipments
async function getAll(req, res) {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const shipments = await db.all(
      `SELECT s.*, COUNT(st.transaction_id) as transaction_count
       FROM shipments s
       LEFT JOIN shipment_transactions st ON s.id = st.shipment_id
       WHERE s.is_deleted = 0 AND s.warehouse_id = ?
       GROUP BY s.id
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.warehouseId, parseInt(limit), parseInt(offset)]
    );

    res.json({ success: true, data: shipments });
  } catch (error) {
    console.error("Error fetching shipments:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get shipment by ID with transaction details
async function getById(req, res) {
  try {
    const { id } = req.params;

    const shipment = await db.get(
      "SELECT * FROM shipments WHERE id = ? AND warehouse_id = ? AND is_deleted = 0",
      [id, req.warehouseId]
    );

    if (!shipment) {
      return res.status(404).json({ success: false, error: "Shipment not found" });
    }

    const transactionIds = await db.all(
      `SELECT transaction_id FROM shipment_transactions WHERE shipment_id = ?`,
      [id]
    );

    const transactions = await transactionQuery.list(
      db,
      req.warehouseId,
      { ids: transactionIds.map((tx) => tx.transaction_id) },
      { sort: "created_at", order: "asc" },
    );

    res.json({
      success: true,
      data: {
        id: shipment.id,
        shipment_number: shipment.shipment_number,
        customer: shipment.customer,
        project_case: shipment.project_case,
        shipment_date: shipment.shipment_date,
        transaction_ids: transactionIds.map(tx => tx.transaction_id),
        items_summary: transactions,
        created_at: shipment.created_at,
        updated_at: shipment.updated_at,
      },
    });
  } catch (error) {
    console.error("Error fetching shipment:", error);
    res.status(500).json({ success: false, error: error.message });
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

// Update shipment
async function update(req, res) {
  try {
    const { id } = req.params;
    const { transaction_ids, customer, project_case, shipment_date } = req.body;

    const shipment = await db.get(
      "SELECT * FROM shipments WHERE id = ? AND warehouse_id = ? AND is_deleted = 0",
      [id, req.warehouseId]
    );

    if (!shipment) {
      return res.status(404).json({ success: false, error: "Shipment not found" });
    }

    // If transaction_ids provided, validate them
    if (transaction_ids && Array.isArray(transaction_ids)) {
      const validationErrors = [];
      const validatedTransactionIds = [];

      for (const txId of transaction_ids) {
        const transaction = await db.get(
          `SELECT st.shipment_id FROM transactions t
           JOIN products p ON p.id = t.product_id
           LEFT JOIN shipment_transactions st ON t.id = st.transaction_id
           WHERE t.id = ? AND p.warehouse_id = ?`,
          [txId, req.warehouseId]
        );

        if (!transaction) {
          validationErrors.push(`Transaction ${txId}: not found`);
          continue;
        }

        // Allow if it already belongs to this shipment, or if it belongs to no shipment
        if (transaction.shipment_id && transaction.shipment_id !== Number(id)) {
          validationErrors.push(`Transaction ${txId}: already belongs to shipment ${transaction.shipment_id}`);
          continue;
        }

        validatedTransactionIds.push(txId);
      }

      if (validationErrors.length > 0) {
        return res.status(409).json({
          success: false,
          error: "Conflict: Some transactions are already assigned to other shipments",
          errors: validationErrors,
        });
      }

      if (validatedTransactionIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No valid transactions provided",
        });
      }

      await db.transaction(async (tx) => {
        // Remove old relationships
        await tx.run("DELETE FROM shipment_transactions WHERE shipment_id = ?", [id]);

        // Add new relationships
        for (const txId of validatedTransactionIds) {
          await tx.run(
            `INSERT INTO shipment_transactions (shipment_id, transaction_id) VALUES (?, ?)`,
            [id, txId]
          );
        }

        // Update shipment fields
        await tx.run(
          `UPDATE shipments SET customer = ?, project_case = ?, shipment_date = ? WHERE id = ?`,
          [customer || null, project_case || null, shipment_date || shipment.shipment_date, id]
        );
      });

      const updated = await db.get("SELECT * FROM shipments WHERE id = ?", [id]);
      const txIds = await db.all(
        `SELECT transaction_id FROM shipment_transactions WHERE shipment_id = ?`,
        [id]
      );
      const transactions = await db.all(
        `SELECT t.* FROM transactions t
         WHERE t.id IN (${txIds.map(tx => tx.transaction_id).join(',') || 'NULL'})`
      );

      res.json({
        success: true,
        data: {
          id: updated.id,
          shipment_number: updated.shipment_number,
          customer: updated.customer,
          project_case: updated.project_case,
          shipment_date: updated.shipment_date,
          transaction_ids: txIds.map(tx => tx.transaction_id),
          items_summary: transactions,
          updated_at: updated.updated_at,
        },
      });
    } else {
      // Update only business fields
      await db.run(
        `UPDATE shipments SET customer = ?, project_case = ?, shipment_date = ? WHERE id = ?`,
        [customer ?? shipment.customer, project_case ?? shipment.project_case, shipment_date ?? shipment.shipment_date, id]
      );

      const updated = await db.get("SELECT * FROM shipments WHERE id = ?", [id]);
      res.json({
        success: true,
        data: {
          id: updated.id,
          shipment_number: updated.shipment_number,
          customer: updated.customer,
          project_case: updated.project_case,
          shipment_date: updated.shipment_date,
          updated_at: updated.updated_at,
        },
      });
    }
  } catch (error) {
    console.error("Error updating shipment:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Delete shipment (soft delete)
async function delete_(req, res) {
  try {
    const { id } = req.params;

    const shipment = await db.get(
      "SELECT * FROM shipments WHERE id = ? AND warehouse_id = ? AND is_deleted = 0",
      [id, req.warehouseId]
    );

    if (!shipment) {
      return res.status(404).json({ success: false, error: "Shipment not found" });
    }

    await db.transaction(async (tx) => {
      // Soft delete shipment
      await tx.run("UPDATE shipments SET is_deleted = 1 WHERE id = ?", [id]);

      // Remove all transaction relationships
      await tx.run("DELETE FROM shipment_transactions WHERE shipment_id = ?", [id]);
    });

    res.json({
      success: true,
      message: "Shipment deleted successfully",
      data: { id, shipment_number: shipment.shipment_number },
    });
  } catch (error) {
    console.error("Error deleting shipment:", error);
    res.status(500).json({ success: false, error: error.message });
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
