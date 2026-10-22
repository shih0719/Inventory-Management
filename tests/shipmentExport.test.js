const request = require("supertest");
const ExcelJS = require("exceljs");
const { setupTestDb, teardownTestDb } = require("./helpers/db");
const { createApp } = require("../src/app");

let app;
let token;
let warehouseId;
let db;
let shipmentId;

const auth = (req) => req.set("Authorization", `Bearer ${token}`).set("X-Warehouse-Id", String(warehouseId));

function binaryParser(res, callback) {
  const chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
}

async function exportWorkbook(id) {
  const res = await auth(request(app).get(`/api/shipments/${id}/export`)).buffer(true).parse(binaryParser);
  const wb = new ExcelJS.Workbook();
  if (res.status === 200) await wb.xlsx.load(res.body);
  return { res, wb };
}

/** All non-empty rows of a sheet as arrays of cell text. */
const rowsOf = (ws) => {
  const rows = [];
  ws.eachRow((row) => rows.push(row.values.slice(1).map((v) => (v == null ? "" : String(v)))));
  return rows;
};

beforeAll(async () => {
  await setupTestDb();
  app = createApp();
  db = require("../src/config/database");

  await db.run("INSERT OR IGNORE INTO warehouses (name) VALUES ('ExportWH')");
  warehouseId = (await db.get("SELECT id FROM warehouses WHERE name = 'ExportWH'")).id;
  const adminUser = await db.get("SELECT id FROM users WHERE username = 'eric'");
  await db.run("INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?)", [adminUser.id, warehouseId]);
  token = (await request(app).post("/api/auth/login").send({ username: "eric", password: "password" })).body.data.token;

  const create = (body) => auth(request(app).post("/api/products")).send(body);
  const cableId = (await create({ sku: "EX-CABLE", name: "網路線", type: "hardware", accountable_quantity: 10 })).body.data.id;
  const apId = (await create({ sku: "EX-AP", name: "基地台", type: "hardware", track_serial: true })).body.data.id;
  // AP stock can't be created by quantity; the fixture sets it to match its serials.
  await db.run("UPDATE products SET accountable_quantity = 2 WHERE id = ?", [apId]);
  for (const sn of ["EX-SN-2", "EX-SN-1"]) {
    await db.run("INSERT INTO product_units (product_id, serial_number, status) VALUES (?, ?, 'in_stock')", [apId, sn]);
  }

  const outboundTagId = (await db.get("SELECT id FROM tags WHERE name = 'OUTBOUND'")).id;
  const res = await auth(request(app).post("/api/outbound")).send({
    tag_id: outboundTagId,
    items: [{ product_id: cableId, quantity: 3, quantity_type: "accountable", remarks: "機房用" }],
    serial_numbers: ["EX-SN-2", "EX-SN-1"],
    shipment: { customer: "ACME", project_case: "CASE-X", shipment_date: "2026-10-11" },
  });
  shipmentId = res.body.data.shipment_id;
});

afterAll(async () => {
  await teardownTestDb();
});

describe("GET /api/shipments/:id/export", () => {
  it("回傳 xlsx，檔名為出貨單號，含「出貨明細」與「序號表」兩個工作表", async () => {
    const { res, wb } = await exportWorkbook(shipmentId);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");
    expect(res.headers["content-disposition"]).toContain("SHP-20261011-001.xlsx");
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(["出貨明細", "序號表"]);
  });

  it("出貨明細：表頭資訊、正數數量、序號數與合計", async () => {
    const { wb } = await exportWorkbook(shipmentId);
    const rows = rowsOf(wb.getWorksheet("出貨明細"));
    const find = (label) => rows.find((r) => r[0] === label);

    expect(find("出貨單號")[1]).toBe("SHP-20261011-001");
    expect(find("客戶")[1]).toBe("ACME");
    expect(find("案子")[1]).toBe("CASE-X");
    expect(find("倉庫")[1]).toBe("ExportWH");

    const cable = rows.find((r) => r.includes("EX-CABLE"));
    expect(cable).toEqual(expect.arrayContaining(["網路線", "3", "有帳", "機房用"]));
    const ap = rows.find((r) => r.includes("EX-AP"));
    expect(ap).toEqual(expect.arrayContaining(["基地台", "2"]));

    const total = rows.find((r) => r.includes("合計"));
    expect(total).toEqual(expect.arrayContaining(["5"]));
  });

  it("序號表：一台一列、依序號排序、顯示目前狀態（退回的標示在庫）", async () => {
    await db.run("UPDATE product_units SET status = 'in_stock', project_case = NULL, sold_to = NULL, sold_at = NULL WHERE serial_number = 'EX-SN-2'");

    const { wb } = await exportWorkbook(shipmentId);
    const rows = rowsOf(wb.getWorksheet("序號表")).filter((r) => r.some((c) => c.startsWith("EX-SN-")));

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(expect.arrayContaining(["EX-AP", "基地台", "EX-SN-1", "已出貨"]));
    expect(rows[1]).toEqual(expect.arrayContaining(["EX-SN-2", "已退回（在庫）"]));
    // Shipped time comes from the shipment's transaction, so it survives the return.
    expect(rows[1][4]).not.toBe("");
  });

  it("不存在的出貨單 → 404", async () => {
    const res = await auth(request(app).get("/api/shipments/99999/export"));
    expect(res.status).toBe(404);
  });
});
