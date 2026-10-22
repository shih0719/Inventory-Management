# 系統架構圖 (Architecture)

本文件以 Mermaid 描述目前 Inventory Management 系統的程式碼結構與資料流向。

## 架構總覽

```mermaid
flowchart LR
    subgraph Client["前端 vite-app/ (React + TypeScript + Vite)"]
        A1[App.tsx / AppContent.tsx]
        A2[components/ 頁面元件]
        A3[api/ fetch wrapper + 各領域 API]
        A4[hooks/ useAppState · useAppHandlers · useAppHelpers]
        A5[context/ ActiveWarehouseContext]
    end

    subgraph Backend["後端 src/ (Node.js + Express)"]
        B0[server.js 進入點]
        B1[app.js Express app]
        B2[config/ database.js · logger.js]
        B3[public/ 靜態檔]
        B4[middleware/ authMiddleware]
        B5[routes/ 各資源路由]
        B6[controllers/ 業務邏輯]
        B7[services/ 服務層]
    end

    subgraph DB["資料層"]
        D1[(SQLite inventory.db)]
        D2[schema.sql / seeds.sql]
        D3[database/ 備份]
    end

    subgraph Infra["建置與部署"]
        I1[vite build → dist]
        I2[copy-frontend.js → public/]
        I3[PM2 / ecosystem.config.js]
    end

    A3 -- "fetch /api, Bearer token, X-Warehouse-Id" --> B1
    A1 --> A2
    A2 --> A3
    A2 --> A4
    A4 --> A5

    B0 --> B1
    B1 --> B4
    B1 --> B5
    B5 --> B6
    B6 --> B7
    B6 --> B2
    B7 --> B2
    B2 --> D1
    B1 -- "serve static" --> B3

    I1 --> I2
    I2 --> B3

    B1 --> B4
    B4 --> B5
```

## 分層說明

### 前端 (vite-app/)
- `App.tsx` / `AppContent.tsx`：應用外殼與視圖切換
- `components/`：各功能頁面（Dashboard、BatchFlow、AP 序號品、Shipments、Transactions 歷史、Reports、Audit Logs 等）
- `api/`：`client.ts` 統一 fetch wrapper，自動帶 `Authorization`（JWT）與 `X-Warehouse-Id`
- `hooks/`：`useAppState`、`useAppHandlers`、`useAppHelpers` 拆分狀態與行為
- `context/`：`ActiveWarehouseContext` 管理當前倉庫

### 後端 (src/)
- `server.js`：進入點，初始化 DB、啟動備份 daemon、graceful shutdown
- `app.js`：組裝 Express，掛載 middleware 與路由
  - 公開路由：`/api/health`、`/api/info`
  - 不需倉庫：`/api/auth`、`/api/warehouses`、`/api/users`、`/api/backup`
  - 需倉庫 context（`warehouseRouter`）：products、transactions、batches、shipments、tags、csv、product-units、audit-logs、reports
- `middleware/authMiddleware.js`：`verifyAuth`（JWT）、`requireRole`（admin/manager/view）、`requireWarehouse`
- `controllers/`：業務邏輯（Transaction Script 為主）
- `services/`：audit、auth、backup、quantityState、user、warehouse
- `config/`：database（含 migration）、logger（Winston）

### 資料層
- SQLite（WAL 模式），schema/seeds 位於 `database/`
- 自動備份機制

### 建置與部署
- `vite build` → `dist/` → `copy-frontend.js` 複製到 `public/`，由 Express 服務
- PM2（`ecosystem.config.js`）管理進程

## 主要請求流程

```mermaid
sequenceDiagram
    participant U as 使用者
    participant F as 前端 (vite-app)
    participant B as Express (src)
    participant M as Middleware
    participant D as SQLite

    U->>F: 操作介面
    F->>B: fetch /api/... (JWT + X-Warehouse-Id)
    B->>M: verifyAuth / requireWarehouse
    M-->>B: 通過驗證
    B->>B: routes → controllers
    B->>D: SQL 查詢 / 寫入
    D-->>B: 結果
    B-->>F: { success, data, pagination }
    F-->>U: 渲染結果
```

## 領域主要實體

- **Product（商品）**：SKU 唯一、有帳/無帳數量、min_stock、track_serial
- **Transaction（庫存異動）**：不可變歷史，記錄 quantity_change、quantity_type、tag、batch、shipment 關聯
- **AP / product_units（序號品）**：逐台追蹤 serial_number、status（in_stock / sold）
- **Shipment（出貨單據）**：`SHP-YYYYMMDD-XXX`，綁定多筆 Transaction
- **Warehouse / User / Role**：多倉庫隔離 + RBAC
