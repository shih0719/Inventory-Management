const request = require("supertest");
const { setupTestDb, teardownTestDb } = require("./helpers/db");
const { createApp } = require("../src/app");

let app;
let adminToken;
let defaultWhId;

beforeAll(async () => {
  await setupTestDb();
  app = createApp();

  // Get Default warehouse id and assign to admin
  const { get, run } = require("../src/config/database");
  const wh = await get("SELECT id FROM warehouses WHERE name = 'default' COLLATE NOCASE");
  defaultWhId = wh.id;

  // Login - token may not include the new warehouse yet, re-login after assigning
  const adminUser = await get("SELECT id FROM users WHERE username = 'eric'");
  await run(
    "INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?)",
    [adminUser.id, defaultWhId]
  );

  const res = await request(app)
    .post("/api/auth/login")
    .send({ username: "eric", password: "password" });
  adminToken = res.body.data.token;
});

afterAll(async () => {
  await teardownTestDb();
});

describe("Issue #11: warehouse_id schema migration", () => {
  it("POST /api/products 帶 X-Warehouse-Id header，product 自動歸屬該倉庫", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Warehouse-Id", String(defaultWhId))
      .send({ sku: "WH-TEST-001", name: "Test Product", type: "hardware" });

    expect(res.status).toBe(201);
    expect(res.body.data.warehouse_id).toBe(defaultWhId);
  });

  it("同一倉庫建立重複 SKU 回傳 409", async () => {
    await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Warehouse-Id", String(defaultWhId))
      .send({ sku: "WH-DUP-001", name: "Product A", type: "hardware" });

    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Warehouse-Id", String(defaultWhId))
      .send({ sku: "WH-DUP-001", name: "Product B", type: "hardware" });

    expect(res.status).toBe(409);
  });

  it("不同倉庫可以有相同 SKU", async () => {
    const { run, get } = require("../src/config/database");

    await run("INSERT OR IGNORE INTO warehouses (name) VALUES ('Warehouse B')");
    const whB = await get("SELECT id FROM warehouses WHERE name = 'Warehouse B'");
    const adminUser = await get("SELECT id FROM users WHERE username = 'eric'");
    await run(
      "INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?)",
      [adminUser.id, whB.id]
    );

    // Re-login to get token with both warehouses
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: "eric", password: "password" });
    const token = loginRes.body.data.token;

    const resA = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Warehouse-Id", String(defaultWhId))
      .send({ sku: "SHARED-SKU-001", name: "Product in Default", type: "hardware" });

    const resB = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Warehouse-Id", String(whB.id))
      .send({ sku: "SHARED-SKU-001", name: "Product in B", type: "hardware" });

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    expect(resA.body.data.warehouse_id).toBe(defaultWhId);
    expect(resB.body.data.warehouse_id).toBe(whB.id);
  });

  it("新建使用者自動指派 Default 倉庫", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ username: "newuser_wh_test", password: "pass123", role: "view" });

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body.data.warehouses)).toBe(true);
    expect(res.body.data.warehouses.length).toBeGreaterThan(0);
  });
});
