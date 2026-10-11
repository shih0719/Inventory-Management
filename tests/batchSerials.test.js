const request = require("supertest");
const { setupTestDb, teardownTestDb } = require("./helpers/db");
const { createApp } = require("../src/app");

let app;
let token;
let warehouseId;
let db;
let inboundTagId;
let returnTagId;

beforeAll(async () => {
  await setupTestDb();
  app = createApp();
  db = require("../src/config/database");

  await db.run("INSERT OR IGNORE INTO warehouses (name) VALUES ('BatchSerialWH')");
  warehouseId = (await db.get("SELECT id FROM warehouses WHERE name = 'BatchSerialWH'")).id;
  const adminUser = await db.get("SELECT id FROM users WHERE username = 'eric'");
  await db.run(
    "INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?)",
    [adminUser.id, warehouseId]
  );
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ username: "eric", password: "password" });
  token = loginRes.body.data.token;

  inboundTagId = (await db.get("SELECT id FROM tags WHERE name = 'INBOUND'")).id;
  returnTagId = (await db.get("SELECT id FROM tags WHERE name = 'RETURN'")).id;
});

afterAll(async () => {
  await teardownTestDb();
});

async function createProduct(sku, { qty = 0, trackSerial = false } = {}) {
  const res = await request(app)
    .post("/api/products")
    .set("Authorization", `Bearer ${token}`)
    .set("X-Warehouse-Id", String(warehouseId))
    .send({ sku, name: sku, type: "hardware", track_serial: trackSerial, accountable_quantity: qty });
  return res.body.data.id;
}

function postBatch(body) {
  return request(app)
    .post("/api/batches")
    .set("Authorization", `Bearer ${token}`)
    .set("X-Warehouse-Id", String(warehouseId))
    .send(body);
}

const qtyOf = async (id) =>
  (await db.get("SELECT accountable_quantity FROM products WHERE id = ?", [id])).accountable_quantity;
const unitOf = (sn) => db.get("SELECT * FROM product_units WHERE serial_number = ?", [sn]);

describe("POST /api/batches — AP 序號進貨", () => {
  it("新序號 + 一般品 → 建立序號品、加庫存、異動記下 product_unit_ids", async () => {
    const apId = await createProduct("BS-AP", { trackSerial: true });
    const cableId = await createProduct("BS-CABLE", { qty: 1 });

    const res = await postBatch({
      tag_id: inboundTagId,
      items: [
        { product_id: apId, quantity_change: 2, quantity_type: "accountable", serial_numbers: ["bs-sn-1 ", "BS-SN-2"] },
        { product_id: cableId, quantity_change: 5, quantity_type: "accountable" },
      ],
    });

    expect(res.status).toBe(201);
    expect(await qtyOf(apId)).toBe(2);
    expect(await qtyOf(cableId)).toBe(6);

    const unit = await unitOf("BS-SN-1");
    expect(unit).toMatchObject({ product_id: apId, status: "in_stock", warehouse_id: warehouseId });

    const tx = await db.get("SELECT * FROM transactions WHERE product_id = ?", [apId]);
    expect(tx.quantity_change).toBe(2);
    expect(JSON.parse(tx.product_unit_ids).sort()).toEqual([unit.id, (await unitOf("BS-SN-2")).id].sort());
  });

  it("RETURN 標籤 + 已出庫序號 → 改回在庫並清空出貨欄位", async () => {
    const apId = await createProduct("BS-RET", { trackSerial: true });
    await db.run(
      "INSERT INTO product_units (product_id, serial_number, status, project_case, sold_to, sold_at) VALUES (?, 'BS-RET-1', 'sold', 'CASE', 'ACME', '2026-10-01T00:00:00Z')",
      [apId]
    );

    const res = await postBatch({
      tag_id: returnTagId,
      items: [{ product_id: apId, quantity_change: 1, quantity_type: "accountable", serial_numbers: ["BS-RET-1"] }],
    });

    expect(res.status).toBe(201);
    expect(await unitOf("BS-RET-1")).toMatchObject({ status: "in_stock", project_case: null, sold_to: null, sold_at: null });
    expect(await qtyOf(apId)).toBe(1);
  });

  it("非 RETURN 標籤 + 已出庫序號 → 400", async () => {
    const apId = await createProduct("BS-NORET", { trackSerial: true });
    await db.run("INSERT INTO product_units (product_id, serial_number, status) VALUES (?, 'BS-NORET-1', 'sold')", [apId]);

    const res = await postBatch({
      tag_id: inboundTagId,
      items: [{ product_id: apId, quantity_change: 1, quantity_type: "accountable", serial_numbers: ["BS-NORET-1"] }],
    });

    expect(res.status).toBe(400);
    expect((await unitOf("BS-NORET-1")).status).toBe("sold");
  });

  it("已在庫序號 → 400，整批不寫入（一般品也不加）", async () => {
    const apId = await createProduct("BS-DUP", { trackSerial: true });
    const cableId = await createProduct("BS-DUP-CABLE", { qty: 0 });
    await db.run("INSERT INTO product_units (product_id, serial_number, status) VALUES (?, 'BS-DUP-1', 'in_stock')", [apId]);

    const res = await postBatch({
      tag_id: inboundTagId,
      items: [
        { product_id: cableId, quantity_change: 3, quantity_type: "accountable" },
        { product_id: apId, quantity_change: 2, quantity_type: "accountable", serial_numbers: ["BS-DUP-1", "BS-DUP-2"] },
      ],
    });

    expect(res.status).toBe(400);
    expect(await qtyOf(cableId)).toBe(0);
    expect(await unitOf("BS-DUP-2")).toBeUndefined();
  });

  it("AP 商品只填數量沒有序號 → 400", async () => {
    const apId = await createProduct("BS-NOSN", { trackSerial: true });
    const res = await postBatch({
      tag_id: inboundTagId,
      items: [{ product_id: apId, quantity_change: 1, quantity_type: "accountable" }],
    });
    expect(res.status).toBe(400);
    expect(await qtyOf(apId)).toBe(0);
  });

  it("序號數量和 quantity_change 不符、批次內重複、無帳類型 → 400", async () => {
    const apId = await createProduct("BS-BAD", { trackSerial: true });
    const bad = [
      { product_id: apId, quantity_change: 2, quantity_type: "accountable", serial_numbers: ["BS-BAD-1"] },
      { product_id: apId, quantity_change: 2, quantity_type: "accountable", serial_numbers: ["BS-BAD-2", "bs-bad-2"] },
      { product_id: apId, quantity_change: 1, quantity_type: "non_accountable", serial_numbers: ["BS-BAD-3"] },
    ];
    for (const item of bad) {
      const res = await postBatch({ tag_id: inboundTagId, items: [item] });
      expect(res.status).toBe(400);
    }
    expect(await qtyOf(apId)).toBe(0);
  });

  it("一般商品帶序號 → 400", async () => {
    const id = await createProduct("BS-PLAIN", { qty: 0 });
    const res = await postBatch({
      tag_id: inboundTagId,
      items: [{ product_id: id, quantity_change: 1, quantity_type: "accountable", serial_numbers: ["BS-PLAIN-1"] }],
    });
    expect(res.status).toBe(400);
  });
});
