# 庫房管理系統

基於 Node.js + SQLite 的倉庫庫存管理系統，支援商品管理、庫存異動追蹤、序號品（AP）逐台管理、儲位管理與 Webhook 通知。

## 功能特色

- **商品管理**：CRUD、軟刪除、CSV 批量匯入匯出（Big5 編碼，Excel 開繁中不亂碼）
- **庫存異動**：有帳 / 無帳雙軌數量，完整 Transaction 歷史紀錄
- **批次異動**：一次操作多商品，部分失敗仍 COMMIT 已成功項目
- **序號品（AP）管理**：對高單價商品逐台追蹤序號、出貨對象、案子；支援批次入庫與批次出庫，自動建立 Transaction 並同步更新庫存數量
- **儲位管理**：商品與儲位多對多關聯
- **低庫存預警**：有帳數量跌破 `min_stock` 時 edge-triggered 推送 Webhook；列表自動排序將低庫存品集中在首頁
- **Webhook 訂閱**：支援 `inventory.changed` / `batch.created` / `inventory.low` 三種事件，Fire-and-forget + 3 次指數退避 retry
- **差異警示**：`accountable_quantity ≠ AP in_stock 數` 時 UI 顯示黃色警示，點擊查看差異明細
- **低庫存篩選**：提供「只顯示低庫存」勾選框，快速查看需補貨的商品

## 技術棧

- **後端**：Node.js + Express 4.x
- **資料庫**：SQLite3（better-sqlite3 wrapper，WAL 模式）
- **前端**：HTML5 + Tailwind CSS 3.x + Vanilla JS（SPA，單頁應用）
- **其他**：iconv-lite（Big5 編碼）、multer（CSV 上傳）、dotenv

## 快速啟動

```bash
npm install
npm run dev       # 開發模式（nodemon）
npm start         # 生產模式
```

瀏覽器開啟：`http://localhost:3000`（PORT 可在 `.env` 覆寫）

### Docker

```bash
docker-compose up -d
```

## 專案結構

```
server.js                        # 入口，掛載所有路由
src/
  config/database.js             # DB 連線 + 自動 migration（ALTER TABLE）
  controllers/
    productsController.js        # 商品 CRUD、CSV 匯入
    transactionsController.js    # 庫存異動，更新 accountable/non_accountable_quantity
    batchesController.js         # 批次異動
    productUnitsController.js    # AP（序號品）CRUD、bulkCreate、bulkSell、exportCSV
    locationsController.js       # 儲位管理
    tagsController.js            # 交易標籤
    webhooksController.js        # Webhook 訂閱管理
    csvController.js             # CSV 匯入/匯出
    systemController.js          # 健康檢查、版本更新
  routes/                        # 一對一對應 controller
  services/webhookService.js     # Webhook 推送服務
database/
  schema.sql                     # 完整 DDL
  seeds.sql                      # 初始 tags 種子資料
  inventory.db                   # 主資料庫（自動建立）
  backups/                       # 自動備份目錄（每小時一次，保留 7 天）
public/
  index.html                     # 前端單頁，所有 modal 定義於此
  js/app.js                      # 前端業務邏輯
```

## API 端點

| 前綴 | 說明 |
|------|------|
| `GET/POST/PUT/DELETE /api/products` | 商品 CRUD |
| `GET/POST /api/transactions` | 庫存異動紀錄 |
| `GET/POST /api/batches` | 批次異動 |
| `GET/POST/PUT/DELETE /api/product-units` | AP（序號品）管理 |
| `POST /api/product-units/bulk` | AP 批次入庫 |
| `POST /api/product-units/bulk-sell` | AP 批次出庫（All-or-nothing）|
| `GET /api/product-units/export` | AP CSV 匯出 |
| `GET/POST/PUT/DELETE /api/locations` | 儲位管理 |
| `GET /api/tags` | 交易標籤列表 |
| `GET/POST/PUT/DELETE /api/webhooks` | Webhook 訂閱 |
| `POST /api/csv/import` | CSV 批量匯入商品 |
| `GET /api/csv/export` | CSV 匯出庫存快照 |
| `GET /api/health` | 健康檢查 |
| `GET /api/updates/status` | 取得版本更新狀態 |
| `POST /api/updates/check` | 手動檢查版本更新 |
| `POST /api/updates/apply` | 執行應用更新 |

## 資料模型

### products

| 欄位 | 說明 |
|------|------|
| `sku` | 唯一商業鍵（對外溝通用） |
| `accountable_quantity` | 有帳庫存 |
| `non_accountable_quantity` | 無帳庫存（樣品、維修件）|
| `min_stock` | 低庫存警戒線（0 = 停用）|
| `track_serial` | `1` = 開啟逐台序號追蹤 |
| `is_deleted` | 軟刪除旗標 |

### product_units（AP 序號品）

| 欄位 | 說明 |
|------|------|
| `serial_number` | 全域唯一；寫入前自動 trim + 轉大寫 |
| `status` | `in_stock` ↔ `sold` |
| `project_case` | 案子，status=sold 時必填 |
| `sold_to` | 客戶/收件人（選填）|
| `sold_at` | 出貨時間，系統自動填入 |

### transactions

| 欄位 | 說明 |
|------|------|
| `quantity_change` | 正值=入庫，負值=出庫 |
| `tag_id` | FK → tags |
| `batch_id` | 選填，屬於哪個批次 |
| `remarks` | 備註；自動建立者填「系統自動」|

## 序號品（AP）說明

對 `track_serial = 1` 的商品，每一台實體設備為一個 **AP**，以全域唯一 `serial_number` 識別。

- **批次入庫**（`POST /api/product-units/bulk`）：部分成功策略，成功筆數自動建立 INBOUND Transaction 並更新 `accountable_quantity`
- **批次出庫**（`POST /api/product-units/bulk-sell`）：All-or-nothing，任一筆失敗整批不寫入；成功後自動建立 OUTBOUND Transaction 並扣減 `accountable_quantity`
- **`accountable_quantity` 與 AP 數量鬆耦合**：差異時 UI 顯示黃色警示，不強制同步

## 低庫存預警

當商品 `accountable_quantity` 由 ≥ `min_stock` 跨越到 < `min_stock` 時，推送 `inventory.low` 事件一次（edge-triggered，不重複發）。

```bash
# 訂閱低庫存事件
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{"name":"low-stock-notify","url":"http://your-server/webhook","events":["inventory.low"]}'
```

事件 payload：

```json
{
  "event": "inventory.low",
  "timestamp": "2026-05-06T08:00:00.000Z",
  "data": {
    "product_id": 1,
    "sku": "SKU-001",
    "name": "螺絲 M4",
    "accountable_quantity": 3,
    "min_stock": 5
  }
}
```

**觸發條件**

| 操作 | 觸發 `inventory.low` |
|------|----------------------|
| 單筆 Transaction（有帳）| ✅ |
| 批次異動（有帳 item）| ✅ 各自判定 |
| 單筆 Transaction（無帳）| ❌ |
| CSV 匯入 | ❌（視為資料校正）|
| AP 批次入庫/出庫 | ❌（AP 操作不 fire webhook）|

## CSV 格式

```csv
SKU,Name,Type,Model,IsAccount,NoAccount,MinStock
SKU-001,筆記型電腦,電子產品,Dell XPS 15,10,5,5
SKU-002,無線滑鼠,配件,Logitech MX Master,50,30,20
```

- 匯入以 SKU 為 upsert key（存在則更新，不存在則建立）
- `MinStock` 欄位缺漏時，更新既有商品保留原值，新商品預設 0
- 編碼：**Big5**（ANSI），Excel 開繁中不亂碼

## 版本管理與更新

系統使用語義化版本（Semantic Versioning）管理版本，版本號在 `package.json` 中定義。

### 版本檢查與更新

- **訪問地址**：`http://localhost:3030/updates.html`（或點擊首頁「⚙️ 系統設定」）
- **版本對比**：自動檢查 GitHub 遠端最新版本，使用 `package.json` 的 version 字段比較
- **檢查方式**：手動按鈕觸發（無自動檢查），點擊「🔍 檢查更新」即可
- **一鍵更新**：發現新版本後點擊「📥 應用更新」自動完成 git pull + 重啟

```bash
# 更新流程
git fetch origin --quiet          # 獲取遠端最新代碼
git reset --hard origin/main      # 強制同步遠端版本
npm install --production          # 安裝新依賴
process.exit(0)                   # Docker 自動重啟
```

### 自動備份

系統會自動定期備份 SQLite 資料庫，確保更新安全。

- **備份位置**：`./database/backups/`
- **備份頻率**：每小時自動執行一次
- **保留策略**：保留最近 7 天的備份，舊備份自動刪除
- **備份方式**：使用 SQLite 的 `.backup` 命令確保一致性
- **備份文件名**：`inventory.backup_YYYYMMDD_HHMMSS.db`

### 手動恢復備份

如需回到某個時間點的數據：

```bash
# 停止應用
docker-compose down

# 備份當前數據庫（可選）
cp database/inventory.db database/inventory.db.broken

# 恢復舊備份
cp database/backups/inventory.backup_20260514_150000.db database/inventory.db

# 重新啟動應用
docker-compose up -d
```

## 安全

- 參數化查詢，防止 SQL Injection
- 單用戶設計，無身份驗證機制
- 軟刪除保留異動歷史，避免資料消失
- 定期自動備份數據庫，確保數據安全
