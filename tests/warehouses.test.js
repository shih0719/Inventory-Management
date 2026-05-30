const request = require("supertest");
const bcrypt = require("bcrypt");
const { setupTestDb, teardownTestDb } = require("./helpers/db");
const { createApp } = require("../src/app");
const { run } = require("../src/config/database");

let app;

async function loginAs(role) {
  const username = `wh_${role}_${Date.now()}`;
  const hash = await bcrypt.hash("pass123", 10);
  await run(
    "INSERT INTO users (username, password_hash, role, provider) VALUES (?, ?, ?, 'local')",
    [username, hash, role]
  );
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password: "pass123" });
  return res.body.data.token;
}

beforeAll(async () => {
  await setupTestDb();
  app = createApp();
});

afterAll(async () => {
  await teardownTestDb();
});

describe("GET /api/warehouses", () => {
  it("未登入時回傳 401", async () => {
    const res = await request(app).get("/api/warehouses");
    expect(res.status).toBe(401);
  });

  it("登入後回傳倉庫清單", async () => {
    const token = await loginAs("view");
    const res = await request(app)
      .get("/api/warehouses")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe("POST /api/warehouses", () => {
  it("view 角色收到 403", async () => {
    const token = await loginAs("view");
    const res = await request(app)
      .post("/api/warehouses")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "倉庫A" });
    expect(res.status).toBe(403);
  });

  it("manager 角色收到 403", async () => {
    const token = await loginAs("manager");
    const res = await request(app)
      .post("/api/warehouses")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "倉庫B" });
    expect(res.status).toBe(403);
  });

  it("admin 可以建立倉庫", async () => {
    const token = await loginAs("admin");
    const res = await request(app)
      .post("/api/warehouses")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "主倉庫", description: "台北主倉" });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("主倉庫");
    expect(res.body.data.id).toBeDefined();
  });

  it("倉庫名稱重複回傳 409", async () => {
    const token = await loginAs("admin");
    await request(app)
      .post("/api/warehouses")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "重複倉庫" });
    const res = await request(app)
      .post("/api/warehouses")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "重複倉庫" });
    expect(res.status).toBe(409);
  });
});

describe("PUT /api/warehouses/:id", () => {
  it("view 角色收到 403", async () => {
    const adminToken = await loginAs("admin");
    const created = await request(app)
      .post("/api/warehouses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `編輯測試_${Date.now()}` });
    const id = created.body.data.id;

    const token = await loginAs("view");
    const res = await request(app)
      .put(`/api/warehouses/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "改名" });
    expect(res.status).toBe(403);
  });

  it("admin 可以修改倉庫", async () => {
    const token = await loginAs("admin");
    const created = await request(app)
      .post("/api/warehouses")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `修改目標_${Date.now()}` });
    const id = created.body.data.id;

    const res = await request(app)
      .put(`/api/warehouses/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "新名稱", description: "更新描述" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("新名稱");
  });
});

describe("DELETE /api/warehouses/:id", () => {
  it("manager 角色收到 403", async () => {
    const adminToken = await loginAs("admin");
    const created = await request(app)
      .post("/api/warehouses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `刪除測試_${Date.now()}` });
    const id = created.body.data.id;

    const token = await loginAs("manager");
    const res = await request(app)
      .delete(`/api/warehouses/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("admin 可以刪除倉庫", async () => {
    const token = await loginAs("admin");
    const created = await request(app)
      .post("/api/warehouses")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `待刪倉庫_${Date.now()}` });
    const id = created.body.data.id;

    const res = await request(app)
      .delete(`/api/warehouses/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
