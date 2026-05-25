# API Examples - Auth & Audit Feature

API响应示例（含此次开发涉及的所有端点）。

---

## Authentication 認証

### POST /api/auth/login

**Request:**
```json
{
  "username": "eric",
  "password": "password123"
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

**Headers for subsequent requests:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### POST /api/auth/logout

**Request:** (empty body)

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Transactions 庫存異動 (Modified)

### GET /api/transactions

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
      "quantity_type": "accountable",
      "tag_id": 1,
      "tag_name": "INBOUND",
      "remarks": "入庫",
      "product_unit_ids": "[1, 2, 3, 4, 5]",
      "product_units": [
        {
          "id": 1,
          "serial_number": "SN-001",
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

**新增欄位:**
- `created_by` (integer) — 執行操作的用戶 ID
- `created_by_user` (string) — 用戶名稱

---

### GET /api/transactions/:id

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
    "created_by": 1,
    "created_by_user": "eric",
    "created_at": "2026-05-23T16:11:54Z"
  }
}
```

---

### POST /api/transactions

**Request:**
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

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "product_id": 1,
    "quantity_change": 10,
    "quantity_type": "accountable",
    "tag_id": 1,
    "remarks": "入庫備註",
    "created_by": 1,
    "created_by_user": "eric",
    "created_at": "2026-05-25T10:00:00Z"
  }
}
```

**自動設定:**
- `created_by` ← JWT token 中的 user_id
- `created_at` ← 當前時間

---

## Batches 批次管理 (Modified)

### GET /api/batches

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
    "created_by": 1,
    "created_by_user": "eric",
    "created_at": "2026-05-14T10:00:00Z"
  }
}
```

---

### POST /api/batches

**Request:**
```json
{
  "name": "5月批量進貨",
  "tag_id": 1,
  "description": "進貨備註",
  "items": [
    {
      "product_id": 1,
      "quantity_change": 10,
      "quantity_type": "accountable",
      "remarks": "產品備註"
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Batch created successfully. Processed 1 items.",
  "data": {
    "batch_id": 1,
    "batch_number": "BATCH-1715682000000",
    "created_by": 1,
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

---

## Shipments 出貨單據 (Modified)

### GET /api/shipments

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
      "created_by": 1,
      "created_by_user": "eric",
      "created_at": "2026-05-23T10:00:00Z"
    }
  ]
}
```

---

### GET /api/shipments/:id

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
        "quantity_change": -5,
        "tag_name": "出庫",
        "created_at": "2026-05-23T10:00:00Z"
      }
    ],
    "created_by": 1,
    "created_by_user": "eric",
    "created_at": "2026-05-23T10:00:00Z"
  }
}
```

---

### POST /api/shipments

**Request:**
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
    "created_by": 1,
    "created_by_user": "eric",
    "created_at": "2026-05-23T10:00:00Z",
    "items_summary": [
      {
        "id": 101,
        "product_id": 1,
        "sku": "SKU-001",
        "quantity_change": -5
      }
    ]
  }
}
```

---

## Audit Logs 審計日誌 (New)

### GET /api/audit-logs

取得所有審計日誌（誰在何時做了什麼）。

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
    },
    {
      "id": 3,
      "user_id": 2,
      "username": "alice",
      "action": "CREATE",
      "resource_type": "shipment",
      "resource_id": 3,
      "timestamp": "2026-05-25T11:00:00Z"
    }
  ],
  "pagination": {
    "total": 100,
    "offset": 0,
    "limit": 50
  }
}
```

---

## Error Responses

### 401 Unauthorized (缺少/無效 token)

```json
{
  "success": false,
  "error": "Unauthorized: Missing or invalid token"
}
```

### 403 Forbidden (操作被拒)

```json
{
  "success": false,
  "error": "Forbidden: You do not have permission to access this resource"
}
```

---

## Notes

- 所有 POST/PUT/DELETE 需要有效的 JWT token（在 `Authorization` header）
- `created_by` 和 `created_by_user` 自動從 JWT 中提取
- Audit logs 記錄所有寫入操作（POST, PUT, DELETE）
- 讀取操作（GET）不記錄在 audit logs 中
