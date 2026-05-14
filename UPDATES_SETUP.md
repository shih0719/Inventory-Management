# ✅ 版本更新系統已完成

## 已實現功能

### 1. 定期自動備份 ✓
- **位置**：`./database/backups/`
- **頻率**：每小時自動備份一次
- **保留**：最近 7 天的備份
- **自動清理**：舊備份自動刪除
- **要求**：需要 Docker 運行

### 2. 版本檢查 ✓
- **檢查機制**：後台每 60 分鐘自動檢查一次
- **檢查方式**：比較本地代碼與 GitHub 最新版本
- **手動檢查**：也可在 Web UI 隨時手動觸發

### 3. 更新管理 Web UI ✓
- **訪問地址**：`http://localhost:3030/updates.html`
- **功能**：
  - 查看當前版本和遠端版本
  - 顯示最後檢查時間
  - 一鍵應用更新
  - 實時反饋更新進度

### 4. 自動更新流程 ✓
- **安全**：更新前自動備份
- **自動化**：git pull + 依賴安裝 + 自動重啟
- **無損**：資料庫和用戶數據不受影響

---

## 快速開始

### 運行應用（Docker）
```bash
docker-compose up -d
```

### 查看更新狀態
1. 打開瀏覽器：`http://localhost:3030/updates.html`
2. 點擊「檢查更新」或等待自動檢查
3. 如有新版本，點擊「應用更新」

### 手動恢復備份
```bash
# 找到要恢復的備份文件
ls database/backups/

# 停止應用
docker-compose down

# 恢復備份
cp database/backups/inventory.backup_YYYYMMDD_HHMMSS.db database/inventory.db

# 重新啟動
docker-compose up -d
```

---

## 文件說明

| 文件 | 用途 |
|------|------|
| `src/services/updateService.js` | 版本檢查和更新邏輯 |
| `src/routes/updates.js` | 更新 API 端點 |
| `public/updates.html` | 更新管理 Web UI |
| `backup-db.sh` | 自動備份腳本 |
| `Dockerfile` | Docker 配置（含備份守護程序） |
| `UPDATE_GUIDE.md` | 詳細使用指南 |
| `.gitignore` | 排除備份文件（不上傳 Git） |

---

## API 端點

```
GET  /api/updates/status  - 獲取更新狀態
POST /api/updates/check   - 手動檢查更新
POST /api/updates/apply   - 執行更新
```

---

## 更新流程圖

```
自動檢查 (每 60 分鐘)
  ↓
Git fetch 遠端倉庫
  ↓
比較本地和遠端版本
  ↓
有新版本? → Web UI 提示 → 用戶點擊更新 → 執行更新
  ↓
Git pull + npm install
  ↓
應用重啟 (Docker 自動)
  ↓
恢復正常服務
```

---

## 備份保證

- ✅ **自動備份**：無需手動，每小時自動執行
- ✅ **持久保存**：備份存儲在 Docker Volume
- ✅ **版本控制**：備份文件名包含時間戳
- ✅ **自動清理**：7 天後自動刪除舊備份
- ✅ **安全恢復**：簡單的文件替換即可恢復

---

## 下一步建議

1. **測試更新機制**
   - 對 GitHub 倉庫做一個小改動
   - 推送到遠端
   - 在更新 Web UI 檢查和應用更新

2. **設置 GitHub Release**
   - 為穩定版本創建 Release
   - 記錄版本變更日誌
   - 便於追溯版本歷史

3. **監控備份**
   - 定期檢查備份目錄大小
   - 根據需要調整保留天數

4. **建立文檔**
   - 向用戶說明更新流程
   - 提供常見問題解答

---

## 問題排查

### 更新失敗
```bash
# 查看日誌
docker-compose logs inventory-app | tail -50

# 手動同步
docker exec -it inventory-system bash
git fetch origin
git status
```

### 備份缺失
```bash
# 檢查備份目錄
ls -lh database/backups/

# 查看備份腳本日誌
docker-compose logs inventory-app | grep UPDATE
```

### 應用無法重啟
```bash
# 重新啟動容器
docker-compose restart inventory-app

# 查看容器狀態
docker-compose ps
```

---

## 配置調整

### 改變版本檢查頻率
編輯 `server.js`，修改：
```javascript
updateService.startPeriodicCheck(60);  // 改為你需要的分鐘數
```

### 改變備份保留天數
編輯 `backup-db.sh`，修改：
```bash
RETENTION_DAYS=7  # 改為你需要的天數
```

### 改變備份頻率
編輯 `backup-db.sh`，修改：
```bash
BACKUP_INTERVAL=3600  # 改為秒數（3600 = 1 小時）
```

---

生成日期：2026-05-14
