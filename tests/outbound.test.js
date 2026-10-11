const request = require("supertest");
const { setupTestDb, teardownTestDb } = require("./helpers/db");
const { createApp } = require("../src/app");

let app;
let token;
let warehouseId;
let otherWarehouseId;
let db;
let outboundTagId;
let loanTagId;

beforeAll(async () => {
  await setupTestDb();
  app = createApp();
  db = require("../src/config/database");

  await db.run("INSERT OR IGNORE INTO warehouses (name) VALUES ('OutboundWH')");
  await db.run("INSERT OR IGNORE INTO warehouses (name) VALUES ('OutboundOtherWH')");
  warehouseId = (await db.get("SELECT id FROM warehouses WHERE name = 'OutboundWH'")).id;
  otherWarehouseId = (await db.get("SELECT id FROM warehouses WHERE name = 'OutboundOtherWH'")).id;

  const adminUser = await db.get("SELECT id FROM users WHERE username = 'eric'");
  for (const wid of [warehouseId, otherWarehouseId]) {
    await db.run(
      "INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?)",
      [adminUser.id, wid]
    );
  }
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ username: "eric", password: "password" });
  token = loginRes.body.data.token;

  outboundTagId = (await db.get("SELECT id FROM tags WHERE name = 'OUTBOUND'")).id;
  loanTagId = (await db.get("SELECT id FROM tags WHERE name = 'LOAN'")).id;
});

afterAll(async () => {
  await teardownTestDb();
});

async function createProduct(sku, { qty = 0, serials = [], wid = warehouseId } = {}) {
  const res = await request(app)
    .post("/api/products")
    .set("Authorization", `Bearer ${token}`)
    .set("X-Warehouse-Id", String(wid))
    .send({
      sku,
      name: sku,
      type: "hardware",
      track_serial: serials.length > 0,
      accountable_quantity: serials.length > 0 ? serials.length : qty,
    });
  const productId = res.body.data.id;
  for (const sn of serials) {
    await db.run(
      "INSERT INTO product_units (product_id, serial_number, status) VALUES (?, ?, 'in_stock')",
      [productId, sn]
    );
  }
  return productId;
}

function postOutbound(body, wid = warehouseId) {
  return request(app)
    .post("/api/outbound")
    .set("Authorization", `Bearer ${token}`)
    .set("X-Warehouse-Id", String(wid))
    .send(body);
}

const qtyOf = async (id) =>
  (await db.get("SELECT accountable_quantity FROM products WHERE id = ?", [id])).accountable_quantity;
const statusOf = async (sn) =>
  (await db.get("SELECT status FROM product_units WHERE serial_number = ?", [sn])).status;

describe("POST /api/outbound", () => {
  it("OUTBOUND + 一般品 + AP 序號 → 扣庫存、AP 變 sold、自動建立出貨單綁定全部異動", async () => {
    const cableId = await createProduct("OB-CABLE", { qty: 10 });
    const apId = await createProduct("OB-AP", { serials: ["OB-SN-1", "OB-SN-2"] });

    const res = await postOutbound({
      tag_id: outboundTagId,
      description: "case A",
      items: [{ product_id: cableId, quantity: 3, quantity_type: "accountable" }],
      serial_numbers: ["ob-sn-1 ", "OB-SN-2"],
      shipment: { customer: "ACME", project_case: "CASE-A", shipment_date: "2026-10-11" },
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.shipment_number).toBe("SHP-20261011-001");
    expect(res.body.data.transaction_ids).toHaveLength(2);

    expect(await qtyOf(cableId)).toBe(7);
    expect(await qtyOf(apId)).toBe(0);

    const unit = await db.get(
      "SELECT status, project_case, sold_to FROM product_units WHERE serial_number = 'OB-SN-1'"
    );
    expect(unit).toEqual({ status: "sold", project_case: "CASE-A", sold_to: "ACME" });

    const apTx = await db.get("SELECT * FROM transactions WHERE product_id = ?", [apId]);
    expect(apTx.quantity_change).toBe(-2);
    expect(apTx.source).toBe("ap-sell");
    expect(apTx.batch_id).toBe(res.body.data.batch_id);
    expect(JSON.parse(apTx.product_unit_ids)).toHaveLength(2);

    const bound = await db.all(
      "SELECT transaction_id FROM shipment_transactions WHERE shipment_id = ? ORDER BY transaction_id",
      [res.body.data.shipment_id]
    );
    expect(bound.map((r) => r.transaction_id)).toEqual([...res.body.data.transaction_ids].sort((a, b) => a - b));

    const shipment = await db.get("SELECT customer, project_case FROM shipments WHERE id = ?", [res.body.data.shipment_id]);
    expect(shipment).toEqual({ customer: "ACME", project_case: "CASE-A" });
  });

  it("非 OUTBOUND 標籤 → 扣庫存但不建立出貨單", async () => {
    const id = await createProduct("OB-LOAN", { qty: 5 });

    const res = await postOutbound({
      tag_id: loanTagId,
      items: [{ product_id: id, quantity: 2, quantity_type: "accountable" }],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.shipment_id).toBeNull();
    expect(res.body.data.shipment_number).toBeNull();
    expect(await qtyOf(id)).toBe(3);
  });

  it("同一商品出現兩行 → 合計檢查庫存", async () => {
    const id = await createProduct("OB-TWICE", { qty: 5 });

    const res = await postOutbound({
      tag_id: loanTagId,
      items: [
        { product_id: id, quantity: 3, quantity_type: "accountable" },
        { product_id: id, quantity: 3, quantity_type: "accountable" },
      ],
    });

    expect(res.status).toBe(400);
    expect(await qtyOf(id)).toBe(5);
  });

  it("有序號但沒有案子 → 400，什麼都不變", async () => {
    await createProduct("OB-NOCASE", { serials: ["OB-NC-1"] });

    const res = await postOutbound({
      tag_id: outboundTagId,
      serial_numbers: ["OB-NC-1"],
      shipment: { customer: "ACME" },
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(await statusOf("OB-NC-1")).toBe("in_stock");
  });

  it("一般品庫存不足 → 400，同批的序號也不出庫（全有或全無）", async () => {
    const id = await createProduct("OB-SHORT", { qty: 1 });
    await createProduct("OB-SHORT-AP", { serials: ["OB-SH-1"] });

    const res = await postOutbound({
      tag_id: outboundTagId,
      items: [{ product_id: id, quantity: 2, quantity_type: "accountable" }],
      serial_numbers: ["OB-SH-1"],
      shipment: { project_case: "CASE-S" },
    });

    expect(res.status).toBe(400);
    expect(await qtyOf(id)).toBe(1);
    expect(await statusOf("OB-SH-1")).toBe("in_stock");
    const shipments = await db.get("SELECT COUNT(*) AS n FROM shipments WHERE project_case = 'CASE-S'");
    expect(shipments.n).toBe(0);
  });

  it("用數量出 AP 商品 → 400（必須掃序號）", async () => {
    const apId = await createProduct("OB-APQTY", { serials: ["OB-AQ-1"] });

    const res = await postOutbound({
      tag_id: loanTagId,
      items: [{ product_id: apId, quantity: 1, quantity_type: "accountable" }],
    });

    expect(res.status).toBe(400);
    expect(await qtyOf(apId)).toBe(1);
  });

  it("不存在、已出庫、重複的序號 → 400，逐一列出錯誤", async () => {
    await createProduct("OB-BAD", { serials: ["OB-BAD-1", "OB-BAD-2"] });
    await db.run("UPDATE product_units SET status = 'sold', project_case = 'X' WHERE serial_number = 'OB-BAD-2'");

    const res = await postOutbound({
      tag_id: outboundTagId,
      serial_numbers: ["OB-BAD-1", "OB-BAD-1", "OB-BAD-2", "OB-NOPE"],
      shipment: { project_case: "CASE-B" },
    });

    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveLength(3);
    expect(await statusOf("OB-BAD-1")).toBe("in_stock");
  });

  it("其他倉庫的序號 → 400", async () => {
    await createProduct("OB-OTHER", { serials: ["OB-OT-1"], wid: otherWarehouseId });

    const res = await postOutbound({
      tag_id: outboundTagId,
      serial_numbers: ["OB-OT-1"],
      shipment: { project_case: "CASE-O" },
    });

    expect(res.status).toBe(400);
    expect(await statusOf("OB-OT-1")).toBe("in_stock");
  });

  it("沒有任何明細 → 400", async () => {
    const res = await postOutbound({ tag_id: outboundTagId });
    expect(res.status).toBe(400);
  });
});
