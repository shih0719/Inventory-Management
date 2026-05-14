# 營運文檔 (Operations Documentation)

本目錄包含日常運維、備份、監控、部署相關的文檔。面向 DevOps、SRE、值班工程師與支持團隊。

## 文檔清單

| 檔案 | 標籤 | 描述 | 受眾 |
|------|------|------|------|
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | 🚀 | 本地開發與生產環境部署 (PM2)、PM2 常見命令 | DevOps, Release Manager, 開發者 |
| [`UPDATE.md`](UPDATE.md) | 🔄 | 應用更新機制、部署流程、驗證與回滾 | DevOps, Release Manager |
| [`BACKUP.md`](BACKUP.md) | 💾 | 資料庫備份策略、位置、手動復原步驟與驗證 | DevOps, SRE |
| [`LOGGING.md`](LOGGING.md) | 📝 | 日誌系統設定、日誌等級、查詢與故障排除 | 開發者, 運維, 支持 |

---

## 常見任務速查

### 日常檢查

```bash
# 檢查備份狀態
cat /backup/latest.log

# 查看近期日誌
tail -f /var/log/inventory-app.log

# 檢查服務健康狀態
curl http://localhost:3000/health
```

### 應急回應

| 情況 | 參考文檔 | 步驟 |
|------|--------|------|
| 資料庫故障 | [`BACKUP.md`](BACKUP.md) | 復原最近的備份 |
| 應用崩潰 | [`UPDATE.md`](UPDATE.md) | 檢查日誌，執行回滾或重啟 |
| 效能下降 | [`LOGGING.md`](LOGGING.md) | 啟用 DEBUG 日誌，分析慢查詢 |
| 部署失敗 | [`UPDATE.md`](UPDATE.md) | 查看更新日誌，手動介入或回滾 |

---

## 關鍵指標與告警

### 監控重點

- **資料庫連線池**: 若耗盡，應用無法執行查詢
- **備份狀態**: 每日備份應於指定時間完成
- **API 響應時間**: 若 p95 > 500ms，檢查慢查詢
- **webhook 交付率**: 失敗率 > 5% 時調查

詳細設定見各文檔。

---

## 變更管理

### 如何應用更新

1. 準備：閱讀 [`UPDATE.md`](UPDATE.md) 中的步驟
2. 備份：執行備份命令 (見 [`BACKUP.md`](BACKUP.md))
3. 測試：在 staging 環境驗證
4. 部署：按 [`UPDATE.md`](UPDATE.md) 的指引部署到 prod
5. 驗證：檢查服務健康與關鍵業務流程

### 回滾程序

若部署後發現問題：
```bash
# 見 UPDATE.md 詳細步驟
git revert <commit-hash>
docker-compose restart app
```

---

## 聯絡與升級

| 問題型態 | 聯絡對象 | 優先級 |
|---------|--------|------|
| 資料遺失 / 難復原 | DBA | 🔴 P0 |
| 服務中斷 | DevOps On-call | 🔴 P0 |
| 效能下降 | 應用團隊 | 🟡 P1 |
| 日誌缺失 | 運維團隊 | 🟡 P1 |
| 備份遺漏 | DBA | 🔴 P0 |

---

## 文檔版本

- **最後更新**: 2026-05-14
- **適用版本**: v1.x
- **下次審查**: 2026-08-14

---

## 相關文檔

- 文檔首頁: [`../README.md`](../README.md)
- 文檔組織說明: [`../ORGANIZATION.md`](../ORGANIZATION.md)
- 系統架構優化: [`../improve.md`](../improve.md)
- 根目錄領域術語: [`../../CONTEXT.md`](../../CONTEXT.md)
- 根目錄版本紀錄: [`../../CHANGELOG.md`](../../CHANGELOG.md)
