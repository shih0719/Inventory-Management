# Claude Code MCP 伺服器設置指南

## 快速設置（5 分鐘）

### 1️⃣ 啟動 MCP 伺服器

在專案根目錄執行：

```bash
node mcp/server.js
```

看到這個訊息表示成功：

```
✅ Inventory MCP Server 運行在 http://localhost:3001
📡 連接到 API: http://localhost:3000
```

**讓此終端保持運行**（最小化但不關閉）。

---

### 2️⃣ 配置 Claude Code

編輯 `C:\Users\eyeye\.claude\settings.json`：

找到 `mcpServers` 區塊（若無則新增）：

```json
{
  "mcpServers": {
    "inventory": {
      "command": "node",
      "args": [
        "C:\\Users\\eyeye\\Documents\\code_test\\Inventory-Management\\mcp\\server.js"
      ],
      "env": {
        "INVENTORY_API_HOST": "localhost",
        "INVENTORY_API_PORT": "3000"
      }
    }
  }
}
```

**重要**：
- `C:\` 要改成你的實際路徑
- 在 JSON 中，路徑用 `\\` 或 `/`

---

### 3️⃣ 重啟 Claude Code

完全退出 Claude Code，再重新打開。

Claude Code 應自動連接 MCP 伺服器。

---

## 測試連接

在 Claude Code 中輸入：

```
查一下 SKU-001 的庫存
```

Agent 應執行 `query-products` 工具並返回結果。

若看到錯誤，見下方「疑難排查」。

---

## 疑難排查

### ❌ 錯誤：MCP 伺服器無法連接

**檢查**：
1. 終端中的 MCP 伺服器是否還在運行？
   - 若已停止，重新執行 `node mcp/server.js`

2. 健康檢查：
   ```bash
   curl http://localhost:3001/health
   ```
   應返回：`{"status":"ok","api":"localhost:3000"}`

3. Inventory API 是否在運行？
   ```bash
   npm run dev
   ```
   或根據你的部署方式啟動 API

### ❌ 錯誤：settings.json 語法錯誤

檢查 JSON 是否有效（用 VS Code 的 JSON 驗證）。

常見錯誤：
- 路徑中單個反斜線 `\`（應為 `\\` 或 `/`）
- 末尾多逗號
- 漏掉引號

### ❌ 工具呼叫失敗「API連線失敗」

**原因**：MCP 伺服器無法連接到實際的 Inventory API

**檢查**：
```bash
curl http://localhost:3000/health
```

若失敗，確認 API 在運行（通常 `npm run dev`）

---

## 多終端運行

需要同時運行 Inventory API 和 MCP 伺服器：

**終端 1 - API 伺服器**：
```bash
npm run dev
```

**終端 2 - MCP 伺服器**：
```bash
node mcp/server.js
```

**Claude Code**：開放即可使用

---

## 什麼時候啟動 MCP？

| 場景 | 做法 |
|------|------|
| 日常開發，有 Claude Code 參與 | 啟動 MCP + API |
| 只用命令列工具（skills/ 下的 CLI） | 不需 MCP，直接用命令列 |
| 在 VS Code 編輯，Claude Code 擴展掛著 | MCP 保持運行 |
| Claude Code IDE 中工作 | MCP 必須運行 |

---

## 環境變數

若要連接到其他 IP（例如測試伺服器），編輯 `mcp/.env`：

```env
INVENTORY_API_HOST=192.168.1.100
INVENTORY_API_PORT=3000
MCP_PORT=3001
```

重啟 MCP 伺服器即生效。

---

## 進階

### 檢查 MCP 伺服器日誌

MCP 伺服器的終端會輸出所有請求與錯誤。若 Claude Code 無法執行工具，查看終端輸出找線索。

### 新增自定義工具

編輯 `mcp/server.js`：

1. 在 `TOOLS` 物件中加入工具定義
2. 在 `executeTool()` 中加入實現
3. 重啟 MCP 伺服器

新工具立即可用，無需改 Claude Code 設定。

### 與命令列工具並行

MCP 和 `skills/` 中的 CLI 工具可共存：
- MCP：用於 Claude Code agents
- CLI：用於人類手動執行或自動化腳本

兩者都連接同一個 API。

---

## 下一步

現在 Claude Code agents 可以：
- ✅ 查詢產品與庫存
- ✅ 建立異動與批次
- ✅ 管理產品與序號品

嘗試這些指令：

```
查詢庫存不足的產品

進貨 100 件到產品 ID 1

建立新產品 SKU-TEST，名稱「測試品」

查詢 SKU-001 的詳細資訊
```

更多工具見 [`README.md`](README.md)。
