# 🔄 系統更新指南

## 概述

這個庫存管理系統提供了**自動化的版本更新機制**，結合**定期數據庫備份**，確保你可以安全地保持最新版本。

## 系統流程

### 1️⃣ **版本檢查** (自動每 60 分鐘)
- 系統自動檢查遠端 Git 倉庫是否有新提交
- 不需要你做任何事，後台自動進行

### 2️⃣ **更新通知** (Web UI)
- 訪問 `http://localhost:3030/updates.html`
- 查看當前版本和是否有新版本
- 手動觸發檢查或應用更新

### 3️⃣ **自動備份** (每小時)
- Docker 容器在後台自動備份資料庫
- 備份位置：`./database/backups/`
- 自動保留最近 7 天的備份
- 舊備份自動清除

### 4️⃣ **應用更新**
- 執行 `git pull` 獲取最新代碼
- 安裝新依賴（如果有）
- 應用自動重啟

---

## 使用方式

### 查看更新狀態

1. 打開瀏覽器訪問：`http://localhost:3030/updates.html`
2. 查看當前版本和遠端狀態

```
當前版本: 1.0.0
遠端版本: abc1234 (git commit hash)
最後檢查: 2026-05-14 15:30:45
更新狀態: ✓ 已是最新
```

### 手動檢查更新

1. 在更新頁面點擊 **「🔍 檢查更新」** 按鈕
2. 系統會立即檢查是否有新版本
3. 如有新版本，「📥 應用更新」按鈕會啟用

### 應用更新

1. 確認有新版本可用
2. 點擊 **「📥 應用更新」** 按鈕
3. 確認對話框
4. 等待應用自動重啟（通常 30 秒內）

```
更新流程：
✓ 備份當前代碼版本
✓ 下載新代碼（git pull）
✓ 安裝依賴
✓ 應用自動重啟
```

---

## API 端點

### 獲取更新狀態
```bash
GET /api/updates/status

返回：
{
  "currentVersion": "1.0.0",
  "available": false,
  "localCommit": "abc123...",
  "remoteCommit": "def456...",
  "lastCheckTime": "2026-05-14T15:30:45.000Z",
  "isUpdating": false,
  "error": null
}
```

### 手動檢查更新
```bash
POST /api/updates/check

返回：更新狀態（同上）
```

### 應用更新
```bash
POST /api/updates/apply

返回：
{
  "message": "更新已開始，應用將自動重啟..."
}

應用會在 30 秒內重啟。
```

---

## 備份管理

### 備份位置
```
database/backups/
├── inventory.backup_20260514_150000.db
├── inventory.backup_20260514_140000.db
├── inventory.backup_20260514_130000.db
└── ...（最多保留 7 天）
```

### 手動恢復備份

如果需要回到某個時間點的數據：

1. **停止應用**
```bash
docker-compose down
```

2. **備份當前數據庫**
```bash
cp database/inventory.db database/inventory.db.broken
```

3. **恢復舊備份**
```bash
cp database/backups/inventory.backup_20260514_150000.db database/inventory.db
```

4. **重新啟動應用**
```bash
docker-compose up -d
```

---

## 常見問題

### Q: 更新會影響我的數據嗎？
**A:** 不會。更新只涉及代碼，不涉及資料庫。每次更新前都有自動備份。

### Q: 更新失敗了怎麼辦？
**A:** 
1. 檢查網絡連接
2. 重啟 Docker 容器
3. 從之前的備份恢復（見備份管理）
4. 檢查日誌：`docker-compose logs inventory-app`

### Q: 可以自動更新嗎？
**A:** 目前設計為手動觸發更新，確保你在重要時刻有控制權。自動更新可能在生產環境造成不利影響。

### Q: 備份需要手動管理嗎？
**A:** 不需要。系統自動每小時備份一次，自動保留 7 天，自動清除舊備份。

### Q: 多久檢查一次更新？
**A:** 系統每 60 分鐘自動檢查一次。你也可以在更新頁面手動檢查。

---

## 技術細節

### 版本檢查機制
- 使用 `git fetch` 獲取遠端最新狀態
- 比較本地 HEAD 和 `origin/main`
- 無需實際修改本地代碼，安全快速

### 更新流程
```javascript
// 執行步驟
1. git fetch origin --quiet
2. git reset --hard origin/main
3. npm install --production
4. process.exit(0)  // Docker 會自動重啟
```

### 備份機制
```bash
# 每小時執行
sqlite3 database/inventory.db ".backup 'database/backups/inventory.backup_TIMESTAMP.db'"

# 保留策略
find database/backups -mtime +7 -delete  # 刪除 7 天前的備份
```

---

## 推薦實踐

1. **定期檢查更新** — 每週至少檢查一次
2. **在工作時間外更新** — 避免打擾業務流程
3. **保持備份** — 定期導出重要備份到外部存儲
4. **記錄版本** — 在 GitHub Release 中標記穩定版本

---

## 手動 Git 操作（高級用戶）

### 查看更新歷史
```bash
git log --oneline -10
```

### 回到特定版本
```bash
git checkout <commit-hash>
npm install --production
npm start
```

### 強制同步遠端（刪除本地未推送的更改）
```bash
git fetch origin
git reset --hard origin/main
```

---

## 相關文件
- `src/services/updateService.js` — 版本檢查邏輯
- `src/routes/updates.js` — API 端點
- `public/updates.html` — Web UI
- `backup-db.sh` — 備份腳本
- `Dockerfile` — Docker 配置

