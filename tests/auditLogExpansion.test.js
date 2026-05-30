const request = require("supertest");
const { setupTestDb, teardownTestDb } = require("./helpers/db");
const { createApp } = require("../src/app");

let app;
let db;
let logAction;
let userId;
let adminToken;
let warehouseId;

beforeAll(async () => {
  await setupTestDb();
  app = createApp();
  db = require("../src/config/database");
  ({ logAction } = require("../src/services/auditService"));

  const bcrypt = require("bcrypt");
  const hash = await bcrypt.hash("pass", 10);
  await db.run(
    "INSERT OR IGNORE INTO users (username, password_hash, role, provider) VALUES (?, ?, 'admin', 'local')",
    ["audit_exp_user", hash]
  );
  const user = await db.get("SELECT id FROM users WHERE username = 'audit_exp_user'");
  userId = user.id;

  const wh = await db.get("SELECT id FROM warehouses WHERE name = 'default' COLLATE NOCASE");
  warehouseId = String(wh.id);
  await db.run(
    "INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?)",
    [userId, wh.id]
  );

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ username: "audit_exp_user", password: "pass" });
  adminToken = loginRes.body.data.token;
});

afterAll(async () => {
  await teardownTestDb();
});

describe("GET /api/audit-logs?event_category filter", () => {
  beforeAll(async () => {
    await logAction(userId, "LOGIN", "auth", userId, null, { eventCategory: "system" });
    await logAction(userId, "CREATE", "product", 42, 1, { eventCategory: "transaction" });
  });

  it("event_category=system 只回傳 system events", async () => {
    const res = await request(app)
      .get("/api/audit-logs?event_category=system")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Warehouse-Id", warehouseId);

    expect(res.status).toBe(200);
    const logs = res.body.data;
    expect(Array.isArray(logs)).toBe(true);
    logs.forEach((l) => expect(l.event_category).toBe("system"));
  });

  it("event_category=transaction 只回傳 transaction events", async () => {
    const res = await request(app)
      .get("/api/audit-logs?event_category=transaction")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Warehouse-Id", warehouseId);

    expect(res.status).toBe(200);
    const logs = res.body.data;
    expect(Array.isArray(logs)).toBe(true);
    logs.forEach((l) => expect(l.event_category).toBe("transaction"));
  });
});

describe("Auth events", () => {
  it("登入成功 → DB 有 LOGIN system event", async () => {
    await request(app)
      .post("/api/auth/login")
      .send({ username: "audit_exp_user", password: "pass" });

    const row = await db.get(
      "SELECT action, event_category FROM audit_logs WHERE action = 'LOGIN' AND resource_type = 'auth' ORDER BY timestamp DESC LIMIT 1"
    );
    expect(row).toBeDefined();
    expect(row.event_category).toBe("system");
  });

  it("登入失敗 → DB 有 LOGIN_FAILED system event with metadata", async () => {
    await request(app)
      .post("/api/auth/login")
      .send({ username: "audit_exp_user", password: "wrong_password" });

    const row = await db.get(
      "SELECT action, event_category, metadata FROM audit_logs WHERE action = 'LOGIN_FAILED' ORDER BY timestamp DESC LIMIT 1"
    );
    expect(row).toBeDefined();
    expect(row.event_category).toBe("system");
    const meta = JSON.parse(row.metadata);
    expect(meta).toHaveProperty("username");
  });
});

describe("User management events", () => {
  it("建立用戶 → DB 有 USER_CREATE system event", async () => {
    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ username: "new_test_user_audit", password: "pass123", role: "view" });

    const row = await db.get(
      "SELECT action, event_category FROM audit_logs WHERE action = 'USER_CREATE' ORDER BY timestamp DESC LIMIT 1"
    );
    expect(row).toBeDefined();
    expect(row.event_category).toBe("system");
  });

  it("更新用戶 → DB 有 USER_UPDATE system event", async () => {
    const user = await db.get("SELECT id FROM users WHERE username = 'new_test_user_audit'");
    await request(app)
      .put(`/api/users/${user.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "manager", warehouse_ids: [] });

    const row = await db.get(
      "SELECT action, event_category FROM audit_logs WHERE action = 'USER_UPDATE' ORDER BY timestamp DESC LIMIT 1"
    );
    expect(row).toBeDefined();
    expect(row.event_category).toBe("system");
  });
});

describe("Warehouse events", () => {
  it("建立倉庫 → DB 有 WAREHOUSE_CREATE system event", async () => {
    await request(app)
      .post("/api/warehouses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "audit-test-warehouse", description: "test" });

    const row = await db.get(
      "SELECT action, event_category FROM audit_logs WHERE action = 'WAREHOUSE_CREATE' ORDER BY timestamp DESC LIMIT 1"
    );
    expect(row).toBeDefined();
    expect(row.event_category).toBe("system");
  });
});

describe("Product transaction events", () => {
  let productId;

  it("建立商品 → DB 有 CREATE transaction event for product", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Warehouse-Id", warehouseId)
      .send({ sku: "AUDIT-TEST-SKU", name: "Audit Test Product", type: "general" });

    expect(res.status).toBe(201);
    productId = res.body.data.id;

    const row = await db.get(
      "SELECT action, event_category, resource_type FROM audit_logs WHERE action = 'CREATE' AND resource_type = 'product' ORDER BY timestamp DESC LIMIT 1"
    );
    expect(row).toBeDefined();
    expect(row.event_category).toBe("transaction");
  });

  it("更新商品 → DB 有 UPDATE transaction event for product", async () => {
    await request(app)
      .put(`/api/products/${productId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Warehouse-Id", warehouseId)
      .send({ name: "Audit Test Product Updated" });

    const row = await db.get(
      "SELECT action, event_category, resource_type FROM audit_logs WHERE action = 'UPDATE' AND resource_type = 'product' ORDER BY timestamp DESC LIMIT 1"
    );
    expect(row).toBeDefined();
    expect(row.event_category).toBe("transaction");
  });
});

describe("logAction — event_category", () => {
  it("system event 寫入 event_category = system", async () => {
    await logAction(userId, "LOGIN", "auth", userId, null, { eventCategory: "system" });

    const row = await db.get(
      "SELECT event_category FROM audit_logs WHERE user_id = ? AND action = 'LOGIN' ORDER BY timestamp DESC LIMIT 1",
      [userId]
    );
    expect(row).toBeDefined();
    expect(row.event_category).toBe("system");
  });

  it("不傳 options 預設 event_category = transaction", async () => {
    await logAction(userId, "CREATE", "product", 1, 1);

    const row = await db.get(
      "SELECT event_category FROM audit_logs WHERE user_id = ? AND action = 'CREATE' ORDER BY timestamp DESC LIMIT 1",
      [userId]
    );
    expect(row).toBeDefined();
    expect(row.event_category).toBe("transaction");
  });

  it("userId = null 的系統事件仍可寫入", async () => {
    await logAction(null, "LOGIN_FAILED", "auth", 0, null, {
      eventCategory: "system",
      metadata: { reason: "null_user_test_marker" },
    });

    const row = await db.get(
      "SELECT event_category, metadata FROM audit_logs WHERE action = 'LOGIN_FAILED' AND metadata LIKE '%null_user_test_marker%' LIMIT 1"
    );
    expect(row).toBeDefined();
    expect(row.event_category).toBe("system");
    const meta = JSON.parse(row.metadata);
    expect(meta.reason).toBe("null_user_test_marker");
  });
});
