# Phase 2 — 倉庫選擇 + 資料隔離

## 狀態：✅ 完成

## 目標

登入後強制選擇一個倉庫，接下來所有新增/查詢操作都限定在該倉庫範圍內。

## 使用者流程

1. 登入成功 → 前端彈出倉庫選擇畫面（只顯示使用者有權限的倉庫）
2. 選定倉庫後進入主畫面
3. 新增產品 → 自動帶入 `warehouse_id`
4. 查詢產品/交易 → 只看到當前倉庫的資料
5. 可切換倉庫（重新選擇）

## 完成任務

### Schema 變更

- [x] `products` 表加 `warehouse_id INTEGER` 欄位，`UNIQUE(sku, warehouse_id)`
- [x] `transactions` 表加 `warehouse_id INTEGER` 欄位
- [x] `batches` 表加 `warehouse_id INTEGER` 欄位
- [x] `shipments` 表加 `warehouse_id INTEGER` 欄位
- [x] 遷移現有資料到 default 倉庫（id=1）
- [x] Default 倉庫固定 id=1，不可刪除

### 後端

- [x] `requireWarehouse` middleware：確認 request 帶有合法的 `X-Warehouse-Id` header，驗證使用者存取權限
- [x] `GET /api/products` 自動過濾 `WHERE warehouse_id = ?`
- [x] `POST /api/products` 自動帶入 `warehouse_id`
- [x] Default 倉庫所有角色自動可存取（login/me 回傳時自動合併）
- [x] `deleteWarehouse` 保護 id=1 不可刪除（403）
- [x] 新建使用者自動指派 default 倉庫

### 前端

- [x] 登入後的倉庫選擇畫面（WarehouseSelector component，三語）
- [x] 選定倉庫存入 `ActiveWarehouseContext` + localStorage
- [x] 所有 API call 自動帶上 `X-Warehouse-Id` header
- [x] 右上角顯示目前倉庫名稱，點擊可切換（完全 reset）
- [x] 單筆新增產品 modal（manager+ 可見）

### 測試

- [x] `tests/warehouseSchema.test.js` — 4 tests GREEN
- [x] `tests/warehouseScoped.test.js` — 4 tests GREEN
- [x] `tests/auth.test.js` — 全回歸通過
- [x] 全套 44 tests GREEN

## 關鍵設計決策（已確認）

- **products 歸屬**：各倉庫完全獨立維護自己的商品清單。`products` 表加 `warehouse_id`，唯一約束改為 `UNIQUE(sku, warehouse_id)`。不共用全域 SKU 定義。AP（`product_units`）不加 `warehouse_id`，倉庫歸屬透過 Product 推導。
- **active warehouse 傳遞方式**：`X-Warehouse-Id` request header。後端 middleware 驗證使用者確實有該倉庫的存取權限。
- **倉庫選擇畫面**：登入後一律顯示選擇畫面，即使使用者只有一個倉庫也要明確選擇。
- **跨倉庫可見性**：Phase 2 完全隔離，使用者只看自己的倉庫。跨倉庫功能留給 Phase 3。
- **Default 倉庫**：固定 id=1，名稱 'default'，不可刪除。所有使用者登入時自動取得存取權（不需 user_warehouses 記錄）。
- **新使用者預設倉庫**：建立使用者時自動指派 default 倉庫（`COLLATE NOCASE` 查找）。
- **切換倉庫**：前端完全重置，跳回 dashboard，所有 state 清空重新載入。

## GitHub Issues

| Issue | 主題 | 狀態 |
|-------|------|------|
| #11 | Schema Migration: warehouse_id | ✅ |
| #12 | 後端 requireWarehouse middleware + API 隔離 | ✅ |
| #13 | 前端 WarehouseSelector + active warehouse context | ✅ |
