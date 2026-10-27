const request = require("supertest");
const { setupTestDb, teardownTestDb } = require("./helpers/db");
const { createApp } = require("../src/app");

// C6：交易的讀取路徑（歷史列表、匯出、單筆、依商品、出貨單與批次明細）
let app;
let token;
let db;
let wh;
let inboundTagId;
let outboundTagId;
let plain;
let ap;
let batchId;
let outbound;

beforeAll(async () => {
  await setupTestDb();
  app = createApp();
  db = require("../src/config/database");

  await db.run("INSERT OR IGNORE INTO warehouses (name) VALUES ('ReadsWH')");
  wh = (await db.get("SELECT id FROM warehouses WHERE name = 'ReadsWH'")).id;
  const admin = await db.get("SELECT id FROM users WHERE username = 'eric'");
  await db.run("INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?)", [admin.id, wh]);
  token = (await request(app).post("/api/auth/login").send({ username: "eric", password: "password" })).body.data.token;
  inboundTagId = (await db.get("SELECT id FROM tags WHERE name = 'INBOUND'")).id;
  outboundTagId = (await db.get("SELECT id FROM tags WHERE name = 'OUTBOUND'")).id;

  plain = (await api("post", "/api/products").send({ sku: "RD-PLAIN", name: "Plain", non_accountable_quantity: 10 })).body.data.id;
  ap = (await api("post", "/api/products").send({ sku: "RD-AP", name: "Ap", track_serial: true })).body.data.id;

  // AP inbound with serials, then a plain inbound in the same batch
  batchId = (await api("post", "/api/batches").send({
    tag_id: inboundTagId,
    description: "reads",
    items: [
      { product_id: ap, quantity_change: 2, quantity_type: "accountable", serial_numbers: ["RD-1", "RD-2"] },
      { product_id: plain, quantity_change: 3, quantity_type: "non_accountable" },
    ],
  })).body.data.batch_id;

  outbound = (await api("post", "/api/outbound").send({
    tag_id: outboundTagId,
    serial_numbers: ["RD-1"],
    shipment: { customer: "ACME", project_case: "CASE-R" },
  })).body.data;
});

afterAll(async () => {
  await teardownTestDb();
});

function api(method, url) {
  return request(app)[method](url).set("Authorization", `Bearer ${token}`).set("X-Warehouse-Id", String(wh));
}

describe("GET /api/transactions", () => {
  it("列出目前倉庫的異動，帶商品、標籤、批次欄位與分頁", async () => {
    const res = await api("get", "/api/transactions?limit=2&page=1");
    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ total: 4, page: 1, limit: 2, totalPages: 2 });
    expect(res.body.data).toHaveLength(2);
    const row = res.body.data[0];
    expect(row).toEqual(expect.objectContaining({ product_name: expect.any(String), sku: expect.any(String), tag_name: expect.any(String) }));
  });

  it("篩選 + 排序", async () => {
    const res = await api("get", "/api/transactions?sku=RD-AP&sort=quantity_change&order=asc");
    expect(res.body.data.map((t) => t.quantity_change)).toEqual([-1, 2]);
    expect((await api("get", "/api/transactions?direction=out")).body.data.map((t) => t.sku)).toEqual(["RD-AP"]);
    expect((await api("get", `/api/transactions?batch_id=${batchId}`)).body.pagination.total).toBe(2);
  });

  it("移動序號的異動帶 product_units，其他為 null", async () => {
    const rows = (await api("get", "/api/transactions?limit=100")).body.data;
    const apIn = rows.find((t) => t.sku === "RD-AP" && t.quantity_change === 2);
    expect(apIn.product_units.map((u) => u.serial_number).sort()).toEqual(["RD-1", "RD-2"]);
    expect(apIn.batch_number).toMatch(/^BATCH-/);
    expect(rows.find((t) => t.sku === "RD-PLAIN" && t.quantity_change === 3).product_units).toBeNull();
  });
});

describe("GET /api/transactions/:id、/product/:id", () => {
  it("單筆帶 product_type 與 product_units", async () => {
    const id = (await db.get("SELECT id FROM transactions WHERE product_id = ? AND quantity_change = -1", [ap])).id;
    const res = await api("get", `/api/transactions/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id, sku: "RD-AP", product_type: "ap", tag_name: expect.any(String) });
    expect(res.body.data.product_units).toEqual([expect.objectContaining({ serial_number: "RD-1", status: "sold" })]);
  });

  it("依商品列出（只含該商品）", async () => {
    const res = await api("get", `/api/transactions/product/${plain}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((t) => t.quantity_change).sort((a, b) => a - b)).toEqual([3, 10]);
    expect(res.body.data.every((t) => t.sku === "RD-PLAIN")).toBe(true);
  });
});

describe("GET /api/transactions/export", () => {
  it("匯出篩選後的異動", async () => {
    const res = await api("get", "/api/transactions/export?sku=RD-PLAIN");
    expect(res.status).toBe(200);
    expect(res.text).toContain("RD-PLAIN");
    expect(res.text).not.toContain("RD-AP");
  });
});

describe("明細頁", () => {
  it("GET /api/shipments/:id 的 items_summary 帶商品與序號", async () => {
    const res = await api("get", `/api/shipments/${outbound.shipment_id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items_summary).toEqual([
      expect.objectContaining({ sku: "RD-AP", product_type: "ap", quantity_change: -1, product_units: [expect.objectContaining({ serial_number: "RD-1" })] }),
    ]);
  });

  it("GET /api/batches/:id 依時間列出批次內的異動", async () => {
    const res = await api("get", `/api/batches/${batchId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.transactions.map((t) => t.sku)).toEqual(["RD-AP", "RD-PLAIN"]);
    expect(res.body.data.transactions[0]).toMatchObject({ product_name: "Ap", tag_name: expect.any(String) });
  });
});
