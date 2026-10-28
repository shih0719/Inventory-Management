// Behaviour that changed when every quantity path moved onto the Stock Ledger (ADR 0003).
const request = require("supertest");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { setupTestDb, teardownTestDb } = require("./helpers/db");
const { createApp } = require("../src/app");

let app;
let db;
let token;
let warehouseId;
let inboundTagId;

beforeAll(async () => {
  await setupTestDb();
  app = createApp();
  db = require("../src/config/database");

  await db.run("INSERT OR IGNORE INTO warehouses (name) VALUES ('RouteLedgerWH')");
  warehouseId = (await db.get("SELECT id FROM warehouses WHERE name = 'RouteLedgerWH'")).id;
  const admin = await db.get("SELECT id FROM users WHERE username = 'eric'");
  await db.run("INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?)", [admin.id, warehouseId]);
  token = (await request(app).post("/api/auth/login").send({ username: "eric", password: "password" })).body.data.token;
  inboundTagId = (await db.get("SELECT id FROM tags WHERE name = 'INBOUND'")).id;
});

afterAll(async () => {
  await teardownTestDb();
});

const auth = (req) => req.set("Authorization", `Bearer ${token}`).set("X-Warehouse-Id", String(warehouseId));
const createProduct = (body) => auth(request(app).post("/api/products")).send({ name: body.sku, type: "hardware", ...body });
const productBySku = (sku) => db.get("SELECT * FROM products WHERE sku = ? AND warehouse_id = ?", [sku, warehouseId]);
const txsOf = (productId) => db.all("SELECT t.*, tg.name AS tag FROM transactions t JOIN tags tg ON t.tag_id = tg.id WHERE product_id = ? ORDER BY t.id", [productId]);

describe("POST /api/products 的初始數量", () => {
  it("寫成 ADJUSTMENT Transaction，數量 = Transaction 累加", async () => {
    const res = await createProduct({ sku: "RL-NEW", accountable_quantity: 5, non_accountable_quantity: 2 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ accountable_quantity: 5, non_accountable_quantity: 2 });

    const txs = await txsOf(res.body.data.id);
    expect(txs.map((t) => [t.tag, t.source, t.quantity_type, t.quantity_change, t.quantity_before, t.warehouse_id])).toEqual([
      ["ADJUSTMENT", "adjust", "accountable", 5, 0, warehouseId],
      ["ADJUSTMENT", "adjust", "non_accountable", 2, 0, warehouseId],
    ]);
  });

  it("數量為 0 時不寫 Transaction", async () => {
    const res = await createProduct({ sku: "RL-ZERO" });
    expect(res.status).toBe(201);
    expect(await txsOf(res.body.data.id)).toHaveLength(0);
  });

  it("AP 商品的初始有帳數量必須為 0 → 400，商品也不建立", async () => {
    const res = await createProduct({ sku: "RL-AP", track_serial: true, accountable_quantity: 3 });
    expect(res.status).toBe(400);
    expect(await productBySku("RL-AP")).toBeUndefined();
  });

  it("負數初始數量 → 400", async () => {
    const res = await createProduct({ sku: "RL-NEG", accountable_quantity: -1 });
    expect(res.status).toBe(400);
    expect(await productBySku("RL-NEG")).toBeUndefined();
  });
});

describe("POST /api/batches", () => {
  it("同商品兩行合計超過庫存 → 400（累計餘額）", async () => {
    const { id } = (await createProduct({ sku: "RL-BATCH-2X", accountable_quantity: 3 })).body.data;
    const res = await auth(request(app).post("/api/batches")).send({
      tag_id: inboundTagId,
      items: [
        { product_id: id, quantity_change: -2, quantity_type: "accountable" },
        { product_id: id, quantity_change: -2, quantity_type: "accountable" },
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      code: "VALIDATION_FAILED",
      errors: [{ label: "#2 (RL-BATCH-2X)", code: "INSUFFICIENT_STOCK", params: { current: 1, requested: 2 } }],
    });
    expect((await productBySku("RL-BATCH-2X")).accountable_quantity).toBe(3);
  });

  it("Transaction 帶 warehouse_id 與 batch_id", async () => {
    const { id } = (await createProduct({ sku: "RL-BATCH-WH" })).body.data;
    const res = await auth(request(app).post("/api/batches")).send({
      tag_id: inboundTagId,
      items: [{ product_id: id, quantity_change: 4, quantity_type: "accountable" }],
    });
    expect(res.status).toBe(201);
    const [tx] = await txsOf(id);
    expect(tx).toMatchObject({ warehouse_id: warehouseId, batch_id: res.body.data.batch_id, quantity_after: 4 });
  });
});

describe("POST /api/product-units/bulk", () => {
  it("入庫 Transaction 帶 warehouse_id、前綴並記 audit", async () => {
    const { id } = (await createProduct({ sku: "RL-APBULK", track_serial: true })).body.data;
    const res = await auth(request(app).post("/api/product-units/bulk")).send({ product_id: id, serial_numbers: ["rl-b-1", "RL-B-2"] });
    expect(res.status).toBe(201);

    const [tx] = await txsOf(id);
    expect(tx).toMatchObject({ tag: "INBOUND", source: "ap-bulk", quantity_change: 2, warehouse_id: warehouseId, remarks: "[有帳] 系統自動" });
    const log = await db.get("SELECT 1 AS ok FROM audit_logs WHERE resource_type = 'transaction' AND resource_id = ?", [tx.id]);
    expect(log).toBeTruthy();
  });
});

describe("POST /api/csv/import 的數量語意", () => {
  const importCsv = async (rows) => {
    const filePath = path.join(os.tmpdir(), `ledger-import-${Date.now()}-${Math.random()}.csv`);
    // UTF-8 BOM so the importer doesn't fall back to Big5.
    fs.writeFileSync(filePath, "﻿SKU,Name,Type,IsAccount,NoAccount\n" + rows.join("\n") + "\n", "utf8");
    try {
      return await auth(request(app).post("/api/csv/import")).attach("file", filePath);
    } finally {
      fs.unlinkSync(filePath);
    }
  };

  it("CSV 數量是目標值：寫入差額的 ADJUSTMENT Transaction", async () => {
    await createProduct({ sku: "RL-CSV-1", accountable_quantity: 5 });
    const res = await importCsv(["RL-CSV-1,Renamed,hardware,8,0"]);
    expect(res.status).toBe(200);

    const product = await productBySku("RL-CSV-1");
    expect(product).toMatchObject({ name: "Renamed", accountable_quantity: 8 });
    const csvTxs = (await txsOf(product.id)).filter((t) => t.source === "csv-import");
    expect(csvTxs.map((t) => [t.tag, t.quantity_change, t.quantity_before, t.quantity_after])).toEqual([["ADJUSTMENT", 3, 5, 8]]);
  });

  it("數量沒變時不寫 Transaction", async () => {
    await createProduct({ sku: "RL-CSV-SAME", accountable_quantity: 2 });
    await importCsv(["RL-CSV-SAME,Same,hardware,2,0"]);
    const product = await productBySku("RL-CSV-SAME");
    expect((await txsOf(product.id)).filter((t) => t.source === "csv-import")).toHaveLength(0);
  });

  it("新 SKU：建立後以 Transaction 帶入數量", async () => {
    await importCsv(["RL-CSV-NEW,New,hardware,0,6"]);
    const product = await productBySku("RL-CSV-NEW");
    expect(product.non_accountable_quantity).toBe(6);
    expect((await txsOf(product.id)).map((t) => [t.source, t.quantity_type, t.quantity_change])).toEqual([["csv-import", "non_accountable", 6]]);
  });

  it("AP 商品的有帳數量不能用 CSV 改 → 該列失敗、整列不變，其他列照常匯入", async () => {
    const { id } = (await createProduct({ sku: "RL-CSV-AP", track_serial: true })).body.data;
    const res = await importCsv(["RL-CSV-AP,Changed,hardware,3,0", "RL-CSV-OK,Ok,hardware,1,0"]);

    expect(res.body.errors).toEqual([expect.objectContaining({ row: 1, reason: "QUANTITY_REJECTED" })]);
    expect(await db.get("SELECT name, accountable_quantity FROM products WHERE id = ?", [id])).toEqual({ name: "RL-CSV-AP", accountable_quantity: 0 });
    expect((await productBySku("RL-CSV-OK")).accountable_quantity).toBe(1);
  });
});
