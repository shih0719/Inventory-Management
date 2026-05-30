# Phase 1 — Auth + 角色 + 倉庫存取控制

## 狀態：✅ 完成

## 目標

- 使用者可用本地帳號密碼登入
- 使用者有系統角色（admin / manager / view）
- 使用者被指定可存取哪些倉庫（多選）
- 所有 API 需要認證；部分 API 限制角色
- 前端根據角色顯示/隱藏功能

## 已完成的任務

### 後端

- [x] Schema: `users` 表加 `role`, `provider`, `email` 欄位
- [x] Schema: 新建 `warehouses` 表（id, name, description, created_at）
- [x] Schema: 新建 `user_warehouses` 關聯表（多對多）
- [x] JWT payload 包含 `role` 和 `warehouses`（使用者有權限的倉庫 id 陣列）
- [x] `requireRole(roles)` middleware（403 if role not allowed）
- [x] `GET /api/auth/provider` 公開端點（回傳目前登入方式）
- [x] `GET /api/auth/me` 回傳 `provider` 欄位
- [x] Warehouse CRUD：`GET/POST /api/warehouses`，`PUT/DELETE /api/warehouses/:id`
- [x] User CRUD：`GET/POST /api/users`，`PUT/DELETE /api/users/:id`
- [x] 全 API 權限補齊：products/transactions/batches/shipments/csv/audit

### 前端

- [x] 登入頁動態偵測 provider（local 顯示表單，microsoft 顯示按鈕）
- [x] 倉庫管理頁（WarehousesPage）— admin only
- [x] 使用者管理頁（UsersPage）— admin only，含角色 badge、倉庫多選
- [x] App.tsx role-based 功能顯示（canWrite, isAdmin）

### 測試

- [x] `tests/auth.test.js` — 10 tests
- [x] `tests/warehouses.test.js` — 10 tests
- [x] `tests/users.test.js` — 13 tests
- [x] `tests/authProvider.test.js` — 3 tests

## 關鍵設計決策

- AuthProvider 是系統層級設定（env `AUTH_PROVIDER`），非使用者選擇
- 切換 provider 時舊帳號全部失效（無混用）
- 倉庫在 Phase 1 只是「存取控制標籤」，尚未與 products 綁定
- JWT 用 `warehouses: number[]` 帶使用者可存取的倉庫清單
