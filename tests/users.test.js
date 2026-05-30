const request = require("supertest");
const bcrypt = require("bcrypt");
const { setupTestDb, teardownTestDb } = require("./helpers/db");
const { createApp } = require("../src/app");
const { run } = require("../src/config/database");

let app;

async function loginAs(role) {
  const username = `usr_${role}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  const hash = await bcrypt.hash("pass123", 10);
  const result = await run(
    "INSERT INTO users (username, password_hash, role, provider) VALUES (?, ?, ?, 'local')",
    [username, hash, role]
  );
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password: "pass123" });
  return { token: res.body.data.token, id: result.id, username };
}

beforeAll(async () => {
  await setupTestDb();
  app = createApp();
});

afterAll(async () => {
  await teardownTestDb();
});

describe("GET /api/users", () => {
  it("未登入回傳 401", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
  });

  it("manager 角色回傳 403", async () => {
    const { token } = await loginAs("manager");
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("admin 回傳使用者清單含 role 和 warehouses", async () => {
    const { token } = await loginAs("admin");
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const user = res.body.data[0];
    expect(user).toHaveProperty("role");
    expect(user).toHaveProperty("warehouses");
    expect(user).not.toHaveProperty("password_hash");
  });
});

describe("POST /api/users", () => {
  it("view 角色回傳 403", async () => {
    const { token } = await loginAs("view");
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username: "newuser", password: "pass123", role: "view" });
    expect(res.status).toBe(403);
  });

  it("admin 可以建立 local 使用者", async () => {
    const { token } = await loginAs("admin");
    const username = `created_${Date.now()}`;
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username, password: "pass123", role: "manager" });
    expect(res.status).toBe(201);
    expect(res.body.data.username).toBe(username);
    expect(res.body.data.role).toBe("manager");
    expect(res.body.data).not.toHaveProperty("password_hash");
  });

  it("username 重複回傳 409", async () => {
    const { token } = await loginAs("admin");
    const username = `dup_${Date.now()}`;
    await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username, password: "pass123", role: "view" });
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username, password: "pass123", role: "view" });
    expect(res.status).toBe(409);
  });

  it("warehouse_ids 含不存在的 id 回傳 400", async () => {
    const { token } = await loginAs("admin");
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username: `wh_bad_${Date.now()}`, password: "pass123", role: "view", warehouse_ids: [99999] });
    expect(res.status).toBe(400);
  });

  it("建立使用者時可以指派倉庫", async () => {
    const { token } = await loginAs("admin");
    const wh = await request(app)
      .post("/api/warehouses")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `使用者倉庫_${Date.now()}` });
    const warehouseId = wh.body.data.id;

    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ username: `wh_user_${Date.now()}`, password: "pass123", role: "manager", warehouse_ids: [warehouseId] });
    expect(res.status).toBe(201);
    expect(res.body.data.warehouses).toContain(warehouseId);
  });
});

describe("PUT /api/users/:id", () => {
  it("manager 角色回傳 403", async () => {
    const { token } = await loginAs("manager");
    const { id } = await loginAs("view");
    const res = await request(app)
      .put(`/api/users/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "manager" });
    expect(res.status).toBe(403);
  });

  it("admin 可以修改 role", async () => {
    const { token } = await loginAs("admin");
    const { id } = await loginAs("view");
    const res = await request(app)
      .put(`/api/users/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "manager", warehouse_ids: [] });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("manager");
  });
});

describe("DELETE /api/users/:id", () => {
  it("view 角色回傳 403", async () => {
    const { token } = await loginAs("view");
    const { id } = await loginAs("view");
    const res = await request(app)
      .delete(`/api/users/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("admin 不能刪除自己", async () => {
    const { token, id } = await loginAs("admin");
    const res = await request(app)
      .delete(`/api/users/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("admin 可以刪除其他使用者", async () => {
    const { token } = await loginAs("admin");
    const { id } = await loginAs("view");
    const res = await request(app)
      .delete(`/api/users/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
