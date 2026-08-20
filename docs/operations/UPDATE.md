# 版本更新與部署

## 概述

本系統**不包含內建的版本自動更新機制**（過往的 `updateService.js`、`/api/updates/*` 端點與 Web UI 更新頁面均已移除）。版本更新透過標準的 Git 工作流手動進行。

## 更新流程

### 1. 拉取最新程式碼

```bash
git pull origin main
```

### 2. 安裝依賴

```bash
npm install
```

### 3. 建置前端

```bash
npm run build   # 建置 vite-app/ 並複製靜態資源至 public/
```

### 4. 重建並重啟容器（Docker 部署）

```bash
docker-compose up -d --build
```

### 5. 驗證

```bash
curl http://localhost:3000/api/health
```

## 回滾

若更新後發現問題：

```bash
git log --oneline -1          # 記下目前 commit
git revert <bad-commit-hash>  # 反轉有問題的 commit
docker-compose up -d --build  # 重建重啟
```

## 備份

更新前建議確認備份存在（見 `BACKUP.md`）。每 6 小時自動備份至 `database/backups/`，保留 7 天。

## 相關文件

- `DOCKER.md` — Docker 部署細節
- `docs/operations/DEPLOYMENT.md` — 部署指南
- `docs/operations/BACKUP.md` — 備份策略
