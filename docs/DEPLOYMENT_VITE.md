# 前端部署指南 — Vite 構建流程

## 🚀 快速開始

前端專案位於 **`vite-app/`**（React + TypeScript + Vite）。

### 開發環境
```bash
cd vite-app
npm install
npm run dev       # 啟動 http://localhost:5173（已 proxy /api 至後端）
```

### 生產構建
```bash
cd vite-app
npm run build     # 執行 tsc -b + vite build，輸出到 dist/
```

## 🔄 建置流程（不用 Docker，直接以 Node 執行）

後端 build script 會建置前端並複製靜態資源到 `public/`（供 Express 伺服）：

```bash
# 在專案根目錄
npm run build:frontend   # 在 vite-app/ 執行建置
npm run copy:frontend    # 將 vite-app/dist 複製到 public/
npm run build            # 一次完成上述兩步
```

## 📦 靜態文件服務

後端 `src/app.js` 透過 Express 靜態中間件伺服 `public/`：

```javascript
app.use(express.static(path.join(__dirname, "../public")));

// SPA fallback — 非 /api 路由回傳 public/index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
```

## 🐳 Docker 部署

`Dockerfile` 多階段建置：先在容器內建置 `vite-app/`，再將 `dist/` 複製為最終映像的 `public/`。

**不需要先在本機執行 `npm run build`**：映像不會用到本機的 `public/` 或 `vite-app/dist/`。

```bash
docker-compose up -d --build
```

`--build` 是重建 Docker 映像（前端也會在這一步重新建置）。程式碼更新後一定要加，否則會沿用舊映像。

## 🔍 環境檢查清單

### 部署前驗證（Docker）
- [ ] `docker-compose up -d --build` 建置無錯誤
- [ ] 專案根目錄有 `.env`（`docker-compose.yml` 以 `env_file` 讀取）

### 部署前驗證（直接以 Node 執行）
- [ ] `npm run build` 無錯誤
- [ ] `public/` 存在，包含 `index.html` 和 `assets/`
- [ ] Node.js 版本 ≥ 18

### 部署後驗證
- [ ] 前端頁面加載正常（http://localhost:3000）
- [ ] Console 無 JavaScript 錯誤
- [ ] 產品加載、CRUD 操作正常
- [ ] CSV 導入導出功能正常

## 🔐 環境變量

### 出貨單通知（LINE / Webhook）

`LINE_CHANNEL_ACCESS_TOKEN`、`LINE_TO`、`STOCK_WEBHOOK_URL` 的設定、取得 LINE 群組 ID 的步驟與 JSON 格式，見 [operations/NOTIFICATIONS.md](operations/NOTIFICATIONS.md)。

### 前端

敏感配置（API 密鑰等）在 `vite-app/.env.local` 中設置（不要提交 Git）：

```bash
VITE_API_BASE_URL=https://api.example.com
```

在代碼中引用：
```javascript
const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
```

## 📝 故障排除

### Vite 構建失敗
```bash
cd vite-app
rm -rf dist
npm run build
```

### 前端無法連接到 API
1. 檢查 `vite-app/vite.config.ts` 的 proxy 配置（開發模式）
2. 確認後端服務在 http://localhost:3000 運行
3. 檢查防火牆規則

### SPA 路由不工作
確保後端對未知非 API 路由回傳 `public/index.html`（見 `src/app.js` 的 SPA fallback）。

---

**備註**：前端程式碼更新後，Docker 部署執行 `docker-compose up -d --build`；直接以 Node 執行則需先 `npm run build` 產生新的靜態資源。開發過程使用 `npm run dev` 進行熱更新。
