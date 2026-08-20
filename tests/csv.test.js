const request = require("supertest");
const path = require("path");
const fs = require("fs");
const os = require("os");
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
    const username = `csv_${role}`;
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

function writeTempCsv(content) {
  const filePath = path.join(os.tmpdir(), `test-import-${Date.now()}.csv`);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

const HEADER = "SKU,Name,Type";

describe("POST /api/csv/import", () => {
  it("未登入回傳 401", async () => {
    const res = await request(app)
      .post("/api/csv/import")
      .set("X-Warehouse-Id", warehouseId);
    expect(res.status).toBe(401);
  });

  it("view 角色回傳 403", async () => {
    const res = await request(app)
      .post("/api/csv/import")
      .set("Authorization", `Bearer ${viewToken}`)
      .set("X-Warehouse-Id", warehouseId);
    expect(res.status).toBe(403);
  });

  it("manager 角色可匯入 CSV", async () => {
    const csvPath = writeTempCsv("SKU,Name,Type\nCSV-MGR-001,Manager Import,hardware\n");
    const res = await request(app)
      .post("/api/csv/import")
      .set("Authorization", `Bearer ${managerToken}`)
      .set("X-Warehouse-Id", warehouseId)
      .attach("file", csvPath);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    fs.unlinkSync(csvPath);
  });

  it("匯入的產品綁定到當前倉庫", async () => {
    const { get } = require("../src/config/database");
    const csvPath = writeTempCsv("SKU,Name,Type\nCSV-WH-001,Warehouse Bound,hardware\n");
    await request(app)
      .post("/api/csv/import")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Warehouse-Id", warehouseId)
      .attach("file", csvPath);

    const product = await get(
      "SELECT warehouse_id FROM products WHERE sku = ?",
      ["CSV-WH-001"]
    );
    expect(product).toBeTruthy();
    expect(String(product.warehouse_id)).toBe(warehouseId);
    fs.unlinkSync(csvPath);
  });

  it("沒有上傳檔案回傳 400", async () => {
    const res = await request(app)
      .post("/api/csv/import")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Warehouse-Id", warehouseId);
    expect(res.status).toBe(400);
  });

  it("缺少 X-Warehouse-Id 回傳 403", async () => {
    const res = await request(app)
      .post("/api/csv/import")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/csv/export", () => {
  it("未登入回傳 401", async () => {
    const res = await request(app)
      .get("/api/csv/export")
      .set("X-Warehouse-Id", warehouseId);
    expect(res.status).toBe(401);
  });

  it("view 角色可匯出", async () => {
    const res = await request(app)
      .get("/api/csv/export")
      .set("Authorization", `Bearer ${viewToken}`)
      .set("X-Warehouse-Id", warehouseId);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
  });
});

describe("GET /api/csv/template", () => {
  it("回傳 CSV 範本", async () => {
    const res = await request(app)
      .get("/api/csv/template")
      .set("Authorization", `Bearer ${viewToken}`)
      .set("X-Warehouse-Id", warehouseId);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
  });
});
