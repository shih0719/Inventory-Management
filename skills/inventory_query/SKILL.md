---
name: inventory_query
description: 查詢庫存系統中的產品列表與剩餘庫存數量。
---

# Inventory Query Skill

此 Skill 允許 Agent 透過 API 查詢庫存系統中的產品資訊。

## 核心功能
1. **取得所有產品**：獲取目前庫房內所有非刪除狀態的產品列表。
2. **根據 SKU 查詢**：精確查找特定編號的產品庫存。
3. **過濾條件**：支持透過名稱 (name) 或標籤 (tag) 進行模糊搜尋。

## 使用方式

### 前提條件：設置伺服器 IP

此 skill 會自動讀取伺服器配置，優先級如下：
1. **命令行參數** (`--host`) — 最優先
2. **`.env` 檔案** — 其次
3. **系統環境變數** — 再其次
4. **預設值** (`localhost`) — 最後

**推薦做法：編輯 `.env` 檔案**

```bash
# 第一次使用時，複製範本
cp skills/inventory_query/.env.example skills/inventory_query/.env

# 編輯為你的伺服器 IP
nano skills/inventory_query/.env
# INVENTORY_API_HOST=192.168.1.100
```

其他方式：
```bash
# 方法 2：系統環境變數
export INVENTORY_API_HOST=192.168.1.100

# 方法 3：命令行參數（臨時覆蓋）
node skills/inventory_query/scripts/query_inventory.js --host 192.168.1.100
```

### 執行查詢

Agent 可以執行以下命令來獲取庫存快照：
```bash
node skills/inventory_query/scripts/query_inventory.js [參數]
```

**參數選項：**
- `--host <IP>`：覆蓋伺服器地址（可選）
- `--sku <SKU>`：搜尋特定 SKU
- `--name <NAME>`：根據名稱過濾
- `--limit <NUMBER>`：回傳數量上限 (默認 100)

### 方法 B：直接調用 API (cURL)
如果環境支援 cURL，可以執行（請將 `<SERVER_IP>` 替換為實際 IP）：
```bash
curl http://192.168.23.16:3000/api/products
```

## 輸出格式
API 將回傳 JSON 格式數據，包含：
- `sku`: 產品編碼
- `name`: 產品名稱
- `accountable_quantity`: 有帳庫存
- `non_accountable_quantity`: 無帳庫存
- `type`: 產品類別
- `model`: 型號

---

## 與 inventory_operations 配合使用

此 Skill 用於**查詢**庫存，要執行**操作**（創建異動、批次、產品等），請使用相關的 Skill：

### 📚 相關 Skills

- **[inventory_operations](../inventory_operations/SKILL.md)** — 執行異動、批次、產品管理、序號品管理、CSV 導入等操作

### 🔄 常見工作流

1. 用 `inventory_query` 查詢目前庫存
2. 用 `inventory_operations` 執行操作（進出貨、批次等）
3. 再用 `inventory_query` 驗證結果
