const request = require("supertest");
const { setupTestDb, teardownTestDb } = require("./helpers/db");
const { createApp } = require("../src/app");

let app;
let token;
let warehouseId;
let db;

beforeAll(async () => {
  await setupTestDb();
  app = createApp();
  db = require("../src/config/database");

  // 建立倉庫
  await db.run("INSERT OR IGNORE INTO warehouses (name) VALUES ('QuickSellWH')");
  const wh = await db.get("SELECT id FROM warehouses WHERE name = 'QuickSellWH'");
  warehouseId = wh.id;

  // 給 admin 倉庫權限並登入
  const adminUser = await db.get("SELECT id FROM users WHERE username = 'eric'");
  await db.run(
    "INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?)",
    [adminUser.id, warehouseId]
  );
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ username: "eric", password: "password" });
  token = loginRes.body.data.token;

  // 確保 OUTBOUND tag 存在
  await db.run("INSERT OR IGNORE INTO tags (name) VALUES ('OUTBOUND')");
});

afterAll(async () => {
  await teardownTestDb();
});

// 建立 AP product + AP records 的 helper
async function createApProduct(sku, serials) {
  const res = await request(app)
    .post("/api/products")
    .set("Authorization", `Bearer ${token}`)
    .set("X-Warehouse-Id", String(warehouseId))
    .send({ sku, name: sku, type: "hardware", track_serial: true, accountable_quantity: serials.length });
  const productId = res.body.data.id;
  for (const sn of serials) {
    await db.run(
      "INSERT INTO product_units (product_id, serial_number, status) VALUES (?, ?, 'in_stock')",
      [productId, sn]
    );
  }
  return productId;
}

describe("POST /api/product-units/bulk-sell — 快速出庫", () => {
  it("有效序號清單 + project_case → AP 變 sold、建立 OUTBOUND Transaction、accountable_quantity 減少", async () => {

    const productId = await createApProduct("QS-VALID-001", ["QS-SN-001", "QS-SN-002"]);

    const res = await request(app)
      .post("/api/product-units/bulk-sell")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Warehouse-Id", String(warehouseId))
      .send({ serial_numbers: ["QS-SN-001", "QS-SN-002"], project_case: "CASE-001" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sold).toBe(2);

    // AP 狀態應為 sold
    const unit1 = await db.get("SELECT status, project_case FROM product_units WHERE serial_number = 'QS-SN-001'");
    const unit2 = await db.get("SELECT status FROM product_units WHERE serial_number = 'QS-SN-002'");
    expect(unit1.status).toBe("sold");
    expect(unit1.project_case).toBe("CASE-001");
    expect(unit2.status).toBe("sold");

    // OUTBOUND Transaction 已建立
    const tx = await db.get(
      "SELECT * FROM transactions WHERE product_id = ? AND quantity_change = -2",
      [productId]
    );
    expect(tx).toBeTruthy();

    // accountable_quantity 減少 2
    const product = await db.get("SELECT accountable_quantity FROM products WHERE id = ?", [productId]);
    expect(product.accountable_quantity).toBe(0);
  });

  it("含不存在序號 → 400，所有 AP 狀態不變", async () => {
    await createApProduct("QS-NOTFOUND-001", ["QS-NF-001"]);

    const res = await request(app)
      .post("/api/product-units/bulk-sell")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Warehouse-Id", String(warehouseId))
      .send({ serial_numbers: ["QS-NF-001", "QS-NONEXISTENT-999"], project_case: "CASE-002" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);

    // QS-NF-001 應仍為 in_stock（整批失敗）
    const unit = await db.get("SELECT status FROM product_units WHERE serial_number = 'QS-NF-001'");
    expect(unit.status).toBe("in_stock");
  });

  it("含已出庫序號 → 400，其他 AP 狀態不變", async () => {
    await createApProduct("QS-ALREADYSOLD-001", ["QS-AS-001", "QS-AS-002"]);
    // 先手動把 QS-AS-001 標為 sold
    await db.run(
      "UPDATE product_units SET status = 'sold', project_case = 'PRE-SOLD' WHERE serial_number = 'QS-AS-001'"
    );

    const res = await request(app)
      .post("/api/product-units/bulk-sell")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Warehouse-Id", String(warehouseId))
      .send({ serial_numbers: ["QS-AS-001", "QS-AS-002"], project_case: "CASE-003" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);

    // QS-AS-002 應仍為 in_stock
    const unit = await db.get("SELECT status FROM product_units WHERE serial_number = 'QS-AS-002'");
    expect(unit.status).toBe("in_stock");
  });

  it("批次內重複序號 → 400", async () => {
    await createApProduct("QS-DUP-001", ["QS-DUP-SN-001"]);

    const res = await request(app)
      .post("/api/product-units/bulk-sell")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Warehouse-Id", String(warehouseId))
      .send({ serial_numbers: ["QS-DUP-SN-001", "QS-DUP-SN-001"], project_case: "CASE-004" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("project_case 缺漏 → 400", async () => {
    await createApProduct("QS-NOCASE-001", ["QS-NC-001"]);

    const res = await request(app)
      .post("/api/product-units/bulk-sell")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Warehouse-Id", String(warehouseId))
      .send({ serial_numbers: ["QS-NC-001"] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
