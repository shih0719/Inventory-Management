# 專案階段總覽

## 背景

庫存管理系統，支援雙重登入（本地帳號密碼 + Microsoft SSO），
使用者有系統角色（admin/manager/view）與倉庫存取清單。

## 階段摘要

| 階段 | 主題 | 狀態 |
|------|------|------|
| Phase 1 | Auth + 角色 + 倉庫存取控制（後端+前端） | ✅ 完成 |
| Phase 2 | 倉庫選擇 + 資料隔離（products/transactions 綁倉庫） | ✅ 完成 |
| Phase 3 | 跨倉庫功能（報表、調撥、audit） | 🔲 待開始 |
| Phase 4 | Microsoft SSO（Azure AD OIDC） | ⏸ 暫緩（等 Azure 憑證） |

## GitHub Issues 對應

| Issue | 主題 | 狀態 |
|-------|------|------|
| #1 | PRD: Auth Provider 抽象層 | ✅ |
| #2 | Schema Migration: users/warehouses/user_warehouses | ✅ |
| #3 | AuthProvider 介面 + LocalProvider 重構 | ✅ |
| #4 | requireRole middleware + 全 API 權限補齊 | ✅ |
| #5 | Warehouse CRUD（admin only） | ✅ |
| #6 | User 管理 CRUD（admin only） | ✅ |
| #7 | GET /api/auth/provider + 前端動態登入頁 | ✅ |
| #8 | MicrosoftProvider（Azure AD OIDC） | ⏸ 暫緩 |
| #9 | 前端 role-based UI 控制 | ✅ |
| #10 | PRD: 前端管理介面 | ✅ |
| #11 | Schema Migration: warehouse_id | ✅ |
| #12 | 後端 requireWarehouse middleware + API 隔離 | ✅ |
| #13 | 前端 WarehouseSelector + active warehouse context | ✅ |
| Phase 3 issues | 尚未建立 | 🔲 |
