#!/bin/bash

# 系統更新腳本
# 用於容器內執行更新，只停止 Node.js 進程，不停止容器

set -e  # 發生錯誤時立即退出

# 確保在正確的目錄執行
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "=========================================="
log "開始系統更新流程"
log "=========================================="

# 1. 停止 Node.js 進程（不停止容器）
log "步驟 1: 停止 Node.js 進程..."
pkill -f "node.*server.js" 2>/dev/null || log "⚠️  Node.js 進程未運行"
sleep 2

# 2. 執行 git 更新
log "步驟 2: 更新代碼..."
if ! git fetch origin --quiet; then
  log "❌ git fetch 失敗"
  exit 1
fi

if ! git reset --hard origin/main; then
  log "❌ git reset 失敗"
  exit 1
fi

log "✓ 代碼更新完成"

# 3. 安裝依賴
log "步驟 3: 安裝依賴..."
if ! npm install --production --no-audit --no-fund; then
  log "⚠️  npm install 出現警告，但繼續執行"
fi

log "✓ 依賴安裝完成"

# 4. 重啟 Node.js 進程
log "步驟 4: 重啟 Node.js..."
cd "$SCRIPT_DIR"
node server.js > /dev/null 2>&1 &
sleep 2
log "✓ Node.js 已啟動"

log "=========================================="
log "✓ 更新完成！"
log "=========================================="
