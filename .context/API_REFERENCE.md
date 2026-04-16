# Inventory Management — API Reference

> Base URL: `http://localhost:3000`  
> All JSON responses follow the envelope: `{ success: boolean, data?: any, error?: string }`

---

## 🟢 Health & Server Info

### `GET /api/health`
系統健康檢查。

**Response**
```json
{ "status": "OK", "timestamp": "2026-04-16T06:00:00.000Z" }
```

---

### `GET /api/info`
取得伺服器 IP / Port 資訊（用於 LAN 連線）。

**Response**
```json
{ "ip": "192.168.1.100", "port": 3000, "url": "http://192.168.1.100:3000" }
```

---

## 📦 Products — `/api/products`

### `GET /api/products`
取得所有商品（分頁 + 篩選）。

| Query Param | Type   | Required | Description |
|-------------|--------|----------|-------------|
| `sku`       | string | No       | 模糊搜尋 SKU |
| `name`      | string | No       | 模糊搜尋名稱（若 sku===name 則以 OR 搜尋）|
| `model`     | string | No       | 模糊搜尋型號 |
| `tag`       | number | No       | 依 tag_id 篩選 |
| `page`      | number | No       | 頁碼（預設 `1`）|
| `limit`     | number | No       | 每頁筆數（預設 `10`）|

**Response 200**
```json
{
  "success": true,
  "data": [ { "id": 1, "sku": "SKU001", "name": "...", "type": "...", "model": "...",
              "accountable_quantity": 10, "non_accountable_quantity": 5,
              "is_deleted": 0, "created_at": "..." } ],
  "pagination": { "total": 100, "page": 1, "limit": 10, "totalPages": 10 }
}
```

---

### `GET /api/products/:id`
依 ID 取得單一商品。

**Path Param**: `id` — 商品 ID
**Response 200**: `{ "success": true, "data": { ...product } }`
**Response 404**: `{ "success": false, "error": "Product not found" }`

---

### `POST /api/products`
建立新商品。

**Request Body**
```json
{
  "type": "電子產品",
  "sku": "SKU-001",
  "name": "產品名稱",
  "model": "MODEL-X",
  "accountable_quantity": 0,
  "non_accountable_quantity": 0
}
```
**Response 201**: `{ "success": true, "data": { ...newProduct } }`
**Response 400**: `{ "success": false, "error": "此 SKU 已存在" }`

---

### `PUT /api/products/:id`
更新商品資訊（不含數量）。

**Path Param**: `id`
**Request Body**
```json
{ "type": "...", "name": "...", "model": "..." }
```
**Response 200**: `{ "success": true, "data": { ...updatedProduct } }`

---

### `DELETE /api/products/:id`
軟刪除商品（`is_deleted = 1`）。

**Path Param**: `id`
**Response 200**: `{ "success": true, "message": "Product deleted successfully" }`

---

### `GET /api/products/:sku/locations`
查詢某商品存放於哪些儲位。

**Path Param**: `sku` — 商品 SKU
**Response 200**
```json
{
  "success": true,
  "data": {
    "product": { "id": 1, "name": "...", "sku": "SKU001" },
    "locations": [ { "id": 1, "name": "A-01", "description": "..." } ]
  }
}
```

---

## 🔄 Transactions — `/api/transactions`

### `GET /api/transactions`
取得所有交易記錄（含 JOIN 的商品、標籤、批次資訊）。

| Query Param    | Type   | Required | Description |
|----------------|--------|----------|-------------|
| `sku`          | string | No       | 依 SKU 模糊篩選 |
| `tag_id`       | number | No       | 依標籤 ID 篩選 |
| `min_quantity` | number | No       | 數量變化 >= 此值（入庫） |
| `max_quantity` | number | No       | 數量變化 <= 此值（出庫） |
| `limit`        | number | No       | 預設 `100` |
| `offset`       | number | No       | 預設 `0` |

**Response 200**
```json
{
  "success": true,
  "data": [
    { "id": 1, "product_id": 1, "tag_id": 2, "batch_id": null,
      "quantity_change": 10, "remarks": "[有帳] ...",
      "product_name": "...", "sku": "SKU001",
      "tag_name": "入庫", "tag_color": "#4CAF50",
      "batch_number": null, "created_at": "..." }
  ]
}
```

---

### `GET /api/transactions/product/:productId`
取得特定商品的所有交易記錄。

**Path Param**: `productId`
**Response 200**: `{ "success": true, "data": [ ...transactions ] }`

---

### `POST /api/transactions`
建立單筆交易（調整庫存）。

**Request Body**
```json
{
  "product_id": 1,
  "tag_id": 2,
  "quantity_change": 10,
  "quantity_type": "accountable",
  "remarks": "備註說明"
}
```

> `quantity_type` 只能是 `"accountable"` 或 `"non_accountable"`
> 正值 = 入庫，負值 = 出庫；若餘量不足回傳 400

**Response 201**: `{ "success": true, "data": { ...transaction } }`

---

## 🏷️ Tags — `/api/tags`

### `GET /api/tags`
取得所有預定義標籤（入庫、出庫等）。

**Response 200**
```json
{
  "success": true,
  "data": [
    { "id": 1, "display_name": "入庫", "color": "#4CAF50" }
  ]
}
```

---

## 📄 CSV — `/api/csv`

### `POST /api/csv/import`
上傳 CSV 批量匯入/更新商品（ANSI/Big5 編碼）。

**Request**: `multipart/form-data`，欄位名稱 `file`，限 `.csv`，最大 5 MB

**CSV 欄位格式**

| 欄位        | Required | 說明 |
|-------------|----------|------|
| `SKU`       | Yes      | |
| `Name`      | Yes      | |
| `Type`      | Yes      | |
| `Model`     | No       | |
| `IsAccount` | No       | 有帳數量 |
| `NoAccount` | No       | 無帳數量 |

**Response 200**
```json
{
  "success": true,
  "message": "Import completed. 5 new products, 2 updated.",
  "imported": 5,
  "updated": 2,
  "errors": [ "Row 3: Missing required fields (SKU, Name, Type)" ]
}
```

---

### `GET /api/csv/export`
匯出所有商品為 CSV（ANSI/Big5 編碼）。

**Response**: 下載 `inventory_export_<timestamp>.csv`

---

### `GET /api/csv/template`
下載 CSV 匯入範本。

**Response**: 下載 `inventory_template.csv`

---

## 🗂️ Batches — `/api/batches`

### `POST /api/batches`
建立批次交易（一次調整多個商品庫存）。

**Request Body**
```json
{
  "tag_id": 2,
  "description": "備註",
  "items": [
    {
      "product_id": 1,
      "quantity_change": 10,
      "quantity_type": "accountable",
      "remarks": "備註"
    }
  ]
}
```

**Response 201**
```json
{
  "success": true,
  "message": "Batch created successfully. Processed 3 items.",
  "data": {
    "batch_id": 5,
    "batch_number": "BATCH-1713244800000",
    "processed_items": [ { "product_id": 1, "product_name": "...", "quantity_type": "accountable", "quantity_change": 10 } ],
    "errors": [ "Product ID 99: Product not found" ]
  }
}
```

> 部分失敗仍 COMMIT；全部失敗才 ROLLBACK 並回傳 400

---

### `GET /api/batches`
取得所有批次（含統計資訊）。

| Query Param | Default |
|-------------|---------|
| `limit`     | 50      |
| `offset`    | 0       |

**Response 200**
```json
{
  "success": true,
  "data": [
    { "id": 1, "batch_number": "BATCH-...", "description": "...",
      "item_count": 5, "total_in": 30, "total_out": 10, "created_at": "..." }
  ]
}
```

---

### `GET /api/batches/:id`
取得單一批次及所有交易明細。

**Path Param**: `id`
**Response 200**
```json
{
  "success": true,
  "data": {
    "id": 1, "batch_number": "BATCH-...", "description": "...",
    "transactions": [
      { "id": 10, "product_name": "...", "sku": "...",
        "tag_name": "入庫", "tag_color": "#4CAF50", "quantity_change": 10 }
    ]
  }
}
```

---

## 🗃️ Locations — `/api/locations`

### `GET /api/locations`
取得所有儲位列表。

**Response 200**: `{ "success": true, "data": [ { "id": 1, "name": "A-01", "description": "..." } ] }`

---

### `POST /api/locations`
建立新儲位。

**Request Body**
```json
{ "name": "A-01", "description": "一號架" }
```
**Response 201**: `{ "success": true, "data": { ...newLocation } }`
**Response 400**: `{ "success": false, "error": "此櫃位名稱已存在" }`

---

### `GET /api/locations/:tag/content`
查詢儲位內有哪些商品（`:tag` 為儲位名稱）。

**Path Param**: `tag` — 儲位名稱
**Response 200**
```json
{
  "success": true,
  "data": {
    "location": { "id": 1, "name": "A-01", "description": "..." },
    "products": [ { "id": 1, "sku": "SKU001", "name": "..." } ]
  }
}
```

---

### `POST /api/locations/:tag/products`
將商品指定到儲位。

**Path Param**: `tag`
**Request Body**: `{ "product_id": 1 }`
**Response 200**: `{ "success": true, "message": "Product assigned to location successfully" }`

> 重複指定不報錯（`INSERT OR IGNORE`）

---

### `DELETE /api/locations/:tag/products/:productId`
從儲位移除商品。

**Path Params**: `tag`（儲位名稱）、`productId`（商品 ID）
**Response 200**: `{ "success": true, "message": "Product removed from location successfully" }`

---

## ⚙️ System — `/api/system`

### `GET /api/system/check-update`
比對本地與遠端 Git commit，判斷是否有更新。

**Response 200**
```json
{
  "success": true,
  "data": { "updateAvailable": true, "localHash": "a1b2c3d", "remoteHash": "e4f5g6h" }
}
```

---

### `POST /api/system/apply-update`
執行 `git pull origin main --rebase` 並於 3 秒後重啟服務。

**Response 200**
```json
{ "success": true, "message": "更新成功，系統即將在 3 秒後重啟...", "output": "..." }
```

> **警告**: 伺服器會在 3 秒後呼叫 `process.exit(1)` 強制重啟，建議搭配 Docker `restart: always`。

---

## 📊 API Summary Table

| Method | Path | 功能 |
|--------|------|------|
| GET    | `/api/health` | 健康檢查 |
| GET    | `/api/info` | 伺服器 IP 資訊 |
| GET    | `/api/products` | 商品列表（分頁/篩選）|
| GET    | `/api/products/:id` | 單一商品 |
| POST   | `/api/products` | 建立商品 |
| PUT    | `/api/products/:id` | 更新商品 |
| DELETE | `/api/products/:id` | 軟刪除商品 |
| GET    | `/api/products/:sku/locations` | 商品存放儲位 |
| GET    | `/api/transactions` | 所有交易記錄 |
| GET    | `/api/transactions/product/:productId` | 商品交易記錄 |
| POST   | `/api/transactions` | 建立單筆交易 |
| GET    | `/api/tags` | 所有標籤 |
| POST   | `/api/csv/import` | 批量匯入 CSV |
| GET    | `/api/csv/export` | 匯出 CSV |
| GET    | `/api/csv/template` | 下載 CSV 範本 |
| POST   | `/api/batches` | 建立批次交易 |
| GET    | `/api/batches` | 所有批次 |
| GET    | `/api/batches/:id` | 批次明細 |
| GET    | `/api/locations` | 所有儲位 |
| POST   | `/api/locations` | 建立儲位 |
| GET    | `/api/locations/:tag/content` | 儲位內商品 |
| POST   | `/api/locations/:tag/products` | 指定商品到儲位 |
| DELETE | `/api/locations/:tag/products/:productId` | 移除儲位商品 |
| GET    | `/api/system/check-update` | 檢查版本更新 |
| POST   | `/api/system/apply-update` | 套用更新並重啟 |
