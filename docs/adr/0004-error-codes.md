# ADR 0004：後端錯誤訊息用英文加 code，由前端翻譯

- 狀態：Accepted
- 日期：2026-10-28

## 背景

前端有四種介面語言（en / zh / zh-cn / ja，`vite-app/src/lib/i18n.ts`），後端卻把錯誤訊息直接寫成中文或英文字串，前端原樣顯示。英文和日文使用者因此會看到中文錯誤，例如 `POST /api/transactions` 回傳的「AP 商品的有帳數量只能朝在庫序號數（0）對齊…」。

## 決策

1. **後端只寫英文，並附上 code**。4xx 回應的格式：

   ```json
   { "success": false, "code": "AP_RECONCILE_DIRECTION", "params": { "inStock": 0 }, "error": "AP accountable quantity can only move toward…" }
   ```

   - `code`：固定的大寫識別字，前端用它查翻譯
   - `params`：要嵌進訊息的值（數量、SKU 等），翻譯模板會用到
   - `error`：英文訊息，給 log、直接呼叫 API 的人，也是前端查不到翻譯時的備案

2. **錯誤清單的每一項**（批次、出貨、CSV 匯入、序號品）格式為 `{ label, code, params, error }`。`label` 是不分語言的位置，例如 `#2 (SKU)`、序號、`#3`。CSV 的項目另外保留 `row`。

3. **共用 helper** 在 `src/utils/errorItem.js`：`failure(code, error, params, errors)` 組出回應本體，`errorItem(label, issue)` 組出清單項目。service 丟出的錯誤（`LedgerError`、`OutboundError`、`ApUnitError`）本身就帶 `code` / `params`。

4. **翻譯集中在前端**。`SERVER_ERRORS`（`lib/i18n.ts`）是 code → 四種語言模板的對照表。`api/client.ts` 在錯誤回應時翻譯最上層的訊息，並把 `errors` 中帶 code 的項目轉成翻譯好的字串，所以元件只需要顯示 `err.message` 和 `err.body.errors`。查不到翻譯時顯示英文 `error`。

5. **`tests/errorCodes.test.js`** 檢查後端送出的每個 code 都有翻譯。

## 理由

- 語言是前端的事：使用者的語言設定只存在瀏覽器（`inv.lang`），後端不需要知道
- 每則錯誤一個 code，前端可以依 code 決定呈現方式，不必解析字串
- 英文 `error` 讓 API 在沒有前端的情況下（測試、curl、log）仍然可讀

## 影響

- 新增錯誤時：後端用 `failure(...)` 或帶 code 的 Error，前端在 `SERVER_ERRORS` 補四種語言，少補時測試會失敗
- 已經套用：Stock Ledger、批次、出貨、序號品、商品、CSV 匯入、備份 Email 測試
- **尚未套用**：auth、middleware、交易、出貨單、倉庫、使用者等處原本就是英文、也還沒有 code 的錯誤（約 30 處）。這些目前對所有語言都顯示英文，之後再補 code
- 成功訊息（例如 CSV 匯入完成）不在這個範圍內，由前端自己組字
- 寫進資料的文字（異動備註如「CSV 匯入」、「移倉至 X」）是資料不是訊息，不翻譯
