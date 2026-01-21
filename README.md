# 庫房管理系統 (Inventory Management System)

現代化 SQLite 基礎庫存管理系統，提供完整的產品管理、庫存異動追蹤與 CSV 導入導出功能。

## 🚀 功能特色

- ✅ **產品管理**：新增、編輯、刪除產品（軟刪除保留歷史）
- 📊 **庫存追蹤**：即時庫存數量管理，支持有帳/無帳分類
- 🏷️ **預定義標籤**：10 種庫存異動標籤（入庫、出庫、調撥、盤點等）
- 📝 **交易歷史**：完整記錄每筆異動，包含時間戳、標籤、說明
- 📤 **CSV 導入導出**：批次匯入產品資料，匯出當前庫存快照
- 🔍 **即時過濾**：根據 SKU、標籤、帳務狀態快速檢索
- 📱 **響應式設計**：桌面表格 + 移動端卡片式佈局自適應
- 🎨 **現代化 UI**：清新藍色調 (#3B82F6)，圓角陰影設計

## 📋 技術棧

### 後端

- **Node.js** + **Express** 4.x
- **SQLite3** 5.x (數據持久化)
- **csv-parser** + **csv-writer** (CSV 處理)
- **multer** (文件上傳)

### 前端

- **HTML5** + **Tailwind CSS** 3.x
- **Vanilla JavaScript** (ES6+)
- 單頁應用架構 (SPA)

## 🛠️ 安裝與啟動

### 1. 安裝依賴

```bash
npm install
```

### 2. 啟動開發服務器

```bash
npm run dev
```

或生產模式：

```bash
npm start
```

### 3. 訪問應用

瀏覽器打開：`http://localhost:3000`

## 📁 專案結構

```
inventory-management-system/
├── server.js                    # Express 服務器入口
├── package.json
├── .env                         # 環境變數配置
├── .gitignore
│
├── src/
│   ├── config/
│   │   └── database.js         # SQLite 連接與初始化
│   │
│   ├── controllers/            # 業務邏輯層
│   │   ├── productsController.js
│   │   ├── transactionsController.js
│   │   ├── tagsController.js
│   │   └── csvController.js
│   │
│   └── routes/                 # API 路由定義
│       ├── products.js
│       ├── transactions.js
│       ├── tags.js
│       └── csv.js
│
├── database/
│   ├── schema.sql              # 數據庫架構定義
│   ├── seeds.sql               # 種子數據（標籤）
│   ├── sample.csv              # 範例 CSV 文件
│   └── inventory.db            # SQLite 數據庫（自動生成）
│
├── public/                     # 前端靜態文件
│   ├── index.html
│   └── js/
│       └── app.js
│
└── uploads/                    # CSV 上傳臨時目錄
```

## 🗄️ 数据库架构

### Products（产品表）

- `id` (主键)
- `type` (类型)
- `sku` (产品编码，**UNIQUE**)
- `name` (名称)
- `model` (型号)
- `accountable_quantity` (有帐库存数量)
- `non_accountable_quantity` (无帐库存数量)
- `is_deleted` (软删除标记)
- `created_at`, `updated_at` (时间戳)

**重要改变：**

- SKU 现在是唯一的（每个 SKU 只有一条记录）
- 使用两个数量字段分别追踪有帐和无帐库存
- 移除了 `is_accountable` 字段

### Tags（标签表 - 预定义）

- 入库、出库、调拨、盘点、损坏、报废、退货、借出、归还、调整

### Batches（批次表）

- `id` (主键)
- `batch_number` (批次编号，UNIQUE)
- `description` (描述)
- `created_at` (时间戳)

### Transactions（交易记录表）

- `product_id`, `tag_id`, `batch_id` (外键)
- `quantity_change` (数量变化)
- `remarks` (说明栏，包含有帐/无帐标识)
- `created_at` (时间戳)

## 🌐 API 端點

### 產品管理

- `GET /api/products` - 獲取產品列表（支持過濾）
- `GET /api/products/:id` - 獲取單個產品
- `POST /api/products` - 新增產品
- `PUT /api/products/:id` - 更新產品
- `DELETE /api/products/:id` - 刪除產品（軟刪除）

### 交易记录

- `GET /api/transactions` - 获取所有交易
- `GET /api/transactions/product/:productId` - 获取产品交易历史
- `POST /api/transactions` - 创建新交易（自动更新库存，**需要指定 quantity_type: 'accountable' 或 'non_accountable'**）

### 批次交易

- `GET /api/batches` - 获取所有批次
- `GET /api/batches/:id` - 获取单个批次详情
- `POST /api/batches` - 创建批次交易（多产品同时异动，**每个产品需指定 quantity_type**）

### 標籤

- `GET /api/tags` - 獲取所有預定義標籤

### CSV 功能

- `POST /api/csv/import` - 匯入 CSV 文件
- `GET /api/csv/export` - 匯出庫存為 CSV

## 📝 CSV 格式規範

### 欄位順序

```csv
SKU,Name,Type,Model,IsAccount,NoAccount
SKU-001,筆記型電腦,電子產品,Dell XPS 15,10,5
SKU-002,無線滑鼠,配件,Logitech MX Master,50,30
SKU-003,USB-C 轉接頭,配件,Anker A8342,0,100
```

### 欄位說明

- **SKU**：產品編碼（必填）
- **Name**：產品名稱（必填）
- **Type**：產品類型（必填）
- **Model**：型號（選填）
- **IsAccount**：有帳庫存數量（必填，沒有填 0）
- **NoAccount**：無帳庫存數量（必填，沒有填 0）

### 重要说明

- **每个 SKU 现在只有一条记录**，包含有帐和无帐两个数量字段
- CSV 中一行数据包含同一 SKU 的有帐和无帐两种数量
- 导入时，系统会将数据存储到 `accountable_quantity` 和 `non_accountable_quantity` 字段
- 导出时，直接输出产品的两个数量字段
- 如果只需要有帐或无帐其中一种，另一栏填 0 即可
- 编码格式必须使用 **ANSI (Big5)** 以正确显示繁体中文

## 🎨 設計規範

- **Model**：型號（選填）
- **IsAccountable**：有帳狀態（`1`/`true` 或 `0`/`false`）
- **Quantity**：庫存數量

## 🎨 設計規範

- **主色調**：清新藍色 `#3B82F6`
- **圓角**：`border-radius: 8px`
- **陰影**：`box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1)`
- **響應式斷點**：`768px`（移動端 ↔ 桌面端）

## 🔒 安全考量

- **單用戶設計**：無需身份驗證
- **參數化查詢**：防止 SQL 注入
- **軟刪除**：保留交易歷史，避免數據丟失
- **文件驗證**：CSV 上傳限制大小與格式

## 📄 授權

MIT License

---

**開發完成時間**：2026 年 1 月
**技術支持**：基於 Node.js + Express + SQLite + Tailwind CSS
