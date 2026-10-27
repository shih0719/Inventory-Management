const request = require("supertest");
const { setupTestDb, teardownTestDb } = require("./helpers/db");
const { createApp } = require("../src/app");

// C2：/api/product-units 只能看到、改到目前倉庫（X-Warehouse-Id）的序號品
let app;
let token;
let db;
let whA;
let whB;
let productA;
let productB;
let unitB;

beforeAll(async () => {
  await setupTestDb();
  app = createApp();
  db = require("../src/config/database");

  await db.run("INSERT OR IGNORE INTO warehouses (name) VALUES ('ApWhA'), ('ApWhB')");
  whA = (await db.get("SELECT id FROM warehouses WHERE name = 'ApWhA'")).id;
  whB = (await db.get("SELECT id FROM warehouses WHERE name = 'ApWhB'")).id;
  const admin = await db.get("SELECT id FROM users WHERE username = 'eric'");
  await db.run("INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?), (?, ?)", [admin.id, whA, admin.id, whB]);
  token = (await request(app).post("/api/auth/login").send({ username: "eric", password: "password" })).body.data.token;

  productA = await createProduct("APW-A", whA);
  productB = await createProduct("APW-B", whB);
  unitB = (await db.run(
    "INSERT INTO product_units (product_id, serial_number, status, project_case) VALUES (?, 'APW-B-1', 'sold', 'CASE-B')",
    [productB]
  )).id;
});

afterAll(async () => {
  await teardownTestDb();
});

async function createProduct(sku, wh) {
  const res = await request(app)
    .post("/api/products")
    .set("Authorization", `Bearer ${token}`)
    .set("X-Warehouse-Id", String(wh))
    .send({ sku, name: sku, type: "hardware", track_serial: true });
  return res.body.data.id;
}

// 所有請求都以倉庫 A 的身分送出
function asA(method, url) {
  return request(app)[method](url).set("Authorization", `Bearer ${token}`).set("X-Warehouse-Id", String(whA));
}

describe("其他倉庫的序號品", () => {
  it("GET /:id → 404", async () => {
    expect((await asA("get", `/api/product-units/${unitB}`)).status).toBe(404);
  });

  it("PUT /:id → 404，資料不變", async () => {
    const res = await asA("put", `/api/product-units/${unitB}`).send({ remarks: "hacked" });
    expect(res.status).toBe(404);
    expect((await db.get("SELECT remarks FROM product_units WHERE id = ?", [unitB])).remarks).toBeNull();
  });

  it("DELETE /:id → 404，序號仍在", async () => {
    const id = (await db.run("INSERT INTO product_units (product_id, serial_number) VALUES (?, 'APW-B-DEL')", [productB])).id;
    expect((await asA("delete", `/api/product-units/${id}`)).status).toBe(404);
    expect(await db.get("SELECT id FROM product_units WHERE id = ?", [id])).toBeTruthy();
  });

  it("GET / 不列出", async () => {
    const res = await asA("get", "/api/product-units?limit=1000");
    expect(res.status).toBe(200);
    expect(res.body.data.map((u) => u.serial_number)).not.toContain("APW-B-1");
    expect(res.body.pagination.total).toBe(res.body.data.length);
  });

  it("GET /export 不匯出", async () => {
    await db.run("INSERT INTO product_units (product_id, serial_number) VALUES (?, 'APW-A-EXP')", [productA]);
    const res = await asA("get", "/api/product-units/export");
    expect(res.status).toBe(200);
    expect(res.text).toContain("APW-A-EXP");
    expect(res.text).not.toContain("APW-B-1");
  });
});

describe("用其他倉庫的商品建立序號品", () => {
  it("POST / → 400", async () => {
    const res = await asA("post", "/api/product-units").send({ product_id: productB, serial_number: "APW-X-1" });
    expect(res.status).toBe(400);
    expect(await db.get("SELECT id FROM product_units WHERE serial_number = 'APW-X-1'")).toBeUndefined();
  });

  it("POST /bulk → 400，不建立序號也不動數量", async () => {
    const res = await asA("post", "/api/product-units/bulk").send({ product_id: productB, serial_numbers: ["APW-X-2"] });
    expect(res.status).toBe(400);
    expect(await db.get("SELECT id FROM product_units WHERE serial_number = 'APW-X-2'")).toBeUndefined();
    expect((await db.get("SELECT accountable_quantity FROM products WHERE id = ?", [productB])).accountable_quantity).toBe(0);
  });
});

describe("建立序號品", () => {
  it("POST /bulk 的 warehouse_id 取自商品，忽略 body", async () => {
    const res = await asA("post", "/api/product-units/bulk").send({ product_id: productA, serial_numbers: ["APW-A-1"], warehouse_id: whB });
    expect(res.status).toBe(201);
    expect((await db.get("SELECT warehouse_id FROM product_units WHERE serial_number = 'APW-A-1'")).warehouse_id).toBe(whA);
  });

  it("POST / 接受數字序號並正規化", async () => {
    const res = await asA("post", "/api/product-units").send({ product_id: productA, serial_number: 12345 });
    expect(res.status).toBe(201);
    expect(res.body.data.serial_number).toBe("12345");
  });
});
