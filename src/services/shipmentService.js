const db = require("../config/database");

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

module.exports = { generateShipmentNumber };
