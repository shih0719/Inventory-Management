# API Reference

**Base URL**: `http://localhost:3000/api`  
**Content-Type**: `application/json`

本文檔列舉所有 API 端點，包括 HTTP 方法、參數、回應格式與範例。

---

## 📋 目錄

1. [Products](#products-產品管理)
2. [Transactions](#transactions-庫存異動)
3. [Tags](#tags-標籤管理)
4. [Batches](#batches-批次管理)
5. [Locations](#locations-倉庫位置)
6. [Product Units](#product-units-序號品)
7. [CSV](#csv-批量導入導出)
8. [Webhooks](#webhooks-webhook-訂閱)
9. [System](#system-系統管理)
10. [Updates](#updates-更新管理)
11. [Health & Info](#health--info-健康檢查)

---

## Products 產品管理

管理庫存系統中的產品信息。

### GET /api/products

取得產品列表（支援分頁與篩選）。

**Query Parameters:**
| 參數 | 型態 | 必填 | 說明 |
|------|------|------|------|
| `page` | integer | N | 頁碼（預設: 1） |
| `limit` | integer | N | 每頁筆數（預設: 10） |
| `sku` | string | N | 按 SKU 模糊搜尋 |
| `name` | string | N | 按產品名稱模糊搜尋 |
| `model` | string | N | 按型號模糊搜尋 |
| `tag` | integer | N | 按標籤 ID 篩選 |
| `low_stock` | boolean | N | 僅顯示庫存不足的產品（`true`） |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sku": "SKU-001",
      "name": "產品名稱",
      "type": "normal|ap",
      "model": "型號",
      "accountable_quantity": 100,
      "non_accountable_quantity": 50,
      "min_stock": 10,
      "ap_in_stock_count": 5,
      "created_at": "2026-05-14T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

**Example:**
```bash
curl "http://localhost:3000/api/products?page=1&limit=10&low_stock=true"
```

---

### GET /api/products/:id

取得單一產品詳情。

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "sku": "SKU-001",
    "name": "產品名稱",
    "type": "normal|ap",
    "model": "型號",
    "accountable_quantity": 100,
    "non_accountable_quantity": 50,
    "min_stock": 10,
    "created_at": "2026-05-14T10:00:00Z",
    "updated_at": "2026-05-14T11:00:00Z"
  }
}
```

**Error (404):**
```json
{
  "success": false,
  "error": "Product not found"
}
```

---

### POST /api/products

建立新產品。

**Request Body:**
```json
{
  "sku": "SKU-NEW",
  "name": "新產品",
  "type": "normal|ap",
  "model": "M1",
  "accountable_quantity": 0,
  "non_accountable_quantity": 0,
  "min_stock": 5
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "sku": "SKU-NEW",
    "name": "新產品",
    "type": "normal",
    ...
  }
}
```

---

### GET /api/products/:sku/locations

查詢產品在各倉庫位置的分佈。

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "location_tag": "A-01",
      "product_count": 5
    }
  ]
}
```

---

### PUT /api/products/:id

更新產品信息。

**Request Body:**
```json
{
  "name": "更新後的名稱",
  "min_stock": 20
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

### DELETE /api/products/:id

軟刪除產品（標記為已刪除，不移除資料）。

**Response (200):**
```json
{
  "success": true,
  "message": "Product deleted"
}
```

---

## Transactions 庫存異動

記錄與查詢庫存變動（進貨、出貨、調整）。

### GET /api/transactions

取得所有異動紀錄（分頁）。

**Query Parameters:**
| 參數 | 型態 | 必填 | 說明 |
|------|------|------|------|
| `page` | integer | N | 頁碼（預設: 1） |
| `limit` | integer | N | 每頁筆數（預設: 10） |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "product_id": 1,
      "sku": "SKU-001",
      "quantity_change": 10,
      "quantity_type": "accountable|non_accountable",
      "tag_id": 1,
      "tag_name": "INBOUND",
      "remarks": "入庫",
      "created_at": "2026-05-14T10:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

---

### GET /api/transactions/product/:productId

查詢特定產品的異動歷史。

**Query Parameters:**
| 參數 | 型態 | 必填 | 說明 |
|------|------|------|------|
| `page` | integer | N | 頁碼（預設: 1） |
| `limit` | integer | N | 每頁筆數（預設: 10） |

**Response (200):**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": { ... }
}
```

---

### POST /api/transactions

建立新的庫存異動記錄。

**Request Body:**
```json
{
  "product_id": 1,
  "quantity_change": 10,
  "quantity_type": "accountable",
  "tag_id": 1,
  "location_id": null,
  "remarks": "入庫備註"
}
```

**Parameters:**
- `product_id` (required): 產品 ID
- `quantity_change` (required): 數量變化（正數=入庫，負數=出庫）
- `quantity_type` (required): `accountable` (有帳) 或 `non_accountable` (無帳)
- `tag_id` (required): 標籤 ID（如 INBOUND、OUTBOUND）
- `location_id` (optional): 倉庫位置 ID
- `remarks` (optional): 備註

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "product_id": 1,
    "quantity_change": 10,
    ...
  }
}
```

**Error (400 - 庫存不足):**
```json
{
  "success": false,
  "error": "無法出庫：有帳庫存不足（目前：5，要出庫：10）"
}
```

---

## Tags 標籤管理

標籤用於分類異動類型（進貨、出貨等）。

### GET /api/tags

取得所有標籤。

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "INBOUND",
      "description": "進貨"
    },
    {
      "id": 2,
      "name": "OUTBOUND",
      "description": "出貨"
    }
  ]
}
```

---

## Batches 批次管理

批次是一次操作中多筆異動的集合（如批量入貨、批量出貨）。

### GET /api/batches

取得所有批次。

**Query Parameters:**
| 參數 | 型態 | 必填 | 說明 |
|------|------|------|------|
| `page` | integer | N | 頁碼（預設: 1） |
| `limit` | integer | N | 每頁筆數（預設: 10） |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "批次名稱",
      "status": "pending|processing|completed|failed",
      "transaction_count": 5,
      "created_at": "2026-05-14T10:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

---

### GET /api/batches/:id

取得批次詳情（包含其中的所有異動）。

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "批次名稱",
    "status": "completed",
    "transactions": [
      {
        "id": 1,
        "product_id": 1,
        "quantity_change": 10,
        ...
      }
    ],
    "created_at": "2026-05-14T10:00:00Z"
  }
}
```

---

### POST /api/batches

建立批次並執行多筆異動。

**Request Body:**
```json
{
  "name": "5月批量進貨",
  "items": [
    {
      "product_id": 1,
      "quantity_change": 10,
      "quantity_type": "accountable",
      "tag_id": 1,
      "remarks": "備註"
    },
    {
      "product_id": 2,
      "quantity_change": 20,
      "quantity_type": "accountable",
      "tag_id": 1,
      "remarks": "備註"
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "batch_id": 1,
    "name": "5月批量進貨",
    "status": "completed",
    "transaction_ids": [1, 2],
    "created_at": "2026-05-14T10:00:00Z"
  }
}
```

**Error (400 - 部分項目失敗):**
```json
{
  "success": false,
  "message": "部分項目處理失敗",
  "data": {
    "successful": [
      { "index": 0, "transaction_id": 1 }
    ],
    "failed": [
      { "index": 1, "error": "庫存不足" }
    ]
  }
}
```

---

## Locations 倉庫位置

管理倉庫中的物理位置（如貨架位置）。

### GET /api/locations

取得所有位置。

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "tag": "A-01",
      "location_name": "貨架 A 第 1 層",
      "created_at": "2026-05-14T10:00:00Z"
    }
  ]
}
```

---

### POST /api/locations

建立新位置。

**Request Body:**
```json
{
  "tag": "A-02",
  "location_name": "貨架 A 第 2 層"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

### GET /api/locations/:tag/content

查詢位置中的產品清單。

**Response (200):**
```json
{
  "success": true,
  "data": {
    "location_tag": "A-01",
    "products": [
      {
        "product_id": 1,
        "sku": "SKU-001",
        "name": "產品名稱",
        "quantity": 10
      }
    ]
  }
}
```

---

### POST /api/locations/:tag/products

將產品分配到位置。

**Request Body:**
```json
{
  "product_id": 1,
  "quantity": 10
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Product assigned"
}
```

---

### DELETE /api/locations/:tag/products/:productId

從位置移除產品。

**Response (200):**
```json
{
  "success": true,
  "message": "Product unassigned"
}
```

---

## Product Units 序號品

管理需追蹤序號的產品個體（AP）。

### GET /api/product-units

取得所有序號品。

**Query Parameters:**
| 參數 | 型態 | 必填 | 說明 |
|------|------|------|------|
| `page` | integer | N | 頁碼（預設: 1） |
| `limit` | integer | N | 每頁筆數（預設: 10） |
| `product_id` | integer | N | 按產品 ID 篩選 |
| `status` | string | N | 按狀態篩選（`in_stock`, `sold`, `returned`） |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "product_id": 1,
      "serial_number": "SN-12345",
      "status": "in_stock|sold|returned",
      "sold_to": null,
      "project_case": null,
      "created_at": "2026-05-14T10:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

---

### GET /api/product-units/:id

取得單一序號品詳情。

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

### POST /api/product-units

建立單個序號品。

**Request Body:**
```json
{
  "product_id": 1,
  "serial_number": "SN-NEW"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

### POST /api/product-units/bulk

批量建立序號品。

**Request Body:**
```json
{
  "product_id": 1,
  "count": 5,
  "serial_prefix": "SN"
}
```

會自動生成 `SN-1`, `SN-2`, ... `SN-5`。

**Response (201):**
```json
{
  "success": true,
  "data": {
    "created": 5,
    "units": [
      { "id": 1, "serial_number": "SN-1", ... }
    ]
  }
}
```

---

### POST /api/product-units/bulk-sell

批量出售序號品。

**Request Body:**
```json
{
  "items": [
    {
      "id": 1,
      "sold_to": "客戶名稱",
      "project_case": "專案代碼"
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Units sold",
  "updated_count": 1
}
```

---

### PUT /api/product-units/:id

更新序號品信息。

**Request Body:**
```json
{
  "status": "sold",
  "sold_to": "客戶名稱",
  "project_case": "專案代碼"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

### DELETE /api/product-units/:id

刪除序號品。

**Response (200):**
```json
{
  "success": true,
  "message": "Unit deleted"
}
```

---

### GET /api/product-units/export

匯出序號品為 CSV。

**Response (200):** CSV 檔案下載

---

## CSV 批量導入導出

### POST /api/csv/import

上傳 CSV 檔案進行批量導入。

**Request:**
- Content-Type: `multipart/form-data`
- Field: `file` (CSV 檔案，最大 5MB)

CSV 格式：
```
sku,name,type,model,accountable_quantity,non_accountable_quantity,min_stock
SKU-001,產品1,normal,M1,100,50,10
SKU-002,產品2,ap,M2,200,0,20
```

**Response (200):**
```json
{
  "success": true,
  "imported": 2,
  "message": "Import completed"
}
```

**Error (400 - 無效 CSV):**
```json
{
  "success": false,
  "error": "CSV parsing error",
  "details": "..."
}
```

---

### GET /api/csv/export

匯出所有產品為 CSV。

**Response (200):** CSV 檔案下載

---

### GET /api/csv/template

下載 CSV 範本（空白模板）。

**Response (200):** CSV 檔案下載

---

## Webhooks Webhook 訂閱

Webhook 用於在特定事件發生時向外部系統推送通知。

### GET /api/webhooks

取得所有 Webhook 訂閱。

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "訂閱名稱",
      "url": "https://example.com/webhook",
      "events": ["inventory.changed", "batch.created"],
      "is_active": 1,
      "created_at": "2026-05-14T10:00:00Z"
    }
  ]
}
```

---

### POST /api/webhooks

建立新的 Webhook 訂閱。

**Request Body:**
```json
{
  "name": "庫存變動通知",
  "url": "https://example.com/webhook",
  "events": ["inventory.changed", "batch.created", "inventory.low"]
}
```

**Supported Events:**
- `inventory.changed` — 庫存異動時
- `batch.created` — 批次建立時
- `inventory.low` — 庫存低於閾值時

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "庫存變動通知",
    ...
  }
}
```

**Error (400 - 無效事件):**
```json
{
  "success": false,
  "error": "Unsupported events: invalid_event. Valid: inventory.changed, batch.created, inventory.low"
}
```

---

### PUT /api/webhooks/:id

更新 Webhook 訂閱。

**Request Body:**
```json
{
  "name": "新名稱",
  "url": "https://example.com/webhook-v2",
  "events": ["inventory.changed"],
  "is_active": 1
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { ... }
}
```

---

### DELETE /api/webhooks/:id

刪除 Webhook 訂閱。

**Response (200):**
```json
{
  "success": true,
  "message": "Subscription deleted"
}
```

---

### GET /api/webhooks/:id/logs

查詢 Webhook 的交付日誌。

**Query Parameters:**
| 參數 | 型態 | 必填 | 說明 |
|------|------|------|------|
| `limit` | integer | N | 回傳筆數（預設: 50） |
| `offset` | integer | N | 偏移量（預設: 0） |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "event": "inventory.changed",
      "status_code": 200,
      "attempts": 1,
      "success": true,
      "error_message": null,
      "created_at": "2026-05-14T10:00:00Z"
    },
    {
      "id": 2,
      "event": "batch.created",
      "status_code": 500,
      "attempts": 3,
      "success": false,
      "error_message": "HTTP 500",
      "created_at": "2026-05-14T10:05:00Z"
    }
  ]
}
```

---

### POST /api/webhooks/:id/test

發送測試 Webhook 有效載荷。

**Request Body:** （空）

**Response (200):**
```json
{
  "success": true,
  "message": "Test webhook fired for event \"inventory.changed\". Check logs for delivery result."
}
```

**Webhook Payload 格式:**

當事件觸發時，系統會向訂閱的 URL 發送 POST 請求：

```json
{
  "event": "inventory.changed",
  "timestamp": "2026-05-14T10:00:00Z",
  "data": {
    "product_id": 1,
    "sku": "SKU-001",
    "quantity_change": 10,
    "quantity_type": "accountable"
  }
}
```

**交付保證:**
- 最多重試 3 次（exponential backoff: 1秒、3秒、9秒）
- 超時時限：10 秒
- 成功條件：HTTP 200-299 狀態碼

---

## System 系統管理

### GET /api/system/check-update

檢查是否有新版本可用。

**Response (200):**
```json
{
  "success": true,
  "current_version": "2.0.0",
  "latest_version": "2.0.1",
  "update_available": true,
  "update_details": {
    "version": "2.0.1",
    "release_date": "2026-05-15",
    "notes": "版本說明"
  }
}
```

---

### POST /api/system/apply-update

應用可用的更新（應用會重啟）。

**Request Body:** （空）

**Response (200):**
```json
{
  "success": true,
  "message": "更新已開始，應用將自動重啟..."
}
```

**Error (409 - 更新進行中):**
```json
{
  "success": false,
  "error": "更新正在進行中"
}
```

---

## Updates 更新管理

### GET /api/updates/status

取得當前更新狀態。

**Response (200):**
```json
{
  "success": true,
  "data": {
    "currentVersion": "2.0.0",
    "isUpdating": false,
    "lastUpdateTime": "2026-05-10T10:00:00Z"
  }
}
```

---

### POST /api/updates/check

手動檢查遠端版本。

**Response (200):**
```json
{
  "success": true,
  "data": {
    "currentVersion": "2.0.0",
    "remoteVersion": "2.0.1",
    "updateAvailable": true
  }
}
```

---

### POST /api/updates/apply

應用更新。

**Response (200):**
```json
{
  "success": true,
  "message": "更新已開始，應用將自動重啟..."
}
```

---

## Health & Info 健康檢查

### GET /api/health

檢查 API 伺服器健康狀態。

**Response (200):**
```json
{
  "status": "OK",
  "timestamp": "2026-05-14T10:00:00Z"
}
```

---

### GET /api/info

取得伺服器信息（IP、連接埠、URL）。

**Response (200):**
```json
{
  "ip": "192.168.1.100",
  "port": 3000,
  "url": "http://192.168.1.100:3000"
}
```

用於自動發現伺服器地址，特別是在本地網路環境中。

---

## 錯誤回應

所有端點在發生錯誤時遵循統一格式：

### 400 Bad Request
```json
{
  "success": false,
  "error": "錯誤信息"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Not found"
}
```

### 500 Internal Server Error
```json
{
  "error": {
    "message": "伺服器內部錯誤",
    "status": 500
  }
}
```

---

## 常見操作範例

### 完整的庫存入貨流程

```bash
# 1. 建立產品
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "LAPTOP-001",
    "name": "筆記型電腦",
    "type": "ap",
    "model": "X1",
    "accountable_quantity": 0,
    "non_accountable_quantity": 0,
    "min_stock": 5
  }'

# 2. 建立序號品（如果是 AP 類型）
curl -X POST http://localhost:3000/api/product-units/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "count": 3,
    "serial_prefix": "LT"
  }'

# 3. 建立進貨異動
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "quantity_change": 3,
    "quantity_type": "accountable",
    "tag_id": 1,
    "remarks": "進貨"
  }'

# 4. 查詢最新庫存
curl http://localhost:3000/api/products/1
```

### 出貨流程

```bash
# 1. 標記序號品為已出售
curl -X POST http://localhost:3000/api/product-units/bulk-sell \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "id": 1,
        "sold_to": "客戶 A",
        "project_case": "案件編號"
      }
    ]
  }'

# 2. 記錄出庫異動
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "quantity_change": -1,
    "quantity_type": "accountable",
    "tag_id": 2,
    "remarks": "出貨給客戶 A"
  }'
```

---

## 相關文檔

- [Webhook 系統詳解](../improve.md#4-extract-webhook-service-contract) — 深入了解 webhook 交付保證
- [資料庫備份](../operations/BACKUP.md) — 資料保護策略
- [日誌查詢](../operations/LOGGING.md) — 故障排除
