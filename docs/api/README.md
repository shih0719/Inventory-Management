# API 端點清單

**最後更新**：2026-05-30

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
| GET | `/api/products/lookup` | 已登入 | 依 SKU 查詢商品 |
| GET | `/api/products/:id` | 已登入 | 取得單一商品 |
| POST | `/api/products` | manager/admin | 建立商品 |
| PUT | `/api/products/:id` | manager/admin | 修改商品 |
| DELETE | `/api/products/:id` | manager/admin | 軟刪除商品 |
| GET | `/api/products/:sku/locations` | 已登入 | 查詢商品儲位 |
| GET | `/api/transactions` | 已登入 | 列出庫存異動 |
| GET | `/api/transactions/:id` | 已登入 | 取得單筆異動 |
| GET | `/api/transactions/product/:productId` | 已登入 | 取得特定商品的異動 |
| POST | `/api/transactions` | manager/admin | 建立庫存異動 |
| GET | `/api/batches` | 已登入 | 列出批次 |
| GET | `/api/batches/:id` | 已登入 | 取得單筆批次 |
| POST | `/api/batches` | manager/admin | 建立批次異動 |
| GET | `/api/shipments` | 已登入 | 列出出貨單據 |
| GET | `/api/shipments/:id` | 已登入 | 取得單筆出貨單 |
| POST | `/api/shipments` | manager/admin | 建立出貨單 |
| PUT | `/api/shipments/:id` | manager/admin | 修改出貨單 |
| DELETE | `/api/shipments/:id` | manager/admin | 軟刪除出貨單 |
| GET | `/api/tags` | 已登入 | 列出交易標籤 |
| GET | `/api/csv/export` | 已登入 | 匯出商品 CSV |
| GET | `/api/csv/template` | 已登入 | 下載 CSV 匯入範本 |
| POST | `/api/csv/import` | manager/admin | 匯入商品 CSV（multipart/form-data） |
| GET | `/api/csv/imports` | 已登入 | 列出匯入歷史 |
| GET | `/api/csv/imports/:importId` | 已登入 | 取得匯入詳情 |
| GET | `/api/product-units` | 已登入 | 列出序號品（AP） |
| GET | `/api/product-units/:id` | 已登入 | 取得單筆 AP |
| POST | `/api/product-units` | 已登入 | 建立單筆 AP |
| POST | `/api/product-units/bulk` | 已登入 | 批次建立 AP |
| POST | `/api/product-units/bulk-sell` | 已登入 | 批次標記 AP 出售 |
| POST | `/api/product-units/transfer` | 已登入 | 跨倉調撥 AP |
| PUT | `/api/product-units/:id` | 已登入 | 修改 AP |
| DELETE | `/api/product-units/:id` | 已登入 | 刪除 AP（硬刪除） |
| GET | `/api/product-units/export` | 已登入 | 匯出 AP CSV |
| GET | `/api/audit-logs` | admin | 查詢 audit log |
| GET | `/api/reports/inventory` | 已登入 | 庫存報表 |

---

## 認証標頭

```
Authorization: Bearer <token>
X-Warehouse-Id: <warehouse_id>   # 倉庫範圍路由必填
```

## 角色說明

| 角色 | 權限 |
|------|------|
| `view` | 唯讀 |
| `manager` | 唯讀 + 庫存異動、商品管理 |
| `admin` | 全部，包含使用者、倉庫、audit log |
