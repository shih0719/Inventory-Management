const ExcelJS = require("exceljs");
const db = require("../config/database");

const UNIT_STATUS_LABEL = { sold: "已出貨", in_stock: "已退回（在庫）" };

// Batch remarks are stored as "[有帳] text"; the type has its own column here.
const stripTypePrefix = (remarks) => (remarks || "").replace(/^\[(有帳|無帳)\]\s*/, "");

/**
 * Build the export workbook for one shipment: sheet「出貨明細」(header, one row per
 * transaction, totals, sign-off) and sheet「序號表」(one row per AP unit).
 * Returns null when the shipment does not exist in the warehouse or was deleted.
 */
async function buildShipmentWorkbook(shipmentId, warehouseId) {
  const shipment = await db.get("SELECT * FROM shipments WHERE id = ? AND warehouse_id = ? AND is_deleted = 0", [shipmentId, warehouseId]);
  if (!shipment) return null;

  const warehouse = await db.get("SELECT name FROM warehouses WHERE id = ?", [warehouseId]);
  const transactions = await db.all(
    `SELECT t.*, p.sku, p.name AS product_name, tg.display_name AS tag_name
     FROM shipment_transactions st
     JOIN transactions t ON t.id = st.transaction_id
     JOIN products p ON p.id = t.product_id
     JOIN tags tg ON tg.id = t.tag_id
     WHERE st.shipment_id = ?
     ORDER BY t.created_at ASC, t.id ASC`,
    [shipmentId]
  );

  const units = [];
  for (const tx of transactions) {
    let ids = [];
    try {
      ids = JSON.parse(tx.product_unit_ids || "[]");
    } catch {
      ids = [];
    }
    tx.serialCount = Array.isArray(ids) ? ids.length : 0;
    if (tx.serialCount === 0) continue;
    const rows = await db.all(
      `SELECT serial_number, status FROM product_units WHERE id IN (${ids.map(() => "?").join(",")})`,
      ids
    );
    // Shipped time comes from this shipment's transaction: a unit's own sold_at is cleared on return.
    for (const u of rows) units.push({ ...u, sku: tx.sku, product_name: tx.product_name, shipped_at: tx.created_at });
  }
  units.sort((a, b) => a.sku.localeCompare(b.sku) || a.serial_number.localeCompare(b.serial_number));

  const wb = new ExcelJS.Workbook();
  const bold = { bold: true };

  // ── Sheet 1: 出貨明細 ─────────────────────────────────────────────────────
  const ws = wb.addWorksheet("出貨明細");
  ws.columns = [{ width: 12 }, { width: 18 }, { width: 28 }, { width: 8 }, { width: 10 }, { width: 10 }, { width: 8 }, { width: 30 }];
  const header = [
    ["出貨單號", shipment.shipment_number],
    ["出貨日期", shipment.shipment_date || ""],
    ["客戶", shipment.customer || ""],
    ["案子", shipment.project_case || ""],
    ["倉庫", warehouse?.name || ""],
    ["建立者", shipment.created_by_user || ""],
    ["建立時間", shipment.created_at || ""],
    ["匯出時間", new Date().toISOString().replace("T", " ").slice(0, 19)],
  ];
  for (const [label, value] of header) {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = bold;
  }
  ws.addRow([]);
  const head = ws.addRow(["項次", "SKU", "品名", "數量", "有帳/無帳", "標籤", "序號數", "備註"]);
  head.font = bold;
  let totalQty = 0;
  transactions.forEach((tx, i) => {
    const qty = Math.abs(tx.quantity_change);
    totalQty += qty;
    ws.addRow([
      i + 1,
      tx.sku,
      tx.product_name,
      qty,
      tx.quantity_type === "accountable" ? "有帳" : "無帳",
      tx.tag_name,
      tx.serialCount || "",
      stripTypePrefix(tx.remarks),
    ]);
  });
  const total = ws.addRow(["合計", `${transactions.length} 項`, "", totalQty, "", "", units.length || "", ""]);
  total.font = bold;
  ws.addRow([]);
  ws.addRow(["出貨人", "", "", "收貨人", "", "", "日期", ""]).font = bold;

  // ── Sheet 2: 序號表 ───────────────────────────────────────────────────────
  const ss = wb.addWorksheet("序號表");
  ss.columns = [{ width: 8 }, { width: 18 }, { width: 28 }, { width: 22 }, { width: 22 }, { width: 16 }];
  ss.addRow(["出貨單號", shipment.shipment_number]).getCell(1).font = bold;
  ss.addRow([]);
  ss.addRow(["項次", "SKU", "品名", "序號", "出貨時間", "目前狀態"]).font = bold;
  units.forEach((u, i) => {
    ss.addRow([i + 1, u.sku, u.product_name, u.serial_number, u.shipped_at || "", UNIT_STATUS_LABEL[u.status] || u.status]);
  });
  ss.addRow(["合計", `${units.length} 台`]).font = bold;

  return { filename: `${shipment.shipment_number}.xlsx`, workbook: wb };
}

module.exports = { buildShipmentWorkbook };
