# TODO — 高單價商品序號追蹤（ProductUnits）

> 對應計畫檔：`C:\Users\eyeye\.claude\plans\joyful-hopping-sunbeam.md`

## 開發目的

為現有庫房系統擴增「逐台序號追蹤」能力，解決**高單價電子產品**（如筆電、儀器）需要追蹤「**某一台具體賣給誰 / 屬於哪個案子**」的業務需求。

現有系統以 SKU + 數量管理庫存，對耗材足夠，但無法回答「序號 SN-A1B2C3 這台筆電目前在哪、賣給誰」。本次擴增在不破壞既有「數量制」流程的前提下，新增一個與既有出/入庫鬆耦合的序號管理模組。

**範圍**：只做出售商品序號管理；不做保固註冊、不做公司資產（折舊/財產編號/會計對接）、不做序號 CSV 匯入。

---

## 任務清單

### 1. Schema：加 `track_serial` 欄位 + 新建 `product_units` 表
- **目的**：建立資料模型基礎。`track_serial` 旗標讓只有高單價 SKU 才走序號流程，避免污染耗材；`product_units` 獨立存每一台的序號、狀態、出貨對象、案子。
- **檔案**：`database/schema.sql`
- **驗收**：DB 重建後，`PRAGMA table_info(products)` 看到 `track_serial`；`product_units` 表存在且有 product_id / status / serial 三個 index。

### 2. `database.js` 加 `track_serial` 的 ALTER TABLE migration
- **目的**：讓既有 `inventory.db` 升級時無痛加欄位，不需重建資料庫。沿用既有 `min_stock` 的 PRAGMA + ALTER 模式。
- **檔案**：`src/config/database.js`
- **驗收**：用舊 DB 啟動，console 出現「Added track_serial column」訊息，舊資料完整保留；再次啟動不重複 ALTER。

### 3. `productsController` 讀寫 `track_serial`
- **目的**：產品 API 能存取新欄位，前端表單才能儲存「這個 SKU 是否逐台追蹤」。
- **檔案**：`src/controllers/productsController.js`
- **設計細則**：
  - POST/PUT 接受 `track_serial`（boolean，存 0/1）；GET 回傳此欄位
  - **關閉保護**：PUT 嘗試把 `track_serial` 從 1 改 0 時，先查 `SELECT COUNT(*) FROM product_units WHERE product_id = ?`，若 > 0 直接回 400，錯誤訊息：「該商品仍有 N 筆序號紀錄，請先全部刪除後再關閉序號追蹤」
  - 從 0 改 1 無限制
  - **軟刪保護**：DELETE Product 時，若該 Product 仍有任何 AP（不管 status），回 400，錯誤訊息：「該商品仍有 N 筆序號紀錄，請先全部刪除後再下架商品」。理由：避免 sold AP 變孤兒、與「關閉 track_serial」策略一致
- **驗收**：
  - POST/PUT 帶入 `track_serial: true` 能正確存為 1；GET 回傳此欄位
  - 對有 AP 的 Product 嘗試關閉 `track_serial`，回 400 + 明確錯誤訊息
  - 對無 AP 的 Product 關閉 `track_serial` 成功

### 4. 新增 `productUnitsController`（CRUD + bulkCreate）
- **目的**：序號的核心業務邏輯。bulkCreate 是因為電子產品到貨常一次登記多台，避免一筆筆送 API；status 改 `sold` 自動填 `sold_at` 是為了減少前端負擔且確保時間一致。
- **檔案**：`src/controllers/productUnitsController.js`（新檔）
- **設計細則**：
  - **serial_number 寫入前**：`trim()` 兩端空白、轉 UPPER，全域 UNIQUE
  - **create**：對 `track_serial = 0` 的 Product 拒絕並回 400
  - **bulkCreate 部分失敗策略**：對齊 CONTEXT.md 既有 Batch 設計——**部分成功仍 COMMIT**，只有全部失敗才 ROLLBACK + 400
    - 回應格式：`{ success: true, inserted: N, failed: M, errors: [{ index, serial_number, reason }] }`
    - 失敗類型至少涵蓋：重複（含本批內互撞）、空字串、Product 不存在、Product `track_serial = 0`
  - **update → sold**：強制驗證 `project_case` 必填；自動填 `sold_at = CURRENT_TIMESTAMP`；`sold_to` 選填
  - **update → in_stock**：自動清空 `project_case` / `sold_to` / `sold_at` 三欄
  - **delete**：真刪（ADR 0001），UNIQUE 約束釋放後允許重用同 serial_number
  - **getAll**：支援 product_id / sku / status / serial_number / sold_to / project_case 篩選 + 分頁，回應與既有 productsController 一致 `{ success, data, pagination }`

### 5. 新增 `productUnits` 路由並掛載到 `server.js`
- **目的**：暴露 REST API 給前端與外部呼叫。
- **檔案**：`src/routes/productUnits.js`（新檔）、`server.js`
- **驗收**：`curl /api/product-units` 回 200 且回應格式與既有 `{ success, data, pagination }` 一致。

### 6. ProductUnits CSV 匯出
- **目的**：業務需求明確要可以匯出，沿用既有 Big5 編碼模式，確保用 Excel 開繁中不亂碼。
- **檔案**：`src/controllers/productUnitsController.js`(新增 exportCSV)
- **設計細則**：
  - **篩選參數與列表 API 完全一致**：`product_id` / `sku` / `status` / `serial_number` / `sold_to` / `project_case`，外加時間範圍 `sold_at_from` / `sold_at_to` / `created_at_from` / `created_at_to`
  - **不分頁**，一次撈完當前篩選結果
  - 欄位風格沿用既有 CSV 的 **PascalCase 大駝峰**
  - 欄位順序：`SKU, ProductName, SerialNumber, Status, ProjectCase, SoldTo, SoldAt, Remarks, CreatedAt`（ProjectCase 排在 SoldTo 前，因為前者必填、更重要）
  - **`Status` 輸出英文 raw value**（`in_stock` / `sold`），不轉中文，保持機器可讀
- **驗收**：`GET /api/product-units/export?status=sold&project_case=P2026-A12` 下載的 CSV 用 Excel 開啟，欄位齊全、順序正確、繁中不亂碼，Status 欄為英文 raw value。

### 7. `index.html`：產品表單加 checkbox + 新增 `product-units-modal`
- **目的**：使用者要能在 UI 把 SKU 標記為「逐台追蹤」，並在獨立 modal 管理該 SKU 的所有序號（清單、新增、批次新增、編輯、刪除、匯出）。
- **檔案**：`public/index.html`
- **設計細則**：
  - 產品列表操作欄：**僅當 `track_serial = 1`** 時顯示「序號」按鈕（與既有「異動/編輯/刪除/歷史/儲位」並列，不做下拉選單，維持既有 UI 風格）
  - 序號 modal 內含：表頭、篩選列（status / serial 搜尋）、單筆新增、批次新增（textarea 一行一個序號）、匯出 CSV 按鈕
  - 序號編輯子表單：status 切到 sold 時顯示 `project_case`（必填）+ `sold_to`（選填）；切回 in_stock 自動清空且隱藏這兩欄
- **驗收**：
  - 產品 modal 看到「逐台追蹤序號」checkbox
  - 開啟序號的 SKU 在表格列多一顆「序號」按鈕，未開啟的 SKU 沒有
  - 點擊開啟 modal，看得到表頭、篩選列、單筆/批次新增表單、匯出按鈕

### 8. `app.js`：ProductUnits 載入/渲染/表單/匯出邏輯
- **目的**：把後端能力接到 UI，讓使用者實際可操作。沿用既有 `loadProducts` / `renderProductsTable` 模式以維持風格一致。
- **檔案**：`public/js/app.js`
- **設計細則**：
  - 沿用既有 `deleteProduct` 的 `confirm()` 二次確認 pattern，訊息依 status 分流：
    - in_stock：`確定要刪除序號「<SN>」嗎？此操作不可復原。`
    - sold：`確定要刪除序號「<SN>」嗎？此 AP 已售出給「<project_case>」，刪除後出貨紀錄將永久消失，無法復原。`
  - **不做批次刪除**（需要刪多筆時使用者逐筆刪，避免誤觸大量資料消失）
  - bulkCreate 回應 `{inserted, failed, errors[]}` 必須以**清單形式**顯示成功/失敗明細，不只 toast「成功」
- **驗收**：完整走過「開啟 modal → 看到清單 → 批次新增 5 個序號（含 1 個刻意重複，驗證部分成功明細）→ 編輯其中 1 個改 sold（驗證 project_case 必填擋住空值）→ 篩選 sold → 匯出 CSV → 刪除 1 筆 sold AP（驗證警語提及 project_case）」流程不報錯。

### 9. UI 顯示「數量 vs 序號數差異」警示
- **目的**：本次決定不強制同步 `accountable_quantity` 與序號數（ADR 0001），但必須讓使用者察覺漂移，避免帳實不符卻不自知。
- **檔案**：`public/index.html`、`public/js/app.js`
- **設計細則**：
  - 列表 API（`getAllProducts`）SQL 加 `LEFT JOIN (SELECT product_id, COUNT(*) AS ap_in_stock_count FROM product_units WHERE status='in_stock' GROUP BY product_id)`，回傳欄位 `ap_in_stock_count`
  - 前端條件：`track_serial = 1 && accountable_quantity !== ap_in_stock_count` 時顯示黃色警示 icon
  - **點擊警示 icon**：彈出 tooltip 顯示「有帳數量 = X，序號 in_stock 數 = Y，相差 Z 筆」+ 提供「跳到序號管理」按鈕，點擊直接打開該 SKU 的序號 modal
- **驗收**：
  - 對 `track_serial = 1` 的 SKU，當 `accountable_quantity != COUNT(in_stock units)` 時，產品列表該列顯示黃色警示 icon
  - 兩數相等時不顯示
  - 點擊 icon 看到差異數字 + 跳轉按鈕，點跳轉按鈕直達該 SKU 的序號 modal

### 10. End-to-end 驗證
- **目的**：確認整個 feature 可用且**不破壞既有功能**（這是最大的風險，因為動了 products 表）。
- **驗收**（對應計畫檔的驗證章節）：
  1. 舊 DB 升級成功，舊資料完整
  2. 新增可追蹤 SKU + 批次登記 5 序號
  3. 出貨 2 台填客戶/案子，sold_at 自動填入
  4. 篩選與序號定位查詢正常
  5. CSV 匯出 Excel 開啟正常
  6. **既有產品的出/入庫流程完全不受影響**（Transactions、min_stock webhook 行為不變）
  7. 重啟服務資料持久、不重複建表報錯

---

## 不在本次範圍（未來再評估）

- **AP 相關 Webhook 事件**：本次 AP 模組所有操作（create / bulkCreate / update / delete）**不 fire 任何 webhook**；既有 webhook 機制（`inventory.changed` / `batch.created` / `inventory.low`）完全不變動。使用者若同時做既有入/出庫 Transaction，那筆 Transaction 仍會照常 fire 既有事件——但這是既有流程行為，不是 AP 觸發的
- 序號 CSV 匯入（搭配掃條碼槍時再做）
- `accountable_quantity` 與 AP 數強制同步（鬆耦合，由 UI 警示提醒，見 ADR 0001）
- AP 變更歷史紀錄（見 ADR 0001：本次決定不留歷史，未來若有審計需求重評）
- 公司資產管理模組（折舊、財產編號、會計對接）
