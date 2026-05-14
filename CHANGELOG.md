# 版本變更紀錄

本檔案遵循 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) 格式，版本遵循 [Semantic Versioning](https://semver.org/lang/zh_TW/)。

## [2.0.0] - 2026-05-14

### 重大變更（Breaking Changes）
- **放棄 Docker 容器化部署，改用 Node.js + PM2 進程管理**
  - 原因：Web UI 更新與 Docker 容器邏輯衝突，且文件占用問題難以解決
  - Docker Compose、Dockerfile、.dockerignore 已全部移除
  - 部署方式改為：`npm run pm2:start`

### 技術改進
- **備份脚本改為 Node.js 實現** — 完全兼容 Windows，不再依賴 bash
  - 使用文件複製備份（簡單可靠）
  - 自動清理舊備份邏輯保留
  - 集成在主應用進程中，無需獨立守護程序

- **更新邏輯簡化** — 移除 Docker 相關代碼
  - 去除容器停止邏輯
  - 直接執行 git + npm install + 重啟
  - PM2 自動重啟應用

### 受影響文件
- **刪除**：Dockerfile, docker-compose.yml, .dockerignore, update.sh, backup-db.sh
- **新增**：ecosystem.config.js, DEPLOYMENT.md
- **修改**：
  - `src/services/backupService.js` — 改為 Node.js 實現，文件複製備份
  - `src/services/updateService.js` — 簡化更新邏輯
  - `src/config/logger.js` — 支持 LOG_DIR 環境變數（暫未啟用）
  - `package.json` — 新增 PM2 相關脚本
  - `README.md` — 更新部署說明為 PM2
  - `server.js` — 移除對 backupService 的重複調用

### 部署指南
詳見 `DEPLOYMENT.md`

## [1.1.1] - 2026-05-14

### 新增功能
- 集成 Winston 日誌系統，支援結構化日誌記錄
- 自動日誌輪轉，保留 10 個文件，每個 10MB
- 新增 PM2 進程管理配置和部署指南

### 技術改進
- 日誌存儲在 `logs/app.log`（全部）和 `logs/error.log`（僅錯誤）
- 為所有日誌添加服務標籤（`[UPDATE]`, `[BACKUP]`, `[SERVER]`, `[SYSTEM]`）
- 替換所有 `console.log/console.error` 為結構化日誌
- **部署策略調整：放棄 Docker，改用 Node.js + PM2**
  - 原因：Web UI 更新與 Docker 容器邏輯衝突，且文件占用問題難以解決
  - 新方案：PM2 進程管理 + 直接執行 git/npm 操作，更清晰簡潔

### 受影響文件
- `src/config/logger.js` - 新增日誌配置
- `src/services/backupService.js` - 更新為使用日誌系統
- `src/services/updateService.js` - 更新為使用日誌系統，簡化更新邏輯（移除 Docker 相關代碼）
- `src/controllers/systemController.js` - 更新為使用日誌系統
- `server.js` - 更新為使用日誌系統
- `docs/LOGGING.md` - 新增日誌文檔
- `package.json` - 新增 PM2 啟動腳本
- `ecosystem.config.js` - 新增 PM2 配置文件
- `DEPLOYMENT.md` - 新增部署指南
- **刪除：** Dockerfile, docker-compose.yml, .dockerignore, update.sh, start.sh

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
