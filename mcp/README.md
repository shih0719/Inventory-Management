# Inventory Management MCP Server

MCP (Model Context Protocol) 伺服器，讓 Claude Code agents 可以連接本地 Inventory Management 系統。

## 為什麼用 MCP？

- ✅ **繞過沙盒限制** — Claude Code skills 在沙盒運行，無法連接本地服務；MCP 伺服器運行在你的機器上，可連接任何本地服務
- ✅ **可靠的工具介面** — 結構化、型別檢查、錯誤處理
- ✅ **易於擴展** — 新增工具無需改 Claude Code 配置
- ✅ **支援多客戶端** — 可供多個 LLM 應用使用

## 安裝

### 步驟 1：設置環境變數

```bash
cp mcp/.env.example mcp/.env
```

編輯 `mcp/.env`，設置你的 API 伺服器地址：

```env
INVENTORY_API_HOST=localhost
INVENTORY_API_PORT=3000
MCP_PORT=3001
```

### 步驟 2：安裝依賴

```bash
cd mcp
npm install dotenv
```

或在專案根目錄：

```bash
npm install dotenv
```

### 步驟 3：啟動 MCP 伺服器

```bash
node mcp/server.js
```

應看到：

```
✅ Inventory MCP Server 運行在 http://localhost:3001
📡 連接到 API: http://localhost:3000
```

### 步驟 4：在 Claude Code 中配置

編輯 `C:\Users\eyeye\.claude\settings.json`，加入 MCP 伺服器設定：

```json
{
  "mcpServers": {
    "inventory": {
      "command": "node",
      "args": ["C:\\Users\\eyeye\\Documents\\code_test\\Inventory-Management\\mcp\\server.js"],
      "env": {
        "INVENTORY_API_HOST": "localhost",
        "INVENTORY_API_PORT": "3000"
      }
    }
  }
}
```

**注意**：
- `command` 應指向 `node` 可執行檔
- `args` 應為 MCP server 指令碼的絕對路徑
- `env` 可選，會覆蓋 `.env` 檔案中的值

### 步驟 5：重啟 Claude Code

設定後，Claude Code 會自動連接 MCP 伺服器。重啟 Claude Code 應看到：

```
連接到 MCP 伺服器: inventory
```

## 使用

### 直接呼叫工具

在 Claude Code 中，agents 現在可以呼叫這些工具：

```
我: "查詢 SKU-001 的庫存"
Agent 執行: 
  Tool: query-products
  Input: { "sku": "SKU-001" }
  Output: { "products": [...], "pagination": {...} }

我: "進貨 50 件產品 ID 1"
Agent 執行:
  Tool: create-transaction
  Input: { 
    "product_id": 1, 
    "quantity_change": 50,
    "quantity_type": "accountable",
    "tag_id": 1
  }
  Output: { "transaction_id": 123, ... }
```

### 可用工具列表

| 工具 | 功能 | 參數 |
|------|------|------|
| `query-products` | 查詢產品列表 | sku, name, page, limit |
| `get-product` | 取得單個產品詳細資訊 | product_id |
| `query-low-stock` | 查詢庫存不足的產品 | page, limit |
| `create-transaction` | 建立庫存異動 | product_id, quantity_change, quantity_type, tag_id, remarks |
| `create-batch` | 批量建立異動 | items (array) |
| `create-product` | 新增產品 | sku, name, type, model, track_serial, min_stock |
| `update-product` | 更新產品 | product_id, name, type, model, min_stock |
| `bulk-create-units` | 批量建立序號品 | product_id, serial_numbers |
| `bulk-sell-units` | 批量出售序號品 | items (array) |

詳細參數說明見 `server.js` 中的 `TOOLS` 定義。

## 疑難排查

### 問題：Claude Code 無法連接 MCP 伺服器

**檢查清單**：
1. MCP 伺服器是否運行？
   ```bash
   curl http://localhost:3001/health
   ```
   應看到 `{"status": "ok", "api": "localhost:3000"}`

2. `.claude/settings.json` 中的路徑是否正確？
   - Windows 路徑應使用 `\\` 或 `/`（不是 `\`）
   - 相對路徑不支持，用絕對路徑

3. Node.js 是否安裝？
   ```bash
   node --version
   ```

### 問題：工具執行失敗「API連線失敗」

**原因**：MCP 伺服器無法連接到 Inventory API

**解決**：
1. 確認 Inventory API 在運行：
   ```bash
   curl http://localhost:3000/health
   ```

2. 檢查 `INVENTORY_API_HOST` 和 `INVENTORY_API_PORT` 是否正確：
   ```bash
   cat mcp/.env
   ```

3. 若用不同 IP/端口，編輯 `mcp/.env` 並重啟 MCP 伺服器

### 問題：工具參數類型錯誤

確保參數類型符合定義：
- `product_id` 應是數字，不是字符串
- `quantity_change` 應是數字（正=進，負=出）
- `serial_numbers` 應是陣列 `["SN-001", "SN-002"]`

## 開發

### 新增工具

1. 在 `TOOLS` 物件中定義工具：
   ```javascript
   'new-tool': {
     description: '工具說明',
     inputSchema: {
       type: 'object',
       properties: {
         param1: { type: 'string', description: '參數說明' },
       },
       required: ['param1'],
     },
   }
   ```

2. 在 `executeTool()` 中實現邏輯：
   ```javascript
   case 'new-tool': {
     return await callAPI('POST', '/api/endpoint', { ... });
   }
   ```

3. 重啟 MCP 伺服器，新工具自動可用

### 日誌和除錯

MCP 伺服器輸出詳細的錯誤訊息。查看終端輸出排查問題。

若要新增自定義日誌，修改 `server.js` 中的相關函式。

## 架構

```
Claude Code (IDE)
     ↓
MCP Client (內建)
     ↓
MCP Server (node mcp/server.js)
     ↓
Inventory API (http://localhost:3000)
```

流程：
1. 使用者在 Claude Code 中輸入指令
2. Agent 決定使用哪個工具（基於工具定義）
3. Claude Code 的 MCP Client 發送請求到 MCP Server
4. MCP Server 執行工具，呼叫 Inventory API
5. 結果回傳給 Agent，Agent 理解並報告給使用者

## 相關文檔

- [`../docs/API.md`](../docs/API.md) — 完整 API 參考
- [`../CONTEXT.md`](../CONTEXT.md) — 領域術語
- [`../docs/improve.md`](../docs/improve.md) — 架構改進建議

## 許可

MIT
