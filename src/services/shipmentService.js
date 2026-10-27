/**
 * Shipments — the only module that writes `shipments` and `shipment_transactions`.
 *
 * A shipment belongs to one warehouse and binds outbound transactions of that
 * warehouse; a transaction belongs to at most one shipment. Write functions take
 * `conn` — run them inside db.transaction() so the binding check and the write
 * see the same rows (transactions run one at a time).
 */

const db = require("../config/database");
const auditService = require("./auditService");
const transactionQuery = require("./transactionQuery");

class ShipmentError extends Error {
  constructor(message, status, errors = []) {
    super(message);
    this.name = "ShipmentError";
    this.status = status;
    this.errors = errors;
  }
}

// Generate shipment number in format SHP-YYYYMMDD-XXX
async function generateShipmentNumber(shipmentDate, conn = db) {
  const date = new Date(shipmentDate);
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');

  // MAX over ALL rows (including soft-deleted): the unique index may cover them too.
  const result = await conn.get(
    `SELECT MAX(CAST(substr(shipment_number, 14) AS INTEGER)) AS maxSeq FROM shipments
     WHERE shipment_number LIKE ?`,
    [`SHP-${dateStr}-%`]
  );

  const nextSeq = (result?.maxSeq || 0) + 1;
  return `SHP-${dateStr}-${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Check `ids` can be bound to `shipmentId` (null for a new shipment): each one is
 * an outbound transaction of the warehouse, bound to no other shipment.
 * Returns the de-duplicated ids; throws ShipmentError 400 (empty) or 409.
 */
async function checkBindable(conn, ids, warehouseId, shipmentId = null) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) throw new ShipmentError("No valid transactions provided", 400);

  const errors = [];
  for (const txId of unique) {
    const row = await conn.get(
      `SELECT t.quantity_change, st.shipment_id FROM transactions t
       JOIN products p ON p.id = t.product_id
       LEFT JOIN shipment_transactions st ON t.id = st.transaction_id
       WHERE t.id = ? AND p.warehouse_id = ?`,
      [txId, warehouseId]
    );
    if (!row) errors.push(`Transaction ${txId}: not found`);
    else if (row.quantity_change >= 0) errors.push(`Transaction ${txId}: not an outbound transaction`);
    else if (row.shipment_id && row.shipment_id !== Number(shipmentId)) {
      errors.push(`Transaction ${txId}: already belongs to shipment ${row.shipment_id}`);
    }
  }
  if (errors.length > 0) {
    throw new ShipmentError("Conflict: Some transactions cannot be bound to this shipment", 409, errors);
  }
  return unique;
}

async function bind(conn, shipmentId, ids) {
  await conn.run("DELETE FROM shipment_transactions WHERE shipment_id = ?", [shipmentId]);
  for (const txId of ids) {
    await conn.run("INSERT INTO shipment_transactions (shipment_id, transaction_id) VALUES (?, ?)", [shipmentId, txId]);
  }
}

/**
 * Create a shipment bound to `transactionIds`. `shipmentDate` defaults to today.
 * @param {{userId?:number, username?:string, warehouseId:number}} actor
 * @returns {{id:number, shipment_number:string}}
 */
async function create(conn, { transactionIds, customer, projectCase, shipmentDate }, actor) {
  const ids = await checkBindable(conn, transactionIds, actor.warehouseId);
  const date = shipmentDate || new Date().toISOString().split('T')[0];
  const shipmentNumber = await generateShipmentNumber(date, conn);
  const result = await conn.run(
    `INSERT INTO shipments (shipment_number, customer, project_case, shipment_date, created_by_user, warehouse_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [shipmentNumber, customer || null, projectCase || null, date, actor.username || "unknown", actor.warehouseId]
  );
  await bind(conn, result.id, ids);
  await auditService.logAction(actor.userId, "CREATE", "shipment", result.id, actor.warehouseId);
  return { id: result.id, shipment_number: shipmentNumber };
}

async function findActive(conn, id, warehouseId) {
  return conn.get("SELECT * FROM shipments WHERE id = ? AND warehouse_id = ? AND is_deleted = 0", [id, warehouseId]);
}

/**
 * Update the shipment's fields (omitted ones are kept) and, when `transactionIds`
 * is given, replace its bindings. Throws ShipmentError 404 / 400 / 409.
 */
async function update(conn, id, { transactionIds, customer, projectCase, shipmentDate }, warehouseId) {
  const shipment = await findActive(conn, id, warehouseId);
  if (!shipment) throw new ShipmentError("Shipment not found", 404);

  if (transactionIds !== undefined) {
    await bind(conn, shipment.id, await checkBindable(conn, transactionIds, warehouseId, shipment.id));
  }
  await conn.run(
    "UPDATE shipments SET customer = ?, project_case = ?, shipment_date = ? WHERE id = ?",
    [customer ?? shipment.customer, projectCase ?? shipment.project_case, shipmentDate ?? shipment.shipment_date, shipment.id]
  );
}

/** Soft-delete the shipment and release its transactions. Throws ShipmentError 404. */
async function remove(conn, id, warehouseId) {
  const shipment = await findActive(conn, id, warehouseId);
  if (!shipment) throw new ShipmentError("Shipment not found", 404);
  await conn.run("UPDATE shipments SET is_deleted = 1 WHERE id = ?", [shipment.id]);
  await conn.run("DELETE FROM shipment_transactions WHERE shipment_id = ?", [shipment.id]);
  return shipment;
}

/**
 * The shipment with its bound transactions (oldest first, serials attached),
 * or null when it is not an active shipment of the warehouse.
 */
async function getDetail(conn, id, warehouseId) {
  const shipment = await findActive(conn, id, warehouseId);
  if (!shipment) return null;
  const rows = await conn.all("SELECT transaction_id FROM shipment_transactions WHERE shipment_id = ?", [shipment.id]);
  const transactionIds = rows.map((r) => r.transaction_id);
  const items = await transactionQuery.list(conn, warehouseId, { ids: transactionIds }, { sort: "created_at", order: "asc" });
  return { shipment, transactionIds, items };
}

module.exports = { ShipmentError, generateShipmentNumber, create, update, remove, getDetail };
