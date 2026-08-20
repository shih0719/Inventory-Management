# CONTEXT

本專案的領域術語表（domain glossary）。撰寫 issue、PR、測試、refactor 提案時，請使用此處定義的術語，避免漂移到同義詞。

延伸文件：
- `docs/adr/` — 架構決策紀錄（按需建立）
- `workFlows/` — 各階段開發計畫與進度紀錄

---

## 核心實體

### Product（商品）
庫存管理的基本單位。由 **SKU**（唯一 business key）、`Name`、`Type`、`Model` 識別。每個 Product 同時持有兩種獨立的數量：`accountable_quantity` 與 `non_accountable_quantity`（見 **Quantity Type**）。軟刪除（`is_deleted`），不實際從資料庫移除。

### SKU
商品的唯一識別碼，由使用者指定、跨系統穩定。內部 `id`（autoincrement）為技術主鍵，**對外溝通與匯入匯出一律用 SKU**。

> ⚠️ **SKU ≠ serial_number**。SKU 是**型號層級**（10 台同型筆電共用同一個 SKU）；serial_number 是**個體層級**（每一台都不同，見 AP 條目）。一個 SKU 在 `products` 表只會有一筆；同一個 SKU 對應的 AP 在 `product_units` 表可有 0~N 筆，每筆 serial_number 各自唯一。


### AP（序號品） _Aid & Pwd_

> **命名對照**：領域語言中統稱「**AP**」或「**序號品**」；資料表名為 `product_units`；REST API 前綴為 `/api/product-units`。文件、討論、註解一律使用「AP / 序號品」；schema 與 URL 維持 `product_units` / `product-units` 以與既有 `/api/products` 風格一致。

對 `track_serial = 1` 的 Product，每一個實體個體即一個 AP（中文：**序號品**），由全域唯一的 `serial_number` 欄位識別。一個 Product 可有 0~N 個 AP。AP 有自己的生命週期狀態（`in_stock` ↔ `sold` 雙向自由流轉，支援出貨與退貨/誤標修正；轉成 `sold` 時自動填 `sold_at`、`sold_to`、`project_case`），與 Product 的 `accountable_quantity` 在**資料上獨立、語意上對應**——本系統不強制兩者數值一致，由 UI 提示漂移。

> ⚠️ **「序號品」是實體名稱**（那一台具體的設備）；**「serial_number」是欄位**（識別該實體的字串編碼）。撰寫文件時兩者不可互換使用。

僅當 Product 標記 `track_serial = 1` 時才產生 AP。耗材類 Product（`track_serial = 0`）只走數量制，不產生 AP。

**AP 只對應 `accountable_quantity`**——「無帳」庫存（樣品、維修件）維持純數量制，不產生 AP。

⚠️ **新增/刪除 AP 不會自動更動 Product 的 `accountable_quantity`**。AP 的數量對齊由使用者透過既有 Transaction 介面手動維護；UI 會在 `accountable_quantity ≠ COUNT(AP WHERE status='in_stock')` 時顯示黃色警示。

AP 批次新增（`POST /api/product-units/bulk`）**會自動建立一筆入庫 Transaction 並更新 Product 的 `accountable_quantity`**（若驗證通過）。單筆建立/刪除則不會自動更動數量，由使用者自行維護一致性。

**出貨欄位規則**（status = `sold` 時）：
- `project_case`（案子）— **必填**，後端強制驗證。系統設計假設「**出貨一定屬於某個案子**」，案子是 AP 出貨的主要歸屬單位
- `sold_to`（客戶/收件人）— 選填，案子內部不一定需要指定收件人
- `sold_at` — 由系統在 status 轉為 `sold` 的瞬間自動填入，不由使用者輸入
- 當 status 從 `sold` 改回 `in_stock` 時，`project_case` / `sold_to` / `sold_at` 三欄**自動清空**，避免殘留資訊誤導

**serial_number 規則**：
- **全域唯一**（不同 Product 的 serial_number 也不會撞，UNIQUE 約束施加於整張 `product_units` 表）
- **寫入前 trim 兩端空白並轉為大寫**（`sn-001` → `SN-001`），確保人工輸入的大小寫差異不會造成「視覺重複」
- **必填、不允許暫缺**（沒有序號就不該建 AP）
- **真刪後可重用**——AP 真刪（DELETE，無軟刪）後，UNIQUE 約束自動釋放，允許再次以同一 serial_number 建立新 AP（罕見場景：誤刪後找回）

### Tag（交易標籤）
預定義的交易類別（例如「入庫」、「出庫」），用於標示一筆 Transaction 的性質。系統初始化時建立，使用者選擇而非自由輸入。

> ⚠️ 此處的 Tag 為**交易分類**，與 GitHub issue 的 label 無關，雖然兩者程式中都叫 "tag"。

### Shipment（出貨單據）
**定位**：在 Transaction 建立之後，賦予多筆庫存異動業務意義的獨立組織層。一份出貨單據整合與追蹤一次出貨操作中的多個庫存異動記錄。

**核心關係**：
- **一對多** — 一個 Shipment 包含多筆 Transactions
- **排他性** — 一個 Transaction 同時只能屬於一個 Shipment（或不屬於任何 Shipment）
- **獨立性** — Transaction 先獨立存在，Shipment 後續選擇性綁定；刪除 Shipment 不刪除 Transaction，僅解除關聯

**業務欄位**（全部選填，可後補修改）：
- `customer` — 收貨客戶
- `project_case` — 案件編號。**注意**：此欄位與 AP 的 `project_case` 各自獨立，系統**不驗證一致性**。Shipment 的 project_case 純粹是出貨單據的業務分類標籤，可包含來自不同案件的 Transactions
- `shipment_date` — 實際出貨日期，由使用者指定（不是系統時間戳）

**自動生成欄位**：
- `shipment_number` — 格式 `SHP-YYYYMMDD-XXX`，按出貨日期每日遞增（e.g., `SHP-20260523-001`、`SHP-20260523-002`...）
- `items_summary` — 逐筆列出被綁定的 Transactions 詳細資訊（不聚合），便於追蹤個別異動

**操作規則**：
1. **建立** — 提供 `transaction_ids`；如果某 ID 已屬於其他 Shipment，API 返回 409 Conflict（防止誤加）
2. **修改** — 通過 `PUT /shipments/:id` 提供完整新的 `transaction_ids` 列表，覆蓋舊值；所有業務欄位也可修改
3. **刪除** — 軟刪除，Transactions 保留並自動解除關聯（shipment_id → NULL）；已刪除 Shipment 仍可查詢

**無狀態設計**：Shipment 不追蹤 pending/confirmed/shipped/delivered 等狀態。一旦建立就是有效單據，無生命週期轉移。

---

## 庫存變動

### Transaction（庫存異動紀錄）
一筆庫存的變動事件，附帶 `quantity_change`（正值=入庫，負值=出庫）、`tag_id`、可選的 `batch_id` 與 `location_id`、與 `remarks`。**Transaction 是不可變的歷史紀錄**——商品的當前數量是異動累積的結果，但每筆異動都留痕。

### Quantity Type（數量類型）
一筆 Transaction 影響 Product 的兩種數量之一：

- **Accountable（有帳）** — 已正式入帳於財務帳冊的庫存
- **Non-Accountable（無帳）** — 未入帳的庫存，例如暫存品、樣品、維修件

兩者數量獨立計算，不互相轉換（除非有專屬的 Tag 表達該流程）。

### Min Stock（最低庫存閾值）
Product 的 `min_stock` 欄位，用於低庫存預警。**只比對 `accountable_quantity`**——「無帳」庫存依定義不應計入可用庫存。`min_stock = 0` 表示停用該商品的預警（預設值）。

### Batch（批次）
一次操作中產生的一組相關 Transaction（例如一次匯入、一次盤點），由 `batch_number`（格式 `BATCH-<timestamp>`）識別。

**Batch 的驗證策略（Strict Mode）**：任一 item 驗證失敗即**整批取消**（回傳 400，列出所有錯誤），不會部分提交。通過驗證後的所有 item 在單一資料庫 transaction 中原子執行，全有或全無。

---

## 流程術語

### CSV Import / Export
透過 Big5 編碼的 CSV 檔批量建立/更新 Product。匯入時以 SKU 為 upsert key——存在則更新，不存在則建立。

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

> ⚠️ **`microsoft`**（Azure AD SSO）目前**尚未實作**，僅在設計層次（見 `workFlows/260530/phase4-microsoft-sso-pending.md`）。請勿在文件或介面中宣稱已支援。

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

以下業務概念目前不在系統範圍內，未來若需擴充再評估是否新增 Tag 或專屬欄位：盤點、調撥、報廢。
