# CONTEXT

本專案的領域術語表（domain glossary）。撰寫 issue、PR、測試、refactor 提案時，請使用此處定義的術語，避免漂移到同義詞。

延伸文件：
- `.context/CURRENT_PROGRESS.md` — 當前狀態、近期工作、待處理項、安全注意事項
- `.context/API_REFERENCE.md` — API 介面參考
- `docs/adr/` — 架構決策紀錄（按需建立）

---

## 核心實體

### Product（商品）
庫存管理的基本單位。由 **SKU**（唯一 business key）、`Name`、`Type`、`Model` 識別。每個 Product 同時持有兩種獨立的數量：`accountable_quantity` 與 `non_accountable_quantity`（見 **Quantity Type**）。軟刪除（`is_deleted`），不實際從資料庫移除。

### SKU
商品的唯一識別碼，由使用者指定、跨系統穩定。內部 `id`（autoincrement）為技術主鍵，**對外溝通與匯入匯出一律用 SKU**。

### Location（儲位）
倉庫實體儲存位置（例如 `A-01`），以 `name` 為唯一識別。Product 與 Location 為多對多關係（一個商品可放多個儲位、一個儲位可放多個商品）。

### Tag（交易標籤）
預定義的交易類別（例如「入庫」、「出庫」），用於標示一筆 Transaction 的性質。系統初始化時建立，使用者選擇而非自由輸入。

> ⚠️ 此處的 Tag 為**交易分類**，與 GitHub issue 的 label 無關，雖然兩者程式中都叫 "tag"。

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

**Batch 的部分失敗策略**：部分 items 失敗時，**已成功的仍會 COMMIT**；只有全部失敗才 ROLLBACK 並回傳 400。這是有意的設計選擇——便於使用者看清哪些 item 出錯而不必整批重試。

---

## 整合 / 通知

### Event（領域事件）
系統廣播的事件，由 webhook 推送至訂閱者。目前支援：

- `inventory.changed` — 單筆 Transaction 成立後觸發
- `batch.created` — Batch 建立後觸發
- `inventory.low` — 商品 `accountable_quantity` **由 ≥ `min_stock` 跨越到 < `min_stock` 的瞬間**觸發（edge-triggered）。同一商品在補貨回到閾值以上之前不會重複觸發。CSV import 不觸發此事件（CSV 視為資料校正）。

擴充事件：修改 `src/services/webhookService.js` 的 `SUPPORTED_EVENTS`。

### Webhook Subscription（Webhook 訂閱）
外部系統註冊接收 Event 的端點，包含 `name`、`url`、訂閱的 `events` 陣列、`is_active` 旗標。

### Webhook Log（推送紀錄）
每次 webhook 推送嘗試的紀錄，含 `attempts`（重試次數）、`status_code`、`success`、`error_message`。

**推送策略**：Fire-and-forget + 3 次指數退避 retry，不阻塞主業務 API。

---

## 流程術語

### CSV Import / Export
透過 Big5 編碼的 CSV 檔批量建立/更新 Product。匯入時以 SKU 為 upsert key——存在則更新，不存在則建立。

### Soft Delete（軟刪除）
Product 的 `is_deleted = 1`，記錄保留但從預設查詢中濾除。

> Location、Transaction、Batch **目前無軟刪除機制**——若未來需要請開 ADR 討論。

### Apply Update（套用更新）
透過 `git pull origin main --rebase` 拉取最新 commit 後 `process.exit(1)` 強制重啟，倚賴 Docker `restart: always` 重新拉起服務。

---

## 暫未納入範圍

以下業務概念目前不在系統範圍內，未來若需擴充再評估是否新增 Tag 或專屬欄位：盤點、調撥、報廢。
