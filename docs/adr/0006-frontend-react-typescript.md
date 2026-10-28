# ADR 0006：前端改用 React + TypeScript + Vite

- 狀態：Accepted
- 日期：2026-05-23（2026-10-28 依程式碼與 commit 紀錄補記）
- 取代：[ADR 0002](0002-frontend-modularization-with-vite.md)

## 背景

ADR 0002 決定先把 `public/app.js` 拆成 vanilla JS 模組，再視情況遷移到 Vue / React。實際上 2026-05-23 起直接把 HTML prototype 移植成 React + TypeScript 的 `vite-app/`（第一批 commit 如 `8bf7336`），跳過了 vanilla 的過渡階段，等於採用 ADR 0002 列為替代方案 C 的「直接遷移」。當時沒有留下決策紀錄，本 ADR 依現況補記。

## 決策（現況）

1. **React 18 + TypeScript + Vite 5**，原始碼在 `vite-app/src/`。`npm run build`（根目錄）會 build 前端並把 `vite-app/dist` 複製到 `public/`，由 Express 以靜態檔案提供，非 `/api` 路徑 fallback 到 `index.html`。
2. **路由**：react-router。URL 決定顯示哪一頁，`View` 型別與路徑對照只在 `src/lib/routes.ts`（`8249193`）。
3. **狀態**：不用全域 store。應用狀態放在 hooks（`useSession`、`useInventory`、`useToast`、`useAppHandlers`、`useLang`），目前倉庫放在 `ActiveWarehouseContext`。
4. **API**：每個後端資源一個 `src/api/*.ts`，全部經 `api/client.ts`。client 負責帶 token 與 `X-Warehouse-Id`、拆開 `{ success, data }`、失敗時丟 `ApiError` 並翻譯錯誤 code（ADR 0004）。
5. **多語系**：`src/lib/i18n.ts`，四種語言（en / zh / zh-cn / ja）。
6. **樣式**：全域 `src/styles.css`，加上元件內的 inline style；沒有 Tailwind，也沒有 CSS modules。

## 影響

- 前端沒有單元測試，以 `npm run typecheck` / `npm run build` 和實際操作驗證
- ADR 0002 的 `state.js`、`modules/`、`templates/`、Tailwind + PostCSS 都不適用
