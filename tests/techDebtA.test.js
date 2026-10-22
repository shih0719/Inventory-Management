// Regression tests for docs/tech-debt.md section A.
const request = require("supertest");
const bcrypt = require("bcrypt");
const { setupTestDb, teardownTestDb } = require("./helpers/db");
const { createApp } = require("../src/app");

let app;
let db;
let token;
let warehouseId;
let otherWarehouseId;
let lockedWarehouseId;
let inboundTagId;
let outboundTagId;

beforeAll(async () => {
  await setupTestDb();
  app = createApp();
  db = require("../src/config/database");

  for (const name of ["DebtWH", "DebtOtherWH", "DebtLockedWH"]) {
    await db.run("INSERT OR IGNORE INTO warehouses (name) VALUES (?)", [name]);
  }
  warehouseId = (await db.get("SELECT id FROM warehouses WHERE name = 'DebtWH'")).id;
  otherWarehouseId = (await db.get("SELECT id FROM warehouses WHERE name = 'DebtOtherWH'")).id;
  lockedWarehouseId = (await db.get("SELECT id FROM warehouses WHERE name = 'DebtLockedWH'")).id;

  const admin = await db.get("SELECT id FROM users WHERE username = 'eric'");
  for (const wid of [warehouseId, otherWarehouseId]) {
    await db.run("INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?)", [admin.id, wid]);
  }
  token = (await request(app).post("/api/auth/login").send({ username: "eric", password: "password" })).body.data.token;

  inboundTagId = (await db.get("SELECT id FROM tags WHERE name = 'INBOUND'")).id;
  outboundTagId = (await db.get("SELECT id FROM tags WHERE name = 'OUTBOUND'")).id;
});

afterAll(async () => {
  await teardownTestDb();
});

afterEach(async () => {
  await restoreTransactionInsert();
});

const auth = (req, { tk = token, wh = warehouseId } = {}) =>
  req.set("Authorization", `Bearer ${tk}`).set("X-Warehouse-Id", String(wh));

async function createProduct(sku, { qty = 0, trackSerial = false, wh = warehouseId } = {}) {
  const res = await auth(request(app).post("/api/products"), { wh }).send({
    sku, name: sku, type: "hardware", track_serial: trackSerial, accountable_quantity: trackSerial ? 0 : qty,
  });
  // AP stock can't be created by quantity; the fixture sets it directly.
  if (trackSerial && qty) {
    await db.run("UPDATE products SET accountable_quantity = ? WHERE id = ?", [qty, res.body.data.id]);
  }
  return res.body.data.id;
}

async function addUnits(productId, serials, { wh = warehouseId } = {}) {
  for (const sn of serials) {
    await db.run("INSERT INTO product_units (product_id, serial_number, warehouse_id) VALUES (?, ?, ?)", [productId, sn, wh]);
  }
}

const qtyOf = async (id) =>
  (await db.get("SELECT accountable_quantity FROM products WHERE id = ?", [id])).accountable_quantity;

// Makes every INSERT INTO transactions fail, to prove the surrounding writes roll back.
// A trigger, so it works however the code reaches the database.
const failTransactionInsert = () =>
  db.run("CREATE TEMP TRIGGER fail_tx_insert BEFORE INSERT ON transactions BEGIN SELECT RAISE(ABORT, 'boom'); END");
const restoreTransactionInsert = () => db.run("DROP TRIGGER IF EXISTS fail_tx_insert");

describe("A1 — POST /api/transactions 對 AP 有帳數量只允許朝在庫序號數對齊", () => {
  const postTx = (body) => auth(request(app).post("/api/transactions")).send({ tag_id: inboundTagId, ...body });

  it("數量已與在庫序號一致時，不掃序號直接入庫 → 400", async () => {
    const id = await createProduct("A1-ALIGNED", { qty: 2, trackSerial: true });
    await addUnits(id, ["A1-SN-1", "A1-SN-2"]);

    const res = await postTx({ product_id: id, quantity_change: 3, quantity_type: "accountable" });

    expect(res.status).toBe(400);
    expect(await qtyOf(id)).toBe(2);
  });

  it("數量已與在庫序號一致時，直接出庫 → 400", async () => {
    const id = await createProduct("A1-OUT", { qty: 1, trackSerial: true });
    await addUnits(id, ["A1-SN-3"]);

    const res = await postTx({ product_id: id, tag_id: outboundTagId, quantity_change: -1, quantity_type: "accountable" });

    expect(res.status).toBe(400);
    expect(await qtyOf(id)).toBe(1);
  });

  it("數量漂移時，朝在庫序號數對齊 → 201", async () => {
    const id = await createProduct("A1-DRIFT", { qty: 0, trackSerial: true });
    await addUnits(id, ["A1-SN-4", "A1-SN-5", "A1-SN-6"]);

    const res = await postTx({ product_id: id, quantity_change: 3, quantity_type: "accountable" });

    expect(res.status).toBe(201);
    expect(await qtyOf(id)).toBe(3);
  });

  it("越過在庫序號數（差距沒有縮小）→ 400", async () => {
    const id = await createProduct("A1-OVERSHOOT", { qty: 1, trackSerial: true });
    await addUnits(id, ["A1-SN-7", "A1-SN-8"]);

    const res = await postTx({ product_id: id, quantity_change: 2, quantity_type: "accountable" });

    expect(res.status).toBe(400);
  });

  it("AP 商品的無帳數量、一般商品的有帳數量不受限制", async () => {
    const ap = await createProduct("A1-NONACCT", { trackSerial: true });
    const plain = await createProduct("A1-PLAIN", { qty: 0 });

    expect((await postTx({ product_id: ap, quantity_change: 4, quantity_type: "non_accountable" })).status).toBe(201);
    expect((await postTx({ product_id: plain, quantity_change: 4, quantity_type: "accountable" })).status).toBe(201);
  });
});

describe("A2 — PUT /api/shipments/:id 保留原本綁定的異動", () => {
  it("用原本的 transaction_ids 更新 → 200，不誤判衝突", async () => {
    const id = await createProduct("A2-CABLE", { qty: 5 });
    const tx = await auth(request(app).post("/api/transactions")).send({
      product_id: id, tag_id: outboundTagId, quantity_change: -1, quantity_type: "accountable",
    });
    const created = await auth(request(app).post("/api/shipments")).send({ transaction_ids: [tx.body.data.id], customer: "C1" });
    expect(created.status).toBe(201);

    const res = await auth(request(app).put(`/api/shipments/${created.body.data.id}`)).send({
      transaction_ids: [tx.body.data.id], customer: "C2",
    });

    expect(res.status).toBe(200);
  });
});

describe("A4 — /api/product-units 寫入需要 manager/admin", () => {
  let viewToken;

  beforeAll(async () => {
    const hash = await bcrypt.hash("pass123", 10);
    await db.run("INSERT OR IGNORE INTO users (username, password_hash, role, provider) VALUES ('debt_view', ?, 'view', 'local')", [hash]);
    const user = await db.get("SELECT id FROM users WHERE username = 'debt_view'");
    await db.run("INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?)", [user.id, warehouseId]);
    viewToken = (await request(app).post("/api/auth/login").send({ username: "debt_view", password: "pass123" })).body.data.token;
  });

  it.each([
    ["post", "/api/product-units"],
    ["post", "/api/product-units/bulk"],
    ["post", "/api/product-units/transfer"],
    ["put", "/api/product-units/1"],
    ["delete", "/api/product-units/1"],
  ])("view 角色 %s %s → 403", async (method, url) => {
    const res = await auth(request(app)[method](url), { tk: viewToken }).send({});
    expect(res.status).toBe(403);
  });

  it("view 角色仍可讀取", async () => {
    const res = await auth(request(app).get("/api/product-units"), { tk: viewToken });
    expect(res.status).toBe(200);
  });
});

describe("A5 — POST /api/product-units/bulk 全有或全無", () => {
  it("寫入 Transaction 失敗時，序號與數量都回滾", async () => {
    const id = await createProduct("A5-AP", { trackSerial: true });
    await failTransactionInsert();

    const res = await auth(request(app).post("/api/product-units/bulk")).send({
      product_id: id, serial_numbers: ["A5-SN-1", "A5-SN-2"],
    });

    expect(res.status).toBe(500);
    await restoreTransactionInsert();
    expect(await db.get("SELECT COUNT(*) AS n FROM product_units WHERE product_id = ?", [id])).toEqual({ n: 0 });
    expect(await qtyOf(id)).toBe(0);
  });

  it("成功時 Transaction 記下的是這次新增的序號", async () => {
    const id = await createProduct("A5-AP-OK", { trackSerial: true });

    const res = await auth(request(app).post("/api/product-units/bulk")).send({
      product_id: id, serial_numbers: ["a5-ok-1", "A5-OK-2"],
    });

    expect(res.status).toBe(201);
    expect(await qtyOf(id)).toBe(2);
    const units = await db.all("SELECT id FROM product_units WHERE product_id = ? ORDER BY id", [id]);
    const tx = await db.get("SELECT * FROM transactions WHERE product_id = ?", [id]);
    expect(JSON.parse(tx.product_unit_ids).sort()).toEqual(units.map((u) => u.id).sort());
  });
});

describe("A6 — POST /api/product-units/transfer 限定來源倉庫並具 atomicity", () => {
  const transfer = (body, opts) => auth(request(app).post("/api/product-units/transfer"), opts).send(body);

  it("無法調走其他倉庫的序號品", async () => {
    const src = await createProduct("A6-SKU-1", { qty: 1, trackSerial: true, wh: otherWarehouseId });
    await createProduct("A6-SKU-1", { trackSerial: true, wh: warehouseId });
    await addUnits(src, ["A6-SN-FOREIGN"], { wh: otherWarehouseId });

    // Current warehouse is DebtWH, but the serial lives in DebtOtherWH; the target (DebtWH) has the SKU.
    const res = await transfer({ serial_numbers: ["A6-SN-FOREIGN"], target_warehouse_id: warehouseId });

    expect(res.status).toBe(400);
    expect((await db.get("SELECT product_id FROM product_units WHERE serial_number = 'A6-SN-FOREIGN'")).product_id).toBe(src);
  });

  it("目標倉庫不在使用者權限內 → 403", async () => {
    const src = await createProduct("A6-SKU-2", { qty: 1, trackSerial: true });
    await addUnits(src, ["A6-SN-LOCKED"]);

    const res = await transfer({ serial_numbers: ["A6-SN-LOCKED"], target_warehouse_id: lockedWarehouseId });

    expect(res.status).toBe(403);
  });

  it("寫入 Transaction 失敗時，序號歸屬與兩邊數量都回滾", async () => {
    const src = await createProduct("A6-SKU-3", { qty: 1, trackSerial: true });
    const dst = await createProduct("A6-SKU-3", { qty: 0, trackSerial: true, wh: otherWarehouseId });
    await addUnits(src, ["A6-SN-ATOMIC"]);
    await failTransactionInsert();

    const res = await transfer({ serial_numbers: ["A6-SN-ATOMIC"], target_warehouse_id: otherWarehouseId });

    expect(res.status).toBe(500);
    await restoreTransactionInsert();
    expect((await db.get("SELECT product_id FROM product_units WHERE serial_number = 'A6-SN-ATOMIC'")).product_id).toBe(src);
    expect(await qtyOf(src)).toBe(1);
    expect(await qtyOf(dst)).toBe(0);
  });

  it("正常調撥：序號移到目標倉庫的同 SKU 商品，兩邊數量各 ±1", async () => {
    const src = await createProduct("A6-SKU-4", { qty: 1, trackSerial: true });
    const dst = await createProduct("A6-SKU-4", { qty: 0, trackSerial: true, wh: otherWarehouseId });
    await addUnits(src, ["A6-SN-OK"]);

    const res = await transfer({ serial_numbers: ["A6-SN-OK"], target_warehouse_id: otherWarehouseId });

    expect(res.status).toBe(200);
    expect((await db.get("SELECT product_id FROM product_units WHERE serial_number = 'A6-SN-OK'")).product_id).toBe(dst);
    expect(await qtyOf(src)).toBe(0);
    expect(await qtyOf(dst)).toBe(1);
  });
});
