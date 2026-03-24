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

### 方法 A：使用輔助腳本 (推薦)
Agent 可以執行以下命令來獲取庫存快照：
```bash
node skills/inventory_query/scripts/query_inventory.js [參數]
```

**參數選項：**
- `--host <IP>`：庫房伺服器的 IP 位址 (預設使用腳本內的 `DEFAULT_HOST` 變數)
- `--sku <SKU>`：搜尋特定 SKU
- `--name <NAME>`：根據名稱過濾
- `--limit <NUMBER>`：回傳數量上限 (默認 100)

> [!TIP]
> 您可以直接修改 `query_inventory.js` 檔案頂部的 `DEFAULT_HOST` 變數，這樣之後就不需要每次都輸入 `--host` 參數。

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
