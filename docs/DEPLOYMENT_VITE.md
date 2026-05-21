# 前端部署指南 — Vite 構建流程

## 🚀 快速開始

### 開發環境
```bash
cd public
npm run dev       # 啟動 http://localhost:5174
```

### 生產構建
```bash
cd public
npm run build     # 生成 dist/ 文件夾
npm run preview   # 預覽生產構建
```

## 🔄 PM2 部署流程

更新 PM2 配置文件 (`ecosystem.config.cjs`) 以支持 Vite 前端構建：

```javascript
module.exports = {
  apps: [
    {
      name: "inventory-api",
      script: "npm run start",
      cwd: "./",
      env: { NODE_ENV: "development" },
      env_production: { NODE_ENV: "production" }
    },
    {
      name: "inventory-frontend",
      script: "npm run build && npm run preview",
      cwd: "./public",
      env: { NODE_ENV: "production" },
      watch: false,
      max_memory_restart: "512M"
    }
  ]
};
```

### 手動部署步驟

```bash
# 1. 停止現有服務
pm2 stop all

# 2. 拉取最新代碼
git pull origin main

# 3. 前端重建
cd public
npm install       # 安裝依賴（如有新增）
npm run build     # 構建生產資源到 dist/

# 4. 啟動服務
pm2 start ecosystem.config.cjs --env production

# 5. 驗證
pm2 status
```

## 📦 靜態文件服務

### 選項 A：使用 Express 靜態中間件（推薦）

在后端 API 中添加靜態文件服務：

```javascript
// app.js (Node.js 後端)
import express from 'express';
import path from 'path';

const app = express();

// API 路由
app.use('/api', apiRoutes);

// 靜態文件（前端 dist）
const frontendPath = path.join(process.cwd(), 'public/dist');
app.use(express.static(frontendPath));

// 所有其他路由返回 index.html（SPA 路由支持）
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(3000, () => console.log('Server ready on :3000'));
```

**優點**：
- 單一進程管理（API + 前端在同一端口）
- /api 代理自動工作
- 支持 SPA 路由重定向

### 選項 B：分離前端靜態服務

使用 `serve` 或 `http-server` 單獨服務前端：

```bash
# 安裝 serve
npm install -g serve

# 啟動前端服務（http://localhost:3000）
serve -s public/dist -l 3000

# 或在 PM2 中啟動
pm2 start "serve -s public/dist -l 3000" --name inventory-frontend
```

## 🔍 環境檢查清單

### 部署前驗證
- [ ] `npm run build` 無錯誤
- [ ] `dist/` 文件夾存在，包含 `index.html` 和 `assets/`
- [ ] API 後端已部署並在 http://localhost:3000/api 可訪問
- [ ] Node.js 版本 ≥ 14

### 部署後驗證
- [ ] 前端頁面加載正常（http://localhost:3000 或 http://localhost:5174）
- [ ] Console 無 JavaScript 錯誤
- [ ] 產品加載、CRUD 操作正常
- [ ] CSV 導入導出功能正常
- [ ] 第三方庫（QRCode、html5-qrcode）加載正常

## 📊 性能優化

### Vite 構建優化
```bash
# 檢查構建產物大小
npm run build -- --analyze

# 啟用高級壓縮
# 編輯 vite.config.js 的 build.minify 設置
```

### Tailwind CSS 優化
- ✅ 已在 `tailwind.config.js` 中配置 `content` 掃描
- ✅ 生產構建自動移除未使用的 CSS（PurgeCSS）
- CSS 文件大小：19.26 kB (gzip: 4.11 kB)

### JavaScript 優化
- ✅ Vite 自動進行代碼分割（模塊）
- ✅ Terser 對生產代碼進行壓縮
- JS 文件大小：40.64 kB (gzip: 8.32 kB)

## 🔐 安全事項

### 環境變量
如需敏感配置（API 密鑰、認證令牌），在 `public/.env.local` 中設置：

```bash
# public/.env.local（不要提交到 Git）
VITE_API_BASE_URL=https://api.example.com
VITE_AUTH_TOKEN=secret
```

在代碼中引用：
```javascript
const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
```

### CORS 配置
API 應允許來自前端域的跨域請求：

```javascript
// 後端 (Node.js/Express)
import cors from 'cors';

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5174', 'https://yourdomain.com'],
  credentials: true
}));
```

### 內容安全策略 (CSP)
考慮添加 CSP 頭以防止 XSS 攻擊：

```javascript
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'"
  );
  next();
});
```

## 📝 故障排除

### Vite 構建失敗
```bash
# 清空構建緩存
rm -rf public/.vite public/dist
npm run build
```

### 前端無法連接到 API
1. 檢查 vite.config.js 的 proxy 配置
2. 確認後端服務在 http://localhost:3000 運行
3. 檢查防火牆規則

### 靜態文件 404 錯誤
1. 確認 `dist/` 文件夾存在
2. 檢查靜態服務中間件配置
3. 驗證文件路徑是否正確（相對 vs 絕對）

### SPA 路由不工作
確保后端返回 `index.html` 以應對所有未知路由：

```javascript
app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public/dist/index.html'));
});
```

## 🔄 更新流程

### 部署新版本
```bash
# 1. 代碼更新
git pull origin main

# 2. 前端重建
cd public
npm run build

# 3. 重啟服務
pm2 restart all

# 4. 確認狀態
pm2 status
pm2 logs inventory-api    # 查看 API 日誌
pm2 logs inventory-frontend  # 查看前端日誌
```

## 📞 相關命令

```bash
# 查看所有 PM2 進程
pm2 list

# 查看進程詳細狀態
pm2 status

# 查看進程日誌
pm2 logs
pm2 logs inventory-api

# 清空日誌
pm2 flush

# 監控實時進程
pm2 monit

# 停止單個進程
pm2 stop inventory-frontend

# 重啟單個進程
pm2 restart inventory-frontend

# 刪除進程配置
pm2 delete inventory-frontend

# 將當前 PM2 進程保存為開機自啟
pm2 startup
pm2 save
```

---

**備註**：所有前端代碼更新後，需要運行 `npm run build` 以生成新的靜態資源。開發過程使用 `npm run dev` 進行熱更新。
