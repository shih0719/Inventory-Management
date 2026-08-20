# 日誌系統文檔

## 概述

本項目使用 **Winston** 日誌庫進行日誌管理。所有應用日誌都會被自動記錄到 `logs/` 目錄。

## 日誌位置

```
logs/
├── app.log      # 所有日誌（info、warn、error）
└── error.log    # 僅錯誤日誌
```

## 日誌格式

日誌格式為：
```
YYYY-MM-DD HH:mm:ss [LEVEL] [SERVICE] 日誌信息
```

範例：
```
2026-05-14 16:27:46 [INFO] [UPDATE] Local version loaded: 1.1.0
2026-05-14 16:27:47 [ERROR] [BACKUP] 備份失敗: Command failed
```

## 日誌級別

- **INFO** — 正常信息（啟動、任務完成）
- **WARN** — 警告信息（可恢復的錯誤）
- **ERROR** — 錯誤信息（需要關注）

## 日誌輪轉

日誌文件會自動輪轉：
- **文件大小限制**：10MB
- **保留文件數**：10 個
- **自動清理**：舊日誌會被自動刪除

## 日誌來源（Service 標籤）

| Service | 用途 |
|---------|------|
| `[BACKUP]` | 數據庫備份與 Email 寄送 |
| `[SERVER]` | 服務器啟動和錯誤 |
| `[SYSTEM]` | 系統相關操作 |

## 導出和查看日誌

### 實時查看日誌
```bash
# Linux/Mac
tail -f logs/app.log

# Windows PowerShell
Get-Content logs/app.log -Wait
```

### 過濾特定服務的日誌
```bash
# 查看只有備份相關的日誌
grep "\[BACKUP\]" logs/app.log

# 查看只有錯誤日誌
cat logs/error.log
```

### 導出日誌到其他格式
```bash
# 複製到外部驅動器
cp logs/app.log /path/to/backup/

# 壓縮日誌
gzip logs/app.log
```

## 配置日誌級別

編輯 `.env` 文件或設置環境變數來改變日誌級別：

```
LOG_LEVEL=debug    # debug, info, warn, error
```

預設為 `info`。

## 環境變數

- `LOG_LEVEL` — 日誌級別（預設：`info`）

## 日誌配置文件

日誌配置位於 `src/config/logger.js`。如需自訂日誌行為，請編輯此文件。
