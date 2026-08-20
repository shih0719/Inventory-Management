const request = require("supertest");
const { setupTestDb, teardownTestDb } = require("./helpers/db");
const { createApp } = require("../src/app");

let app;
let adminToken;
let managerToken;
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
    const username = `audit_${role}`;
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
  managerToken = await makeUser("manager");
  viewToken = await makeUser("view");
});

afterAll(async () => {
  await teardownTestDb();
});

describe("GET /api/audit-logs", () => {
  it("未登入回傳 401", async () => {
    const res = await request(app)
      .get("/api/audit-logs")
      .set("X-Warehouse-Id", warehouseId);
    expect(res.status).toBe(401);
  });

  it("view 角色回傳 403", async () => {
    const res = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${viewToken}`)
      .set("X-Warehouse-Id", warehouseId);
    expect(res.status).toBe(403);
  });

  it("manager 角色回傳 403", async () => {
    const res = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${managerToken}`)
      .set("X-Warehouse-Id", warehouseId);
    expect(res.status).toBe(403);
  });

  it("admin 角色可存取", async () => {
    const res = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Warehouse-Id", warehouseId);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toHaveProperty("total");
  });

  it("缺少 X-Warehouse-Id 回傳 403", async () => {
    const res = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it("audit log 只回傳當前倉庫的記錄", async () => {
    const { run, get } = require("../src/config/database");
    const { logAction } = require("../src/services/auditService");

    const adminUser = await get("SELECT id FROM users WHERE username = 'audit_admin'");
    const otherWh = await get("SELECT id FROM warehouses WHERE name = 'other-wh'") ||
      await (async () => {
        await run("INSERT OR IGNORE INTO warehouses (name) VALUES ('other-wh-audit')");
        return get("SELECT id FROM warehouses WHERE name = 'other-wh-audit'");
      })();

    await logAction(adminUser.id, "CREATE", "product", 999, Number(warehouseId));
    await logAction(adminUser.id, "CREATE", "product", 888, otherWh.id);

    const res = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Warehouse-Id", warehouseId);

    expect(res.status).toBe(200);
    const resourceIds = res.body.data.map((l) => l.resource_id);
    expect(resourceIds).toContain(999);
    expect(resourceIds).not.toContain(888);
  });

  it("支援 action 過濾", async () => {
    const res = await request(app)
      .get("/api/audit-logs?action=CREATE")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Warehouse-Id", warehouseId);

    expect(res.status).toBe(200);
    const actions = res.body.data.map((l) => l.action);
    actions.forEach((a) => expect(a).toBe("CREATE"));
  });

  it("支援分頁 limit/offset", async () => {
    const res = await request(app)
      .get("/api/audit-logs?limit=1&offset=0")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Warehouse-Id", warehouseId);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
  });
});
