# Skills 庫存系統操作手冊

本資料夾包含 Claude Code Agents 用於操作庫存管理系統的各種 Skills。

## 📚 可用 Skills

### 1️⃣ inventory_query — 查詢庫存 ⭐ 基礎

**檔案**: [`inventory_query/SKILL.md`](inventory_query/SKILL.md)

**用途**: 查詢產品列表、庫存數量、搜尋特定產品

**主要功能**:
- 取得所有產品
- 按 SKU 或名稱搜尋
- 按標籤篩選
- 查詢庫存不足的產品

**範例**:
```bash
node skills/inventory_query/scripts/query_inventory.js --sku SKU-001
node skills/inventory_query/scripts/query_inventory.js --low-stock
```

---

### 2️⃣ inventory_operations — 執行操作 ⭐ 核心

**檔案**: [`inventory_operations/SKILL.md`](inventory_operations/SKILL.md)

**用途**: 執行完整的庫存操作（記錄異動、建立批次、管理產品等）

**主要功能**:
1. **異動管理** — 記錄進出貨、庫存調整
2. **批次操作** — 批量創建多筆異動
3. **產品管理** — 新增、更新、刪除產品
4. **序號品管理** — 建立、出售、追蹤序號品（AP）
5. **CSV 導入** — 從 CSV 檔案批量導入

**子命令**:
```bash
# 創建單筆異動
node scripts/create_transaction.js --product-id 1 --quantity 10 --type accountable --tag-id 1

# 批量操作（批次）
node scripts/create_batch.js --batch-name "進貨批次" --items '[{...}, {...}]'

# 產品管理
node scripts/manage_product.js --action create --sku SKU-NEW --name "產品名"

# 序號品管理
node scripts/manage_units.js --action bulk-create --product-id 1 --count 5

# CSV 導入
node scripts/csv_import.js --type products --file data.csv
```

---

## 🎯 快速開始

### 第一次使用？

**步驟 1：配置環境**

因為 `inventory_query` 和 `inventory_operations` 是分開的 skills，**每個 skill 各有自己的環境配置**。

**方法 A：使用 .env 檔案（推薦 ✅ 最簡單）**

```bash
# 為 inventory_query 設置
cp skills/inventory_query/.env.example skills/inventory_query/.env
nano skills/inventory_query/.env
# 改 INVENTORY_API_HOST=192.168.1.100

# 為 inventory_operations 設置
cp skills/inventory_operations/.env.example skills/inventory_operations/.env
nano skills/inventory_operations/.env
# 改 INVENTORY_API_HOST=192.168.1.100
```

或一個命令批量設置：
```bash
cd skills && \
cp inventory_query/.env.example inventory_query/.env && \
cp inventory_operations/.env.example inventory_operations/.env && \
sed -i 's/localhost/192.168.1.100/g' inventory_query/.env inventory_operations/.env
```

**方法 B：系統環境變數（永久）**

```bash
# Linux / Mac — 加入 ~/.bashrc 或 ~/.zshrc
export INVENTORY_API_HOST=192.168.1.100
export INVENTORY_API_PORT=3000

# Windows — 系統環境變數
INVENTORY_API_HOST=192.168.1.100
INVENTORY_API_PORT=3000
```

**方法 C：命令列參數（臨時，一次性）**

```bash
node skills/inventory_query/scripts/query_inventory.js --host 192.168.1.100
node skills/inventory_operations/scripts/create_transaction.js --host 192.168.1.100 ...
```

**步驟 2：確認伺服器運行**

```bash
# 應看到產品列表（連接成功）
node skills/inventory_query/scripts/query_inventory.js
```

**步驟 3：執行操作**

```bash
# 查詢
node skills/inventory_query/scripts/query_inventory.js --sku SKU-001

# 建立異動
node skills/inventory_operations/scripts/create_transaction.js \
  --product-id 1 --quantity 10 --type accountable --tag-id 1
```

---

## 📊 典型工作流

### 場景 1: 進貨

```bash
# 1. 查詢目前庫存
node skills/inventory_query/scripts/query_inventory.js --sku LAPTOP-001

# 2. 建立異動記錄（進貨 10 件）
node skills/inventory_operations/scripts/create_transaction.js \
  --product-id 1 \
  --quantity 10 \
  --type accountable \
  --tag-id 1 \
  --remarks "供應商進貨"

# 3. 驗證庫存已更新
node skills/inventory_query/scripts/query_inventory.js --sku LAPTOP-001
```

### 場景 2: 出貨

```bash
# 1. 查詢在庫序號品
node skills/inventory_operations/scripts/manage_units.js \
  --action list \
  --product-id 1 \
  --status in_stock

# 2. 標記為已出售
node skills/inventory_operations/scripts/manage_units.js \
  --action bulk-sell \
  --items '[{"id": 1, "sold_to": "客戶A", "project_case": "案件001"}]'

# 3. 記錄出貨異動
node skills/inventory_operations/scripts/create_transaction.js \
  --product-id 1 \
  --quantity -1 \
  --type accountable \
  --tag-id 2 \
  --remarks "出貨給客戶A"

# 4. 驗證庫存
node skills/inventory_query/scripts/query_inventory.js --sku LAPTOP-001
```

### 場景 3: 批量進貨

```bash
# 一次創建多筆異動
node skills/inventory_operations/scripts/create_batch.js \
  --batch-name "5月進貨批次" \
  --items '[
    {"product_id": 1, "quantity_change": 50, "quantity_type": "accountable", "tag_id": 1, "remarks": "品項1"},
    {"product_id": 2, "quantity_change": 100, "quantity_type": "accountable", "tag_id": 1, "remarks": "品項2"}
  ]'
```

---

## 🔧 參數快速參考

### create_transaction.js
| 參數 | 必填 | 說明 |
|------|------|------|
| `--product-id` | ✓ | 產品 ID |
| `--quantity` | ✓ | 數量變化（正=進，負=出） |
| `--type` | ✓ | `accountable` 或 `non_accountable` |
| `--tag-id` | ✓ | 標籤 ID（1=進貨, 2=出貨） |
| `--remarks` | N | 備註 |

### manage_units.js
| 動作 | 必填參數 | 說明 |
|------|---------|------|
| `bulk-create` | `--product-id`, `--count` | 批量建立序號品 |
| `bulk-sell` | `--items` (JSON) | 標記為已出售 |
| `list` | N | 查詢序號品 |

### manage_product.js
| 動作 | 必填參數 | 說明 |
|------|---------|------|
| `create` | `--sku`, `--name`, `--type`, `--model` | 建立產品 |
| `update` | `--product-id` | 更新產品 |
| `delete` | `--product-id` | 刪除產品 |

---

## 📖 完整文檔

- **[inventory_query](inventory_query/SKILL.md)** — 詳細查詢說明
- **[inventory_operations](inventory_operations/SKILL.md)** — 詳細操作說明
- **[API 文檔](../docs/API.md)** — 完整的 API 參考
- **[系統架構](../docs/improve.md)** — 系統設計與優化建議

---

## ⚠️ 常見問題

### Q: 如何快速切換伺服器 IP？

A: 因為有兩個獨立的 skills，**各 skill 有自己的 .env** 檔案：

```bash
# 方式 1：編輯各 skill 的 .env（推薦，永久生效）
nano skills/inventory_query/.env
nano skills/inventory_operations/.env

# 方式 2：批量修改（用 sed）
sed -i 's/localhost/192.168.1.100/g' skills/inventory_query/.env skills/inventory_operations/.env

# 方式 3：創建多個環境檔案，快速切換
cp skills/inventory_query/.env.example skills/inventory_query/.env.staging
# 編輯 .env.staging，然後：
cp skills/inventory_query/.env.staging skills/inventory_query/.env  # 切換到測試環境

# 方式 4：命令列參數（一次性覆蓋）
node skills/inventory_query/scripts/query_inventory.js --host 192.168.1.100

# 方式 5：系統環境變數（全局有效）
export INVENTORY_API_HOST=192.168.1.100
# 之後的所有 scripts 都會使用這個設定
```

### Q: 錯誤：連線到伺服器失敗
A: 確認伺服器在運行，檢查 IP 和連接埠（預設 3000）

### Q: 如何批量導入產品？
A: 準備 CSV 檔案，執行：
```bash
node skills/inventory_operations/scripts/csv_import.js --type products --file data.csv
```

### Q: 批次操作中某些項目失敗怎麼辦？
A: 批次會顯示成功和失敗的項目。檢查失敗原因（通常是庫存不足），手動修正後重試。

---

## 🤖 在 Claude Code 中使用

Agents 可以直接使用這些 skills：

```
我說: "查一下 SKU-001 的庫存"

Agent 執行: node skills/inventory_query/scripts/query_inventory.js --sku SKU-001

我說: "進貨 50 件"

Agent 執行: node skills/inventory_operations/scripts/create_transaction.js \
  --product-id 1 --quantity 50 --type accountable --tag-id 1
```

---

## 📝 版本記錄

- **v2.0** (2026-05-18) — 新增 inventory_operations skill，支援完整操作
- **v1.0** (2026-05-14) — 初始版本，僅支援查詢
