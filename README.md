# 庫房管理系統

基於 Node.js + Express + SQLite 的倉庫庫存管理系統，支援商品管理、庫存異動追蹤、批次異動、序號品（AP）逐台管理、出貨單據、多倉庫隔離與審計日誌。

## 功能特色

- **商品管理**：CRUD、軟刪除、CSV 批量匯入匯出（Big5 編碼，Excel 開繁中不亂碼）
- **庫存異動**：有帳 / 無帳雙軌數量，完整 Transaction 歷史紀錄與篩選（SKU、方向、帳別、標籤、日期區間）
- **批次異動**：一次操作多商品，任一項驗證失敗即整批取消（Strict Mode，全有或全無）
- **序號品（AP）管理**：對高單價商品逐台追蹤序號、出貨對象、案子；支援批次入庫、批次出庫與跨倉調撥
- **出貨單據（Shipment）**：將多筆庫存異動組織成出貨單，追蹤客戶與案子
- **多倉庫隔離**：使用者可選定當前倉庫，所有資料與 API 請求皆限定在該倉庫範圍內
- **低庫存標記**：`accountable_quantity` 跌破 `min_stock` 時在首頁高亮
- **角色權限**：`admin` / `manager` / `view` 三種角色，控制增刪改權限
- **審計日誌**：記錄登入、登出、商品/交易/批次/倉庫等操作，可供 admin 查詢
- **自動備份**：每 6 小時自動備份，保留 7 天；可設定每週 Email 寄送備份

## 技術棧

- **後端**：Node.js + Express 4.x + SQLite3
- **資料庫**：SQLite3（WAL 模式）
- **前端**：React 18 + TypeScript + Vite（位於 `vite-app/`）
- **認證**：JWT Bearer Token + bcrypt，支援 local / Microsoft SSO
- **部署**：Docker / Docker Compose（建置後端並以 `vite-app/dist` 作為前端靜態資源）

## 快速啟動

### 開發

```bash
# 後端
npm install
npm run dev          # http://localhost:3030

# 前端（另一終端）
cd vite-app
npm install
npm run dev          # http://localhost:5173（已設定 proxy 轉發 /api 至後端）
```
### 建置前端靜態資源

```bash
npm run build:frontend   # 在 vite-app/ 建置
npm run copy:frontend    # 將 vite-app/dist 複製到 public/
# 或一次完成：
npm run build
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

所有 API 前綴為 `/api`，需 `Authorization: Bearer <token>`（除登入/provider），倉庫範圍路由另需 `X-Warehouse-Id` header。完整清單見 `docs/api/README.md`。

### 認證與系統

| 路由 | 說明 |
|------|------|
| `POST /api/auth/login` | 登入（回傳 JWT） |
| `POST /api/auth/logout` | 登出 |
| `GET /api/auth/me` | 取得當前使用者 |
| `POST /api/auth/change-password` | 修改密碼 |
| `GET /api/auth/provider` | 查詢 auth provider |
| `GET /api/health` | 健康檢查 |

### 倉庫與使用者（admin）

| 路由 | 說明 |
|------|------|
| `GET/POST /api/warehouses`、`PUT/DELETE /api/warehouses/:id` | 倉庫管理 |
| `GET/POST /api/users`、`PUT/DELETE /api/users/:id` | 使用者管理 |
| `GET /api/audit-logs` | 審計日誌查詢 |
| `GET/POST /api/backup/settings`、`POST /api/backup/test-email` | 備份 Email 設定 |

### 庫存業務（需 `X-Warehouse-Id`）

| 路由 | 說明 |
|------|------|
| `GET/POST /api/products`、`GET/PUT/DELETE /api/products/:id`、`GET /api/products/lookup`、`GET /api/products/:sku/locations` | 商品 CRUD 與查詢 |
| `GET/POST /api/transactions`、`GET /api/transactions/:id`、`GET /api/transactions/product/:productId` | 庫存異動 |
| `GET/POST /api/batches`、`GET /api/batches/:id` | 批次異動 |
| `GET/POST /api/shipments`、`GET/PUT/DELETE /api/shipments/:id` | 出貨單據 |
| `GET /api/tags` | 交易標籤 |
| `GET/POST /api/product-units`、`GET/PUT/DELETE /api/product-units/:id`、`POST /api/product-units/bulk`、`POST /api/product-units/bulk-sell`、`POST /api/product-units/transfer`、`GET /api/product-units/export` | AP 序號品管理 |
| `POST /api/csv/import`、`GET /api/csv/export`、`GET /api/csv/template`、`GET /api/csv/imports` | CSV 匯入匯出 |
| `GET /api/reports/inventory` | 庫存報表 |

## 資料模型

**products**：`sku`、`accountable_quantity`、`non_accountable_quantity`、`min_stock`、`track_serial`、`is_deleted`

**product_units**：`serial_number`、`status` (`in_stock|sold`)、`project_case`、`sold_to`、`warehouse_id`

**transactions**：`quantity_change` (正=入庫，負=出庫)、`quantity_type` (`accountable|non_accountable`)、`tag_id`、`batch_id`、`location_id`、`remarks`

## AP（序號品）

開啟 `track_serial = 1` 的商品支援逐台序號管理。批次入庫部分成功自動建立 Transaction；批次出庫 all-or-nothing。

## CSV 格式

```csv
SKU,Name,Type,Model,IsAccount,NoAccount,MinStock
SKU-001,筆記型電腦,電子產品,Dell XPS 15,10,5,5
```

- 以 SKU 為 upsert key（存在則更新）
- 編碼：**Big5**

## 備份

每 6 小時自動備份至 `database/backups/`，保留 7 天；可透過後端 UI 設定每週寄送備份 Email。

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
