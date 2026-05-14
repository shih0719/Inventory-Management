# 版本變更紀錄

本檔案遵循 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) 格式，版本遵循 [Semantic Versioning](https://semver.org/lang/zh_TW/)。

## [1.1.0] - 2026-05-14

### 新增功能
- 低庫存產品全局排序到列表頂端，集中於首頁展示
- 新增「⚠️ 只顯示低庫存」篩選勾選框，快速查看待補貨商品
- 後端排序邏輯優化，使用 `ORDER BY CASE` 確保低庫存品優先顯示

### 技術改進
- 優化 SQL 查詢排序邏輯（`productsController.js`）
- 前端支援低庫存篩選參數傳遞

### 受影響文件
- `src/controllers/productsController.js` - 新增全局排序邏輯
- `public/index.html` - 新增篩選勾選框
- `public/js/app.js` - 新增事件監聽和參數傳遞

## [1.0.2] - 2026-05-13

### 修復
- 修正 Windows Docker 環境下的檔案路徑識別問題
- 防止 Docker volume mount 導致數據庫資料損失

## [1.0.1] - 2026-05-12

### 修復
- 修正版本顯示邏輯

### 改進
- 禁用自動版本檢查，改為手動檢查模式

## [1.0.0] - 2026-05-01

### 初始發布
- ✅ 商品管理（CRUD、軟刪除、CSV 批量匯入匯出）
- ✅ 庫存異動追蹤（有帳/無帳雙軌）
- ✅ 批次異動管理
- ✅ 序號品（AP）逐台追蹤
- ✅ 儲位管理（多對多關聯）
- ✅ 低庫存預警（Webhook edge-triggered）
- ✅ 自動備份機制（每小時、保留 7 天）
- ✅ 版本管理與在線更新
