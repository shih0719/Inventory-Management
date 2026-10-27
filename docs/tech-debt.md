# 技術債追蹤清單

來源：2026-10-22 架構審查（範圍：近 60 筆 commit 的熱點：Outbound、AP、Shipment、Batch、前端 `App.tsx`）。
術語依 [`CONTEXT.md`](../CONTEXT.md)；較早的架構說明見 [`improve.md`](improve.md)。

完成一項就勾選，並在後面補上 PR / commit 連結。

---

## A. 已確認的 bug

> 2026-10-22 全數修正（分支 `fix/tech-debt-a`，`82dc299`）。回歸測試：`tests/techDebtA.test.js`（A3、A7、A8 為前端或無法經路由觸及的分支，以 typecheck／人工檢查驗證）。

- [x] **A1. `POST /api/transactions` 可繞過 AP 序號規則**
  `transactionsController.create` 不檢查 `product.track_serial`。AdjustStockModal 與 Undo（`useAppHandlers.ts:93-110`）都能直接調整 AP 商品的 `accountable_quantity`，結果與 CONTEXT.md「AP 商品不能用數量出庫」的規則衝突。

- [x] **A2. 修改 Shipment 時誤判綁定衝突**
  `src/controllers/shipmentsController.js:272`：`transaction.shipment_id !== id`，其中 `id` 是字串 route param、`shipment_id` 是整數，永遠不相等。PUT 帶入原本就屬於這張單的 transaction 時會回 409。

- [x] **A3. Batch 名稱遺失**
  前端送 `{ name }`（`vite-app/src/hooks/useAppHandlers.ts:141`），後端讀 `description`（`src/controllers/batchesController.js:67`）。

- [x] **A4. `/api/product-units` 寫入路由沒有 `requireRole`**
  `src/routes/productUnits.js` 的 bulk / transfer / create / PUT / DELETE 只經過 `verifyAuth` + `requireWarehouse`，所以 `view` 角色也能修改 AP。其他寫入路由（transactions、batches、shipments）都有角色限制。

- [x] **A5. AP 批次入庫沒有包在 DB transaction 內**
  `src/controllers/productUnitsController.js:109-196` 先 INSERT `product_units` 再寫 Transaction。中途失敗會留下序號，卻沒有對應的數量異動。

- [x] **A6. AP 調撥不限來源倉庫，也不具 atomicity**
  `productUnitsController.js:220` 只用 `serial_number` 查詢，沒限定 `req.warehouseId`，可以調走其他倉庫的序號品。這條路徑同時沒有 DB transaction，也不經過數量驗證（直接 `- ?`）。

- [x] **A7. 預設倉庫名稱大小寫不一致**
  `src/controllers/productsController.js:162` 查 `name = 'Default'`，`src/config/database.js:339` 建立的是 `'default'`，所以 fallback 永遠找不到。

- [x] **A8. AP 統計使用不存在的狀態**
  `vite-app/src/components/modals/APProductModal.tsx:55` 統計 `status === 'returned'`，但 schema 只允許 `in_stock` / `sold`。

## B. 待確認的疑慮

這幾項由探索 agent 回報，尚未逐行確認，或可能是刻意的設計。

- [x] **B1. 共用連線上的 transaction 互相干擾** — 已由 C3 解決（`945b874`）
  `database.js` 只有一條 sqlite3 連線，並行請求各自下 `BEGIN`/`COMMIT` 時，可能把別的請求的寫入捲進自己的 transaction。`logAction` 在 transaction 內呼叫但沒有 await。

- [x] **B2. 倉庫隔離不完整** — products、transactions、batches、shipments 的讀寫全部限定目前倉庫，其他倉庫回 404；batches／shipments 建立時寫入 `warehouse_id`，舊資料啟動時回填（`tests/warehouseIsolation.test.js`、`tests/warehouseBackfill.test.js`）。CSV 匯入歷史仍是全域的（`csv_imports` 沒有 `warehouse_id`），刻意不處理。
  多數寫入路徑沒寫 `transactions.warehouse_id`。`shipments` 的 `getAll` / `getById`，以及 `transactions` 的 `getById` / `getByProduct`，查詢時都沒限定倉庫。`POST /api/batches` 查商品也只用 `product_id`，可以對其他倉庫的商品進貨。（`/api/product-units` 已由 C2 限定倉庫。）

- [x] **B3. AP 狀態與數量的漂移是否為刻意設計？** — 決議：PUT 不能改 status，狀態只經由出貨／退貨改變（兩者都經過 Stock Ledger）；`tests/productUnitUpdate.test.js`
  `PUT /api/product-units/:id` 改 status 不動數量，也不寫 Transaction。CONTEXT.md 只說明「單筆建立/刪除」不動數量，沒涵蓋改 status。

- [x] **B4. CSV 匯入直接覆寫數量且不留 Transaction** — 決議：CSV 數量為目標值，差額經 Stock Ledger 寫成 ADJUSTMENT（[ADR 0003](adr/0003-stock-ledger.md)，`46dc623`）
  `csvController.js:201-235`。這和「Transaction 是不可變的歷史紀錄」原則衝突，需決定是否為刻意設計。

- [x] **B5. migration 寫死預設 admin `eric` / `password`**（已確認，安全性問題）— 改由 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 建立，沒設定就不建立（`tests/defaultAdmin.test.js`）
  `database.js:515-544`。密碼寫死為 `password`、角色為 admin；seed 後無條件執行，沒有判斷 `NODE_ENV`，正式環境也會建立。
  另外 `database.js:232` 每次啟動都把名為 `eric` 的 view 帳號升成 admin，已刪除。

- [x] **B6. `schema.sql` 與 migration 不一致**
  `schema.sql` 沒有 `batches.warehouse_id` / `transactions.warehouse_id`（只在 migration 中補）；`webhook_*` 表沒有任何程式使用。
  已完成：`schema.sql` 補齊啟動 migration 會加的表與欄位、拿掉 `webhook_*`（舊資料庫的保留不動）；`tests/schemaDrift.test.js` 檢查新資料庫不需要再 migration、舊資料庫啟動後形狀相同。順帶修掉：正式資料庫的 `audit_logs` 是 `database/migrations/001` 建的，CHECK 只允許 CREATE/UPDATE/DELETE 且 `user_id` 必填，登入與使用者／倉庫管理的 audit 一直被擋掉（`logAction` 吞掉錯誤）；啟動時改為重建這張表，保留原有紀錄。`database/migrations/*.sql` 從來不會被執行，已刪除；真正的 migration 在 `src/config/database.js`，規則寫在 `.claude/rules/database.md`。

## C. 架構重構（deepening）

依建議順序排列。詳細的 before/after 見審查報告。

- [x] **C1. Stock Ledger module** — *Strong* — `src/services/stockLedger.js`，[ADR 0003](adr/0003-stock-ledger.md)（`4511f83`、`46dc623`）
  「寫 Transaction + 更新 Product 數量」目前散在 7 處：transactions、batches、outbound、AP bulk、AP transfer、CSV、products.create。收斂成單一 interface（例如 `ledger.apply(movements, actor, { tag, batch })`），由它負責欄位選擇、非負檢查、snapshot、`warehouse_id`、audit、AP 必須帶序號，以及 atomicity。這一項可一併解決 A1、A5，以及部分的 A6、B2。

- [x] **C2. AP 生命週期 module**（後端）— *Strong*（依賴 C1）— `src/services/apUnits.js`
  序號正規化有 9 份（後端 3、前端 6），in_stock ↔ sold 的轉換散在 4 處。改成集中在一個 module，數量變動交給 Stock Ledger。後端已完成：`apUnits` 是唯一寫 `product_units` 的模組，`/api/product-units` 全部限定目前倉庫（`tests/apUnitsWarehouse.test.js`）；`bulk` 不再接受 body 的 `warehouse_id`，前端 client 已同步移除。

- [x] **C2b. 前端改用後端的序號規則** — *Worth exploring*（依賴 C2，可併入 C5）
  前端仍有 6 份「trim + 轉大寫」：`BatchFlow.tsx`（2）、`CameraScanner.tsx`、`InboundSerialEntry.tsx`、`OutboundExtras.tsx`、`CreateProductUnitsModal.tsx`；`InboundSerialEntry.tsx:44`、`OutboundExtras.tsx:110` 只 trim 不轉大寫，`APProductModal.tsx:63` 也只 trim。改成只做顯示用整理，判斷以 lookup／API 回應為準。契約見 `docs/api/README.md` 的 AP 共通規則。
  已完成：`vite-app/src/lib/serial.ts`（`normalizeSerial`、`parseSerialList`）與後端同一規則，所有序號比對與輸入清單都改用它。`InboundSerialEntry`／`OutboundExtras` 的手打輸入只 trim 是刻意的：交給 `onAdd`／`onScan` 時才正規化，原文用來還原輸入框。

- [x] **C3. `db.transaction()` helper 與可注入的連線** — *Worth exploring*（建議與 C1 一起做）— `945b874`
  取代 14 處手寫 `BEGIN`/`COMMIT`，並解決 B1。

- [x] **C4. Shipment 綁定 module** — *Worth exploring* — `src/services/shipmentService.js`
  `shipmentsController` 的 create/update 與 `outboundService` 共用一個 `bind()`，負責編號、互斥檢查、倉庫與出庫檢查。可一併解決 A2。已完成：綁定檢查移進寫入的 DB transaction（修掉並發重複綁定），只接受出庫異動，建立／修改／匯出的明細都改用 `getDetail`（`tests/shipmentBinding.test.js`）。

- [ ] **C5. 前端 App shell 拆分** — *Worth exploring*（導航部分已由 `8249193` 完成：react-router，`View` 型別只剩 `lib/routes.ts` 一份）
  剩下：`useAppHandlers` 有 16 個依位置傳入的參數、Topbar/AppContent 接收約 60 個 props、401 處理有兩份（`api/client.ts`、`useAppState.ts`）、`Modal` 型別複製了 3 份。拆成 `useSession`、inventory store。

- [x] **C6. Transaction 查詢 module** — *Speculative* — `src/services/transactionQuery.js`
  JOIN 與 enrich 邏輯有 4 份；倉庫參數改為 interface 的必填欄位。可一併解決 B2 的查詢部分。已完成：transactions 的列表／匯出／單筆／依商品，以及出貨單與批次明細共用同一份查詢（`tests/transactionReads.test.js`）。出貨單建立／修改回傳的 `items_summary` 與 Excel 匯出已在 C4 改用同一份查詢。

## 測試缺口

目前沒有測試覆蓋：product-units delete 的成功路徑（只測了角色與跨倉庫）、前端。

（B3/C2 補上：`tests/productUnitUpdate.test.js`、`tests/apUnitsWarehouse.test.js`。）

（C1/C3 補上：`tests/dbTransaction.test.js`、`tests/stockLedger.test.js`（含並行 lost update）、`tests/stockLedgerRoutes.test.js`（CSV 數量語意、建立商品、batch、AP bulk）。）
