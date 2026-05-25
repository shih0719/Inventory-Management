# API Reference

**Base URL**: `http://localhost:3000/api`  
**Content-Type**: `application/json`

本文檔列舉所有 API 端點，包括 HTTP 方法、參數、回應格式與範例。

## 🔐 Authentication

Most API endpoints require JWT authentication. Include token in `Authorization` header:

```
Authorization: Bearer <JWT_TOKEN>
```

**Exceptions (no auth required):**
- `POST /api/auth/login`
- `GET /api/health`
- `GET /api/info`

---

## 📋 目錄

1. [Authentication](#authentication-認証)
2. [Audit Logs](#audit-logs-審計日誌)
3. [Products](#products-產品管理)
4. [Transactions](#transactions-庫存異動)
5. [Tags](#tags-標籤管理)
6. [Batches](#batches-批次管理)
7. [Shipments](#shipments-出貨單據)
8. [Locations](#locations-倉庫位置)
9. [Product Units](#product-units-序號品)
10. [CSV](#csv-批量導入導出)
11. [Webhooks](#webhooks-webhook-訂閱)
12. [System](#system-系統管理)
13. [Updates](#updates-更新管理)
14. [Health & Info](#health--info-健康檢查)

---

## Authentication 認証

### POST /api/auth/login

Login with username and password to get JWT token.

**Request Body:**
```json
{
  "username": "eric",
  "password": "password"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "eric",
      "created_at": "2026-05-25T10:00:00Z"
    }
  }
}
```

**Error (401 - 認証失敗):**
```json
{
  "success": false,
  "error": "Invalid username or password"
}
```

---

### POST /api/auth/logout

Logout (stateless JWT - no token blacklist needed).

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Audit Logs 審計日誌

### GET /api/audit-logs

查詢所有審計日誌（誰在何時做了什麼操作）。

**Query Parameters:**
| 參數 | 型態 | 必填 | 說明 |
|------|------|------|------|
| `resource_type` | string | N | 篩選資源類型（`transaction`, `batch`, `shipment`） |
| `resource_id` | integer | N | 篩選特定資源 ID |
| `user_id` | integer | N | 篩選特定用戶 |
| `limit` | integer | N | 回傳筆數（預設: 50） |
| `offset` | integer | N | 偏移量（預設: 0） |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "username": "eric",
      "action": "CREATE",
      "resource_type": "transaction",
      "resource_id": 101,
      "timestamp": "2026-05-25T10:05:30Z"
    },
    {
      "id": 2,
      "user_id": 1,
      "username": "eric",
      "action": "CREATE",
      "resource_type": "batch",
      "resource_id": 5,
      "timestamp": "2026-05-25T10:10:15Z"
    }
  ],
  "pagination": {
    "total": 100,
    "offset": 0,
    "limit": 50
  }
}
```

**Notes:**
- 需要有效的 JWT token
- 記錄所有 POST/PUT/DELETE 操作
- 讀取操作（GET）不被記錄

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

⚠️ **Requires Authentication** — `Authorization: Bearer <token>`

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
      "product_unit_ids": "[1, 2, 3, 4, 5]",
      "product_units": [
        {
          "id": 1,
          "serial_number": "SN-001",
          "status": "in_stock"
        },
        {
          "id": 2,
          "serial_number": "SN-002",
          "status": "in_stock"
        }
      ],
      "created_by_user": "eric",
      "created_at": "2026-05-14T10:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

**Notes:**
- `product_unit_ids`: JSON 陣列，記錄關聯的序號品 ID（序號品專用）
- `product_units`: 包含序號品的詳細信息（id、serial_number、status）
- 一般品（normal）的 product_unit_ids 為 null
- 序號品（AP）進出庫時會自動記錄
- **前端功能**: 序號品詳情頁提供「複製」按鈕，一鍵複製所有序號品（自動跳行區分，可直接貼到 Excel）

---

### GET /api/transactions/:id

取得單筆交易的詳細信息（包含序號品詳情）。

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 12,
    "product_id": 35,
    "sku": "TEST-AP-001",
    "product_name": "測試AP產品",
    "product_type": "ap",
    "quantity_change": -2,
    "tag_name": "出庫",
    "tag_color": "#EF4444",
    "product_unit_ids": "[10,11]",
    "product_units": [
      {
        "id": 10,
        "serial_number": "SN-A",
        "status": "sold"
      },
      {
        "id": 11,
        "serial_number": "SN-B",
        "status": "sold"
      }
    ],
    "created_by_user": "eric",
    "created_at": "2026-05-23T16:11:54Z"
  }
}
```

**Notes:**
- 序號品（AP）會包含具體的序號品清單
- 一般品（normal）的 product_units 為 null

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
  "data": [
    {
      "id": 1,
      "product_id": 1,
      "sku": "SKU-001",
      "product_name": "產品名稱",
      "quantity_change": 5,
      "tag_name": "INBOUND",
      "remarks": "進庫",
      "product_unit_ids": "[1, 2, 3, 4, 5]",
      "product_units": [
        {
          "id": 1,
          "serial_number": "SN-001",
          "status": "in_stock"
        },
        {
          "id": 2,
          "serial_number": "SN-002",
          "status": "in_stock"
        }
      ],
      "created_by_user": "eric",
      "created_at": "2026-05-23T10:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

**Notes:**
- 序號品（AP）的進出庫會記錄具體的序號品 ID 和詳情
- 一般品（normal）的 product_units 為 null

---

### POST /api/transactions

建立新的庫存異動記錄。

⚠️ **Requires Authentication** — `Authorization: Bearer <token>`  
**Note:** `created_by_user` is automatically captured from the authenticated user.

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
    "tag_id": 1,
    "quantity_change": 10,
    "quantity_type": "accountable",
    "remarks": "入庫備註",
    "created_by_user": "eric",
    "created_at": "2026-05-25T10:00:00Z"
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
      "status": "completed",
      "transaction_count": 5,
      "created_by_user": "eric",
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
    "name": "5月進貨批次",
    "status": "completed",
    "transactions": [
      {
        "id": 1,
        "product_id": 1,
        "sku": "SKU-001",
        "quantity_change": 10,
        "quantity_type": "accountable",
        "remarks": "進貨"
      }
    ],
    "created_by_user": "eric",
    "created_at": "2026-05-14T10:00:00Z"
  }
}
```

---

### POST /api/batches

建立批次並執行多筆異動。

⚠️ **Requires Authentication** — `Authorization: Bearer <token>`  
**Note:** `created_by_user` is automatically captured from the authenticated user for both batch and transactions.

**Request Body:**
```json
{
  "name": "5月批量進貨",
  "tag_id": 1,
  "description": "進貨備註（可選）",
  "items": [
    {
      "product_id": 1,
      "quantity_change": 10,
      "quantity_type": "accountable",
      "remarks": "產品備註"
    },
    {
      "product_id": 2,
      "quantity_change": 20,
      "quantity_type": "accountable",
      "remarks": "產品備註"
    }
  ]
}
```

**Parameters:**
- `name` (required): 批次名稱
- `tag_id` (required): 標籤 ID（如 1=INBOUND進貨、2=OUTBOUND出貨）
- `description` (optional): 批次描述
- `items` (required): 異動項目陣列
  - `product_id` (required): 產品 ID
  - `quantity_change` (required): 數量變化（正數=入庫，負數=出庫）
  - `quantity_type` (required): `accountable` (有帳) 或 `non_accountable` (無帳)
  - `remarks` (optional): 項目備註

**Response (201):**
```json
{
  "success": true,
  "message": "Batch created successfully. Processed 1 items.",
  "data": {
    "batch_id": 1,
    "batch_number": "BATCH-1715682000000",
    "created_by_user": "eric",
    "created_at": "2026-05-25T10:00:00Z",
    "processed_items": [
      {
        "product_id": 1,
        "product_name": "產品名稱",
        "quantity_type": "accountable",
        "quantity_change": 10
      }
    ]
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

## Shipments 出貨單據

整合和追蹤一次出貨操作中的多個庫存異動記錄。一個 Shipment 關聯多筆 Transactions，一個 Transaction 只能屬於一個 Shipment。

### POST /api/shipments

建立新的出貨單據。

⚠️ **Requires Authentication** — `Authorization: Bearer <token>`  
**Note:** `created_by_user` is automatically captured from the authenticated user.

**Request Body:**
```json
{
  "transaction_ids": [101, 102, 103],
  "customer": "客戶 A",
  "project_case": "案件編號",
  "shipment_date": "2026-05-23"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "shipment_number": "SHP-20260523-001",
    "customer": "客戶 A",
    "project_case": "案件編號",
    "shipment_date": "2026-05-23",
    "transaction_ids": [101, 102, 103],
    "items_summary": [
      {
        "id": 101,
        "product_id": 1,
        "sku": "SKU-001",
        "quantity_change": -5,
        "product_name": "產品名稱",
        "tag_name": "出庫",
        "created_at": "2026-05-23T10:00:00Z"
      }
    ],
    "created_by_user": "eric",
    "created_at": "2026-05-23T10:00:00Z"
  }
}
```

**Error (409 - 衝突):**
```json
{
  "success": false,
  "error": "Conflict: Some transactions are already assigned to other shipments",
  "errors": ["Transaction 102 already belongs to shipment 5"]
}
```

**Error (400 - 驗證失敗):**
```json
{
  "success": false,
  "error": "transaction_ids array is required and must not be empty"
}
```

**Notes:**
- `shipment_number` 自動生成，格式為 `SHP-YYYYMMDD-XXX`（日期+遞增序號）
- 所有業務欄位（`customer`、`project_case`、`shipment_date`）皆為選填，可後補
- Transaction 衝突時返回 409，防止重複綁定
- 同一 Transaction 只能屬於一個 Shipment

---

### GET /api/shipments

列出所有出貨單據（含分頁）。

**Query Parameters:**
| 參數 | 型態 | 必填 | 說明 |
|------|------|------|------|
| `limit` | integer | N | 每頁筆數（預設: 50） |
| `offset` | integer | N | 偏移量（預設: 0） |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "shipment_number": "SHP-20260523-001",
      "customer": "客戶 A",
      "project_case": "案件編號",
      "shipment_date": "2026-05-23",
      "transaction_count": 3,
      "created_by_user": "eric",
      "created_at": "2026-05-23T10:00:00Z"
    }
  ]
}
```

---

### GET /api/shipments/:id

取得出貨單據詳情（含完整 Transactions 和序號品資訊）。

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "shipment_number": "SHP-20260523-001",
    "customer": "客戶 A",
    "project_case": "案件編號",
    "shipment_date": "2026-05-23",
    "transaction_ids": [101, 102],
    "items_summary": [
      {
        "id": 101,
        "product_id": 1,
        "sku": "SKU-001",
        "product_name": "測試 AP 產品",
        "product_type": "ap",
        "quantity_change": -5,
        "tag_name": "出庫",
        "tag_color": "#EF4444",
        "product_unit_ids": "[10, 11, 12, 13, 14]",
        "product_units": [
          {
            "id": 10,
            "serial_number": "SN-001",
            "status": "sold"
          },
          {
            "id": 11,
            "serial_number": "SN-002",
            "status": "sold"
          },
          {
            "id": 12,
            "serial_number": "SN-003",
            "status": "sold"
          },
          {
            "id": 13,
            "serial_number": "SN-004",
            "status": "sold"
          },
          {
            "id": 14,
            "serial_number": "SN-005",
            "status": "sold"
          }
        ],
        "created_at": "2026-05-23T10:00:00Z"
      },
      {
        "id": 102,
        "product_id": 2,
        "sku": "SKU-002",
        "product_name": "一般產品",
        "product_type": "normal",
        "quantity_change": -3,
        "tag_name": "出庫",
        "tag_color": "#EF4444",
        "product_unit_ids": null,
        "product_units": null,
        "created_at": "2026-05-23T10:05:00Z"
      }
    ],
    "created_by_user": "eric",
    "created_at": "2026-05-23T10:00:00Z",
    "updated_at": "2026-05-23T10:00:00Z"
  }
}
```

**Notes:**
- `items_summary`: 包含所有關聯的 Transactions，並包含序號品詳情
- `product_units`: 序號品（AP）會包含具體的序號品清單；一般品（normal）為 null
- 序號品可複製：前端提供「複製」按鈕，自動複製所有序號，每行一個

**Error (404):**
```json
{
  "success": false,
  "error": "Shipment not found"
}
```

---

### PUT /api/shipments/:id

修改出貨單據（完全替換 Transactions 和業務欄位）。

⚠️ **Requires Authentication** — `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "transaction_ids": [101, 104],
  "customer": "新客戶",
  "project_case": "新案件",
  "shipment_date": "2026-05-24"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "shipment_number": "SHP-20260523-001",
    "customer": "新客戶",
    "project_case": "新案件",
    "shipment_date": "2026-05-24",
    "transaction_ids": [101, 104],
    "items_summary": [
      {
        "id": 101,
        "product_id": 1,
        "quantity_change": -5,
        "created_at": "2026-05-23T10:00:00Z"
      }
    ],
    "created_by_user": "eric",
    "created_at": "2026-05-23T10:00:00Z",
    "updated_at": "2026-05-23T11:00:00Z"
  }
}
```

**Error (409 - 衝突):**
```json
{
  "success": false,
  "error": "Conflict: Some transactions are already assigned to other shipments",
  "errors": ["Transaction 104 already belongs to shipment 2"]
}
```

**Notes:**
- 修改時完全替換 `transaction_ids` 列表
- 如果新 Transaction 已屬於其他 Shipment，返回 409 Conflict
- 所有欄位都可修改，包括業務信息和綁定的 Transactions

---

### DELETE /api/shipments/:id

軟刪除出貨單據（不刪除關聯的 Transactions，僅解除關聯）。

⚠️ **Requires Authentication** — `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "message": "Shipment deleted successfully",
  "data": {
    "id": 1,
    "shipment_number": "SHP-20260523-001"
  }
}
```

**Error (404):**
```json
{
  "success": false,
  "error": "Shipment not found"
}
```

**Notes:**
- 軟刪除：Shipment 記錄保留（`is_deleted = 1`），但查詢時被濾除
- Transactions 自動解除關聯，可被新 Shipment 綁定
- 已刪除的 `shipment_number` 可被重新使用（同日期）

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
      "name": "A-01",
      "description": "貨架 A 第 1 層",
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
  "name": "A-02",
  "description": "貨架 A 第 2 層"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "A-02",
    "description": "貨架 A 第 2 層"
  }
}
```

**Error (400 - 位置已存在):**
```json
{
  "success": false,
  "error": "此櫃位名稱已存在"
}
```

---

### GET /api/locations/:tag/content

查詢位置中的產品清單。

**Parameters:**
- `:tag` (required) — 位置標籤（如 "A-01"）

**Response (200):**
```json
{
  "success": true,
  "data": {
    "location": {
      "id": 1,
      "name": "A-01",
      "description": "貨架 A 第 1 層"
    },
    "products": [
      {
        "id": 1,
        "sku": "SKU-001",
        "name": "產品名稱",
        "type": "normal|ap",
        "model": "型號",
        "accountable_quantity": 10,
        "non_accountable_quantity": 5,
        "min_stock": 5,
        "is_deleted": 0,
        "created_at": "2026-05-14T10:00:00Z"
      }
    ]
  }
}
```

**Error (404):**
```json
{
  "success": false,
  "error": "Location not found"
}
```

---

### POST /api/locations/:tag/products

將產品分配到位置。

**Parameters:**
- `:tag` (required) — 位置標籤（如 "A-01"）

**Request Body:**
```json
{
  "product_id": 1
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Product assigned to location successfully"
}
```

**Error (400):**
```json
{
  "success": false,
  "error": "product_id is required"
}
```

**Error (404):**
```json
{
  "success": false,
  "error": "Location not found"
}
```

---

### DELETE /api/locations/:tag/products/:productId

從位置移除產品。

**Parameters:**
- `:tag` (required) — 位置標籤（如 "A-01"）
- `:productId` (required) — 產品 ID

**Response (200):**
```json
{
  "success": true,
  "message": "Product removed from location successfully"
}
```

**Error (404):**
```json
{
  "success": false,
  "error": "Location not found"
}
```

---

### DELETE /api/locations/:name

刪除位置。

**Parameters:**
- `:name` (required) — 位置名稱（如 "A-01"）

**Response (200):**
```json
{
  "success": true,
  "message": "Location deleted successfully"
}
```

**Error (404):**
```json
{
  "success": false,
  "error": "Location not found"
}
```

---

### DELETE /api/locations/:name

刪除位置。

**Parameters:**
- `:name` (required) — 位置名稱（如 "A-01"）

**Response (200):**
```json
{
  "success": true,
  "message": "Location deleted successfully"
}
```

**Error (404):**
```json
{
  "success": false,
  "error": "Location not found"
}
```

---

## Product Units 序號品

管理需追蹤序號的產品個體（AP）。

### GET /api/product-units/export

匯出序號品為 CSV 檔案。

**Response (200):** CSV 檔案下載

---

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
  "currentVersion": "2.0.0",
  "isUpdating": false,
  "lastUpdateTime": "2026-05-10T10:00:00Z"
}
```

---

### POST /api/updates/check

手動檢查遠端版本。

**Response (200):**
```json
{
  "currentVersion": "2.0.0",
  "remoteVersion": "2.0.1",
  "updateAvailable": true
}
```

---

### POST /api/updates/apply

應用更新。

**Response (200):**
```json
{
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

### 完整的庫存入貨流程（使用批次 API）

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

# 3. 批量進貨（推薦使用批次 API）
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "name": "5月進貨批次",
    "tag_id": 1,
    "description": "進口筆記本",
    "items": [
      {
        "product_id": 1,
        "quantity_change": 3,
        "quantity_type": "accountable",
        "remarks": "進貨 3 台"
      }
    ]
  }'

# 4. 查詢最新庫存
curl http://localhost:3000/api/products/1
```

### 序號品出貨流程

```bash
# 標記序號品為已出售（會自動記錄 Transaction 和序號品詳情）
curl -X POST http://localhost:3000/api/product-units/bulk-sell \
  -H "Content-Type: application/json" \
  -d '{
    "serial_numbers": ["SN-001", "SN-002", "SN-003"],
    "sold_to": "客戶 A",
    "project_case": "案件編號"
  }'

# Response:
# {
#   "success": true,
#   "data": {
#     "sold": 3,
#     "transactions_created": 1,
#     "message": "3 units have been marked as sold."
#   }
# }

# 查詢出貨紀錄（包含序號品詳情）
curl http://localhost:3000/api/transactions/product/1

# Response 包含：
# "product_unit_ids": "[1, 2, 3]"
# "product_units": [
#   { "id": 1, "serial_number": "SN-001", "status": "sold" },
#   { "id": 2, "serial_number": "SN-002", "status": "sold" },
#   { "id": 3, "serial_number": "SN-003", "status": "sold" }
# ]
```

### 一般品出貨流程（使用批次 API）

```bash
# 批量出貨（使用批次 API）
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "name": "5月出貨批次",
    "tag_id": 2,
    "description": "售出給客戶 A",
    "items": [
      {
        "product_id": 1,
        "quantity_change": -5,
        "quantity_type": "accountable",
        "remarks": "出貨給客戶 A"
      }
    ]
  }'
```

### 單筆異動（使用 Transactions API）

若需要單筆記錄（非批次），可使用 `POST /api/transactions`：

```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "quantity_change": 5,
    "quantity_type": "accountable",
    "tag_id": 1,
    "remarks": "單筆進貨"
  }'
```

---

## 相關文檔

- [Webhook 系統詳解](../improve.md#4-extract-webhook-service-contract) — 深入了解 webhook 交付保證
- [資料庫備份](../operations/BACKUP.md) — 資料保護策略
- [日誌查詢](../operations/LOGGING.md) — 故障排除
