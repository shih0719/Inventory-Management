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
    const csvPath = writeTempCsv("SKU,Name,Type\nCSV-MGR-001,Manager Import,normal\n");
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
    const csvPath = writeTempCsv("SKU,Name,Type\nCSV-WH-001,Warehouse Bound,normal\n");
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
    expect(res.body.code).toBe("FILE_NOT_PROVIDED");
  });

  it("不是 .csv 的檔案 → 400 INVALID_FILE_TYPE", async () => {
    const txtPath = path.join(os.tmpdir(), `notes-${Date.now()}.txt`);
    fs.writeFileSync(txtPath, "x");
    const res = await request(app)
      .post("/api/csv/import")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Warehouse-Id", warehouseId)
      .attach("file", txtPath);
    fs.unlinkSync(txtPath);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "INVALID_FILE_TYPE", params: { fileName: path.basename(txtPath) } });
  });

  it("每列都無效 → 400，逐列帶 code 的錯誤", async () => {
    const csvPath = writeTempCsv("SKU,Name,Type,IsAccount\nBAD SKU,X,normal,0\nCSV-NEG,X,normal,-1\n");
    const res = await request(app)
      .post("/api/csv/import")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Warehouse-Id", warehouseId)
      .attach("file", csvPath);
    fs.unlinkSync(csvPath);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      code: "IMPORT_FAILED",
      params: { count: 2 },
      errors: [
        { row: 1, label: "#1", code: "INVALID_SKU_FORMAT", params: { sku: "BAD SKU" } },
        { row: 2, label: "#2", code: "INVALID_QUANTITY", params: { field: "IsAccount", value: "-1" } },
      ],
    });
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
