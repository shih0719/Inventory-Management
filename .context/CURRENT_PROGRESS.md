## 第二條：任務交接與持久化 (Task Handover)

1. **[Status]**: Stable
2. **[Done]**: 
    - 實作 Webhook 通知系統（內網版，無 HMAC）
    - 新增 DB 表：`webhook_subscriptions`、`webhook_logs`（schema.sql）
    - 新增 `src/services/webhookService.js`：fire-and-forget + 3次指數退避 retry
    - 新增 `src/controllers/webhooksController.js` + `src/routes/webhooks.js`：CRUD 管理 + logs 查詢 + 測試推送
    - 注入 `transactionsController.js`：`inventory.changed` 事件
    - 注入 `batchesController.js`：`batch.created` 事件
    - 掛載 `/api/webhooks` 到 `server.js`
    - 前次工作：整理 API Reference 文件 → `.context/API_REFERENCE.md`
3. **[Context]**: 
    - `src/services/webhookService.js` — 核心推送邏輯
    - `src/controllers/webhooksController.js` — 管理 API
    - `database/schema.sql` — 含 webhook 兩張表
4. **[Pending]**: 
    - 觀察 CSV 匯入是否需要自動編碼偵測（目前固定 Big5）
    - Webhook 目前僅支援 `inventory.changed` 和 `batch.created` 兩個事件
    - 如需擴充事件（商品異動、儲位指派等），修改 `webhookService.js` `SUPPORTED_EVENTS` 陣列即可
5. **[Safety]**: 
    - `webhookService.fire()` 為 fire-and-forget，不會阻塞主業務 API 回應
    - DB 表使用 `CREATE TABLE IF NOT EXISTS`，重啟不會重建，首次啟動後自動建立新表
    - Retry 失敗日誌寫入 `webhook_logs`，可透過 `GET /api/webhooks/:id/logs` 查詢
    - `POST /api/system/apply-update` 觸發 `process.exit(1)` 強制重啟，建議搭配 Docker `restart: always`
