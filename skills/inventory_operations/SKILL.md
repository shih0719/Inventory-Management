---
name: inventory_operations
description: 對庫存系統進行異動、批次、產品管理等操作
---

# Inventory Operations Skill

此 Skill 允許 Agents 對庫存系統執行完整的操作（創建、更新、刪除、批量處理）。

## 核心功能

1. **異動管理** — 記錄庫存進出（入庫、出貨、調整）
2. **批次操作** — 批量建立多筆異動
3. **產品管理** — 建立、更新、刪除產品
4. **序號品管理** — 建立、出售、追蹤序號品（AP）
5. **批量導入** — 從 CSV 匯入產品或異動

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
cp skills/inventory_operations/.env.example skills/inventory_operations/.env

# 編輯為你的伺服器 IP
nano skills/inventory_operations/.env
# INVENTORY_API_HOST=192.168.1.100
# INVENTORY_API_PORT=3000
```

其他方式：
```bash
# 方法 2：系統環境變數（全局有效）
export INVENTORY_API_HOST=192.168.1.100
export INVENTORY_API_PORT=3000

# 方法 3：命令行參數（臨時覆蓋）
node scripts/create_transaction.js --product-id 1 --quantity 10 --type accountable --tag-id 1 --host 192.168.1.100
```

### 驗證伺服器連接
```bash
# 檢查伺服器是否可連接
curl http://your-ip:3000/api/health
```

---

## 操作手冊

### 1️⃣ 創建異動記錄

**用途**：記錄庫存進出（進貨、出貨、調整）

```bash
node skills/inventory_operations/scripts/create_transaction.js \
  --product-id 1 \
  --quantity 10 \
  --type accountable \
  --tag-id 1 \
  --remarks "進貨備註"
```

**參數**：
| 參數 | 必填 | 說明 |
|------|------|------|
| `--product-id` | ✓ | 產品 ID |
| `--quantity` | ✓ | 數量變化（正數=進，負數=出） |
| `--type` | ✓ | `accountable` (有帳) 或 `non_accountable` (無帳) |
| `--tag-id` | ✓ | 標籤 ID（1=INBOUND, 2=OUTBOUND 等） |
| `--location-id` | N | 倉庫位置 ID |
| `--remarks` | N | 備註說明 |
| `--host` | N | 伺服器 IP（預設：DEFAULT_HOST） |

**例子**：
```bash
# 進貨 100 件
node skills/inventory_operations/scripts/create_transaction.js \
  --product-id 1 --quantity 100 --type accountable --tag-id 1 --remarks "供應商進貨"

# 出貨 50 件給客戶
node skills/inventory_operations/scripts/create_transaction.js \
  --product-id 1 --quantity -50 --type accountable --tag-id 2 --remarks "銷售出貨"
```

---

### 2️⃣ 批量操作（批次）

**用途**：一次建立多筆異動（如批量進貨或出貨）

```bash
node skills/inventory_operations/scripts/create_batch.js \
  --batch-name "5月進貨批次" \
  --items '
  [
    {"product_id": 1, "quantity": 10, "type": "accountable", "tag_id": 1, "remarks": "品項1"},
    {"product_id": 2, "quantity": 20, "type": "accountable", "tag_id": 1, "remarks": "品項2"}
  ]'
```

**參數**：
| 參數 | 必填 | 說明 |
|------|------|------|
| `--batch-name` | ✓ | 批次名稱 |
| `--items` | ✓ | JSON 陣列，每個元素是一筆異動 |
| `--host` | N | 伺服器 IP |

**例子**：
```bash
node skills/inventory_operations/scripts/create_batch.js \
  --batch-name "銷售出貨_20260518" \
  --items '[
    {"product_id": 1, "quantity": -5, "type": "accountable", "tag_id": 2},
    {"product_id": 3, "quantity": -2, "type": "accountable", "tag_id": 2}
  ]'
```

---

### 3️⃣ 創建/更新產品

**用途**：建立新產品或更新現有產品信息

```bash
# 建立新產品
node skills/inventory_operations/scripts/manage_product.js \
  --action create \
  --sku SKU-NEW \
  --name "新產品名稱" \
  --type normal \
  --model "型號" \
  --min-stock 5

# 更新產品
node skills/inventory_operations/scripts/manage_product.js \
  --action update \
  --product-id 1 \
  --name "更新後的名稱" \
  --min-stock 10

# 刪除產品（軟刪除）
node skills/inventory_operations/scripts/manage_product.js \
  --action delete \
  --product-id 1
```

**參數**（create）：
| 參數 | 必填 | 說明 |
|------|------|------|
| `--sku` | ✓ | SKU 編碼（唯一） |
| `--name` | ✓ | 產品名稱 |
| `--type` | ✓ | `normal` 或 `ap` (序號品) |
| `--model` | ✓ | 型號 |
| `--min-stock` | N | 最低庫存（預設: 0） |
| `--host` | N | 伺服器 IP |

**參數**（update）：
| 參數 | 必填 | 說明 |
|------|------|------|
| `--product-id` | ✓ | 產品 ID |
| `--name` | N | 新名稱 |
| `--min-stock` | N | 新的最低庫存 |

**參數**（delete）：
| 參數 | 必填 | 說明 |
|------|------|------|
| `--product-id` | ✓ | 產品 ID |

---

### 4️⃣ 序號品管理（AP）

**用途**：建立和管理需要序號追蹤的產品

```bash
# 批量建立序號品
node skills/inventory_operations/scripts/manage_units.js \
  --action bulk-create \
  --product-id 1 \
  --count 5 \
  --prefix "SN"

# 標記序號品為已出售
node skills/inventory_operations/scripts/manage_units.js \
  --action bulk-sell \
  --items '[
    {"id": 1, "sold_to": "客戶A", "project_case": "案件001"},
    {"id": 2, "sold_to": "客戶B", "project_case": "案件002"}
  ]'

# 查詢序號品
node skills/inventory_operations/scripts/manage_units.js \
  --action list \
  --product-id 1 \
  --status in_stock
```

**參數**（bulk-create）：
| 參數 | 必填 | 說明 |
|------|------|------|
| `--product-id` | ✓ | 產品 ID |
| `--count` | ✓ | 建立數量 |
| `--prefix` | N | 序號前綴（預設: SN） |

**參數**（bulk-sell）：
| 參數 | 必填 | 說明 |
|------|------|------|
| `--items` | ✓ | JSON 陣列 `[{id, sold_to, project_case}, ...]` |

**參數**（list）：
| 參數 | 必填 | 說明 |
|------|------|------|
| `--product-id` | N | 按產品篩選 |
| `--status` | N | `in_stock`, `sold`, `returned` |
| `--limit` | N | 回傳數量（預設: 50） |

---

### 5️⃣ CSV 導入

**用途**：批量導入產品或異動記錄

```bash
# 導入產品 CSV
node skills/inventory_operations/scripts/csv_import.js \
  --type products \
  --file path/to/products.csv

# 導入異動記錄
node skills/inventory_operations/scripts/csv_import.js \
  --type transactions \
  --file path/to/transactions.csv
```

**參數**：
| 參數 | 必填 | 說明 |
|------|------|------|
| `--type` | ✓ | `products` 或 `transactions` |
| `--file` | ✓ | CSV 檔案路徑 |
| `--host` | N | 伺服器 IP |

**CSV 格式 - 產品**：
```csv
sku,name,type,model,accountable_quantity,non_accountable_quantity,min_stock
SKU-001,筆記型電腦,ap,X1,0,0,5
SKU-002,滑鼠,normal,M1,100,50,10
```

**CSV 格式 - 異動**：
```csv
product_id,quantity_change,quantity_type,tag_id,remarks
1,10,accountable,1,進貨
2,20,accountable,1,進貨
1,-5,accountable,2,出貨
```

---

## 常見操作範例

### 完整的進貨流程

```bash
# 1. 建立新產品
node skills/inventory_operations/scripts/manage_product.js \
  --action create \
  --sku LAPTOP-2024 \
  --name "筆記型電腦 2024 款" \
  --type ap \
  --model "X1 Pro" \
  --min-stock 5

# 2. 批量建立序號品（假設上面建立的產品 ID 為 10）
node skills/inventory_operations/scripts/manage_units.js \
  --action bulk-create \
  --product-id 10 \
  --count 10 \
  --prefix "LAPTOP-2024"

# 3. 記錄進貨異動
node skills/inventory_operations/scripts/create_transaction.js \
  --product-id 10 \
  --quantity 10 \
  --type accountable \
  --tag-id 1 \
  --remarks "供應商進貨，合約編號 PO-20260518"
```

### 完整的出貨流程

```bash
# 1. 查詢在庫序號品
node skills/inventory_operations/scripts/manage_units.js \
  --action list \
  --product-id 10 \
  --status in_stock

# 2. 標記序號品為已出售
node skills/inventory_operations/scripts/manage_units.js \
  --action bulk-sell \
  --items '[
    {"id": 1, "sold_to": "客戶 ABC 公司", "project_case": "案件 #2024-001"},
    {"id": 2, "sold_to": "客戶 ABC 公司", "project_case": "案件 #2024-001"}
  ]'

# 3. 記錄出貨異動
node skills/inventory_operations/scripts/create_transaction.js \
  --product-id 10 \
  --quantity -2 \
  --type accountable \
  --tag-id 2 \
  --remarks "出貨給客戶 ABC 公司，發票編號 INV-20260518"
```

### 批量進貨

```bash
# 一次進貨多種產品
node skills/inventory_operations/scripts/create_batch.js \
  --batch-name "5月月度進貨" \
  --items '[
    {"product_id": 1, "quantity": 50, "type": "accountable", "tag_id": 1, "remarks": "筆記型電腦"},
    {"product_id": 2, "quantity": 100, "type": "accountable", "tag_id": 1, "remarks": "滑鼠"},
    {"product_id": 3, "quantity": 200, "type": "accountable", "tag_id": 1, "remarks": "鍵盤"}
  ]'
```

---

## 錯誤處理

所有腳本遇到錯誤時會輸出詳細信息。常見錯誤：

| 錯誤 | 原因 | 解決方案 |
|------|------|--------|
| `連線到伺服器失敗` | 伺服器未運行或 IP 錯誤 | 檢查伺服器、確認 DEFAULT_HOST 設定 |
| `無法出庫：庫存不足` | 出庫數量超過現有庫存 | 檢查目前庫存，減少出庫數量 |
| `產品不存在` | 產品 ID 錯誤 | 查詢 inventory_query skill 確認產品 ID |
| `標籤不存在` | tag_id 錯誤 | 標籤 ID 通常是 1(INBOUND), 2(OUTBOUND) |
| `參數缺失` | 必填參數未提供 | 檢查上表中 ✓ 的必填參數 |

---

## 提示與技巧

> [!TIP]
> **組合使用 inventory_query 和 inventory_operations**
> 
> 1. 用 `inventory_query` 查詢目前庫存
> 2. 用 `inventory_operations` 執行操作
> 3. 再用 `inventory_query` 驗證結果

> [!NOTE]
> **JSON 參數在 CLI 中的轉義**
> 
> 在 bash 中傳遞 JSON 時，確保正確轉義：
> ```bash
> # ✓ 正確 — 使用單引號包圍 JSON
> --items '[{"id": 1}]'
> 
> # ✗ 錯誤 — 直接貼 JSON，引號會被誤解
> --items [{"id": 1}]
> ```

> [!WARNING]
> **批量操作可能失敗**
> 
> 批次操作（create_batch）中，若有些項目失敗，其他項目仍會成功。
> 查看輸出結果確認哪些成功、哪些失敗。

---

## 相關資源

- **完整 API 文檔** — [`docs/API.md`](../../docs/API.md)
- **庫存查詢 Skill** — [`skills/inventory_query/`](../inventory_query/SKILL.md)
- **系統架構** — [`docs/improve.md`](../../docs/improve.md)
- **API 設計決策** — [`docs/adr/`](../../docs/adr/)
