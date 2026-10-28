# CONTEXT

本專案的領域術語表（domain glossary）。撰寫 issue、PR、測試、refactor 提案時，請使用此處定義的術語，避免漂移到同義詞。

延伸文件：
- `docs/adr/` — 架構決策紀錄（按需建立）

---

## 核心實體

### Product（商品）
庫存管理的基本單位。由 **SKU**（唯一 business key）、`Name`、`Type`、`Model` 識別。每個 Product 同時持有兩種獨立的數量：`accountable_quantity` 與 `non_accountable_quantity`（見 **Quantity Type**）。軟刪除（`is_deleted`），不實際從資料庫移除。

### SKU
商品的唯一識別碼，由使用者指定、跨系統穩定。內部 `id`（autoincrement）為技術主鍵，**對外溝通與匯入匯出一律用 SKU**。

> ⚠️ **SKU ≠ serial_number**。SKU 是**型號層級**（10 台同型筆電共用同一個 SKU）；serial_number 是**個體層級**（每一台都不同，見 AP 條目）。一個 SKU 在 `products` 表只會有一筆；同一個 SKU 對應的 AP 在 `product_units` 表可有 0~N 筆，每筆 serial_number 各自唯一。


### AP（序號品） _Aid & Pwd_

> **命名對照**：領域語言中統稱「**AP**」或「**序號品**」；資料表名為 `product_units`；REST API 前綴為 `/api/product-units`。文件、討論、註解一律使用「AP / 序號品」；schema 與 URL 維持 `product_units` / `product-units` 以與既有 `/api/products` 風格一致。

對 `track_serial = 1` 的 Product，每一個實體個體即一個 AP（中文：**序號品**），由全域唯一的 `serial_number` 欄位識別。一個 Product 可有 0~N 個 AP。AP 有自己的生命週期狀態（`in_stock` → `sold` 只經由出貨，`sold` → `in_stock` 只經由退貨（RETURN）入庫，兩者都會同時經 Stock Ledger 寫入數量；`PUT /api/product-units/:id` 不能改 status，只能修改出貨欄位與 remarks；轉成 `sold` 時自動填 `sold_at`、`sold_to`、`project_case`），與 Product 的 `accountable_quantity` 在**資料上獨立、語意上對應**——本系統不強制兩者數值一致，由 UI 提示漂移。

> ⚠️ **「序號品」是實體名稱**（那一台具體的設備）；**「serial_number」是欄位**（識別該實體的字串編碼）。撰寫文件時兩者不可互換使用。

僅當 Product 標記 `track_serial = 1` 時才產生 AP。耗材類 Product（`track_serial = 0`）只走數量制，不產生 AP。

**AP 只對應 `accountable_quantity`**——「無帳」庫存（樣品、維修件）維持純數量制，不產生 AP。

⚠️ **新增/刪除 AP 不會自動更動 Product 的 `accountable_quantity`**。AP 的數量對齊由使用者透過既有 Transaction 介面手動維護——該介面（`POST /api/transactions`）對 AP 商品的有帳數量**只接受朝在庫序號數對齊**的異動（差距必須縮小），一般進出貨必須走序號流程；UI 會在 `accountable_quantity ≠ COUNT(AP WHERE status='in_stock')` 時顯示黃色警示。

AP 批次新增（`POST /api/product-units/bulk`）**會自動建立一筆入庫 Transaction 並更新 Product 的 `accountable_quantity`**（若驗證通過）。單筆建立/刪除則不會自動更動數量，由使用者自行維護一致性。

**出貨欄位規則**（status = `sold` 時）：
- `project_case`（案子）— **必填**，後端強制驗證。系統設計假設「**出貨一定屬於某個案子**」，案子是 AP 出貨的主要歸屬單位
- `sold_to`（客戶/收件人）— 選填，案子內部不一定需要指定收件人
- `sold_at` — 由系統在 status 轉為 `sold` 的瞬間自動填入，不由使用者輸入
- 當 status 從 `sold` 改回 `in_stock` 時，`project_case` / `sold_to` / `sold_at` 三欄**自動清空**，避免殘留資訊誤導；在庫的序號不能填出貨欄位
- AP 商品不能用數量出庫，必須在「出貨」頁掃描序號（避免 `accountable_quantity` 減少但序號仍是 `in_stock`）。
- AP 商品進貨同樣必須掃描序號（「進貨」頁，批次明細帶 `serial_numbers`，數量 = 序號數）。新序號直接建立；已出庫的序號只有在「退貨」（RETURN）標籤下可改回 `in_stock`，並清空 `project_case` / `sold_to` / `sold_at`。

**serial_number 規則**：
- **全域唯一**（不同 Product 的 serial_number 也不會撞，UNIQUE 約束施加於整張 `product_units` 表）
- **寫入前 trim 兩端空白並轉為大寫**（`sn-001` → `SN-001`），確保人工輸入的大小寫差異不會造成「視覺重複」
- **必填、不允許暫缺**（沒有序號就不該建 AP）
- **真刪後可重用**——AP 真刪（DELETE，無軟刪）後，UNIQUE 約束自動釋放，允許再次以同一 serial_number 建立新 AP（罕見場景：誤刪後找回）

### Tag（交易標籤）
預定義的交易類別（例如「入庫」、「出庫」），用於標示一筆 Transaction 的性質。系統初始化時建立，使用者選擇而非自由輸入。

實際用到的標籤：進貨頁 `INBOUND`、`RETURN`；出貨頁 `OUTBOUND`（建立 Shipment）、`INTERNAL`（內部領用，不建 Shipment、不通知）；AP 移倉 `TRANSFER`；調整與 CSV 匯入 `ADJUSTMENT`。借出不另設標籤，以 `OUTBOUND` 出庫、`RETURN` 歸還。seeds 裡的其他標籤（`COUNT`、`DAMAGE`、`SCRAP`、`LOAN`、`RETURN_LOAN`）保留給舊資料，介面不提供選擇。

> ⚠️ 此處的 Tag 為**交易分類**，與 GitHub issue 的 label 無關，雖然兩者程式中都叫 "tag"。

### Shipment（出貨單據）
**定位**：在 Transaction 建立之後，賦予多筆庫存異動業務意義的獨立組織層。一份出貨單據整合與追蹤一次出貨操作中的多個庫存異動記錄。

**核心關係**：
- **一對多** — 一個 Shipment 包含多筆 Transactions
- **排他性** — 一個 Transaction 同時只能屬於一個 Shipment（或不屬於任何 Shipment）
- **只綁出庫** — 只能綁定同倉庫的出庫異動（`quantity_change < 0`）
- **獨立性** — Transaction 先獨立存在，Shipment 後續選擇性綁定；刪除 Shipment 不刪除 Transaction，僅解除關聯

**業務欄位**（全部選填，可後補修改）：
- `customer` — 收貨客戶
- `project_case` — 案件編號。**注意**：此欄位與 AP 的 `project_case` 各自獨立，系統**不驗證一致性**。Shipment 的 project_case 純粹是出貨單據的業務分類標籤，可包含來自不同案件的 Transactions
- `shipment_date` — 實際出貨日期，由使用者指定（不是系統時間戳）

**自動生成欄位**：
- `shipment_number` — 格式 `SHP-YYYYMMDD-XXX`，按出貨日期每日遞增（e.g., `SHP-20260523-001`、`SHP-20260523-002`...）
- `items_summary` — 逐筆列出被綁定的 Transactions 詳細資訊（不聚合），便於追蹤個別異動

**操作規則**：
0. **自動建立（主要途徑）** — 「出貨」頁送出且標籤為 `OUTBOUND` 時，`POST /api/outbound` 在同一個 DB transaction 內建立異動、將 AP 序號標為 `sold`、並建立 Shipment 綁定所有異動。其他標籤不建立 Shipment。含 AP 序號時 `project_case` 必填，並同時寫入 Shipment 與 AP；AP 的 `sold_to` 取自 Shipment 的 `customer`。下方「建立」改為補綁既有異動用。
1. **建立** — 提供 `transaction_ids`；任一筆不存在於目前倉庫、不是出庫、或已屬於其他 Shipment，API 返回 409 Conflict 並逐筆列出原因，整張單不建立。重複的 ID 只綁一次
2. **修改** — 通過 `PUT /shipments/:id` 提供完整新的 `transaction_ids` 列表，覆蓋舊值（規則同建立）；不帶 `transaction_ids` 則只改業務欄位，沒給的欄位保持原值
3. **刪除** — 軟刪除，Transactions 保留並自動解除關聯（shipment_id → NULL）；記錄留在資料庫，API 不再列出或回傳

**出貨單模組**（`src/services/shipmentService.js`）是唯一寫入 `shipments` 與 `shipment_transactions` 的模組：負責編號、綁定檢查（倉庫、出庫、排他）與明細查詢。手動建立和 `POST /api/outbound` 都走同一個 `create`；綁定檢查和寫入在同一個 DB transaction 內，兩個請求不會把同一筆異動綁進兩張單。建立、修改、單筆查詢與 Excel 匯出的明細都來自 `getDetail`。

**無狀態設計**：Shipment 不追蹤 pending/confirmed/shipped/delivered 等狀態。一旦建立就是有效單據，無生命週期轉移。

---

## 庫存變動

### Transaction（庫存異動紀錄）
一筆庫存的變動事件，附帶 `quantity_change`（正值=入庫，負值=出庫）、`tag_id`、可選的 `batch_id` 與 `location_id`、與 `remarks`。**Transaction 是不可變的歷史紀錄**——商品的當前數量是異動累積的結果，但每筆異動都留痕。

### Stock Ledger（庫存帳本）
**唯一**可以改動 Product 數量的模組（`src/services/stockLedger.js`）。呼叫端把數量變動描述為 **movement**（商品、Quantity Type、帶正負號的 delta、選填的序號 `unitIds`），交給 `ledger.apply(tx, movements, ctx)`；帳本在呼叫端的 DB transaction 內一次驗證全部 movement（非負、Tag 存在、AP 規則），再逐筆寫 Transaction、更新數量、記 audit。任一筆不通過就整批不寫入。

- 任何新的進出貨、調整、匯入路徑都必須經過 Stock Ledger，**不得直接 `UPDATE products SET *_quantity`**
- AP 商品的有帳 movement 必須帶序號（序號數 = |delta|），或標記為 `reconcile`（只能朝在庫序號數對齊）；序號本身的狀態由 AP 流程負責，帳本不檢查
- 只有「出貨」頁建立 Shipment 時會通知：commit 後，該次出貨的所有 movement 合併成一筆 `stock.changed` 事件（附 Shipment 單號、客戶、案件），POST 到 `STOCK_WEBHOOK_URL`，並以 LINE 推播摘要文字給 `LINE_TO`（`src/services/stockNotifier.js`，各自有設定才送）；其他數量異動不通知，rollback 的不送，送失敗只記 log
- 決策紀錄見 `docs/adr/0003-stock-ledger.md`

**AP 模組**（`src/services/apUnits.js`）是唯一寫入 `product_units` 的模組：負責序號正規化、倉庫範圍（序號品屬於其商品的倉庫）與 `in_stock` ↔ `sold` 轉換。數量仍由 Stock Ledger 寫入——AP 模組的 `plan*` 函式回傳建 movement 所需的序號，呼叫端在同一個 DB transaction 內交給帳本。

### Quantity Type（數量類型）
一筆 Transaction 影響 Product 的兩種數量之一：

- **Accountable（有帳）** — 已正式入帳於財務帳冊的庫存
- **Non-Accountable（無帳）** — 未入帳的庫存，例如暫存品、樣品、維修件

兩者數量獨立計算，不互相轉換（除非有專屬的 Tag 表達該流程）。

### Min Stock（最低庫存閾值）
Product 的 `min_stock` 欄位，用於低庫存預警。**只比對 `accountable_quantity`**——「無帳」庫存依定義不應計入可用庫存。`min_stock = 0` 表示停用該商品的預警（預設值）。

### Batch（批次）
一次操作中產生的一組相關 Transaction（例如一次匯入、一次出貨），由 `batch_number`（格式 `BATCH-<timestamp>`）識別。

**Batch 的驗證策略（Strict Mode）**：任一 item 驗證失敗即**整批取消**（回傳 400，列出所有錯誤），不會部分提交。通過驗證後的所有 item 在單一資料庫 transaction 中原子執行，全有或全無。

---

## 流程術語

### CSV Import / Export
透過 Big5 編碼的 CSV 檔批量建立/更新 Product。匯入時以 SKU 為 upsert key——存在則更新，不存在則建立。`Type` 欄只能是 `ap` 或 `normal`，直接設定 `track_serial`（與編輯 Product 相同：還有 AP 的商品不能關閉序號追蹤）；匯出時由 `track_serial` 產生。
CSV 中的數量是**目標值**：匯入時計算與目前數量的差額，經 Stock Ledger 寫成 `ADJUSTMENT` 標籤、source `csv-import` 的 Transaction（差額為 0 則不寫）。逐列提交，失敗的列回報錯誤、不影響其他列。AP 商品的有帳數量不能用 CSV 改動（該列失敗）。

### Soft Delete（軟刪除）
- **Product** — `is_deleted = 1`，記錄保留但從預設查詢中濾除
- **Shipment** — `is_deleted = 1`，已刪除的出貨單記錄保留供審計追蹤

> Transaction、Batch **目前無軟刪除機制**——若未來需要請開 ADR 討論。

### Apply Update（套用更新）
透過 `git pull origin main --rebase` 拉取最新 commit 後 `process.exit(1)` 強制重啟，倚賴 Docker `restart: always` 重新拉起服務。

---

---

## 前端架構

前端使用 **React + TypeScript + Vite** 構建，位於 `vite-app/`。

### 組件結構
- `vite-app/src/components/` — 頁面級組件（每個功能一個 `.tsx` 檔）
- `vite-app/src/context/` — React Context（如 `ActiveWarehouseContext`）
- `vite-app/src/api/` — API 呼叫封裝（按領域分檔）

### 當前倉庫（Active Warehouse）
使用者登入後選擇倉庫，所有 API 請求帶 `X-Warehouse-Id` header，Context 由 `ActiveWarehouseContext` 管理。

### 工具鏈
- **Vite** — 打包器，HMR 開發環境
- 部署：`npm run build` 建置前端並複製靜態資源至 `public/`（供後端 Express 伺服）

---

## 認証與授權

### Auth Provider（認証提供者）
系統層級設定，管理員選擇一個 provider，全員走同一條路。切換 provider 時舊帳號直接失效。

目前實際支援的 provider：
- **`local`** — username/password，bcrypt 驗証，帳號由 admin 手動建立

> ⚠️ **`microsoft`**（Azure AD SSO）目前**尚未實作**，僅在設計層次（見 `docs/adr/0005-auth-provider-abstraction.md`）。請勿在文件或介面中宣稱已支援。

Provider 透過抽象層設計，未來可新增 Google 等 provider 而不改動核心邏輯。

### User（使用者）
系統操作者。每個 User 有：
- **Role**（系統層級）：`admin` / `manager` / `view`
- **Warehouses**（可存取倉庫清單）：多對多，決定能操作哪些倉庫
- **Provider**：目前僅 `local`

Local User 由 admin 手動建立並設定密碼。

### Role（角色）
系統層級，決定使用者能執行的動作：

| 動作 | admin | manager | view |
|---|---|---|---|
| 查看庫存、交易紀錄 | ✅ | ✅ | ✅ |
| 新增/修改產品 | ✅ | ✅ | ❌ |
| 新增交易（入庫/出庫） | ✅ | ✅ | ❌ |
| 管理使用者 | ✅ | ❌ | ❌ |
| 系統設定（切換 auth provider） | ✅ | ❌ | ❌ |

### Warehouse（倉庫）
庫存管理的空間隔離單位。每個 Warehouse 維護**完全獨立**的商品清單——同一個 SKU 在不同倉庫是不同的 Product 記錄，可以有不同的名稱、min_stock、track_serial 等設定。倉庫之間的資料互不可見，使用者只能看到當前選定倉庫的資料。

**Active Warehouse（當前倉庫）**：使用者登入後必須選擇一個倉庫（即使只有一個選項也要明確選擇），選定後所有操作皆限定在該倉庫範圍內。前端透過 `X-Warehouse-Id` request header 傳遞當前倉庫 ID，後端 middleware 驗證使用者確實有該倉庫的存取權限。

### 驗証策略
系統採用 **JWT Bearer Token** 認証，token payload 包含 `id`、`username`、`role`、`warehouses`（id 陣列）。

三層 middleware：
1. **`verifyAuth`** — 驗証 token 有效，掛載 `req.user`（含 role 和 warehouses）
2. **`requireRole(roles)`** — 檢查 `req.user.role` 是否在允許清單內
3. **`requireWarehouse`** — 檢查 `req.user.warehouses` 是否包含操作對象，並掛載 `req.warehouseId`

所有端點預設需要登入，無公開 API。

---

## 暫未納入範圍

以下業務概念目前不在系統範圍內，未來若需擴充再評估是否新增 Tag 或專屬欄位：盤點、報廢。
