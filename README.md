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

## 🗄️ 數據庫架構

### Products（產品表）

- `id`, `type`, `sku`, `name`, `model`
- `is_accountable` (有帳/無帳)
- `quantity` (當前庫存)
- `is_deleted` (軟刪除標記)

### Tags（標籤表 - 預定義）

- 入庫、出庫、調撥、盤點、損壞、報廢、退貨、借出、歸還、調整

### Transactions（交易記錄表）

- `product_id`, `tag_id`, `quantity_change`
- `remarks` (說明欄)
- `created_at` (時間戳)

## 🌐 API 端點

### 產品管理

- `GET /api/products` - 獲取產品列表（支持過濾）
- `GET /api/products/:id` - 獲取單個產品
- `POST /api/products` - 新增產品
- `PUT /api/products/:id` - 更新產品
- `DELETE /api/products/:id` - 刪除產品（軟刪除）

### 交易記錄

- `GET /api/transactions` - 獲取所有交易
- `GET /api/transactions/product/:productId` - 獲取產品交易歷史
- `POST /api/transactions` - 創建新交易（自動更新庫存）

### 標籤

- `GET /api/tags` - 獲取所有預定義標籤

### CSV 功能

- `POST /api/csv/import` - 匯入 CSV 文件
- `GET /api/csv/export` - 匯出庫存為 CSV

## 📝 CSV 格式規範

### 欄位順序

```csv
SKU,Name,Type,Model,IsAccountable,Quantity
SKU-001,筆記型電腦,電子產品,Dell XPS 15,1,10
SKU-002,無線滑鼠,配件,Logitech MX Master,true,50
```

### 欄位說明

- **SKU**：產品編碼（必填，唯一）
- **Name**：產品名稱（必填）
- **Type**：產品類型（必填）
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
