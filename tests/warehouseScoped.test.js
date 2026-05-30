const request = require("supertest");
const { setupTestDb, teardownTestDb } = require("./helpers/db");
const { createApp } = require("../src/app");

let app;
let adminToken;
let whAId;
let whBId;

beforeAll(async () => {
  await setupTestDb();
  app = createApp();

  const res = await request(app)
    .post("/api/auth/login")
    .send({ username: "eric", password: "password" });
  adminToken = res.body.data.token;

  const { run, get } = require("../src/config/database");
  await run("INSERT OR IGNORE INTO warehouses (name) VALUES ('WarehouseA')");
  await run("INSERT OR IGNORE INTO warehouses (name) VALUES ('WarehouseB')");
  const whA = await get("SELECT id FROM warehouses WHERE name = 'WarehouseA'");
  const whB = await get("SELECT id FROM warehouses WHERE name = 'WarehouseB'");
  whAId = whA.id;
  whBId = whB.id;
});

afterAll(async () => {
  await teardownTestDb();
});

describe("Issue #12: requireWarehouse middleware", () => {
  it("GET /api/products 未帶 X-Warehouse-Id header 時回傳 403", async () => {
    const res = await request(app)
      .get("/api/products")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(403);
  });

  it("使用者存取無權限的倉庫時回傳 403", async () => {
    // 建立只有 WarehouseA 權限的使用者
    const { run, get } = require("../src/config/database");
    const bcrypt = require("bcrypt");
    const hash = await bcrypt.hash("pass123", 10);
    await run(
      "INSERT OR IGNORE INTO users (username, password_hash, role, provider) VALUES (?, ?, 'view', 'local')",
      ["limited_user", hash]
    );
    const user = await get("SELECT id FROM users WHERE username = 'limited_user'");
    await run("DELETE FROM user_warehouses WHERE user_id = ?", [user.id]);
    await run("INSERT INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?)", [user.id, whAId]);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: "limited_user", password: "pass123" });
    const token = loginRes.body.data.token;

    // 嘗試存取 WarehouseB（無權限）
    const res = await request(app)
      .get("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Warehouse-Id", String(whBId));

    expect(res.status).toBe(403);
  });

  it("倉庫 A 建立的 product，倉庫 B 查詢看不到", async () => {
    // admin 有所有倉庫權限，先給 admin 兩個倉庫
    const { run, get } = require("../src/config/database");
    const adminUser = await get("SELECT id FROM users WHERE username = 'eric'");
    await run("INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?)", [adminUser.id, whAId]);
    await run("INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?)", [adminUser.id, whBId]);

    // 重新登入取得含兩個倉庫的 token
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: "eric", password: "password" });
    const token = loginRes.body.data.token;

    // 在 WarehouseA 建立一個 product
    await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Warehouse-Id", String(whAId))
      .send({ sku: "ISOLATED-001", name: "Only in A", type: "hardware" });

    // 用 WarehouseB 查詢，不應看到該 product
    const res = await request(app)
      .get("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Warehouse-Id", String(whBId));

    expect(res.status).toBe(200);
    const skus = res.body.data.map(p => p.sku);
    expect(skus).not.toContain("ISOLATED-001");
  });

  it("POST /api/products 從 X-Warehouse-Id header 自動帶入 warehouse_id", async () => {
    const { get, run } = require("../src/config/database");
    const adminUser = await get("SELECT id FROM users WHERE username = 'eric'");
    await run("INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?)", [adminUser.id, whAId]);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: "eric", password: "password" });
    const token = loginRes.body.data.token;

    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Warehouse-Id", String(whAId))
      .send({ sku: "HEADER-WH-001", name: "From Header", type: "hardware" });

    expect(res.status).toBe(201);
    expect(res.body.data.warehouse_id).toBe(whAId);
  });
});
