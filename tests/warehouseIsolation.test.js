const request = require("supertest");
const { setupTestDb, teardownTestDb } = require("./helpers/db");
const { createApp } = require("../src/app");

// B2：products / transactions / batches / shipments 只能看到、改到目前倉庫（X-Warehouse-Id）的資料
let app;
let token;
let db;
let whA;
let whB;
let whNoAccess;
let inboundTagId;
let productA;
let productB;
let txB;
let batchB;
let shipmentB;

beforeAll(async () => {
  await setupTestDb();
  app = createApp();
  db = require("../src/config/database");

  await db.run("INSERT OR IGNORE INTO warehouses (name) VALUES ('IsoA'), ('IsoB'), ('IsoNoAccess')");
  whA = (await db.get("SELECT id FROM warehouses WHERE name = 'IsoA'")).id;
  whB = (await db.get("SELECT id FROM warehouses WHERE name = 'IsoB'")).id;
  whNoAccess = (await db.get("SELECT id FROM warehouses WHERE name = 'IsoNoAccess'")).id;
  const admin = await db.get("SELECT id FROM users WHERE username = 'eric'");
  await db.run("INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?), (?, ?)", [admin.id, whA, admin.id, whB]);
  token = (await request(app).post("/api/auth/login").send({ username: "eric", password: "password" })).body.data.token;
  inboundTagId = (await db.get("SELECT id FROM tags WHERE name = 'INBOUND'")).id;

  productA = (await as(whA, "post", "/api/products").send({ sku: "ISO-A", name: "ISO-A", non_accountable_quantity: 5 })).body.data.id;
  productB = (await as(whB, "post", "/api/products").send({ sku: "ISO-B", name: "ISO-B", non_accountable_quantity: 5 })).body.data.id;

  const batchRes = await as(whB, "post", "/api/batches").send({
    tag_id: inboundTagId,
    items: [{ product_id: productB, quantity_change: 1, quantity_type: "non_accountable" }],
  });
  batchB = batchRes.body.data.batch_id;
  txB = (await db.get("SELECT id FROM transactions WHERE batch_id = ?", [batchB])).id;
  shipmentB = (await as(whB, "post", "/api/shipments").send({ transaction_ids: [txB] })).body.data.id;
});

afterAll(async () => {
  await teardownTestDb();
});

function as(wh, method, url) {
  return request(app)[method](url).set("Authorization", `Bearer ${token}`).set("X-Warehouse-Id", String(wh));
}
const asA = (method, url) => as(whA, method, url);
const qty = async (id) => (await db.get("SELECT non_accountable_quantity AS q FROM products WHERE id = ?", [id])).q;

describe("products", () => {
  it("GET /:id 其他倉庫 → 404", async () => {
    expect((await asA("get", `/api/products/${productB}`)).status).toBe(404);
  });

  it("PUT /:id 其他倉庫 → 404，資料不變", async () => {
    expect((await asA("put", `/api/products/${productB}`).send({ name: "hacked" })).status).toBe(404);
    expect((await db.get("SELECT name FROM products WHERE id = ?", [productB])).name).toBe("ISO-B");
  });

  it("DELETE /:id 其他倉庫 → 404，仍在", async () => {
    const id = (await as(whB, "post", "/api/products").send({ sku: "ISO-B-DEL", name: "x" })).body.data.id;
    expect((await asA("delete", `/api/products/${id}`)).status).toBe(404);
    expect((await db.get("SELECT is_deleted FROM products WHERE id = ?", [id])).is_deleted).toBe(0);
  });

  it("GET /:sku/locations 只找目前倉庫", async () => {
    expect((await asA("get", "/api/products/ISO-B/locations")).status).toBe(404);
  });

  it("GET /lookup 可查有權限的其他倉庫（調撥用），無權限 → 403", async () => {
    const ok = await asA("get", `/api/products/lookup?sku=ISO-B&warehouse_id=${whB}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.id).toBe(productB);
    expect((await asA("get", `/api/products/lookup?sku=ISO-B&warehouse_id=${whNoAccess}`)).status).toBe(403);
  });

  it("POST / 忽略 body 的 warehouse_id，建在目前倉庫", async () => {
    const res = await asA("post", "/api/products").send({ sku: "ISO-BODY", name: "x", warehouse_id: whNoAccess });
    expect(res.status).toBe(201);
    expect(res.body.data.warehouse_id).toBe(whA);
  });
});

describe("transactions", () => {
  it("GET /:id 其他倉庫 → 404", async () => {
    expect((await asA("get", `/api/transactions/${txB}`)).status).toBe(404);
  });

  it("GET /product/:id 其他倉庫的商品 → 404", async () => {
    expect((await asA("get", `/api/transactions/product/${productB}`)).status).toBe(404);
  });

  it("POST / 其他倉庫的商品 → 404，數量不變", async () => {
    const before = await qty(productB);
    const res = await asA("post", "/api/transactions").send({ product_id: productB, tag_id: inboundTagId, quantity_change: 3, quantity_type: "non_accountable" });
    expect(res.status).toBe(404);
    expect(await qty(productB)).toBe(before);
  });
});

describe("batches", () => {
  it("新建的批次寫入 warehouse_id", async () => {
    expect((await db.get("SELECT warehouse_id FROM batches WHERE id = ?", [batchB])).warehouse_id).toBe(whB);
  });

  it("GET / 不列出其他倉庫", async () => {
    const res = await asA("get", "/api/batches");
    expect(res.status).toBe(200);
    expect(res.body.data.map((b) => b.id)).not.toContain(batchB);
  });

  it("GET /:id 其他倉庫 → 404", async () => {
    expect((await asA("get", `/api/batches/${batchB}`)).status).toBe(404);
  });

  it("POST / 含其他倉庫的商品 → 400，整批不寫入", async () => {
    const before = await qty(productB);
    const res = await asA("post", "/api/batches").send({
      tag_id: inboundTagId,
      items: [
        { product_id: productA, quantity_change: 1, quantity_type: "non_accountable" },
        { product_id: productB, quantity_change: 1, quantity_type: "non_accountable" },
      ],
    });
    expect(res.status).toBe(400);
    expect(await qty(productB)).toBe(before);
  });
});

describe("shipments", () => {
  it("新建的出貨單寫入 warehouse_id", async () => {
    expect((await db.get("SELECT warehouse_id FROM shipments WHERE id = ?", [shipmentB])).warehouse_id).toBe(whB);
  });

  it("GET / 不列出其他倉庫", async () => {
    const res = await asA("get", "/api/shipments");
    expect(res.status).toBe(200);
    expect(res.body.data.map((s) => s.id)).not.toContain(shipmentB);
  });

  it("GET /:id、/:id/export 其他倉庫 → 404", async () => {
    expect((await asA("get", `/api/shipments/${shipmentB}`)).status).toBe(404);
    expect((await asA("get", `/api/shipments/${shipmentB}/export`)).status).toBe(404);
  });

  it("PUT /:id 其他倉庫 → 404，資料不變", async () => {
    expect((await asA("put", `/api/shipments/${shipmentB}`).send({ customer: "hacked" })).status).toBe(404);
    expect((await db.get("SELECT customer FROM shipments WHERE id = ?", [shipmentB])).customer).toBeNull();
  });

  it("DELETE /:id 其他倉庫 → 404，仍在", async () => {
    expect((await asA("delete", `/api/shipments/${shipmentB}`)).status).toBe(404);
    expect((await db.get("SELECT is_deleted FROM shipments WHERE id = ?", [shipmentB])).is_deleted).toBe(0);
  });

  it("POST / 綁定其他倉庫的異動 → 409（視為找不到），不建立", async () => {
    const txA = (await db.get("SELECT id FROM transactions WHERE product_id = ?", [productA])).id;
    const loose = (await db.run(
      "INSERT INTO transactions (product_id, tag_id, quantity_change, quantity_type, warehouse_id) VALUES (?, ?, 1, 'non_accountable', ?)",
      [productB, inboundTagId, whB]
    )).id;
    const count = async () => (await db.get("SELECT COUNT(*) AS n FROM shipments")).n;
    const before = await count();
    const res = await asA("post", "/api/shipments").send({ transaction_ids: [txA, loose] });
    expect(res.status).toBe(409);
    expect(res.body.errors).toEqual([`Transaction ${loose}: not found`]);
    expect(await count()).toBe(before);
  });
});
