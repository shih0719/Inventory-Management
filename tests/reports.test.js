const request = require("supertest");
const { setupTestDb, teardownTestDb } = require("./helpers/db");
const { createApp } = require("../src/app");

let app;
let adminToken;
let viewToken;
let warehouseId;

beforeAll(async () => {
  await setupTestDb();
  app = createApp();

  const { run, get } = require("../src/config/database");
  const bcrypt = require("bcrypt");

  const wh = await get("SELECT id FROM warehouses WHERE name = 'default' COLLATE NOCASE");
  warehouseId = String(wh.id);

  async function makeUser(role) {
    const username = `report_${role}`;
    const hash = await bcrypt.hash("pass123", 10);
    await run(
      "INSERT OR IGNORE INTO users (username, password_hash, role, provider) VALUES (?, ?, ?, 'local')",
      [username, hash, role]
    );
    const user = await get("SELECT id FROM users WHERE username = ?", [username]);
    await run(
      "INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?)",
      [user.id, wh.id]
    );
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username, password: "pass123" });
    return res.body.data.token;
  }

  adminToken = await makeUser("admin");
  viewToken = await makeUser("view");
});

afterAll(async () => {
  await teardownTestDb();
});

describe("GET /api/reports/inventory", () => {
  it("未登入回傳 401", async () => {
    const res = await request(app)
      .get("/api/reports/inventory")
      .set("X-Warehouse-Id", warehouseId);
    expect(res.status).toBe(401);
  });

  it("缺少 X-Warehouse-Id 回傳 403", async () => {
    const res = await request(app)
      .get("/api/reports/inventory")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it("view 角色可存取報表", async () => {
    const res = await request(app)
      .get("/api/reports/inventory")
      .set("Authorization", `Bearer ${viewToken}`)
      .set("X-Warehouse-Id", warehouseId);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("products");
    expect(res.body.data).toHaveProperty("summary");
    expect(res.body.data.summary).toHaveProperty("total");
    expect(res.body.data.summary).toHaveProperty("low_stock_count");
    expect(res.body.data.summary).toHaveProperty("low_stock_items");
  });

  it("回傳的產品只屬於指定倉庫", async () => {
    const { run, get } = require("../src/config/database");

    // Create a second warehouse and a product in it
    await run("INSERT INTO warehouses (name) VALUES ('other-wh')");
    const otherWh = await get("SELECT id FROM warehouses WHERE name = 'other-wh'");

    await run(
      "INSERT INTO products (sku, name, type, warehouse_id) VALUES (?, ?, 'hardware', ?)",
      ["OTHER-SKU-001", "Other Warehouse Product", otherWh.id]
    );

    // Report for default warehouse should NOT include the other warehouse product
    const res = await request(app)
      .get("/api/reports/inventory")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Warehouse-Id", warehouseId);

    expect(res.status).toBe(200);
    const skus = res.body.data.products.map((p) => p.sku);
    expect(skus).not.toContain("OTHER-SKU-001");
  });

  it("低庫存產品出現在 summary.low_stock_items", async () => {
    const { run } = require("../src/config/database");

    await run(
      "INSERT INTO products (sku, name, type, warehouse_id, min_stock, accountable_quantity) VALUES (?, ?, 'hardware', ?, 10, 2)",
      ["LOW-001", "Low Stock Product", warehouseId]
    );

    const res = await request(app)
      .get("/api/reports/inventory")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Warehouse-Id", warehouseId);

    expect(res.status).toBe(200);
    const lowSkus = res.body.data.summary.low_stock_items.map((p) => p.sku);
    expect(lowSkus).toContain("LOW-001");
    expect(res.body.data.summary.low_stock_count).toBeGreaterThanOrEqual(1);
  });
});
