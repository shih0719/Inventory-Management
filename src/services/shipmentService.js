const db = require("../config/database");

// Generate shipment number in format SHP-YYYYMMDD-XXX
async function generateShipmentNumber(shipmentDate) {
  const date = new Date(shipmentDate);
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');

  // MAX over ALL rows (including soft-deleted): the unique index may cover them too.
  const result = await db.get(
    `SELECT MAX(CAST(substr(shipment_number, 14) AS INTEGER)) AS maxSeq FROM shipments
     WHERE shipment_number LIKE ?`,
    [`SHP-${dateStr}-%`]
  );

  const nextSeq = (result?.maxSeq || 0) + 1;
  return `SHP-${dateStr}-${String(nextSeq).padStart(3, '0')}`;
}

module.exports = { generateShipmentNumber };
