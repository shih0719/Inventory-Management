# 部署指南

## 本地開發

```bash
# 後端
npm install
npm run dev

# 前端（另一終端）
cd vite-app && npm install && npm run dev
```

## 生產環境（Docker Compose）

### 1. 建置並啟動
```bash
# 建置前端並複製到 public/，再建置 Docker 映像
npm run build
docker-compose up -d --build
```

### 2. 查看應用狀態
```bash
docker-compose ps
docker-compose logs -f app
```

### 3. 停止/重啟
```bash
docker-compose down       # 停止
docker-compose restart app # 重啟
```

### 4. 健康檢查
```bash
curl http://localhost:3000/api/health
```

## 環境變數

設定 `.env`（見 `.env.example`）：
```
JWT_SECRET=<your-secret>
LOG_LEVEL=info
NODE_ENV=production
DB_PATH=/app/data/inventory.db
```

## 前端建置

前端（React/TS/Vite）位於 `vite-app/`。建置流程：
```bash
npm run build:frontend   # 在 vite-app/ 執行 tsc + vite build
npm run copy:frontend    # 將 vite-app/dist 複製到 public/
```
`npm run build` 一次完成上述兩步。

## 資料持久化

資料庫檔案透過 Docker volume 掛載於 `./data`（`DB_PATH=/app/data/inventory.db`），容器重啟不會遺失資料。

## 備份

每 6 小時自動備份至 `database/backups/`，保留 7 天。可透過後端 UI 設定每週 Email 寄送。

## 日誌檔案

- 應用日誌：`logs/app.log`
- 錯誤日誌：`logs/error.log`
