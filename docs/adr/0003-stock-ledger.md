# ADR 0003：Product 數量只能經由 Stock Ledger 改動

- 狀態：Accepted
- 日期：2026-10-22
- 相關：`docs/tech-debt.md` C1、C3、B1、B4

## 背景

「寫 Transaction + 更新 Product 數量」原本散在 7 處（transactions、batches、outbound、AP bulk、AP transfer、CSV、products.create），各自處理欄位選擇、非負檢查、snapshot、`warehouse_id`、audit 與 atomicity，做法互不一致：

- 非負檢查多半在 `BEGIN` 之前做，寫入時用絕對值覆寫，並行請求會互相覆蓋數量（lost update）
- 只有 AP transfer 寫 `transactions.warehouse_id`；AP bulk / transfer 不記 audit
- AP bulk / transfer 找不到 Tag 或驗證失敗時靜默跳過，序號照寫、數量不動
- CSV 匯入與建立商品直接寫數量，不留 Transaction，違反「Transaction 是不可變的歷史紀錄」

此外所有請求共用一條 sqlite 連線，transaction 開著時，其他請求的查詢會被捲進去（B1）。

## 決策

1. **`db.transaction(fn)`**（`src/config/database.js`）：同一時間只有一個 transaction；一般的 `db.run/get/all` 在 transaction 進行中會等候。從 transaction 內部（同一個 async context，用 `AsyncLocalStorage` 追蹤）發出的查詢直接通過，巢狀呼叫併入外層。手寫的 `BEGIN`/`COMMIT` 一律改用它。
2. **Stock Ledger**（`src/services/stockLedger.js`）是唯一改動數量的模組：
   - `apply(tx, movements, ctx)` 接收呼叫端的 `tx`，不自己開 transaction，讓帳本的寫入與呼叫端的 batch、AP 狀態、Shipment 寫入一起提交
   - 在 transaction 內讀取目前數量，同商品多筆 movement 以累計餘額檢查；一次回報所有錯誤（`LedgerError.errors`），任一筆失敗整批不寫
   - 數量更新帶 `AND field = before` 的條件，讀到過期值時直接失敗，不會覆寫
   - `warehouse_id` 取自商品本身（不是操作者的目前倉庫），調撥兩側因此各自正確
   - 每筆 Transaction 都在 transaction 內 await 寫 audit
   - Tag 找不到時丟 `LedgerError`，不再靜默跳過
   - `check(tx, movements)` 只回傳錯誤，供呼叫端與自己的驗證錯誤合併回報
3. **AP 規則的界線**：帳本只檢查結構——AP 商品的有帳 movement 必須帶 `unitIds` 且數量 = |delta|，或標記 `kind: 'reconcile'` 並朝在庫序號數對齊。序號狀態（是否在庫、是否已出庫）由 AP 流程負責（tech-debt C2）。
4. **建立商品與 CSV 匯入也經過帳本**（B4 決議：數量 = Transaction 累加的不變式在每條路徑都成立）：
   - 建立商品：以 0 建立，初始數量寫成 `ADJUSTMENT` 標籤、source `adjust` 的 movement。AP 商品的初始有帳數量必須為 0（序號要走入庫流程）
   - CSV：數量欄位是目標值，寫入差額（`ADJUSTMENT`、source `csv-import`），差額為 0 不寫；逐列提交；AP 商品的有帳數量改動使該列失敗
   - `transactions.source` 有 CHECK 約束，沒有 `product-create` 這個值；改約束需要重建資料表，所以建立商品沿用 `adjust`，以 remarks 區分
5. AP bulk 維持部分成功（失敗的序號回報在 `errors`），實際新增的序號寫成一筆 movement。
6. remarks 一律由帳本加上 `[有帳]` / `[無帳]` 前綴（原本 AP bulk / transfer 沒有）。

## 取捨

| 維度 | 後果 |
|---|---|
| 並行 | 所有 DB 存取在 transaction 期間序列化。單一 SQLite 檔、少量使用者，代價可忽略 |
| 錯誤回報 | 驗證移進 transaction 內，讀到的數量就是寫入時的數量；過期讀取改為明確失敗 |
| CSV 語意 | 匯入現在會產生大量 ADJUSTMENT Transaction，歷史頁會看到它們 |
| 規則擴散 | 新增數量路徑若直接寫 `products.*_quantity` 就會繞過所有規則；以 CONTEXT.md 規範與 code review 把關 |
| 呼叫端紀律 | transaction 內呼叫的非同步函式必須 await，否則可能在 COMMIT 後才執行並繞過等候 |
