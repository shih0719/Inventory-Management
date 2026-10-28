# 出貨單通知（LINE / Webhook）

建立出貨單時，系統會自動發一則通知，讓主管馬上知道出了什麼貨。可以推播到 LINE（個人或群組），也可以把 JSON 送到任何 Webhook 網址；兩種可同時使用。

## 什麼時候會發

| 情況 | 是否通知 |
|------|----------|
| 「出貨」頁以 **OUTBOUND** 標籤送出，建立出貨單 | ✅ 一張出貨單一則（不論含幾個商品、幾個序號品） |
| 其他標籤出庫（借出、報廢…）| ❌ |
| 入庫、調整、盤點、CSV 匯入、序號品調撥 | ❌ |
| 「出貨單」頁手動建立、補綁既有異動 | ❌ |
| 出貨驗證失敗（庫存不足等，整張不寫入）| ❌ |

訊息範例：

```
【出貨單】SHP-20261028-001
倉庫：台北倉
客戶：客戶甲　案件：CASE-9
操作人：eric
・螺絲 M3 有帳 10→7（-3）
・交換器 有帳 5→2（-3）
```

每行商品為：產品名稱、有帳/無帳、出貨前→出貨後（變動量）。

## 設定總覽

在專案根目錄 `.env` 設定（範本見 `.env.example`），改完需重啟服務（Docker：`docker-compose up -d`；PM2：`pm2 restart all`）：

| 變數 | 說明 |
|------|------|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API 的長期 Channel access token |
| `LINE_TO` | 接收者 ID：群組（`C` 開頭）或個人（`U` 開頭） |
| `STOCK_WEBHOOK_URL` | 選填。收 JSON 的網址（Slack / Teams Incoming Webhook、n8n、Zapier…） |

- LINE 需要 `LINE_CHANNEL_ACCESS_TOKEN` 與 `LINE_TO` **兩個都設定**才會送。
- 留空就不送。三個都留空 = 關閉通知。
- 送出逾時 5 秒；失敗只記在 log，不重試，**不影響出貨本身**。

---

## LINE 設定步驟

整個流程約 10 分鐘，需要一個 LINE 帳號。

### 1. 建立 LINE 官方帳號與 Messaging API channel

1. 到 [LINE Official Account Manager](https://manager.line.biz/) 建立一個官方帳號（例如「庫存通知」）。
2. 進入該帳號 → 右上 **設定** → **Messaging API** → **啟用 Messaging API**，選擇（或新建）一個 Provider。
3. 到 [LINE Developers Console](https://developers.line.biz/console/)，點進剛剛的 Provider，就會看到這個官方帳號對應的 **Messaging API channel**。

### 2. 發行 Channel access token

1. LINE Developers Console → 你的 channel → **Messaging API** 分頁。
2. 拉到最下方 **Channel access token (long-lived)** → **Issue**。
3. 複製這串 token，填到 `.env`：

```bash
LINE_CHANNEL_ACCESS_TOKEN=貼上剛剛複製的 token
```

> ⚠️ token 等同密碼，不要貼到聊天室或提交到 Git。外洩時在同一處按 **Reissue** 重新發行，再更新 `.env`。

### 3. 允許官方帳號加入群組（要送到群組才需要）

LINE Official Account Manager → **設定** → **帳號設定** → **功能切換** → 「**加入群組或多人聊天室**」選 **接受邀請**。

### 4. 取得群組 ID（或個人 ID）

LINE 不會在任何畫面上直接顯示群組 ID，只會放在「LINE 送給你的 webhook 事件」裡。所以要**暫時**接一個能看到事件內容的網址，抓到 ID 後再關掉。下面用免費的 [webhook.site](https://webhook.site)，不需註冊。

**4-1. 拿一個臨時網址**

打開 <https://webhook.site>，頁面上方「Your unique URL」就是你的臨時網址（形如 `https://webhook.site/1a2b3c4d-...`），按 **Copy**。這個分頁保持開著。

**4-2. 把臨時網址設給 LINE**

1. LINE Developers Console → 你的 channel → **Messaging API** 分頁 → **Webhook settings**。
2. **Webhook URL** 按 **Edit**，貼上臨時網址 → **Update**。
3. 打開 **Use webhook**。
4. （可選）按 **Verify**：顯示 **Success**，且 webhook.site 左側出現一筆請求，就是接通了。

> 若 Official Account Manager 的「回應設定」把 Webhook 關掉了，請在 **設定** → **回應設定** 把 **Webhook** 打開。

**4-3. 觸發事件**

- **要送到群組**：在 LINE 把官方帳號邀進主管群組（群組 → 邀請 → 搜尋官方帳號名稱）。加入時 LINE 會送出 `join` 事件；或在群組裡隨便傳一句話。
- **要送給個人**：請主管加官方帳號為好友（會送出 `follow` 事件），或傳一句話給官方帳號。

**4-4. 從 webhook.site 找 ID**

回到 webhook.site，左側點最新一筆請求，右側 **Raw Content** 會像這樣：

```json
{
  "destination": "U0000000000000000000000000000000",
  "events": [
    {
      "type": "join",
      "source": {
        "type": "group",
        "groupId": "C1234567890abcdef1234567890abcdef"
      },
      "timestamp": 1761638400000,
      "mode": "active"
    }
  ]
}
```

- 群組：取 `events[0].source.groupId`（`C` 開頭）
- 個人：取 `events[0].source.userId`（`U` 開頭）

> 不要用最外層的 `destination`，那是官方帳號自己的 ID。也不要用 Developers Console **Basic settings** 裡的「Your user ID」，那是 channel 管理者本人的 ID，不一定是主管。

填到 `.env`：

```bash
LINE_TO=C1234567890abcdef1234567890abcdef
```

**4-5. 收尾（重要）**

回到 LINE Developers Console → **Webhook settings**：關掉 **Use webhook**，並清空 Webhook URL。webhook.site 的網址任何知道的人都看得到內容，不要長期接著。

本系統只「發送」推播，不需要接收 LINE 的 webhook，所以關掉不影響通知。

### 5. 重啟並測試

1. 重啟服務讓 `.env` 生效。
2. 在「出貨」頁選 **OUTBOUND** 標籤，出一筆小量的貨。
3. 群組（或主管）應收到【出貨單】訊息。

---

## 疑難排解

沒收到訊息時，先看 `logs/app.log` 有沒有下列警告（詳見 [LOGGING.md](LOGGING.md)）：

| log 內容 | 原因 | 處理 |
|----------|------|------|
| 完全沒有 `Stock LINE push` 字樣 | 沒觸發或沒設定 | 確認用 **OUTBOUND** 標籤出貨；確認 `.env` 兩個 LINE 變數都有值且已重啟 |
| `Stock LINE push responded 401` | token 錯誤或已失效 | 重新複製或 Reissue token |
| `Stock LINE push responded 400` 或 `403` | `LINE_TO` 錯誤，或官方帳號已不在該群組 | 重新照步驟 4 取得 ID、確認沒有多餘空白；確認官方帳號還在群組裡 |
| 送給個人但對方沒收到（log 可能沒有警告）| 對方封鎖了官方帳號或刪除好友 | 請主管解除封鎖、重新加好友 |
| `Stock LINE push responded 429` | 本月訊息則數用完，或短時間送太多 | 到 Official Account Manager 查看用量或升級方案 |
| `Stock LINE push failed: ...` | 伺服器連不到 `api.line.me` | 檢查伺服器對外網路、防火牆、proxy |

### 訊息則數

推播會計入官方帳號的每月訊息則數；LINE 依「收到的人數」計算，**送到群組時，群組裡每個成員各算一則**。免費額度依方案而定，請在 Official Account Manager →「**用量**」查看。用完後該月剩下的通知會送不出去（只記 log，主管不會收到提示）。

---

## Webhook（JSON）

設定 `STOCK_WEBHOOK_URL` 後，每張出貨單會 `POST` 一筆 JSON（`Content-Type: application/json`）：

```json
{
  "event": "stock.changed",
  "occurredAt": "2026-10-28T08:00:00.000Z",
  "text": "【出貨單】SHP-20261028-001\n倉庫：台北倉\n客戶：客戶甲　案件：CASE-9\n操作人：eric\n・螺絲 M3 有帳 10→7（-3）",
  "source": "batch",
  "tag": "OUTBOUND",
  "actor": "eric",
  "batchId": 12,
  "shipment": {
    "id": 3,
    "shipmentNumber": "SHP-20261028-001",
    "customer": "客戶甲",
    "projectCase": "CASE-9",
    "shipmentDate": "2026-10-28"
  },
  "movements": [
    {
      "transactionId": 101,
      "sku": "A-01",
      "name": "螺絲 M3",
      "warehouseId": 2,
      "warehouse": "台北倉",
      "quantityType": "accountable",
      "delta": -3,
      "before": 10,
      "after": 7,
      "remarks": "",
      "source": "batch"
    }
  ]
}
```

| 欄位 | 說明 |
|------|------|
| `text` | 與 LINE 相同的訊息文字；Slack / Teams Incoming Webhook 會直接顯示這一欄 |
| `shipment` | 出貨單號、客戶、案件、出貨日期 |
| `movements[]` | 每一筆庫存異動；`source` 為 `batch`（一般品）或 `ap-sell`（序號品） |
| `quantityType` | `accountable`（有帳）或 `non_accountable`（無帳） |

不需回應內容；非 2xx 的回應會記到 log，不重試。

---

## 給開發者

- 程式：`src/services/stockNotifier.js`（組訊息、發送）；出貨單資料由 `src/services/outboundService.js` 以 `annotate` 附上。
- 訊息文字在 `summarize()`；改格式時一併更新 `tests/stockNotifier.test.js`。
- 測試環境（`tests/setup.js`）會把三個變數清空，測試不會真的發出通知。
