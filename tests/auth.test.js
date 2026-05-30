const request = require("supertest");
const jwt = require("jsonwebtoken");
const { setupTestDb, teardownTestDb } = require("./helpers/db");
const { createApp } = require("../src/app");

let app;

beforeAll(async () => {
  await setupTestDb();
  app = createApp();
});

afterAll(async () => {
  await teardownTestDb();
});

async function loginAs(role) {
  const { run, get } = require("../src/config/database");
  const bcrypt = require("bcrypt");
  const username = `testuser_${role}`;
  const hash = await bcrypt.hash("pass123", 10);
  await run(
    "INSERT OR IGNORE INTO users (username, password_hash, role, provider) VALUES (?, ?, ?, 'local')",
    [username, hash, role]
  );
  const user = await get("SELECT id FROM users WHERE username = ?", [username]);
  const defaultWh = await get("SELECT id FROM warehouses WHERE name = 'default' COLLATE NOCASE");
  if (defaultWh) {
    await run(
      "INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?)",
      [user.id, defaultWh.id]
    );
  }
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password: "pass123" });
  return res.body.data.token;
}

describe("POST /api/auth/login", () => {
  it("成功登入後 JWT 包含 role 和 warehouses", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "eric", password: "password" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const token = res.body.data.token;
    const decoded = jwt.decode(token);

    expect(decoded.role).toBe("admin");
    expect(Array.isArray(decoded.warehouses)).toBe(true);
  });

  it("密碼錯誤時回傳 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "eric", password: "wrong" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/products", () => {
  it("未登入時回傳 401", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(401);
  });

  it("登入後可存取", async () => {
    const { get } = require("../src/config/database");
    const token = await loginAs("view");
    const defaultWh = await get("SELECT id FROM warehouses WHERE name = 'default' COLLATE NOCASE");
    const res = await request(app)
      .get("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Warehouse-Id", String(defaultWh.id));
    expect(res.status).toBe(200);
  });
});

describe("requireRole", () => {
  it("view 角色 POST /api/products 收到 403", async () => {
    const token = await loginAs("view");
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ sku: "TEST-001", name: "Test", type: "hardware" });
    expect(res.status).toBe(403);
  });

  it("manager 角色 POST /api/products 可以建立", async () => {
    const { get } = require("../src/config/database");
    const token = await loginAs("manager");
    const defaultWh = await get("SELECT id FROM warehouses WHERE name = 'default' COLLATE NOCASE");
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Warehouse-Id", String(defaultWh.id))
      .send({ sku: "TEST-002", name: "Test Product", type: "hardware" });
    expect(res.status).toBe(201);
  });

  it("view 角色 GET /api/audit-logs 收到 403", async () => {
    const token = await loginAs("view");
    const res = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("manager 角色 GET /api/audit-logs 收到 403", async () => {
    const token = await loginAs("manager");
    const res = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("admin 角色 GET /api/audit-logs 可以存取", async () => {
    const token = await loginAs("admin");
    const res = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Warehouse-Id", "1");
    expect(res.status).toBe(200);
  });
});

describe("GET /api/auth/me", () => {
  it("回傳包含 provider 欄位", async () => {
    const token = await loginAs("view");
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.provider).toBe("local");
  });
});
