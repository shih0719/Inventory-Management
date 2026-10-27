const request = require("supertest");
const { setupTestDb, teardownTestDb } = require("./helpers/db");
const { createApp } = require("../src/app");

// B3 決議：PUT /api/product-units/:id 不能改 status，狀態只能經由出貨／退貨流程改變
let app;
let token;
let warehouseId;
let db;
let productId;

beforeAll(async () => {
  await setupTestDb();
  app = createApp();
  db = require("../src/config/database");

  await db.run("INSERT OR IGNORE INTO warehouses (name) VALUES ('UnitUpdateWH')");
  warehouseId = (await db.get("SELECT id FROM warehouses WHERE name = 'UnitUpdateWH'")).id;
  const adminUser = await db.get("SELECT id FROM users WHERE username = 'eric'");
  await db.run("INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?)", [adminUser.id, warehouseId]);
  token = (await request(app).post("/api/auth/login").send({ username: "eric", password: "password" })).body.data.token;

  const res = await request(app)
    .post("/api/products")
    .set("Authorization", `Bearer ${token}`)
    .set("X-Warehouse-Id", String(warehouseId))
    .send({ sku: "UU-AP", name: "UU-AP", type: "hardware", track_serial: true });
  productId = res.body.data.id;
});

afterAll(async () => {
  await teardownTestDb();
});

async function insertUnit(serial, status) {
  const sold = status === "sold";
  const r = await db.run(
    "INSERT INTO product_units (product_id, serial_number, status, project_case, sold_to, sold_at) VALUES (?, ?, ?, ?, ?, ?)",
    [productId, serial, status, sold ? "CASE-1" : null, sold ? "ACME" : null, sold ? "2026-10-01T00:00:00Z" : null]
  );
  return r.id;
}

function put(id, body) {
  return request(app)
    .put(`/api/product-units/${id}`)
    .set("Authorization", `Bearer ${token}`)
    .set("X-Warehouse-Id", String(warehouseId))
    .send(body);
}

describe("PUT /api/product-units/:id", () => {
  it("帶 status → 400，序號不變", async () => {
    const id = await insertUnit("UU-1", "in_stock");
    const res = await put(id, { status: "sold", project_case: "CASE-X" });
    expect(res.status).toBe(400);
    const unit = await db.get("SELECT status, project_case FROM product_units WHERE id = ?", [id]);
    expect(unit).toEqual({ status: "in_stock", project_case: null });
  });

  it("已出貨的序號可修改 project_case / sold_to / remarks，sold_at 不變", async () => {
    const id = await insertUnit("UU-2", "sold");
    const res = await put(id, { project_case: "CASE-2", sold_to: "Beta", remarks: "改單" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: "sold",
      project_case: "CASE-2",
      sold_to: "Beta",
      remarks: "改單",
      sold_at: "2026-10-01T00:00:00Z",
    });
  });

  it("已出貨的序號不能清空 project_case", async () => {
    const id = await insertUnit("UU-3", "sold");
    const res = await put(id, { project_case: "  " });
    expect(res.status).toBe(400);
  });

  it("在庫的序號只能改 remarks，帶出貨欄位 → 400", async () => {
    const id = await insertUnit("UU-4", "in_stock");
    expect((await put(id, { remarks: "備註" })).status).toBe(200);
    expect((await put(id, { sold_to: "ACME" })).status).toBe(400);
    expect((await put(id, { project_case: "CASE-4" })).status).toBe(400);
  });
});
