const request = require("supertest");
const { setupTestDb, teardownTestDb } = require("./helpers/db");
const { createApp } = require("../src/app");

// C4：出貨單綁定異動（POST / PUT /api/shipments 與 /api/outbound 共用同一套規則）
let app;
let token;
let db;
let wh;
let inboundTagId;
let outboundTagId;
let product;

beforeAll(async () => {
  await setupTestDb();
  app = createApp();
  db = require("../src/config/database");

  await db.run("INSERT OR IGNORE INTO warehouses (name) VALUES ('BindWH')");
  wh = (await db.get("SELECT id FROM warehouses WHERE name = 'BindWH'")).id;
  const admin = await db.get("SELECT id FROM users WHERE username = 'eric'");
  await db.run("INSERT OR IGNORE INTO user_warehouses (user_id, warehouse_id) VALUES (?, ?)", [admin.id, wh]);
  token = (await request(app).post("/api/auth/login").send({ username: "eric", password: "password" })).body.data.token;
  inboundTagId = (await db.get("SELECT id FROM tags WHERE name = 'INBOUND'")).id;
  outboundTagId = (await db.get("SELECT id FROM tags WHERE name = 'OUTBOUND'")).id;

  product = (await api("post", "/api/products").send({ sku: "BIND-1", name: "Bind", accountable_quantity: 100 })).body.data.id;
});

afterAll(async () => {
  await teardownTestDb();
});

function api(method, url) {
  return request(app)[method](url).set("Authorization", `Bearer ${token}`).set("X-Warehouse-Id", String(wh));
}

async function outTx() {
  const res = await api("post", "/api/transactions").send({
    product_id: product, tag_id: outboundTagId, quantity_change: -1, quantity_type: "accountable",
  });
  return res.body.data.id;
}

async function inTx() {
  const res = await api("post", "/api/transactions").send({
    product_id: product, tag_id: inboundTagId, quantity_change: 1, quantity_type: "accountable",
  });
  return res.body.data.id;
}

const shipmentCount = async () => (await db.get("SELECT COUNT(*) AS n FROM shipments")).n;

describe("POST /api/shipments", () => {
  it("入庫異動不能綁進出貨單 → 409，不建立出貨單", async () => {
    const id = await inTx();
    const before = await shipmentCount();
    const res = await api("post", "/api/shipments").send({ transaction_ids: [id] });
    expect(res.status).toBe(409);
    expect(res.body.errors).toEqual([expect.stringContaining(`Transaction ${id}`)]);
    expect(await shipmentCount()).toBe(before);
  });

  it("重複的 transaction_id 只綁一次", async () => {
    const id = await outTx();
    const res = await api("post", "/api/shipments").send({ transaction_ids: [id, id] });
    expect(res.status).toBe(201);
    expect(res.body.data.transaction_ids).toEqual([id]);
  });

  it("回應的 items_summary 與 GET 相同（帶商品與標籤）", async () => {
    const id = await outTx();
    const created = await api("post", "/api/shipments").send({ transaction_ids: [id], customer: "C" });
    expect(created.status).toBe(201);
    const fetched = await api("get", `/api/shipments/${created.body.data.id}`);
    expect(created.body.data.items_summary).toEqual(fetched.body.data.items_summary);
    expect(created.body.data.items_summary[0]).toMatchObject({ id, sku: "BIND-1", tag_name: expect.any(String) });
  });

  it("同時兩張單綁同一筆異動 → 只有一張成功", async () => {
    const id = await outTx();
    const results = await Promise.all([
      api("post", "/api/shipments").send({ transaction_ids: [id] }),
      api("post", "/api/shipments").send({ transaction_ids: [id] }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const bound = await db.all("SELECT shipment_id FROM shipment_transactions WHERE transaction_id = ?", [id]);
    expect(bound).toHaveLength(1);
  });
});

describe("PUT /api/shipments/:id", () => {
  let shipmentId;
  let first;

  beforeAll(async () => {
    first = await outTx();
    shipmentId = (await api("post", "/api/shipments").send({ transaction_ids: [first] })).body.data.id;
  });

  it("換綁異動：回應的 items_summary 與 GET 相同", async () => {
    const second = await outTx();
    const res = await api("put", `/api/shipments/${shipmentId}`).send({ transaction_ids: [first, second], customer: "D" });
    expect(res.status).toBe(200);
    expect(res.body.data.transaction_ids.sort()).toEqual([first, second].sort());
    const fetched = await api("get", `/api/shipments/${shipmentId}`);
    expect(res.body.data.items_summary).toEqual(fetched.body.data.items_summary);
  });

  it("換入入庫異動 → 409，原本的綁定不變", async () => {
    const before = (await api("get", `/api/shipments/${shipmentId}`)).body.data.transaction_ids;
    const res = await api("put", `/api/shipments/${shipmentId}`).send({ transaction_ids: [await inTx()] });
    expect(res.status).toBe(409);
    expect((await api("get", `/api/shipments/${shipmentId}`)).body.data.transaction_ids).toEqual(before);
  });

  it("transaction_ids 為空陣列 → 400", async () => {
    const res = await api("put", `/api/shipments/${shipmentId}`).send({ transaction_ids: [] });
    expect(res.status).toBe(400);
  });

  it("不帶 transaction_ids 只改欄位，綁定不變", async () => {
    const before = (await api("get", `/api/shipments/${shipmentId}`)).body.data.transaction_ids;
    const res = await api("put", `/api/shipments/${shipmentId}`).send({ project_case: "P-9" });
    expect(res.status).toBe(200);
    const after = (await api("get", `/api/shipments/${shipmentId}`)).body.data;
    expect(after.project_case).toBe("P-9");
    expect(after.transaction_ids).toEqual(before);
  });
});
