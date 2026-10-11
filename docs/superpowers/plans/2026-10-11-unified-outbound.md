# Unified Outbound Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge 出貨（批次出庫）、AP 快速出貨、出貨單據建立 into one screen and one atomic API call: scan SKUs and AP serials in the same form, and an OUTBOUND-tagged submit creates the Shipment automatically.

**Architecture:** A new `outboundService.createOutbound()` validates everything first (Strict Mode), then in one SQLite transaction writes the batch, the quantity transactions, marks AP units `sold`, and — when the tag is `OUTBOUND` — creates a Shipment bound to all those transactions. It is exposed as `POST /api/outbound`. A serial lookup endpoint lets the frontend turn a scanned serial into an AP line. The outbound `BatchFlow` gains shipment fields and an AP serial list; the AP quick-sell modal and the old `bulk-sell` endpoint are deleted; the Shipments page becomes view + 補綁 only.

**Tech Stack:** Node/Express + sqlite3 (backend, Jest + supertest tests), React + TypeScript + Vite (frontend, verified with `tsc` + browser preview).

**Decisions already made (from the user):**
1. Tag `OUTBOUND` → always create a Shipment. Any other tag → no Shipment.
2. AP serials and regular SKU lines can be mixed in one outbound.

**Domain rules to keep (CONTEXT.md):**
- If any AP serial is in the outbound, `project_case` is required (AP rule). `sold_to` = the shipment's `customer`.
- AP products (`track_serial = 1`) can no longer be deducted by quantity — they must be scanned by serial. This closes the drift where a quantity outbound reduced `accountable_quantity` without marking units sold.
- Whole outbound is all-or-nothing.

**Baseline:** `npm test` → 11 suites, 83 tests passing (checked 2026-10-11).

---

## File Structure

Backend
- Create `src/services/shipmentService.js` — `generateShipmentNumber(date)` moved out of the controller so the new service can reuse it.
- Create `src/services/outboundService.js` — `createOutbound(input, actor)` + `OutboundError`. Owns all validation + the DB transaction.
- Create `src/controllers/outboundController.js` — maps HTTP body ↔ service.
- Create `src/routes/outbound.js` — `POST /`.
- Modify `src/app.js` — mount `/outbound` on `warehouseRouter`.
- Modify `src/controllers/shipmentsController.js` — import `generateShipmentNumber` from the service.
- Modify `src/controllers/productUnitsController.js` — add `lookupBySerial`, delete `bulkSell`.
- Modify `src/routes/productUnits.js` — add `GET /lookup/:serial`, delete `POST /bulk-sell`.
- Create `tests/outbound.test.js`; delete `tests/quickSell.test.js` (its cases are ported).

Frontend (`vite-app/src/`)
- Modify `types.ts` — `OutboundInput`, `OutboundResult`, `SerialLookup`.
- Create `api/outbound.ts` — `createOutbound()`.
- Modify `api/product-units.ts` — add `lookupSerial()`, delete `bulkSellUnits()`.
- Modify `components/ProductCombobox.tsx` — `onUnmatchedEnter` prop.
- Create `components/OutboundExtras.tsx` — `ShipmentFields` + `SerialList` (keeps BatchFlow from growing).
- Modify `components/BatchFlow.tsx` — serial scanning, shipment fields, AP-by-quantity blocked.
- Modify `hooks/useAppHandlers.ts` — outbound submits go to `createOutbound`.
- Modify `components/APProductsPage.tsx`, `components/AppContent.tsx`, `App.tsx` — AP button navigates to outbound.
- Delete `components/modals/QuickSellModal.tsx`.
- Modify `lib/i18n.ts` — drop unused `quickSell*` (except `quickSellTitle`) and `apNoteForBatch` keys.
- Modify `components/ShipmentsPage.tsx` — wording: create → 補綁.

Docs
- Modify `CONTEXT.md`, `docs/api/README.md`, `README.md`.

---

### Task 1: Move `generateShipmentNumber` into a service

**Files:**
- Create: `src/services/shipmentService.js`
- Modify: `src/controllers/shipmentsController.js:1-18`

- [ ] **Step 1: Create the service**

```js
// src/services/shipmentService.js
const db = require("../config/database");

// Generate shipment number in format SHP-YYYYMMDD-XXX
async function generateShipmentNumber(shipmentDate) {
  const date = new Date(shipmentDate);
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');

  const result = await db.get(
    `SELECT COUNT(*) as count FROM shipments
     WHERE shipment_number LIKE ? AND is_deleted = 0`,
    [`SHP-${dateStr}-%`]
  );

  const nextSeq = (result?.count || 0) + 1;
  return `SHP-${dateStr}-${String(nextSeq).padStart(3, '0')}`;
}

module.exports = { generateShipmentNumber };
```

- [ ] **Step 2: Use it from the controller**

In `src/controllers/shipmentsController.js`, delete the local `generateShipmentNumber` function (lines 4–18) and change the imports at the top to:

```js
const db = require("../config/database");
const auditService = require("../services/auditService");
const { generateShipmentNumber } = require("../services/shipmentService");
```

- [ ] **Step 3: Run tests — nothing should change**

Run: `npm test`
Expected: 11 suites / 83 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/services/shipmentService.js src/controllers/shipmentsController.js
git commit -m "refactor: move generateShipmentNumber into shipmentService"
```

---

### Task 2: Outbound service + endpoint (TDD)

**Files:**
- Create: `tests/outbound.test.js`
- Create: `src/services/outboundService.js`
- Create: `src/controllers/outboundController.js`
- Create: `src/routes/outbound.js`
- Modify: `src/app.js` (warehouseRouter block, after the `/shipments` line)

- [ ] **Step 1: Write the failing tests**

Note: the seeded tags are `INBOUND, OUTBOUND, TRANSFER, COUNT, DAMAGE, SCRAP, RETURN, LOAN, RETURN_LOAN, ADJUSTMENT`. `LOAN` is used as the "not OUTBOUND" tag.

```js
// tests/outbound.test.js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/outbound.test.js --runInBand`
Expected: FAIL — requests return 404 (route not mounted).

- [ ] **Step 3: Write the service**

```js
// src/services/outboundService.js
const db = require("../config/database");
const quantityStateService = require("./quantityStateService");
const auditService = require("./auditService");
const { generateShipmentNumber } = require("./shipmentService");

class OutboundError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = "OutboundError";
    this.errors = errors;
  }
}

function normalizeSerial(sn) {
  return String(sn || "").trim().toUpperCase();
}

const typeLabel = (quantityType) => (quantityType === "accountable" ? "有帳" : "無帳");

/**
 * Validate and execute one outbound (Strict Mode: all-or-nothing).
 *
 * Side effects, inside one DB transaction: inserts a batch and its transactions,
 * decrements product quantities, marks AP units sold, and — when the tag is
 * OUTBOUND — inserts a shipment bound to every created transaction.
 *
 * @param {Object} input
 * @param {number} input.tagId
 * @param {string} [input.description]
 * @param {Array<{product_id:number, quantity:number, quantity_type:string, remarks?:string}>} [input.items]
 *        Non-AP lines; quantity is a positive number of units going out.
 * @param {string[]} [input.serials] AP serial numbers.
 * @param {{customer?:string, project_case?:string, shipment_date?:string}} [input.shipment]
 * @param {{userId:number, username:string, warehouseId:number}} actor
 * @throws {OutboundError} when any validation fails (nothing is written).
 */
async function createOutbound(input, actor) {
  const { tagId, description = "", items = [], serials = [], shipment = {} } = input;
  const customer = (shipment.customer || "").trim() || null;
  const projectCase = (shipment.project_case || "").trim() || null;

  if (items.length === 0 && serials.length === 0) {
    throw new OutboundError("至少需要一筆商品或序號");
  }

  const tag = await db.get("SELECT id, name FROM tags WHERE id = ?", [tagId]);
  if (!tag) throw new OutboundError(`tag_id ${tagId} 不存在`);

  const errors = [];
  // Running balance per product+type, so two lines of the same product are checked together.
  const running = new Map();
  const balanceKey = (productId, quantityType) => `${productId}:${quantityType}`;
  const takeFrom = (product, quantityType, count) => {
    const key = balanceKey(product.id, quantityType);
    const current = running.has(key)
      ? running.get(key)
      : quantityType === "accountable" ? product.accountable_quantity : product.non_accountable_quantity;
    const validation = quantityStateService.validate(current, -count, { quantityType });
    if (!validation.ok) return { error: validation.reason };
    running.set(key, validation.newQuantity);
    return { before: current, after: validation.newQuantity };
  };

  // ── Phase 1a: regular lines ────────────────────────────────────────────────
  const plannedTx = [];
  for (let i = 0; i < items.length; i++) {
    const { product_id, quantity, quantity_type, remarks } = items[i];
    const label = `第 ${i + 1} 行`;
    const count = parseInt(quantity, 10);

    if (!product_id || !Number.isInteger(count) || count <= 0) {
      errors.push(`${label}：需要商品與大於 0 的數量`);
      continue;
    }
    if (!["accountable", "non_accountable"].includes(quantity_type)) {
      errors.push(`${label}：quantity_type 必須是 accountable 或 non_accountable`);
      continue;
    }
    const product = await db.get(
      "SELECT * FROM products WHERE id = ? AND warehouse_id = ? AND is_deleted = 0",
      [product_id, actor.warehouseId]
    );
    if (!product) {
      errors.push(`${label}：此倉庫找不到商品 ${product_id}`);
      continue;
    }
    if (product.track_serial) {
      errors.push(`${label}（${product.sku}）：AP 商品請掃描序號出貨`);
      continue;
    }
    const taken = takeFrom(product, quantity_type, count);
    if (taken.error) {
      errors.push(`${label}（${product.sku}）：${taken.error}`);
      continue;
    }
    plannedTx.push({
      product_id: product.id,
      quantity_type,
      quantity_change: -count,
      before: taken.before,
      after: taken.after,
      source: "batch",
      remarks: `[${typeLabel(quantity_type)}] ${remarks || description}`,
      unitIds: null,
    });
  }

  // ── Phase 1b: AP serials ───────────────────────────────────────────────────
  if (serials.length > 0 && !projectCase) {
    errors.push("出貨含 AP 序號時，案子（project_case）為必填");
  }
  const seen = new Set();
  const unitsByProduct = new Map();
  for (const raw of serials) {
    const sn = normalizeSerial(raw);
    if (!sn) {
      errors.push({ serial_number: "", reason: "序號不可為空" });
      continue;
    }
    if (seen.has(sn)) {
      errors.push({ serial_number: sn, reason: "批次內序號重複" });
      continue;
    }
    seen.add(sn);
    const unit = await db.get(
      `SELECT pu.id, pu.status, pu.product_id
       FROM product_units pu JOIN products p ON pu.product_id = p.id
       WHERE pu.serial_number = ? AND p.warehouse_id = ? AND p.is_deleted = 0`,
      [sn, actor.warehouseId]
    );
    if (!unit) {
      errors.push({ serial_number: sn, reason: "此倉庫找不到序號" });
    } else if (unit.status !== "in_stock") {
      errors.push({ serial_number: sn, reason: "已出庫" });
    } else {
      if (!unitsByProduct.has(unit.product_id)) unitsByProduct.set(unit.product_id, []);
      unitsByProduct.get(unit.product_id).push(unit.id);
    }
  }
  for (const [productId, unitIds] of unitsByProduct) {
    const product = await db.get("SELECT * FROM products WHERE id = ?", [productId]);
    const taken = takeFrom(product, "accountable", unitIds.length);
    if (taken.error) {
      errors.push(`${product.sku}：${taken.error}（序號品數量與帳面不一致）`);
      continue;
    }
    plannedTx.push({
      product_id: productId,
      quantity_type: "accountable",
      quantity_change: -unitIds.length,
      before: taken.before,
      after: taken.after,
      source: "ap-sell",
      remarks: `[有帳] ${description}`,
      unitIds,
    });
  }

  if (errors.length > 0) {
    throw new OutboundError(`驗證失敗，共 ${errors.length} 筆錯誤，整批取消`, errors);
  }

  // ── Phase 2: write everything atomically ───────────────────────────────────
  const createShipment = tag.name === "OUTBOUND";
  const shipmentDate = shipment.shipment_date || new Date().toISOString().split("T")[0];
  const soldAt = new Date().toISOString();

  await db.run("BEGIN TRANSACTION");
  try {
    const batchNumber = `BATCH-${Date.now()}`;
    const batch = await db.run(
      "INSERT INTO batches (batch_number, description, created_by_user) VALUES (?, ?, ?)",
      [batchNumber, description, actor.username]
    );
    auditService.logAction(actor.userId, "CREATE", "batch", batch.id, actor.warehouseId);

    const transactionIds = [];
    for (const tx of plannedTx) {
      if (tx.unitIds) {
        for (const unitId of tx.unitIds) {
          await db.run(
            "UPDATE product_units SET status = 'sold', project_case = ?, sold_to = ?, sold_at = ? WHERE id = ?",
            [projectCase, customer, soldAt, unitId]
          );
        }
      }
      const result = await db.run(
        `INSERT INTO transactions (product_id, tag_id, batch_id, quantity_change, quantity_type, quantity_before, quantity_after, source, remarks, product_unit_ids, created_by_user)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tx.product_id, tag.id, batch.id, tx.quantity_change, tx.quantity_type,
          tx.before, tx.after, tx.source, tx.remarks,
          tx.unitIds ? JSON.stringify(tx.unitIds) : null, actor.username,
        ]
      );
      transactionIds.push(result.id);
      auditService.logAction(actor.userId, "CREATE", "transaction", result.id);

      const field = tx.quantity_type === "accountable" ? "accountable_quantity" : "non_accountable_quantity";
      await db.run(`UPDATE products SET ${field} = ? WHERE id = ?`, [tx.after, tx.product_id]);
    }

    let shipmentId = null;
    let shipmentNumber = null;
    if (createShipment) {
      shipmentNumber = await generateShipmentNumber(shipmentDate);
      const created = await db.run(
        `INSERT INTO shipments (shipment_number, customer, project_case, shipment_date, created_by_user)
         VALUES (?, ?, ?, ?, ?)`,
        [shipmentNumber, customer, projectCase, shipmentDate, actor.username]
      );
      shipmentId = created.id;
      for (const txId of transactionIds) {
        await db.run(
          "INSERT INTO shipment_transactions (shipment_id, transaction_id) VALUES (?, ?)",
          [shipmentId, txId]
        );
      }
      auditService.logAction(actor.userId, "CREATE", "shipment", shipmentId, actor.warehouseId);
    }

    await db.run("COMMIT");

    return {
      batch_id: batch.id,
      batch_number: batchNumber,
      transaction_ids: transactionIds,
      shipment_id: shipmentId,
      shipment_number: shipmentNumber,
    };
  } catch (error) {
    await db.run("ROLLBACK");
    throw error;
  }
}

module.exports = { createOutbound, OutboundError };
```

- [ ] **Step 4: Write the controller and route, mount it**

```js
// src/controllers/outboundController.js
const { createOutbound, OutboundError } = require("../services/outboundService");

// POST /api/outbound — one outbound: quantity lines + AP serials (+ shipment when tag is OUTBOUND)
async function create(req, res) {
  const { tag_id, description, items, serial_numbers, shipment } = req.body;
  if (!tag_id) {
    return res.status(400).json({ success: false, error: "tag_id is required" });
  }
  try {
    const data = await createOutbound(
      {
        tagId: tag_id,
        description: description || "",
        items: Array.isArray(items) ? items : [],
        serials: Array.isArray(serial_numbers) ? serial_numbers : [],
        shipment: shipment || {},
      },
      { userId: req.user?.id, username: req.user?.username || "unknown", warehouseId: req.warehouseId }
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    if (error instanceof OutboundError) {
      return res.status(400).json({ success: false, error: error.message, errors: error.errors });
    }
    console.error("Error creating outbound:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { create };
```

```js
// src/routes/outbound.js
const express = require("express");
const router = express.Router();
const outboundController = require("../controllers/outboundController");
const { requireRole } = require("../middleware/authMiddleware");

router.post("/", requireRole(["manager", "admin"]), outboundController.create);

module.exports = router;
```

In `src/app.js`, directly after `warehouseRouter.use("/shipments",     require("./routes/shipments"));` add:

```js
  warehouseRouter.use("/outbound",      require("./routes/outbound"));
```

- [ ] **Step 5: Run the new tests**

Run: `npx jest tests/outbound.test.js --runInBand`
Expected: 9 tests PASS.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: 12 suites / 92 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/services/outboundService.js src/controllers/outboundController.js src/routes/outbound.js src/app.js tests/outbound.test.js
git commit -m "feat: add atomic POST /api/outbound (qty lines + AP serials + auto shipment)"
```

---

### Task 3: Serial lookup endpoint; remove `bulk-sell`

**Files:**
- Modify: `src/controllers/productUnitsController.js` (add `lookupBySerial`, delete `bulkSell` at lines 180–281 and from `module.exports`)
- Modify: `src/routes/productUnits.js`
- Modify: `tests/outbound.test.js` (append)
- Delete: `tests/quickSell.test.js`

- [ ] **Step 1: Append failing tests**

Append to `tests/outbound.test.js`:

```js
describe("GET /api/product-units/lookup/:serial", () => {
  const lookup = (sn, wid = warehouseId) =>
    request(app)
      .get(`/api/product-units/lookup/${encodeURIComponent(sn)}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Warehouse-Id", String(wid));

  it("找到序號（不分大小寫）→ 200 帶商品資訊", async () => {
    const apId = await createProduct("OB-LK", { serials: ["OB-LK-1"] });
    const res = await lookup(" ob-lk-1 ");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      serial_number: "OB-LK-1", status: "in_stock", product_id: apId, sku: "OB-LK",
    });
  });

  it("不存在或在別的倉庫 → 404", async () => {
    await createProduct("OB-LK-OTHER", { serials: ["OB-LK-O1"], wid: otherWarehouseId });
    expect((await lookup("OB-NOPE-999")).status).toBe(404);
    expect((await lookup("OB-LK-O1")).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest tests/outbound.test.js -t lookup --runInBand`
Expected: FAIL — the first test gets 404 (no route matches `/lookup/:serial` yet).

- [ ] **Step 3: Implement `lookupBySerial`**

In `src/controllers/productUnitsController.js`, add after `getAll`:

```js
// GET /api/product-units/lookup/:serial — exact serial in the current warehouse
async function lookupBySerial(req, res) {
  try {
    const sn = normalizeSerial(req.params.serial);
    const unit = await db.get(
      `SELECT pu.id, pu.serial_number, pu.status, pu.product_id, p.sku, p.name AS product_name
       FROM product_units pu JOIN products p ON pu.product_id = p.id
       WHERE pu.serial_number = ? AND p.warehouse_id = ? AND p.is_deleted = 0`,
      [sn, req.warehouseId]
    );
    if (!unit) return res.status(404).json({ success: false, error: "此倉庫找不到序號" });
    res.json({ success: true, data: unit });
  } catch (error) {
    console.error("Error looking up serial:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
```

Delete the whole `bulkSell` function (its comment `// POST /api/product-units/bulk-sell` through its closing brace) and change the export line to:

```js
module.exports = { getAll, getById, lookupBySerial, create, bulkCreate, transfer, update, remove, exportCSV };
```

If `quantityStateService` is no longer referenced in the file after deleting `bulkSell`, remove its `require` line too (check with grep).

- [ ] **Step 4: Update the routes**

`src/routes/productUnits.js` becomes:

```js
const express = require("express");
const router = express.Router();
const c = require("../controllers/productUnitsController");

router.get("/export", c.exportCSV);
router.get("/lookup/:serial", c.lookupBySerial);
router.get("/", c.getAll);
router.get("/:id", c.getById);
router.post("/bulk", c.bulkCreate);
router.post("/transfer", c.transfer);
router.post("/", c.create);
router.put("/:id", c.update);
router.delete("/:id", c.remove);

module.exports = router;
```

- [ ] **Step 5: Delete the old quick-sell tests**

Their cases (valid sell, unknown serial, already sold, duplicate, missing project_case) are all covered by `tests/outbound.test.js`.

```bash
git rm tests/quickSell.test.js
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: 12 suites / 89 tests pass (83 − 5 quickSell + 9 outbound + 2 lookup).

- [ ] **Step 7: Commit**

```bash
git add src/controllers/productUnitsController.js src/routes/productUnits.js tests/outbound.test.js
git commit -m "feat: add serial lookup endpoint; remove bulk-sell (replaced by /api/outbound)"
```

---

### Task 4: Frontend types and API clients

**Files:**
- Modify: `vite-app/src/types.ts` (after the `CreateBatchResult` block)
- Create: `vite-app/src/api/outbound.ts`
- Modify: `vite-app/src/api/product-units.ts` (delete `bulkSellUnits` at lines 40–54, add `lookupSerial`)

- [ ] **Step 1: Add types**

Append after the `CreateBatchResult` interface in `vite-app/src/types.ts`:

```ts
// ---- Outbound (unified: qty lines + AP serials + auto shipment) -----------
export interface OutboundItem {
  product_id: number;
  /** Positive number of units going out. */
  quantity: number;
  quantity_type: QuantityType;
  remarks?: string;
}

export interface OutboundInput {
  tag_id: number;
  description?: string;
  items: OutboundItem[];
  serial_numbers: string[];
  shipment?: { customer?: string; project_case?: string; shipment_date?: string };
}

export interface OutboundResult {
  batch_id: number;
  batch_number: string;
  transaction_ids: number[];
  /** Set only when the tag is OUTBOUND. */
  shipment_id: number | null;
  shipment_number: string | null;
}

export interface SerialLookup {
  id: number;
  serial_number: string;
  status: 'in_stock' | 'sold';
  product_id: number;
  sku: string;
  product_name: string;
}
```

- [ ] **Step 2: Create the outbound client**

```ts
// src/api/outbound.ts
import { api } from './client';
import type { OutboundInput, OutboundResult } from '../types';

/** One atomic outbound; creates a shipment when the tag is OUTBOUND. */
export async function createOutbound(input: OutboundInput): Promise<OutboundResult> {
  const res = await api.post<OutboundResult>('/api/outbound', input);
  return res.data;
}
```

- [ ] **Step 3: Replace `bulkSellUnits` with `lookupSerial`**

In `vite-app/src/api/product-units.ts`, delete the `bulkSellUnits` function and add:

```ts
/** Exact serial lookup in the current warehouse. Throws ApiError(404) when not found. */
export async function lookupSerial(serial: string): Promise<SerialLookup> {
  const res = await api.get<SerialLookup>(`/api/product-units/lookup/${encodeURIComponent(serial.trim())}`);
  return res.data;
}
```

Add `SerialLookup` to that file's `import type { ... } from '../types'` line.

- [ ] **Step 4: Typecheck**

Run: `npm --prefix vite-app run typecheck`
Expected: exactly one error — `QuickSellModal.tsx` can't find `bulkSellUnits`. Task 8 deletes that file. Any other error is a real problem: fix it before committing.

- [ ] **Step 5: Commit**

```bash
git add vite-app/src/types.ts vite-app/src/api/outbound.ts vite-app/src/api/product-units.ts
git commit -m "feat(frontend): add outbound and serial lookup API clients"
```

---

### Task 5: `ProductCombobox` — hand unmatched scans to the caller

**Files:**
- Modify: `vite-app/src/components/ProductCombobox.tsx` (props interface, destructuring, Enter branch in `handleKey`)

- [ ] **Step 1: Add the prop**

In `ProductComboboxProps`, after `focusSignal?: number;`:

```ts
  /**
   * Enter with text that matches no product (e.g. a scanned AP serial).
   * Resolve true when the text was consumed — the input then clears for the next scan;
   * false keeps the text selected so the next scan replaces it.
   */
  onUnmatchedEnter?: (text: string) => boolean | Promise<boolean>;
```

Add `onUnmatchedEnter,` to the destructured props after `focusSignal = 0,`.

- [ ] **Step 2: Use it in the Enter branch**

Replace:

```ts
      } else if (q) {
        // No match: keep the text selected so the next scan replaces it.
        inputRef.current?.select();
        e.preventDefault();
      }
```

with:

```ts
      } else if (q) {
        e.preventDefault();
        if (!onUnmatchedEnter) {
          // No match: keep the text selected so the next scan replaces it.
          inputRef.current?.select();
          return;
        }
        void Promise.resolve(onUnmatchedEnter(query.trim())).then((consumed) => {
          if (consumed) {
            setQuery('');
            setOpen(false);
          } else {
            inputRef.current?.select();
          }
        });
      }
```

Note: a serial usually matches no product, so the list is empty and `open && visible[hi]` is false — the branch above is reached. Exact SKU matches still win first.

- [ ] **Step 3: Typecheck**

Run: `npm --prefix vite-app run typecheck`
Expected: only the known `QuickSellModal.tsx` error.

- [ ] **Step 4: Commit**

```bash
git add vite-app/src/components/ProductCombobox.tsx
git commit -m "feat(frontend): let ProductCombobox hand unmatched scans to the caller"
```

---

### Task 6: `OutboundExtras` — shipment fields + serial list

**Files:**
- Create: `vite-app/src/components/OutboundExtras.tsx`

- [ ] **Step 1: Create the component file**

Uses existing classes (`card`, `field`, `batch-meta-fields`, `pill`, `remove`) and the same inline `lang === 'en' ? … : …` strings as `BatchFlow`/`ShipmentsPage`.

```tsx
// src/components/OutboundExtras.tsx
import type { SerialLookup } from '../types';
import type { Lang } from '../lib/i18n';

export interface ShipmentDraft {
  customer: string;
  project_case: string;
  shipment_date: string;
}

export function ShipmentFields({
  value,
  onChange,
  createsShipment,
  caseRequired,
  lang,
}: {
  value: ShipmentDraft;
  onChange: (patch: Partial<ShipmentDraft>) => void;
  /** Tag is OUTBOUND → a shipment document will be created. */
  createsShipment: boolean;
  /** At least one AP serial is in the list. */
  caseRequired: boolean;
  lang: Lang;
}) {
  const en = lang === 'en';
  const caseMissing = caseRequired && !value.project_case.trim();
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10 }}>
        {createsShipment
          ? en ? 'A shipment document is created on submit.' : '送出時會自動建立出貨單據'
          : en ? 'This tag does not create a shipment document.' : '此標籤不會建立出貨單據'}
      </div>
      <div className="batch-meta-fields">
        <div className="field">
          <label>{en ? 'Customer' : '客戶'}</label>
          <input value={value.customer} onChange={(e) => onChange({ customer: e.target.value })} />
        </div>
        <div className="field">
          <label>
            {en ? 'Project' : '案子'}
            {caseRequired && <span style={{ color: 'var(--accent)' }}> *</span>}
          </label>
          <input
            value={value.project_case}
            aria-invalid={caseMissing}
            onChange={(e) => onChange({ project_case: e.target.value })}
            placeholder={caseRequired ? (en ? 'Required for AP serials' : 'AP 序號出貨必填') : ''}
          />
        </div>
        {createsShipment && (
          <div className="field">
            <label>{en ? 'Shipment date' : '出貨日期'}</label>
            <input
              type="date"
              value={value.shipment_date}
              onChange={(e) => onChange({ shipment_date: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function SerialList({
  units,
  onRemove,
  scanError,
  lang,
}: {
  units: SerialLookup[];
  onRemove: (serial: string) => void;
  scanError: string | null;
  lang: Lang;
}) {
  const en = lang === 'en';
  if (units.length === 0 && !scanError) return null;
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
        {en ? 'AP serials' : 'AP 序號'} <span className="pill">{units.length}</span>
      </div>
      {scanError && <div className="batch-line-error">⚠ {scanError}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {units.map((u) => (
          <div key={u.serial_number} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ fontFamily: 'var(--mono)' }}>{u.serial_number}</span>
            <span style={{ color: 'var(--ink-3)' }}>
              {u.sku} · {u.product_name}
            </span>
            <button
              className="remove"
              style={{ marginLeft: 'auto' }}
              onClick={() => onRemove(u.serial_number)}
              aria-label={en ? 'Remove serial' : '移除序號'}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm --prefix vite-app run typecheck`
Expected: only the known `QuickSellModal.tsx` error.

- [ ] **Step 3: Commit**

```bash
git add vite-app/src/components/OutboundExtras.tsx
git commit -m "feat(frontend): add shipment fields and AP serial list for outbound"
```

---

### Task 7: Wire serials + shipment into `BatchFlow` and the submit handler

**Files:**
- Modify: `vite-app/src/components/BatchFlow.tsx`
- Modify: `vite-app/src/hooks/useAppHandlers.ts:120-142`

- [ ] **Step 1: Extend the payload type**

In `BatchFlow.tsx`, replace the `BatchSubmitPayload` interface with:

```ts
export interface BatchSubmitPayload {
  name: string;
  items: CreateBatchItem[];
  /** UI-only convenience copy, NOT sent to the backend. */
  tagId: number;
  locationTag: string;
  /** Outbound only: AP serials and shipment fields, sent to POST /api/outbound. */
  outbound?: { serials: string[]; shipment: ShipmentDraft };
}
```

Update imports at the top of `BatchFlow.tsx`:

```ts
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { CreateBatchItem, Product, QuantityType, SerialLookup, Tag } from '../types';
import { L, tagLabel, type Lang } from '../lib/i18n';
import { ProductCombobox } from './ProductCombobox';
import { ShipmentFields, SerialList, type ShipmentDraft } from './OutboundExtras';
import { lookupSerial } from '../api/product-units';
```

- [ ] **Step 2: Add state and the scan handler**

After the `touch` declaration (`const touch = (id: number) => …`), add:

```ts
  // Outbound only: scanned AP serials + shipment fields.
  const [serialUnits, setSerialUnits] = useState<SerialLookup[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [shipment, setShipment] = useState<ShipmentDraft>({
    customer: '',
    project_case: '',
    shipment_date: new Date().toISOString().split('T')[0],
  });
  const createsShipment = tags.find((tg) => tg.id === tagId)?.name === 'OUTBOUND';
  const caseRequired = serialUnits.length > 0;

  /** Text scanned into a product field that matched no SKU: try it as an AP serial. */
  const handleSerialScan = async (lineId: number, text: string): Promise<boolean> => {
    const sn = text.trim().toUpperCase();
    if (serialUnits.some((u) => u.serial_number === sn)) {
      setScanError(lang === 'en' ? `${sn} is already in the list` : `${sn} 已在清單中`);
      return false;
    }
    try {
      const unit = await lookupSerial(sn);
      if (unit.status !== 'in_stock') {
        setScanError(lang === 'en' ? `${sn} is already shipped` : `${sn} 已出庫`);
        return false;
      }
      setSerialUnits((prev) => [...prev, unit]);
      setScanError(null);
      focusProduct(lineId);
      return true;
    } catch {
      setScanError(lang === 'en' ? `No product or serial "${sn}"` : `找不到商品或序號「${sn}」`);
      return false;
    }
  };
```

- [ ] **Step 3: Block AP products on quantity lines**

In `linesWithStatus`, replace:

```ts
        if (!product) {
          error = null; // empty line is fine until submit
        } else if (l.qty === 0 || l.qty === '') {
```

with:

```ts
        if (!product) {
          error = null; // empty line is fine until submit
        } else if (!isInbound && product.track_serial) {
          error = lang === 'en' ? 'AP product — scan its serial numbers instead' : 'AP 商品請改掃描序號';
        } else if (l.qty === 0 || l.qty === '') {
```

Delete the AP note block under the combobox (it would now contradict the error):

```tsx
                  {!!l.product?.track_serial && (
                    <div style={{ marginTop: 4 }}>
                      <span className="ap-note">{t.apNoteForBatch}</span>
                    </div>
                  )}
```

- [ ] **Step 4: Update submit rules**

Replace:

```ts
  const canSubmit = validLines.length > 0 && !hasErrors && !submitting;

  const totalUnits = validLines.reduce((s, l) => s + Number(l.qty), 0);
```

with:

```ts
  const caseMissing = caseRequired && !shipment.project_case.trim();
  const canSubmit =
    (validLines.length > 0 || serialUnits.length > 0) && !hasErrors && !caseMissing && !submitting;

  const totalUnits = validLines.reduce((s, l) => s + Number(l.qty), 0) + serialUnits.length;
```

In `handleSubmit`, replace the `onSubmit` call:

```ts
      await onSubmit({ name: generatedName, items, tagId, locationTag: '' });
```

with:

```ts
      await onSubmit({
        name: generatedName,
        items,
        tagId,
        locationTag: '',
        ...(isInbound ? {} : { outbound: { serials: serialUnits.map((u) => u.serial_number), shipment } }),
      });
```

- [ ] **Step 5: Render the extras and pass the scan handler**

Directly after the closing `</div>` of the batch-metadata card (the `<div className="card" style={{ padding: 14 }}>` that holds `batch-meta-fields`), add:

```tsx
      {!isInbound && (
        <ShipmentFields
          value={shipment}
          onChange={(patch) => setShipment((s) => ({ ...s, ...patch }))}
          createsShipment={createsShipment}
          caseRequired={caseRequired}
          lang={lang}
        />
      )}
```

Directly before `<div className="flow-foot">`, add:

```tsx
      {!isInbound && (
        <SerialList
          units={serialUnits}
          onRemove={(sn) => setSerialUnits((prev) => prev.filter((u) => u.serial_number !== sn))}
          scanError={scanError}
          lang={lang}
        />
      )}
```

On the `<ProductCombobox …>` inside the lines map, add the prop after `focusSignal={…}`:

```tsx
                    onUnmatchedEnter={isInbound ? undefined : (text) => handleSerialScan(l.id, text)}
```

Change the outbound scan placeholder so people know serials work. Replace the `scanPh` definition with:

```ts
  const scanPh = isInbound
    ? lang === 'en' ? 'Scan or search product…' : lang === 'ja' ? 'スキャンまたは商品を検索…' : lang === 'zh-cn' ? '扫描或搜索商品…' : '掃描或搜尋商品…'
    : lang === 'en' ? 'Scan SKU / AP serial, or search…' : lang === 'ja' ? 'SKU / AP シリアルをスキャン…' : lang === 'zh-cn' ? '扫描 SKU / AP 序号或搜索…' : '掃描 SKU / AP 序號或搜尋…';
```

- [ ] **Step 6: Route outbound submits to `/api/outbound`**

In `vite-app/src/hooks/useAppHandlers.ts`, add the import next to `createBatch`:

```ts
import { createOutbound } from '../api/outbound';
```

Replace the `try` body start of `handleBatchSubmit`:

```ts
        const items: CreateBatchItem[] = payload.items;
        await createBatch({ name: payload.name, tag_id: payload.tagId, items });
        await Promise.all([refetchProducts(), refetchTransactions()]);
        navigateTo({ kind: 'dashboard' });
        showToast(`${t.batchSaved} · ${items.length} ${t.lines}`);
```

with:

```ts
        const items: CreateBatchItem[] = payload.items;
        let suffix = `${items.length} ${t.lines}`;
        if (payload.outbound) {
          const result = await createOutbound({
            tag_id: payload.tagId,
            description: payload.name,
            items: items.map((i) => ({
              product_id: i.product_id,
              quantity: Math.abs(i.quantity_change),
              quantity_type: i.quantity_type,
              remarks: i.remarks,
            })),
            serial_numbers: payload.outbound.serials,
            shipment: payload.outbound.shipment,
          });
          suffix = result.shipment_number ?? `${items.length + payload.outbound.serials.length} ${t.lines}`;
        } else {
          await createBatch({ name: payload.name, tag_id: payload.tagId, items });
        }
        await Promise.all([refetchProducts(), refetchTransactions()]);
        navigateTo({ kind: 'dashboard' });
        showToast(`${t.batchSaved} · ${suffix}`);
```

Also show per-serial errors: in the same handler's `catch`, after the `if (body?.data?.failed) { … }` block and still inside the `if (err instanceof ApiError …)` block, add:

```ts
          if (Array.isArray(body?.errors) && body.errors.length > 0) {
            const first = body.errors[0];
            detail = ` — ${typeof first === 'string' ? first : `${first.serial_number}: ${first.reason}`}`;
          }
```

- [ ] **Step 7: Typecheck**

Run: `npm --prefix vite-app run typecheck`
Expected: only the known `QuickSellModal.tsx` error. Also `t.apNoteForBatch` should no longer be referenced (`grep -n apNoteForBatch vite-app/src/components` → no hits).

- [ ] **Step 8: Commit**

```bash
git add vite-app/src/components/BatchFlow.tsx vite-app/src/hooks/useAppHandlers.ts
git commit -m "feat(frontend): scan AP serials and fill shipment fields in the outbound flow"
```

---

### Task 8: AP page button → outbound flow; delete the quick-sell modal

**Files:**
- Modify: `vite-app/src/components/APProductsPage.tsx`
- Modify: `vite-app/src/components/AppContent.tsx` (props interface, destructuring, `<APProductsPage>` render)
- Modify: `vite-app/src/App.tsx` (`<AppContent>` props, near `onBatchSubmit={handleBatchSubmit}`)
- Modify: `vite-app/src/lib/i18n.ts`
- Delete: `vite-app/src/components/modals/QuickSellModal.tsx`

- [ ] **Step 1: APProductsPage**

Replace the props interface and the top of the component:

```tsx
import { useMemo } from 'react';
import type { Product } from '../types';
import { L, type Lang } from '../lib/i18n';

export interface APProductsPageProps {
  products: Product[];
  lang: Lang;
  onSelectProduct: (product: Product) => void;
  /** Opens the outbound flow, where AP serials are scanned. */
  onQuickOutbound: () => void;
}

export function APProductsPage({
  products,
  lang,
  onSelectProduct,
  onQuickOutbound,
}: APProductsPageProps) {
  const t = L[lang];

  const apProducts = useMemo(() => products.filter((p) => p.track_serial), [products]);
```

Change the button to `onClick={onQuickOutbound}` and delete the whole `{showQuickSell && ( <QuickSellModal … /> )}` block.

- [ ] **Step 2: AppContent + App**

In `AppContentProps` add after `onBatchSubmit`:

```ts
  onQuickOutbound: () => void;
```

Add `onQuickOutbound,` to the destructuring after `onBatchSubmit,`. Change the render to:

```tsx
      {view.kind === 'ap-products' && (
        <APProductsPage
          products={products}
          lang={lang}
          onSelectProduct={(product) => onSetModal({ kind: 'ap-product', product })}
          onQuickOutbound={onQuickOutbound}
        />
      )}
```

In `App.tsx`, after `onBatchSubmit={handleBatchSubmit}` add:

```tsx
        onQuickOutbound={() => navigateTo({ kind: 'batch', batchKind: 'outbound' })}
```

If `onRefetchProducts` is now unused inside `AppContent.tsx` (grep it), leave it — it's still part of the props and used by `EditProductsPage`.

- [ ] **Step 3: Delete the modal and its now-unused strings**

```bash
git rm vite-app/src/components/modals/QuickSellModal.tsx
```

In `vite-app/src/lib/i18n.ts`, in **all four** language blocks (`en`, `zh`, `ja`, `zh-cn`), delete these keys: `quickSellSerialLabel`, `quickSellSerialPh`, `quickSellProjectCase`, `quickSellProjectCasePh`, `quickSellSoldTo`, `quickSellSoldToPh`, `quickSellSubmit`, `quickSellSuccess`, `quickSellErrors`, `apNoteForBatch`. Keep `quickSellTitle` (still the AP page button label).

Check nothing else uses them:

Run: `grep -rnE "quickSell(SerialLabel|SerialPh|ProjectCase|SoldTo|Submit|Success|Errors)|apNoteForBatch" vite-app/src`
Expected: no output.

- [ ] **Step 4: Typecheck + build**

Run: `npm --prefix vite-app run typecheck`
Expected: 0 errors.

Run: `npm --prefix vite-app run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A vite-app/src
git commit -m "feat(frontend): AP quick outbound opens the unified outbound flow; drop QuickSellModal"
```

---

### Task 9: Shipments page becomes view + 補綁

**Files:**
- Modify: `vite-app/src/components/ShipmentsPage.tsx` (header subtitle ~line 169–171, list button ~line 195, create panel title ~line 243)

Only wording changes. The create form stays because it's the only way to bind older unbound transactions.

- [ ] **Step 1: Subtitle**

Replace:

```tsx
              {lang === 'en'
                ? 'Group transactions into shipments'
                : '將異動分組為出貨單據'}
```

with:

```tsx
              {lang === 'en'
                ? 'Shipments are created by Outbound with the OUTBOUND tag'
                : '出貨單據由「出貨」頁（OUTBOUND 標籤）自動建立'}
```

- [ ] **Step 2: Button + panel title**

Replace `(lang === 'en' ? '+ New' : '新增')` with `(lang === 'en' ? 'Bind existing' : '補綁異動')`.

Replace `{lang === 'en' ? 'New Shipment' : '新增出貨單'}` with `{lang === 'en' ? 'Bind existing transactions' : '補綁既有異動'}`.

- [ ] **Step 3: Typecheck + commit**

Run: `npm --prefix vite-app run typecheck`
Expected: 0 errors.

```bash
git add vite-app/src/components/ShipmentsPage.tsx
git commit -m "feat(frontend): reframe Shipments page as view + bind-existing"
```

---

### Task 10: Docs

**Files:**
- Modify: `CONTEXT.md` (Shipment section, around lines 55–77)
- Modify: `docs/api/README.md:65`
- Modify: `README.md:102`

- [ ] **Step 1: CONTEXT.md**

Under `**操作規則**：` in the Shipment section, insert as rule 0 (before `1. **建立**`):

```markdown
0. **自動建立（主要途徑）** — 「出貨」頁送出且標籤為 `OUTBOUND` 時，`POST /api/outbound` 在同一個 DB transaction 內建立異動、將 AP 序號標為 `sold`、並建立 Shipment 綁定所有異動。其他標籤不建立 Shipment。含 AP 序號時 `project_case` 必填，並同時寫入 Shipment 與 AP；AP 的 `sold_to` 取自 Shipment 的 `customer`。下方「建立」改為補綁既有異動用。
```

In the AP section, after the `出貨欄位規則` list, add:

```markdown
- AP 商品不能用數量出庫，必須在「出貨」頁掃描序號（避免 `accountable_quantity` 減少但序號仍是 `in_stock`）。
```

- [ ] **Step 2: API docs**

In `docs/api/README.md`, replace the `bulk-sell` row with:

```markdown
| GET | `/api/product-units/lookup/:serial` | 已登入 | 以序號查詢目前倉庫的 AP（找不到回 404） |
| POST | `/api/outbound` | manager / admin | 統一出庫：數量明細 + AP 序號，OUTBOUND 標籤自動建立出貨單（全有或全無） |
```

In `README.md:102`, replace `` `POST /api/product-units/bulk-sell`、`` with `` `GET /api/product-units/lookup/:serial`、`` and add a row to the same table:

```markdown
| `POST /api/outbound` | 統一出庫（數量 + AP 序號 + 自動出貨單） |
```

- [ ] **Step 3: Commit**

```bash
git add CONTEXT.md docs/api/README.md README.md
git commit -m "docs: document unified outbound and serial lookup"
```

---

### Task 11: End-to-end verification in the browser

Uses the `backend` + `frontend` configs in `.claude/launch.json` (scratch DB, so real data is untouched).

- [ ] **Step 1: Start servers**

`preview_start {name: "backend"}` then `preview_start {name: "frontend"}`. Log in with the seed admin account.

- [ ] **Step 2: Prepare data**

On the scratch DB, make sure the current warehouse has one regular product with stock ≥ 3 and one AP product with ≥ 2 `in_stock` serials (create them via the UI if missing).

- [ ] **Step 3: Happy path**

Open 出貨. Check:
- The OUTBOUND chip is selected, and the hint says a shipment document will be created.
- Scan the regular SKU into line 1, enter qty 2, press Enter.
- Type an AP serial in lowercase into line 2's field and press Enter. It appears in the AP 序號 list and the field clears.
- The submit button stays disabled until 案子 is filled.
- Fill 客戶 + 案子 and submit. The toast shows `SHP-YYYYMMDD-NNN`.
- In 出貨單據, the new shipment lists both transactions.
- On the AP page, the serial shows `sold` with the 案子 and 客戶.

- [ ] **Step 4: Error paths**

- Scan the same serial twice → "已在清單中".
- Scan a garbage string → "找不到商品或序號".
- Pick the AP product by name on a quantity line → the line shows "AP 商品請改掃描序號" and submit is disabled.
- On the AP page, click 快速出貨 → it lands on the outbound flow.

- [ ] **Step 5: Mobile width**

`resize_window {preset: "mobile"}`, then confirm the shipment fields and serial list don't scroll horizontally. Reset with `preset: "desktop"`.

- [ ] **Step 6: Final checks**

Run: `npm test`
Expected: 12 suites / 89 tests pass.

Run: `npm --prefix vite-app run build`
Expected: success.

Check `read_console_messages {onlyErrors: true}` → no errors. Take a screenshot of the outbound page with a serial in the list as proof.

---

## Known follow-ups (out of scope, noted only)

- `ShipmentsPage.loadShipments` fetches every shipment one by one (N+1) and only offers the latest 500 transactions for binding.
- `BatchFlow` outbound offers only tags `OUTBOUND / INTERNAL / ADJUST`, but the seeded tags have no `INTERNAL` or `ADJUST` (the seed uses `ADJUSTMENT`). So the outbound page can only pick OUTBOUND in practice. That happens to fit decision 1, but the filter is wrong.
- `createBatch` reads `description`, but the frontend sends `name`, so batch names typed in the inbound flow are dropped. The new outbound path sends `description` correctly.
