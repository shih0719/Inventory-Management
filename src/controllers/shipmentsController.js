const db = require("../config/database");
const auditService = require("../services/auditService");

// Generate shipment number in format SHP-YYYYMMDD-XXX
async function generateShipmentNumber(shipmentDate) {
  const date = new Date(shipmentDate);
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');

  const result = await db.get(
    `SELECT COUNT(*) as count FROM shipments
     WHERE shipment_number LIKE ? AND is_deleted = 0`,
    [`SHP-${dateStr}-%`]
  );

  const nextSeq = (result?.count || 0) + 1;
  return `SHP-${dateStr}-${String(nextSeq).padStart(3, '0')}`;
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

    const finalDate = shipment_date || new Date().toISOString().split('T')[0];

    // Phase 1: Validate all transactions exist and none are already in another shipment
    const validationErrors = [];
    const validatedTransactionIds = [];

    for (const txId of transaction_ids) {
      const transaction = await db.get(
        `SELECT st.shipment_id FROM transactions t
         LEFT JOIN shipment_transactions st ON t.id = st.transaction_id
         WHERE t.id = ?`,
        [txId]
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

    await db.run("BEGIN TRANSACTION");

    try {
      const createdByUser = req.user?.username || "unknown";
      const result = await db.run(
        `INSERT INTO shipments (shipment_number, customer, project_case, shipment_date, created_by_user)
         VALUES (?, ?, ?, ?, ?)`,
        [shipmentNumber, customer || null, project_case || null, finalDate, createdByUser]
      );

      const shipmentId = result.id;

      auditService.logAction(
        req.user?.id,
        "CREATE",
        "shipment",
        shipmentId,
        req.warehouseId
      );

      // Insert shipment-transaction relationships
      for (const txId of validatedTransactionIds) {
        await db.run(
          `INSERT INTO shipment_transactions (shipment_id, transaction_id) VALUES (?, ?)`,
          [shipmentId, txId]
        );
      }

      await db.run("COMMIT");

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
      await db.run("ROLLBACK");
      throw error;
    }
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
       WHERE s.is_deleted = 0
       GROUP BY s.id
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)]
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
      "SELECT * FROM shipments WHERE id = ? AND is_deleted = 0",
      [id]
    );

    if (!shipment) {
      return res.status(404).json({ success: false, error: "Shipment not found" });
    }

    const transactionIds = await db.all(
      `SELECT transaction_id FROM shipment_transactions WHERE shipment_id = ?`,
      [id]
    );

    const transactions = await db.all(
      `SELECT t.*, p.name as product_name, p.sku, p.type as product_type, tg.display_name as tag_name, tg.color as tag_color
       FROM transactions t
       JOIN products p ON t.product_id = p.id
       JOIN tags tg ON t.tag_id = tg.id
       WHERE t.id IN (${transactionIds.map(tx => tx.transaction_id).join(',') || 'NULL'})
       ORDER BY t.created_at ASC`
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

// Update shipment
async function update(req, res) {
  try {
    const { id } = req.params;
    const { transaction_ids, customer, project_case, shipment_date } = req.body;

    const shipment = await db.get(
      "SELECT * FROM shipments WHERE id = ? AND is_deleted = 0",
      [id]
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
           LEFT JOIN shipment_transactions st ON t.id = st.transaction_id
           WHERE t.id = ?`,
          [txId]
        );

        if (!transaction) {
          validationErrors.push(`Transaction ${txId}: not found`);
          continue;
        }

        // Allow if it already belongs to this shipment, or if it belongs to no shipment
        if (transaction.shipment_id && transaction.shipment_id !== id) {
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

      await db.run("BEGIN TRANSACTION");

      try {
        // Remove old relationships
        await db.run("DELETE FROM shipment_transactions WHERE shipment_id = ?", [id]);

        // Add new relationships
        for (const txId of validatedTransactionIds) {
          await db.run(
            `INSERT INTO shipment_transactions (shipment_id, transaction_id) VALUES (?, ?)`,
            [id, txId]
          );
        }

        // Update shipment fields
        await db.run(
          `UPDATE shipments SET customer = ?, project_case = ?, shipment_date = ? WHERE id = ?`,
          [customer || null, project_case || null, shipment_date || shipment.shipment_date, id]
        );

        await db.run("COMMIT");

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
      } catch (error) {
        await db.run("ROLLBACK");
        throw error;
      }
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
      "SELECT * FROM shipments WHERE id = ? AND is_deleted = 0",
      [id]
    );

    if (!shipment) {
      return res.status(404).json({ success: false, error: "Shipment not found" });
    }

    await db.run("BEGIN TRANSACTION");

    try {
      // Soft delete shipment
      await db.run("UPDATE shipments SET is_deleted = 1 WHERE id = ?", [id]);

      // Remove all transaction relationships
      await db.run("DELETE FROM shipment_transactions WHERE shipment_id = ?", [id]);

      await db.run("COMMIT");

      res.json({
        success: true,
        message: "Shipment deleted successfully",
        data: { id, shipment_number: shipment.shipment_number },
      });
    } catch (error) {
      await db.run("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("Error deleting shipment:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  create,
  getAll,
  getById,
  update,
  delete: delete_,
};
