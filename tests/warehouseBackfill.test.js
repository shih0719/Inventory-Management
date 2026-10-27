const os = require("os");
const path = require("path");
const fs = require("fs");

// B2：舊資料的 batches / shipments / transactions 沒寫 warehouse_id，啟動時依商品回填
describe("啟動時回填 warehouse_id", () => {
  const savedPath = process.env.DB_PATH;
  afterAll(() => { process.env.DB_PATH = savedPath; });

  // A fresh module instance per "process start", all on the same file
  const boot = () => {
    let mod;
    jest.isolateModules(() => { mod = require("../src/config/database"); });
    return mod;
  };

  test("依所屬異動的商品倉庫回填；沒有異動的歸到 default", async () => {
    process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "inv-")), "backfill.db");

    const first = boot();
    await first.initDatabase();
    const wh = (await first.run("INSERT INTO warehouses (name) VALUES ('Legacy')")).id;
    const defaultWh = (await first.get("SELECT id FROM warehouses WHERE name = 'default' COLLATE NOCASE")).id;
    const tag = (await first.get("SELECT id FROM tags WHERE name = 'INBOUND'")).id;
    const product = (await first.run("INSERT INTO products (warehouse_id, type, sku, name) VALUES (?, 'normal', 'LEG-1', 'x')", [wh])).id;
    const batch = (await first.run("INSERT INTO batches (batch_number) VALUES ('LEG-B')")).id;
    const emptyBatch = (await first.run("INSERT INTO batches (batch_number) VALUES ('LEG-EMPTY')")).id;
    const tx = (await first.run(
      "INSERT INTO transactions (product_id, tag_id, batch_id, quantity_change, quantity_type) VALUES (?, ?, ?, 1, 'non_accountable')",
      [product, tag, batch]
    )).id;
    const shipment = (await first.run("INSERT INTO shipments (shipment_number) VALUES ('LEG-S')")).id;
    await first.run("INSERT INTO shipment_transactions (shipment_id, transaction_id) VALUES (?, ?)", [shipment, tx]);
    await first.closeDatabase();

    const second = boot();
    await second.initDatabase();
    const whOf = async (table, id) => (await second.get(`SELECT warehouse_id FROM ${table} WHERE id = ?`, [id])).warehouse_id;
    expect(await whOf("transactions", tx)).toBe(wh);
    expect(await whOf("batches", batch)).toBe(wh);
    expect(await whOf("shipments", shipment)).toBe(wh);
    expect(await whOf("batches", emptyBatch)).toBe(defaultWh);
    await second.closeDatabase();
  });
});
