// Stock Ledger: the only path that changes Product quantities (docs/adr/0003-stock-ledger.md).
const { setupTestDb, teardownTestDb } = require("./helpers/db");

let db;
let ledger;
let warehouseId;
let actor;

beforeAll(async () => {
  await setupTestDb();
  db = require("../src/config/database");
  ledger = require("../src/services/stockLedger");
  await db.run("INSERT OR IGNORE INTO warehouses (name) VALUES ('LedgerWH')");
  warehouseId = (await db.get("SELECT id FROM warehouses WHERE name = 'LedgerWH'")).id;
  const user = await db.get("SELECT id, username FROM users WHERE username = 'eric'");
  actor = { userId: user.id, username: user.username };
});

afterAll(async () => {
  await teardownTestDb();
});

let skuSeq = 0;
async function product({ acc = 0, nonAcc = 0, ap = false, serialsInStock = 0 } = {}) {
  const sku = `LG-${++skuSeq}`;
  const { id } = await db.run(
    "INSERT INTO products (warehouse_id, type, sku, name, accountable_quantity, non_accountable_quantity, track_serial) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [warehouseId, ap ? "ap" : "normal", sku, sku, acc, nonAcc, ap ? 1 : 0],
  );
  const unitIds = [];
  for (let i = 0; i < serialsInStock; i++) {
    const unit = await db.run(
      "INSERT INTO product_units (product_id, serial_number, warehouse_id) VALUES (?, ?, ?)",
      [id, `${sku}-SN${i}`, warehouseId],
    );
    unitIds.push(unit.id);
  }
  return { id, unitIds };
}

const qty = async (id) => db.get("SELECT accountable_quantity AS acc, non_accountable_quantity AS non FROM products WHERE id = ?", [id]);
const apply = (movements, ctx = {}) =>
  db.transaction((tx) => ledger.apply(tx, movements, { tag: { name: "ADJUSTMENT" }, source: "adjust", actor, ...ctx }));

describe("apply", () => {
  it("寫入 Transaction（含 snapshot、warehouse_id、前綴）並更新對應欄位", async () => {
    const p = await product({ acc: 5, nonAcc: 2 });
    const [result] = await apply([{ productId: p.id, quantityType: "non_accountable", delta: 3, remarks: "補貨" }]);

    expect(await qty(p.id)).toEqual({ acc: 5, non: 5 });
    const tx = await db.get("SELECT * FROM transactions WHERE id = ?", [result.transactionId]);
    expect(tx).toMatchObject({
      product_id: p.id,
      quantity_change: 3,
      quantity_type: "non_accountable",
      quantity_before: 2,
      quantity_after: 5,
      warehouse_id: warehouseId,
      source: "adjust",
      remarks: "[無帳] 補貨",
      created_by_user: "eric",
    });
  });

  it("每筆 Transaction 都寫 audit log（帶倉庫）", async () => {
    const p = await product({ acc: 1 });
    const [result] = await apply([{ productId: p.id, quantityType: "accountable", delta: 1 }]);
    const log = await db.get(
      "SELECT * FROM audit_logs WHERE resource_type = 'transaction' AND resource_id = ?",
      [result.transactionId],
    );
    expect(log).toMatchObject({ action: "CREATE", warehouse_id: warehouseId, user_id: actor.userId });
  });

  it("同商品多筆 movement 以累計餘額檢查非負", async () => {
    const p = await product({ acc: 3 });
    await expect(
      apply([
        { productId: p.id, quantityType: "accountable", delta: -2 },
        { productId: p.id, quantityType: "accountable", delta: -2 },
      ]),
    ).rejects.toMatchObject({ name: "LedgerError", errors: [expect.objectContaining({ index: 1 })] });
    expect((await qty(p.id)).acc).toBe(3);
  });

  it("一次列出所有錯誤，任何一筆失敗都不寫入", async () => {
    const ok = await product({ acc: 10 });
    const short = await product({ acc: 0 });
    let error;
    try {
      await apply([
        { productId: ok.id, quantityType: "accountable", delta: -1 },
        { productId: short.id, quantityType: "accountable", delta: -1 },
        { productId: 999999, quantityType: "accountable", delta: 1 },
        { productId: ok.id, quantityType: "bogus", delta: 1 },
      ]);
    } catch (e) {
      error = e;
    }
    expect(error.errors.map((e) => e.index)).toEqual([1, 2, 3]);
    expect((await qty(ok.id)).acc).toBe(10);
  });

  it("delta 必須是非 0 的整數", async () => {
    const p = await product();
    await expect(apply([{ productId: p.id, quantityType: "accountable", delta: 0 }])).rejects.toMatchObject({ name: "LedgerError" });
    await expect(apply([{ productId: p.id, quantityType: "accountable", delta: 1.5 }])).rejects.toMatchObject({ name: "LedgerError" });
  });

  it("Tag 不存在 → LedgerError，不靜默跳過", async () => {
    const p = await product();
    await expect(apply([{ productId: p.id, quantityType: "accountable", delta: 1 }], { tag: { name: "NOPE" } }))
      .rejects.toMatchObject({ name: "LedgerError" });
    expect((await qty(p.id)).acc).toBe(0);
  });

  it("帶 batchId、locationId、unitIds 時一併寫入", async () => {
    const p = await product({ ap: true, acc: 0, serialsInStock: 2 });
    const batch = await db.run("INSERT INTO batches (batch_number, created_by_user) VALUES ('LG-B', 'eric')");
    const [result] = await apply(
      [{ productId: p.id, quantityType: "accountable", delta: 2, unitIds: p.unitIds }],
      { batchId: batch.id },
    );
    const tx = await db.get("SELECT batch_id, product_unit_ids FROM transactions WHERE id = ?", [result.transactionId]);
    expect(tx.batch_id).toBe(batch.id);
    expect(JSON.parse(tx.product_unit_ids)).toEqual(p.unitIds);
  });

  it("並行出庫不會互相覆蓋數量（lost update）", async () => {
    const p = await product({ acc: 1 });
    const out = () => apply([{ productId: p.id, quantityType: "accountable", delta: -1 }]);
    const results = await Promise.allSettled([out(), out()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await qty(p.id)).acc).toBe(0);
    expect((await db.get("SELECT COUNT(*) AS n FROM transactions WHERE product_id = ?", [p.id])).n).toBe(1);
  });
});

describe("AP 規則", () => {
  it("AP 有帳 movement 沒帶序號 → 拒絕", async () => {
    const p = await product({ ap: true });
    await expect(apply([{ productId: p.id, quantityType: "accountable", delta: 1 }])).rejects.toMatchObject({ name: "LedgerError" });
  });

  it("unitIds 數量必須等於 |delta|", async () => {
    const p = await product({ ap: true, serialsInStock: 2 });
    await expect(apply([{ productId: p.id, quantityType: "accountable", delta: 1, unitIds: p.unitIds }]))
      .rejects.toMatchObject({ name: "LedgerError" });
  });

  it("非 AP 商品、或 AP 的無帳 movement 不可帶 unitIds", async () => {
    const normal = await product();
    const ap = await product({ ap: true, serialsInStock: 1 });
    await expect(apply([{ productId: normal.id, quantityType: "accountable", delta: 1, unitIds: [1] }]))
      .rejects.toMatchObject({ name: "LedgerError" });
    await expect(apply([{ productId: ap.id, quantityType: "non_accountable", delta: 1, unitIds: ap.unitIds }]))
      .rejects.toMatchObject({ name: "LedgerError" });
  });

  it("AP 的無帳數量不受序號規則限制", async () => {
    const p = await product({ ap: true });
    await apply([{ productId: p.id, quantityType: "non_accountable", delta: 4 }]);
    expect((await qty(p.id)).non).toBe(4);
  });

  it("reconcile：朝在庫序號數對齊 → 通過；差距沒縮小 → 拒絕", async () => {
    const p = await product({ ap: true, acc: 0, serialsInStock: 2 });
    await apply([{ productId: p.id, quantityType: "accountable", delta: 2, kind: "reconcile" }]);
    expect((await qty(p.id)).acc).toBe(2);

    await expect(apply([{ productId: p.id, quantityType: "accountable", delta: 1, kind: "reconcile" }]))
      .rejects.toMatchObject({ name: "LedgerError" });
  });
});

describe("check", () => {
  it("只回傳錯誤，不寫入", async () => {
    const p = await product({ acc: 1 });
    const errors = await ledger.check(db, [
      { productId: p.id, quantityType: "accountable", delta: -1 },
      { productId: p.id, quantityType: "accountable", delta: -1 },
    ]);
    expect(errors).toEqual([expect.objectContaining({ index: 1, productId: p.id })]);
    expect((await qty(p.id)).acc).toBe(1);
  });
});
