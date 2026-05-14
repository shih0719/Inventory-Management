# 數據庫備份服務

## 概述

系統提供自動化的 SQLite 數據庫備份機制，確保數據安全。備份服務在應用啟動時自動開始，無需人工介入。

## 架構

### 備份服務位置
- **模組**：`src/services/backupService.js`
- **啟動**：`server.js` 應用啟動時調用 `startBackupDaemon()`
- **備份存儲**：`database/backups/`

### 備份策略

| 項目 | 配置 |
|------|------|
| **備份頻率** | 每小時 (3600000ms) |
| **保留時間** | 7 天 |
| **備份方式** | SQLite `.backup` 命令 |
| **文件命名** | `inventory.backup_YYYYMMDDTHHMMSS.db` |
| **自動清理** | 超過 7 天的備份自動刪除 |

## 工作原理

### 1. 啟動流程

```javascript
// server.js
const { startBackupDaemon } = require("./src/services/backupService");

initDatabase()
  .then(() => {
    startBackupDaemon();  // 啟動備份守護程序
    app.listen(PORT, ...);
  });
```

### 2. 首次備份

應用啟動時立即執行一次備份：

```
應用啟動
  ↓
呼叫 startBackupDaemon()
  ↓
建立 database/backups/ 目錄
  ↓
執行第一次備份
  ↓
輸出日誌：[BACKUP] ✓ 備份成功: inventory.backup_2026-05-14T0608.db (0.13MB)
```

### 3. 定期備份

之後每小時自動執行一次：

```
定時器 (BACKUP_INTERVAL = 3600000ms)
  ↓
執行 performBackup()
  ↓
建立新備份文件
  ↓
清理舊備份 (> 7天)
  ↓
記錄日誌
```

## 備份機制詳解

### SQLite `.backup` 命令

```bash
sqlite3 "database/inventory.db" ".backup 'database/backups/inventory.backup_TIMESTAMP.db'"
```

**優勢：**
- ✅ 一致性備份 — 不會備份到不完整的狀態
- ✅ 在線備份 — 無需停止應用或鎖定數據庫
- ✅ 完整副本 — 包括所有數據和 WAL 日誌

**vs 其他方式：**
| 方式 | 優點 | 缺點 |
|------|------|------|
| `.backup` 命令 | 一致、在線 | 需要 sqlite3 工具 |
| 複製文件 | 簡單 | 可能備份不完整 |
| 導出 SQL | 可搜索 | 速度慢、體積大 |

## 代碼詳解

### backupService.js 核心函數

#### `startBackupDaemon()`

```javascript
function startBackupDaemon() {
  ensureBackupDir();           // 確保目錄存在
  performBackup();             // 立即執行一次
  setInterval(performBackup, BACKUP_INTERVAL);  // 定期執行
  console.log('[BACKUP] 定期備份已啟動...');
}
```

#### `performBackup()`

```javascript
async function performBackup() {
  // 1. 檢查數據庫是否存在
  if (!fs.existsSync(DB_PATH)) {
    console.log('[BACKUP] ⚠️ 資料庫未找到');
    return;
  }

  // 2. 生成時間戳（格式：20260514T0608）
  const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '')
    .slice(0, 15);

  // 3. 執行 SQLite 備份
  await execAsync(`sqlite3 "${DB_PATH}" ".backup '${backupFile}'"`);

  // 4. 記錄成功日誌
  console.log(`[BACKUP] ✓ 備份成功: ${filename} (${sizeMB}MB)`);

  // 5. 清理舊備份
  cleanOldBackups();
}
```

#### `cleanOldBackups()`

```javascript
function cleanOldBackups() {
  const now = Date.now();
  const files = fs.readdirSync(BACKUP_DIR);

  files.forEach(file => {
    if (file.startsWith('inventory.backup_') && file.endsWith('.db')) {
      const filePath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(filePath);
      
      // 計算文件年齡（天數）
      const ageInDays = (now - stat.mtimeMs) / (1000 * 60 * 60 * 24);

      // 刪除超過保留期的備份
      if (ageInDays > RETENTION_DAYS) {
        fs.unlinkSync(filePath);
        console.log(`[BACKUP] 🗑️ 刪除舊備份: ${file}`);
      }
    }
  });

  // 輸出當前備份數
  const backupCount = files.filter(/*...*/);
  console.log(`[BACKUP] 當前備份數: ${backupCount} 個`);
}
```

## 備份位置和文件命名

### 備份目錄結構

```
database/
├── inventory.db                    # 當前數據庫
├── inventory.db-shm               # SQLite 寫入加速文件
├── inventory.db-wal               # SQLite Write-Ahead Log
└── backups/
    ├── inventory.backup_20260514T0608.db
    ├── inventory.backup_20260514T0708.db
    ├── inventory.backup_20260514T0808.db
    └── ...（最多保留 7 天的備份）
```

### 文件命名規則

```
inventory.backup_YYYYMMDDTHHMMSS.db
                │      │ └─ 月
                │      └─ 日
                └─ 年

例：inventory.backup_20260514T0608.db
    = 2026年5月14日 06:08 的備份
```

## 手動恢復備份

### 完整恢復步驟

#### 1. 停止應用

```bash
docker-compose down
```

#### 2. 備份當前損壞的數據庫（可選）

```bash
cp database/inventory.db database/inventory.db.broken
```

#### 3. 列出可用備份

```bash
ls -lh database/backups/
```

輸出示例：
```
inventory.backup_20260514T0608.db  128K
inventory.backup_20260514T0708.db  129K
inventory.backup_20260514T0808.db  130K
```

#### 4. 恢復指定時間點的備份

```bash
# 恢復最新備份
cp database/backups/inventory.backup_20260514T0808.db database/inventory.db

# 或恢復指定時間點
cp database/backups/inventory.backup_20260514T0608.db database/inventory.db
```

#### 5. 重啟應用

```bash
docker-compose up -d
```

#### 6. 驗證恢復成功

```bash
# 檢查應用是否運行
docker-compose ps

# 檢查數據是否恢復
curl http://localhost:3030/api/products
```

## 故障排查

### 問題 1: 備份文件未生成

**症狀：** `database/backups/` 目錄為空

**排查步驟：**

```bash
# 1. 檢查容器日誌
docker logs inventory-system | grep BACKUP

# 2. 檢查 database/ 目錄是否存在
ls -la database/

# 3. 檢查 SQLite 數據庫是否正常
sqlite3 database/inventory.db ".tables"
```

**常見原因：**
- ❌ 數據庫文件不存在或損壞
- ❌ 沒有寫入權限
- ❌ SQLite 工具未安裝（Docker 中已包含）

### 問題 2: 備份文件持續增長

**症狀：** `database/backups/` 中文件不斷增加，不清理

**排查步驟：**

```bash
# 檢查日誌中是否有刪除操作
docker logs inventory-system | grep "刪除舊備份"

# 檢查文件修改時間
stat database/backups/inventory.backup_*.db | grep Modify
```

**常見原因：**
- ❌ RETENTION_DAYS 設置太大
- ❌ cleanOldBackups() 未正常執行
- ❌ 文件系統時間不正確

### 問題 3: 備份速度慢或超時

**症狀：** `[BACKUP] 備份失敗` 或超時

**排查步驟：**

```bash
# 檢查數據庫大小
du -sh database/inventory.db

# 手動執行備份測試
docker exec inventory-system sqlite3 database/inventory.db ".backup 'database/backups/test.db'"

# 檢查磁盤空間
df -h database/
```

**常見原因：**
- ❌ 磁盤空間不足
- ❌ 數據庫文件過大
- ❌ 磁盤 I/O 緩慢

### 問題 4: 恢復後應用無法啟動

**症狀：** 恢復備份後應用崩潰或 500 錯誤

**解決方案：**

```bash
# 1. 檢查備份文件是否完整
sqlite3 database/backups/inventory.backup_*.db ".tables"

# 2. 如果備份損壞，用最早的備份
cp database/backups/inventory.backup_20260514T0608.db database/inventory.db

# 3. 強制重新構建
docker-compose down
docker rmi inventory-management-inventory-app
docker-compose up -d --build
```

## 配置調整

### 改變備份頻率

編輯 `src/services/backupService.js`：

```javascript
// 改為每 30 分鐘備份一次
const BACKUP_INTERVAL = 1800000;  // 30 分鐘

// 或改為每 6 小時備份一次
const BACKUP_INTERVAL = 21600000;  // 6 小時
```

### 改變備份保留時間

編輯 `src/services/backupService.js`：

```javascript
// 保留 14 天
const RETENTION_DAYS = 14;

// 或保留 30 天
const RETENTION_DAYS = 30;
```

### 改變備份存儲位置

編輯 `src/services/backupService.js`：

```javascript
// 改為存儲在外部路徑
const BACKUP_DIR = '/mnt/backups/inventory';
```

同時在 `docker-compose.yml` 中添加 volume：

```yaml
volumes:
  - /mnt/backups/inventory:/mnt/backups/inventory
```

## 監控和告警

### 檢查備份狀態

```bash
# 查看最新備份
ls -lh database/backups/ | tail -5

# 檢查備份大小趨勢
du -sh database/backups/

# 統計備份數量
ls database/backups/ | wc -l
```

### 集成到監控系統

可以通過解析日誌來集成：

```bash
# 監控備份成功率
docker logs inventory-system | grep "✓ 備份成功" | wc -l

# 監控備份失敗
docker logs inventory-system | grep "✗ 備份失敗"

# 監控清理動作
docker logs inventory-system | grep "刪除舊備份"
```

## 最佳實踐

### ✅ 應該做的

1. **定期檢查備份**
   ```bash
   # 設置週期性檢查
   ls -lh database/backups/
   ```

2. **監控磁盤空間**
   ```bash
   df -h database/
   ```

3. **定期測試恢復**
   - 每月至少測試一次備份恢復
   - 確保備份文件確實可用

4. **保存外部備份**
   ```bash
   # 定期複製到外部存儲
   cp -r database/backups/ /external-storage/backups_$(date +%Y%m%d)
   ```

### ❌ 不應該做的

1. ❌ 刪除 `backups/` 目錄
2. ❌ 手動修改備份文件
3. ❌ 在備份運行中重啟應用
4. ❌ 修改 `BACKUP_INTERVAL` 為 0（禁用備份）

## 性能考慮

### 備份對應用的影響

- **CPU** — 最小（SQLite 備份是順序讀）
- **內存** — 最小（備份進程獨立）
- **磁盤 I/O** — 中等（需要讀整個數據庫）
- **應用性能** — 無影響（非阻塞備份）

### 優化建議

如果備份過程影響應用：

```javascript
// 改為凌晨備份（例如每天 2:00am）
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000;  // 每 24 小時
// 然後在應用啟動時不立即備份
```

修改 `startBackupDaemon()`：

```javascript
function startBackupDaemon() {
  ensureBackupDir();
  // performBackup();  // 註釋掉立即備份
  
  // 在下一個整點執行第一次備份
  scheduleNextBackup();
  
  setInterval(performBackup, BACKUP_INTERVAL);
}
```

## 相關文件

- `src/services/backupService.js` — 備份服務實現
- `server.js` — 應用啟動時調用備份服務
- `docker-compose.yml` — 數據庫卷配置
- `database/backups/` — 備份存儲目錄

## 更新歷史

- **2026-05-14** — 從 shell 腳本遷移到 Node.js 服務
