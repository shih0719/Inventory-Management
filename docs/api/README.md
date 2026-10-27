# API 端點清單

**最後更新**：2026-10-27

所有 API 前綴為 `/api`，需 JWT Bearer Token（除 `/api/auth/login`、`/api/auth/provider`）。

---

## 認證範圍

### 全局路由（無倉庫限制）
| 方法 | 路徑 | 角色 | 說明 |
|------|------|------|------|
| GET | `/api/auth/provider` | 公開 | 查詢目前 auth provider（目前僅支援 local） |
| POST | `/api/auth/login` | 公開 | 登入，返回 JWT |
| POST | `/api/auth/logout` | 已登入 | 登出 |
| GET | `/api/auth/me` | 已登入 | 取得當前使用者資訊 |
| POST | `/api/auth/change-password` | 已登入 | 修改密碼 |
| GET | `/api/warehouses` | 已登入 | 列出所有倉庫 |
| POST | `/api/warehouses` | admin | 建立倉庫 |
| PUT | `/api/warehouses/:id` | admin | 修改倉庫 |
| DELETE | `/api/warehouses/:id` | admin | 刪除倉庫 |
| GET | `/api/users` | admin | 列出所有使用者 |
| POST | `/api/users` | admin | 建立使用者 |
| PUT | `/api/users/:id` | admin | 修改使用者（role、倉庫） |
| DELETE | `/api/users/:id` | admin | 刪除使用者 |
| GET | `/api/backup/settings` | admin | 查詢備份 Email 設定 |
| POST | `/api/backup/settings` | admin | 更新備份 Email 設定 |
| POST | `/api/backup/test-email` | admin | 寄送測試 Email |

### 倉庫範圍路由（需 `X-Warehouse-Id` header）
所有以下路由均需要使用者對該倉庫有存取權限（middleware: `requireWarehouse`）。

| 方法 | 路徑 | 角色 | 說明 |
|------|------|------|------|
| GET | `/api/products` | 已登入 | 列出商品 |
| GET | `/api/products/lookup` | 已登入 | 依 SKU 查詢商品（`?sku=&warehouse_id=`；可查有權限的其他倉庫，調撥用；無權限回 403） |
| GET | `/api/products/:id` | 已登入 | 取得單一商品 |
| POST | `/api/products` | manager/admin | 建立商品 |
| PUT | `/api/products/:id` | manager/admin | 修改商品 |
| DELETE | `/api/products/:id` | manager/admin | 軟刪除商品 |
| GET | `/api/products/:sku/locations` | 已登入 | 查詢商品儲位 |
| GET | `/api/transactions` | 已登入 | 列出庫存異動 |
| GET | `/api/transactions/export` | 已登入 | 匯出篩選後的異動 CSV（Big5） |
| GET | `/api/transactions/:id` | 已登入 | 取得單筆異動 |
| GET | `/api/transactions/product/:productId` | 已登入 | 取得特定商品的異動 |
| POST | `/api/transactions` | manager/admin | 建立庫存異動 |
| GET | `/api/batches` | 已登入 | 列出批次 |
| GET | `/api/batches/:id` | 已登入 | 取得單筆批次 |
| POST | `/api/batches` | manager/admin | 建立批次異動 |
| GET | `/api/shipments` | 已登入 | 列出出貨單據 |
| GET | `/api/shipments/:id` | 已登入 | 取得單筆出貨單 |
| GET | `/api/shipments/:id/export` | 已登入 | 匯出出貨單 Excel（工作表：出貨明細、序號表） |
| POST | `/api/shipments` | manager/admin | 建立出貨單並綁定異動（只能綁目前倉庫、未綁定的出庫異動，否則 409；回應同 GET /:id） |
| PUT | `/api/shipments/:id` | manager/admin | 修改出貨單；帶 `transaction_ids` 時整組換綁（規則同建立），沒給的欄位保持原值；回應同 GET /:id |
| DELETE | `/api/shipments/:id` | manager/admin | 軟刪除出貨單 |
| GET | `/api/tags` | 已登入 | 列出交易標籤 |
| GET | `/api/csv/export` | 已登入 | 匯出商品 CSV |
| GET | `/api/csv/template` | 已登入 | 下載 CSV 匯入範本 |
| POST | `/api/csv/import` | manager/admin | 匯入商品 CSV（multipart/form-data） |
| GET | `/api/csv/imports` | 已登入 | 列出匯入歷史（⚠️ 全域，不限倉庫） |
| GET | `/api/csv/imports/:importId` | 已登入 | 取得匯入詳情（⚠️ 全域，不限倉庫） |
| GET | `/api/product-units` | 已登入 | 列出目前倉庫的序號品（AP） |
| GET | `/api/product-units/:id` | 已登入 | 取得單筆 AP（其他倉庫的回 404） |
| POST | `/api/product-units` | manager／admin | 建立單筆 AP（不動數量；商品須屬目前倉庫） |
| POST | `/api/product-units/bulk` | manager／admin | 批次建立 AP 並寫一筆 INBOUND（商品須屬目前倉庫；部分成功） |
| GET | `/api/product-units/lookup/:serial` | 已登入 | 以序號查詢目前倉庫的 AP（找不到回 404） |
| POST | `/api/outbound` | manager / admin | 統一出庫：數量明細 + AP 序號，OUTBOUND 標籤自動建立出貨單（全有或全無） |
| POST | `/api/product-units/transfer` | manager／admin | 把目前倉庫的在庫 AP 調撥到另一倉庫同 SKU 的商品 |
| PUT | `/api/product-units/:id` | manager／admin | 修改 AP 的出貨欄位與 remarks（不能改 status） |
| DELETE | `/api/product-units/:id` | manager／admin | 刪除 AP（硬刪除，不動數量；其他倉庫的回 404） |
| GET | `/api/product-units/export` | 已登入 | 匯出目前倉庫的 AP CSV |
| GET | `/api/audit-logs` | admin | 查詢 audit log |
| GET | `/api/reports/inventory` | 已登入 | 庫存報表 |

> **AP（`/api/product-units`）共通規則**：所有路由只看得到、改得到 `X-Warehouse-Id` 倉庫的序號品，倉庫取自序號品所屬商品；body 不接受 `warehouse_id`。序號一律正規化為「去頭尾空白 + 轉大寫」，前端可只做顯示用的整理，以後端回應為準。序號狀態只能經由出貨（`/api/outbound`）與退貨入庫（`/api/batches`，RETURN 標籤）改變。

---

## 認証標頭

```
Authorization: Bearer <token>
X-Warehouse-Id: <warehouse_id>   # 倉庫範圍路由必填
```

倉庫範圍路由只看得到、改得到 `X-Warehouse-Id` 倉庫的資料：其他倉庫的資源一律回 404（綁定出貨單時回 409「not found」），列表不會列出。建立資料時倉庫一律取自標頭，body 的 `warehouse_id` 會被忽略。例外：

- `GET /api/products/lookup` 的 `warehouse_id` 可以是使用者有權限的其他倉庫（調撥時查目標倉庫），沒有權限回 403。
- `GET /api/csv/imports`、`/api/csv/imports/:importId` 是全域的（`csv_imports` 沒有 `warehouse_id`），見 `docs/tech-debt.md` B2。

## 角色說明

| 角色 | 權限 |
|------|------|
| `view` | 唯讀 |
| `manager` | 唯讀 + 庫存異動、商品管理 |
| `admin` | 全部，包含使用者、倉庫、audit log |
