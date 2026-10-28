// Stock notifier: one message per shipment created by an outbound; other quantity changes send nothing.
const { setupTestDb, teardownTestDb } = require("./helpers/db");

let db;
let ledger;
let createOutbound;
let warehouseId;
let actor;
let outboundTagId;
let loanTagId;
let fetchSpy;

beforeAll(async () => {
  await setupTestDb();
  db = require("../src/config/database");
  ledger = require("../src/services/stockLedger");
  ({ createOutbound } = require("../src/services/outboundService"));
  await db.run("INSERT OR IGNORE INTO warehouses (name) VALUES ('NotifyWH')");
  warehouseId = (await db.get("SELECT id FROM warehouses WHERE name = 'NotifyWH'")).id;
  const user = await db.get("SELECT id, username FROM users WHERE username = 'eric'");
  actor = { userId: user.id, username: user.username, warehouseId };
  outboundTagId = (await db.get("SELECT id FROM tags WHERE name = 'OUTBOUND'")).id;
  loanTagId = (await db.get("SELECT id FROM tags WHERE name = 'LOAN'")).id;
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(() => {
  process.env.STOCK_WEBHOOK_URL = "https://hooks.example.test/stock";
  fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, status: 200 });
});

afterEach(() => {
  process.env.STOCK_WEBHOOK_URL = "";
  process.env.LINE_CHANNEL_ACCESS_TOKEN = "";
  process.env.LINE_TO = "";
  fetchSpy.mockRestore();
});

let skuSeq = 0;
async function product(acc, serials = []) {
  const sku = `NT-${++skuSeq}`;
  const ap = serials.length > 0;
  const { id } = await db.run(
    "INSERT INTO products (warehouse_id, type, sku, name, accountable_quantity, track_serial) VALUES (?, ?, ?, ?, ?, ?)",
    [warehouseId, ap ? "ap" : "normal", sku, `Name ${sku}`, ap ? serials.length : acc, ap ? 1 : 0],
  );
  for (const sn of serials) {
    await db.run("INSERT INTO product_units (product_id, serial_number, warehouse_id) VALUES (?, ?, ?)", [id, sn, warehouseId]);
  }
  return { id, sku };
}

const ship = (items, serials = [], tagId = outboundTagId) => createOutbound({
  tagId,
  items: items.map(({ id, quantity }) => ({ product_id: id, quantity, quantity_type: "accountable" })),
  serials,
  shipment: { customer: "客戶甲", project_case: "CASE-9" },
}, actor);
// Callbacks run on a microtask after commit; let them finish.
const settle = () => new Promise((resolve) => setImmediate(resolve));

it("出貨（一般品＋多個序號品）只發一則，帶出貨單號、客戶、案件與每項前後數量", async () => {
  const line = await product(10);
  const serials = [`SN-${skuSeq + 1}-1`, `SN-${skuSeq + 1}-2`];
  const ap = await product(0, serials);
  const result = await ship([{ id: line.id, quantity: 3 }], serials);
  await settle();

  expect(fetchSpy).toHaveBeenCalledTimes(1);
  const [url, init] = fetchSpy.mock.calls[0];
  expect(url).toBe("https://hooks.example.test/stock");
  const body = JSON.parse(init.body);
  expect(body).toMatchObject({
    event: "stock.changed",
    tag: "OUTBOUND",
    actor: "eric",
    batchId: result.batch_id,
    shipment: { id: result.shipment_id, shipmentNumber: result.shipment_number, customer: "客戶甲", projectCase: "CASE-9" },
  });
  expect(body.movements.map((m) => [m.sku, m.source, m.warehouse, m.delta, m.before, m.after]))
    .toEqual([[line.sku, "batch", "NotifyWH", -3, 10, 7], [ap.sku, "ap-sell", "NotifyWH", -2, 2, 0]]);
  expect(body.text).toBe([
    `【出貨單】${result.shipment_number}`,
    "倉庫：NotifyWH",
    "客戶：客戶甲　案件：CASE-9",
    "操作人：eric",
    `・Name ${line.sku} 有帳 10→7（-3）`,
    `・Name ${ap.sku} 有帳 2→0（-2）`,
  ].join("\n"));
});

it("不建立出貨單的出庫（非 OUTBOUND 標籤）不送", async () => {
  const p = await product(5);
  await ship([{ id: p.id, quantity: 1 }], [], loanTagId);
  await settle();
  expect(fetchSpy).not.toHaveBeenCalled();
});

it("一般數量異動不送", async () => {
  const p = await product(5);
  await db.transaction((tx) => ledger.apply(tx, [{ productId: p.id, quantityType: "accountable", delta: 1 }],
    { tag: { name: "ADJUSTMENT" }, source: "adjust", actor }));
  await settle();
  expect(fetchSpy).not.toHaveBeenCalled();
});

it("出貨驗證失敗時不送", async () => {
  const p = await product(1);
  await expect(ship([{ id: p.id, quantity: 5 }])).rejects.toThrow();
  await settle();
  expect(fetchSpy).not.toHaveBeenCalled();
});

it("未設定任何目標時不送", async () => {
  process.env.STOCK_WEBHOOK_URL = "";
  const p = await product(2);
  await ship([{ id: p.id, quantity: 1 }]);
  await settle();
  expect(fetchSpy).not.toHaveBeenCalled();
});

it("通知失敗不影響出貨結果", async () => {
  fetchSpy.mockRejectedValue(new Error("network down"));
  const p = await product(2);
  await expect(ship([{ id: p.id, quantity: 1 }])).resolves.toMatchObject({ shipment_number: expect.any(String) });
  await settle();
  expect((await db.get("SELECT accountable_quantity AS acc FROM products WHERE id = ?", [p.id])).acc).toBe(1);
});

describe("LINE push", () => {
  beforeEach(() => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "line-token";
    process.env.LINE_TO = "Cgroup123";
  });

  it("以 Bearer token 推播出貨單文字到 LINE_TO", async () => {
    process.env.STOCK_WEBHOOK_URL = "";
    const p = await product(4);
    const result = await ship([{ id: p.id, quantity: 2 }]);
    await settle();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.line.me/v2/bot/message/push");
    expect(init.headers.Authorization).toBe("Bearer line-token");
    expect(JSON.parse(init.body)).toEqual({
      to: "Cgroup123",
      messages: [{ type: "text", text: expect.stringContaining(`【出貨單】${result.shipment_number}`) }],
    });
  });

  it("webhook 與 LINE 都設定時兩邊都送", async () => {
    const p = await product(4);
    await ship([{ id: p.id, quantity: 1 }]);
    await settle();
    expect(fetchSpy.mock.calls.map(([url]) => url).sort())
      .toEqual(["https://api.line.me/v2/bot/message/push", "https://hooks.example.test/stock"]);
  });

  it("缺 LINE_TO 時不推播", async () => {
    process.env.STOCK_WEBHOOK_URL = "";
    process.env.LINE_TO = "";
    const p = await product(4);
    await ship([{ id: p.id, quantity: 1 }]);
    await settle();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
