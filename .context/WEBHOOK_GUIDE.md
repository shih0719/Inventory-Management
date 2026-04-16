# Webhook 運作指南

> 本文件說明 Inventory Management 系統的 Webhook 通知機制，包含架構設計、事件格式、設定方式與除錯方法。

---

## 什麼是 Webhook？

Webhook 是一種「**事件驅動推送**」機制。當系統內發生特定事件（如庫存變動），伺服器會**主動 HTTP POST** 通知你預先設定的外部端點，不需要外部系統輪詢。

```
傳統輪詢（Polling）               Webhook（推送）
─────────────────────             ─────────────────────
外部 → 每 30 秒問一次             庫存變動 → 立刻通知外部
外部 → "有新資料嗎？"             外部 → 收到推送，立即處理
外部 → "有新資料嗎？"
（大量無效請求，有延遲）           （即時、高效、解耦）
```

---

## 支援的事件

| Event Name | 觸發時機 | 觸發端點 |
|------------|---------|---------|
| `inventory.changed` | 單筆庫存異動成功 | `POST /api/transactions` |
| `batch.created` | 批次出入庫成功 | `POST /api/batches` |

---

## 整體運作流程

```
┌─────────────────────────────────────────────────────┐
│                 Inventory Management                │
│                                                     │
│  1. 使用者操作 → POST /api/transactions             │
│                      ↓                              │
│  2. 寫入 DB（有帳/無帳數量更新）                   │
│                      ↓                              │
│  3. res.json() ← 立即回應使用者（不等 Webhook）     │
│                      ↓                              │
│  4. webhookService.fire() ← 非同步背景執行          │
│         ↓                                           │
│  5. 查 webhook_subscriptions（is_active = 1）       │
│         ↓                                           │
│  6. 過濾：訂閱的 events 包含此事件嗎？              │
│         ↓ 是                                        │
│  7. HTTP POST → 外部 URL                            │
│         ↓                                           │
│  8. 成功 → 寫 webhook_logs（success=1）             │
│     失敗 → Retry（最多 3 次）→ 寫 log（success=0） │
└─────────────────────────────────────────────────────┘
                          ↓
              ┌───────────────────────┐
              │  外部系統（n8n 等）   │
              │  接收 Payload 並處理  │
              └───────────────────────┘
```

---

## Payload 格式

所有事件共用相同的外層結構：

```json
{
  "event": "<事件名稱>",
  "timestamp": "2026-04-16T06:30:00.000Z",
  "data": { ... }
}
```

### `inventory.changed` Payload

```json
{
  "event": "inventory.changed",
  "timestamp": "2026-04-16T06:30:00.000Z",
  "data": {
    "transaction_id": 42,
    "product_id": 1,
    "sku": "SKU-001",
    "product_name": "網路交換器 24P",
    "quantity_type": "accountable",
    "quantity_change": -5,
    "new_quantity": 45,
    "tag_id": 2,
    "remarks": "出貨給客戶 A"
  }
}
```

| 欄位 | 說明 |
|------|------|
| `quantity_type` | `accountable`（有帳）或 `non_accountable`（無帳）|
| `quantity_change` | 正值 = 入庫，負值 = 出庫 |
| `new_quantity` | 異動後的最新數量 |

---

### `batch.created` Payload

```json
{
  "event": "batch.created",
  "timestamp": "2026-04-16T06:30:00.000Z",
  "data": {
    "batch_id": 5,
    "batch_number": "BATCH-1713244800000",
    "tag_id": 2,
    "description": "四月份盤點入庫",
    "processed_count": 3,
    "items": [
      { "product_id": 1, "product_name": "交換器 24P", "quantity_type": "accountable", "quantity_change": 10 },
      { "product_id": 2, "product_name": "路由器 X",   "quantity_type": "accountable", "quantity_change": 5  }
    ]
  }
}
```

---

## Retry 機制

推送失敗（非 2xx 回應或連線逾時）時，系統會自動重試：

```
Attempt 1 失敗
    └→ 等待 1 秒
Attempt 2 失敗
    └→ 等待 3 秒
Attempt 3 失敗
    └→ 寫入 webhook_logs（error_message 記錄失敗原因）
       不再重試，繼續處理其他訂閱
```

| 項目 | 數值 |
|------|------|
| 最大重試次數 | 3 次 |
| 退避策略 | 指數退避（1s / 3s / 9s）|
| 請求逾時 | 10 秒 |
| 失敗影響 | 不影響主業務 API 回應速度 |

> **重要**：webhook 為 fire-and-forget，推送失敗**不會**造成原始 API 回傳錯誤。

---

## 設定步驟

### Step 1：新增訂閱

```bash
POST /api/webhooks
Content-Type: application/json

{
  "name": "n8n-inventory-alert",
  "url": "http://192.168.1.50:5678/webhook/inventory",
  "events": ["inventory.changed", "batch.created"]
}
```

回應：
```json
{ "success": true, "data": { "id": 1, "name": "n8n-inventory-alert", ... } }
```

### Step 2：觸發事件（正常操作即可）

```bash
POST /api/transactions
{ "product_id": 1, "tag_id": 2, "quantity_change": -5, "quantity_type": "accountable" }
```

→ 外部端點收到 `inventory.changed` 推送 ✅

### Step 3：驗證推送結果

```bash
GET /api/webhooks/1/logs
```

```json
{
  "success": true,
  "data": [
    { "event": "inventory.changed", "status_code": 200, "attempts": 1, "success": 1, "error_message": null }
  ]
}
```

### Step 4：測試推送（開發/驗證用）

```bash
POST /api/webhooks/1/test
```

→ 立即向端點發送帶有 `_test: true` 標記的測試 Payload。

---

## 管理訂閱

### 暫停推送

```bash
PUT /api/webhooks/1
{ "is_active": 0 }
```

### 恢復推送

```bash
PUT /api/webhooks/1
{ "is_active": 1 }
```

### 更改接收端點

```bash
PUT /api/webhooks/1
{ "url": "http://new-endpoint/webhook" }
```

### 刪除訂閱

```bash
DELETE /api/webhooks/1
```

---

## 多訂閱支援

可以同時設定多個外部端點，每個訂閱獨立接收、獨立 retry：

```
inventory.changed 事件發生
    ├─→ 訂閱 #1（n8n）       → POST http://n8n:5678/webhook/...
    ├─→ 訂閱 #2（自訂服務）  → POST http://192.168.1.99/notify
    └─→ 訂閱 #3（Line Bot）  → POST https://your-bot/webhook
```

每個訂閱的推送結果互不影響。

---

## 資料庫結構

### `webhook_subscriptions`

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | INTEGER | 主鍵 |
| `name` | TEXT | 識別名稱 |
| `url` | TEXT | 外部接收端點 |
| `events` | TEXT | JSON 陣列字串 |
| `is_active` | INTEGER | 1=啟用，0=停用 |
| `created_at` | DATETIME | 建立時間 |

### `webhook_logs`

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | INTEGER | 主鍵 |
| `subscription_id` | INTEGER | 對應訂閱 |
| `event` | TEXT | 事件名稱 |
| `payload` | TEXT | 發送的完整 JSON |
| `status_code` | INTEGER | HTTP 回應碼（null=無法連線）|
| `attempts` | INTEGER | 實際嘗試次數 |
| `success` | INTEGER | 1=成功，0=失敗 |
| `error_message` | TEXT | 失敗原因 |
| `created_at` | DATETIME | 記錄時間 |

---

## 除錯指引

### 推送沒有收到？

1. 確認訂閱 `is_active = 1`
   ```bash
   GET /api/webhooks
   ```

2. 查看推送 log
   ```bash
   GET /api/webhooks/1/logs
   ```

3. 常見 `error_message` 說明

| 錯誤訊息 | 原因 | 處理方式 |
|---------|------|---------|
| `ECONNREFUSED` | 目標服務未啟動 | 確認外部服務正在運行 |
| `Request timed out (10s)` | 目標回應超過 10 秒 | 優化外部端點回應速度 |
| `HTTP 4xx` | 外部端點拒絕請求 | 確認 URL 路徑正確 |
| `HTTP 5xx` | 外部端點內部錯誤 | 查看外部服務日誌 |

4. 使用測試推送排查
   ```bash
   POST /api/webhooks/1/test
   ```

### 如何確認 Payload 正確？

使用 [webhook.site](https://webhook.site) 建立一個臨時端點，將其 URL 設定為測試訂閱的接收地址，即可看到完整的推送内容。

---

## 與 n8n 整合範例

1. 在 n8n 建立 **Webhook Trigger** 節點，複製其接收 URL
2. 在 Inventory Management 新增訂閱：
   ```json
   { "name": "n8n", "url": "<n8n webhook URL>", "events": ["inventory.changed"] }
   ```
3. 觸發庫存異動，n8n 工作流自動啟動 ✅

可在 n8n 後接 Line Notify、Email、Slack 等通知節點，實現完整的告警流程。
