# 庫房管理系統

基於 Node.js + SQLite 的倉庫庫存管理系統，支援商品管理、庫存異動追蹤、序號品（AP）逐台管理、儲位管理與 Webhook 通知。

## 功能特色

- **商品管理**：CRUD、軟刪除、CSV 批量匯入匯出（Big5 編碼，Excel 開繁中不亂碼）
- **庫存異動**：有帳 / 無帳雙軌數量，完整 Transaction 歷史紀錄
- **批次異動**：一次操作多商品，部分失敗仍 COMMIT 已成功項目
- **序號品（AP）管理**：對高單價商品逐台追蹤序號、出貨對象、案子；支援批次入庫與批次出庫
- **儲位管理**：商品與儲位多對多關聯
- **低庫存預警**：有帳數量跌破 `min_stock` 時 edge-triggered 推送 Webhook
- **Webhook 訂閱**：支援 `inventory.changed` / `batch.created` / `inventory.low` 三種事件，Fire-and-forget + 3 次指數退避 retry
- **差異警示**：`accountable_quantity ≠ AP in_stock 數` 時 UI 顯示黃色警示
- **自動備份**：每小時自動備份，保留 7 天

## 技術棧

- **後端**：Node.js + Express 4.x
- **資料庫**：SQLite3（better-sqlite3，WAL 模式）
- **前端**：HTML5 + Tailwind CSS 3.x + Vanilla JS（SPA）

## 快速啟動

### 開發

```bash
npm install
npm run dev
```

### 生產（Docker Compose）

```bash
# 複製 .env 環境變數
cp .env.example .env

# 啟動服務
docker-compose up -d

# 檢查健康狀態
curl http://localhost:3000/api/health
```

**`.env` 必需欄位：**
```
JWT_SECRET=<your-secret>
LOG_LEVEL=info
NODE_ENV=production
```

## API 端點

| 路由 | 說明 |
|------|------|
| `POST /api/auth/login` | 登入 |
| `POST /api/auth/logout` | 登出 |
| `POST /api/auth/change-password` | 修改密碼 |
| `GET/POST/PUT/DELETE /api/products` | 商品 CRUD |
| `GET/POST /api/transactions` | 庫存異動 |
| `GET/POST /api/batches` | 批次異動 |
| `GET/POST/PUT/DELETE /api/product-units` | AP 管理 |
| `POST /api/product-units/bulk` | AP 批次入庫 |
| `POST /api/product-units/bulk-sell` | AP 批次出庫 |
| `GET/POST/PUT/DELETE /api/locations` | 儲位管理 |
| `GET/POST/PUT/DELETE /api/webhooks` | Webhook 訂閱 |
| `POST /api/csv/import` | CSV 匯入 |
| `GET /api/csv/export` | CSV 匯出 |
| `GET /api/health` | 健康檢查 |

## 資料模型

**products**：`sku`、`accountable_quantity`、`non_accountable_quantity`、`min_stock`、`track_serial`、`is_deleted`

**product_units**：`serial_number`、`status` (`in_stock|sold`)、`project_case`、`sold_to`、`sold_at`

**transactions**：`quantity_change` (正=入庫，負=出庫)、`tag_id`、`batch_id`、`remarks`

## AP（序號品）

開啟 `track_serial = 1` 的商品支援逐台序號管理。批次入庫部分成功自動建立 Transaction；批次出庫 all-or-nothing。

## 低庫存預警

當 `accountable_quantity` 跌破 `min_stock` 時，邊界觸發推送 `inventory.low` Webhook。

```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{"name":"low-stock","url":"http://your-server/webhook","events":["inventory.low"]}'
```

## CSV 格式

```csv
SKU,Name,Type,Model,IsAccount,NoAccount,MinStock
SKU-001,筆記型電腦,電子產品,Dell XPS 15,10,5,5
```

- 以 SKU 為 upsert key（存在則更新）
- 編碼：**Big5**

## 備份

自動每小時備份，保留 7 天。

```bash
# 手動恢復
docker-compose exec app cp database/backups/inventory.backup_YYYYMMDD*.db database/inventory.db
docker-compose restart app
```

## 安全

- 參數化查詢防止 SQL Injection
- JWT 認證（24h）+ bcrypt 密碼
- 軟刪除保留歷史
- 自動備份
- 審計日誌
