#!/bin/bash

# SQLite 定期備份腳本
# 每小時運行一次，保留最近 7 天的備份

BACKUP_DIR="./database/backups"
DB_PATH="./database/inventory.db"
RETENTION_DAYS=7
BACKUP_INTERVAL=3600  # 1 小時（秒）

# 建立備份目錄
mkdir -p "$BACKUP_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] SQLite 備份守護程序已啟動"

while true; do
  # 檢查資料庫是否存在
  if [ -f "$DB_PATH" ]; then
    # 生成時間戳
    TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
    BACKUP_FILE="$BACKUP_DIR/inventory.backup_${TIMESTAMP}.db"

    # 備份資料庫（使用 sqlite3 .backup 命令確保一致性）
    sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'" 2>/dev/null

    if [ $? -eq 0 ]; then
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ 備份成功: $BACKUP_FILE"
    else
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✗ 備份失敗: $BACKUP_FILE"
    fi

    # 清理舊備份（保留 N 天）
    find "$BACKUP_DIR" -name "inventory.backup_*.db" -type f -mtime +$RETENTION_DAYS -delete

    OLD_COUNT=$(find "$BACKUP_DIR" -name "inventory.backup_*.db" -type f | wc -l)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 當前備份數量: $OLD_COUNT 個"
  else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠ 資料庫未找到: $DB_PATH"
  fi

  # 等待下一個備份週期
  sleep $BACKUP_INTERVAL
done
