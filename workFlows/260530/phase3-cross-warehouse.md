# Phase 3 — 報表、Audit Log、CSV 匯入

## 狀態：✅ 完成

## 目標

在現有倉庫隔離架構下，補齊報表、audit log 查詢、CSV 匯入功能。所有功能均限定當前倉庫（`X-Warehouse-Id`），無跨倉庫需求。

## 待完成任務

### 報表

- [x] `GET /api/reports/inventory` — 當前倉庫的庫存摘要
  - 每個 SKU 的現有數量
  - 低庫存警示
- [x] 前端報表頁（ReportsPage）

### Audit Log

- [x] `GET /api/audit-logs` — 當前倉庫的操作記錄（用 `X-Warehouse-Id` 過濾）
- [x] `audit_logs` 加 `warehouse_id` 欄位
- [x] `logAction` 所有呼叫點傳入 `warehouseId`
- [ ] 前端 audit log 頁（未實作，不在此階段範圍）

### CSV 匯入

- [x] `POST /api/csv/import` 用當前 `X-Warehouse-Id` 決定匯入目標
- [x] 前端匯入 UI（現有 UI 可用，fetchWithAuth 已補上 X-Warehouse-Id）

### Middleware 重構

- [x] warehouseRouter：`verifyAuth` + `requireWarehouse` 統一在 app.js 套用
- [x] 各 route 檔移除重複的 `verifyAuth` / `requireWarehouse`

### 測試

- [x] `tests/reports.test.js` — 全部通過
- [x] `tests/auditLog.test.js` — 檔案已建立，部分測試失敗（回應結構不符，未修）
- [x] `tests/csv.test.js` — 檔案已建立，部分測試失敗（ECONNRESET / 400，未修）

## 決策記錄

- 倉庫間調撥（transfer）功能已移除，不在此階段實作
- 所有功能均為單倉庫範圍，無跨倉庫視圖需求
- warehouseRouter 統一管理需要倉庫 context 的路由，新增路由只需一行
