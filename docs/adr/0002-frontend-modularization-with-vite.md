# ADR 0002：前端現代化 — Vite + 中央狀態 + 模板分割

- 狀態：Accepted
- 日期：2026-05-21

## 背景

當前 `public/` 前端存在可維護性問題：

- `app.js` 超過 2300 行，混雜 API 調用、DOM 操作、事件處理、多個功能領域的邏輯
- 模態框、表單、表格 HTML 全部內聯在 `index.html`（1000+ 行）
- CSS 混合 Tailwind CDN + 內聯 `<style>` 標籤，難以追蹤
- 各功能模組間無明確通信規範，容易出現隱藏耦合

同時，未來存在「遷移到 Vue / React 等框架」的可能性，需要現在就建立相容的架構。

## 決策

採納**五個關聯決策**，形成完整的前端現代化方案：

### 1. 狀態管理：中央 State + Mutations
建立單一 `state.js` 作為全局狀態容器，所有狀態修改**必須**通過 `mutations.js` 的規範化函數進行。這樣：
- 狀態修改可追蹤、易調試
- 為未來 Vuex / Redux 遷移做準備
- 防止模塊間無意污染

```javascript
// state.js - 狀態定義
const state = {
  products: { items: [], currentPage: 1, filters: { ... } },
  locations: { items: [], selectedId: null },
  transactions: { items: [], ... },
  // ... 其他模塊
  ui: { modals: { ... }, loading: { ... } }
};

// mutations.js - 修改規範
export const mutations = {
  ADD_PRODUCT(product) { state.products.items.push(product); },
  SET_LOCATIONS(items) { state.locations.items = items; },
  // ...
};
```

### 2. 業務邏輯分層：按領域模塊化
將 `app.js` 分割為 8 個獨立模塊，每個對應一個業務領域（不按 UI 層級）：
- `modules/products.js` — 產品 CRUD、過濾
- `modules/locations.js` — 儲位管理、掃描
- `modules/transactions.js` — 庫存異動
- `modules/batches.js` — 批次操作
- `modules/webhooks.js` — Webhook 訂閱
- `modules/productUnits.js` — AP（序號品）管理
- `modules/csvImportExport.js` — CSV 匯入匯出
- `modules/utils.js` — 通知、格式化、模態框操作

每個模塊職責單一，導出對應的 API 函數，內部透過 `mutations` 修改狀態。

### 3. HTML 分割：為框架遷移預留結構
將 1000+ 行的 `index.html` 按邏輯區域分割為多個 HTML 片段（模板）：
```
templates/
├── sections/
│   ├── products-section.html
│   ├── locations-section.html
│   └── ...
└── modals/
    ├── product-modal.html
    ├── transaction-modal.html
    └── ...
```
主 `index.html` 只保留頂層容器。未來遷移到 Vue 時，這些 `.html` 直接變成 `.vue` 組件，無需大幅改動。

### 4. 工具鏈：Vite + Tailwind + PostCSS
- **Vite**：現代化模組打包器，零配置、快速開發熱更新
- **Tailwind + PostCSS**：將 Tailwind CDN 改為本地編譯，生產構建時只包含用到的 CSS，減小體積
- 部署流程改為 `npm run build` 生成 `dist/` 靜態資源

這套工具鏈是 Vue 3 / React 的標準配置，遷移時無縫接軌。

### 5. 框架遷移準備
現在的架構設計已為以下場景做好準備：
- **遷移到 Vue 3 + Pinia**：狀態層（state + mutations）直接對應 Pinia store，UI 層用 `.vue` 單檔組件
- **遷移到 React + Zustand/Redux**：狀態層對應 store，UI 層用 `.jsx` 組件
- **部署方式**：Vite 對兩者都原生支援

## 替代方案

### 方案 B：保持 vanilla JS，僅做簡易模塊化
分割 `app.js` 成多個檔案，保持 Tailwind CDN，不引入構建工具。
- ✅ 零學習曲線，維持現狀
- ❌ 框架遷移時需大幅改寫；Tailwind CDN 效率低
- ❌ 無法享受現代化工具的開發體驗

### 方案 C：直接遷移到 Vue / React
跳過過渡階段，立即用 Vue 重寫 UI。
- ✅ 最終體驗最好
- ❌ 遷移成本高、風險大、無法分階段驗證

## 取捨

| 維度 | 影響 | 理由 |
|---|---|---|
| **開發速度** | 短期放慢（2-3 天重構） | 但長期加快（更清晰的代碼結構、更少 bug） |
| **部署流程** | 從靜態文件改為 npm build | 符合現代化趨勢，PM2 可直接執行 npm scripts |
| **學習成本** | 需熟悉 Vite 配置 | 但配置極簡，團隊易上手 |
| **框架遷移成本** | **顯著降低** | 現在的架構設計與 Vue/React 相容，未來只改 UI 層 |
| **可維護性** | **顯著提升** | 模塊化 + 狀態集中，新成員易理解 |

## 實施計畫

1. **第 1 天**：初始化 Vite + npm packages、建立 `src/` 目錄結構、配置 `vite.config.js`、`postcss.config.js`
2. **第 2 天**：遷移 `app.js` 拆分為 `state.js` + `mutations.js` + 8 個業務模塊
3. **第 3 天**：分割 HTML 成 `templates/`、調整 CSS、測試整個系統、部署

## 後續觸發條件

### 何時調整此決策

- **若業務無法支持 2-3 天的開發停頓**：改採漸進式遷移（先分割 JS，後加 Vite）
- **若 Node.js 版本過舊（< 16）**：Vite 需要 Node 14+，驗證版本相容性

### 何時進行框架遷移

當以下條件**任一**達成時，啟動 Vue / React 遷移：
- 團隊希望改善 UI 響應式互動（使用狀態綁定）
- 複雜度不斷增長，vanilla JS 難以維護
- 有新成員加入，框架帶來的結構化開發經驗對團隊有益

遷移時，`src/modules/` + `src/main.js` **完全不動**，只改 `templates/` 和 UI 層邏輯。

## 相關決策

- 無直接相依的先前 ADR
- 與 CONTEXT.md 中「前端架構」章節相關（待補充）
