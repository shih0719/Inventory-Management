# TODO — 序號批次出庫（Bulk Sell）

## 開發目的

補齊序號管理的出庫流程。目前只有批次入庫（`POST /api/product-units/bulk`），出庫只能單筆操作。
本次新增批次出庫 API，並同步補上入庫/出庫自動建立 Transaction 的功能，解決帳實不符需手動維護的問題。

---

## 設計決策

- **出庫觸發**：掃 QR code，每行一個序號，與批次入庫操作方式一致
- **共用欄位**：整批共用 `project_case`（必填）、`sold_to`（選填）、`remarks`（選填）
- **失敗策略**：All-or-nothing — 任何一筆驗證失敗，整批不寫入，回傳錯誤清單
- **自動 Transaction**：入庫/出庫成功後自動建立對應 Transaction，不再需要手動操作
  - 入庫 → `tag = INBOUND`，`quantity_change = +N`
  - 出庫 → `tag = OUTBOUND`，`quantity_change = -N`
  - 備註統一加「系統自動」
- **跨品項**：若批次序號屬於不同 product，依 product 分組各自建立一筆 Transaction

---

## 任務清單

### 1. 新增 `bulkSell` — `POST /api/product-units/bulk-sell`

- **檔案**：`src/controllers/productUnitsController.js`
- **Request payload**：
  ```json
  {
    "serial_numbers": ["SN-001", "SN-002"],
    "project_case": "P2026-A12",
    "sold_to": "Customer ABC",
    "remarks": "optional"
  }
  ```
- **驗證規則（全部通過才寫入）**：
  - `serial_numbers` 非空陣列（必填）
  - `project_case` 必填
  - 每筆序號：存在於 DB、狀態為 `in_stock`、批次內不重複
- **成功流程（單一 DB transaction）**：
  1. 批次 UPDATE `product_units` → status `sold`，填入 `project_case`、`sold_to`、`sold_at = NOW()`
  2. 依 product_id 分組，各建一筆 Transaction（`tag = OUTBOUND`，`quantity_change = -N`，remarks = 「系統自動」）
- **Response 失敗**：
  ```json
  {
    "success": false,
    "errors": [
      { "serial_number": "SN-999", "reason": "序號不存在" },
      { "serial_number": "SN-001", "reason": "已出庫" }
    ]
  }
  ```
- **Response 成功**：
  ```json
  {
    "success": true,
    "sold": 3,
    "transactions_created": 1
  }
  ```
- **驗收**：
  - 正常批次出庫成功，DB 內序號狀態改為 `sold`，自動產生 OUTBOUND Transaction
  - 含一筆不存在序號時整批失敗，回傳明確錯誤清單
  - 含一筆已出庫序號時整批失敗
  - `project_case` 未填時回 400

### 2. 新增路由 `POST /api/product-units/bulk-sell`

- **檔案**：`src/routes/productUnits.js`
- **驗收**：`POST /api/product-units/bulk-sell` 回應正確，不影響現有路由

### 3. 修改 `bulkCreate` — 入庫自動建 Transaction

- **檔案**：`src/controllers/productUnitsController.js`
- **變更**：`bulkCreate` 成功插入後，依 product 分組自動建一筆 Transaction（`tag = INBOUND`，`quantity_change = +inserted 數`，remarks = 「系統自動」）
- **注意**：`tag_id` 需從 `tags` 表查 `name = 'INBOUND'` 取得，不可寫死數字
- **驗收**：
  - 批次入庫 3 筆成功後，Transaction 紀錄自動出現一筆 INBOUND +3
  - 部分失敗（入 3 筆、失敗 1 筆）時，Transaction 依實際 inserted 數（+2）建立
  - 既有批次入庫的部分成功行為不受影響

### 4. UI — 批次出庫表單（序號 modal 內）

- **檔案**：`public/index.html`、`public/js/app.js`
- **設計細則**：
  - 在序號 modal 內新增「批次出庫」區塊，與現有「批次入庫」區塊並列
  - textarea 一行一個序號（與入庫一致）
  - 欄位：`project_case`（必填）、`sold_to`（選填）、`remarks`（選填）
  - 送出後以清單形式顯示成功/失敗明細（與 bulkCreate 的錯誤顯示風格一致）
- **驗收**：
  - 掃入 3 個序號，填 `project_case`，送出成功，清單更新
  - 含一個不存在序號時，整批失敗，明確顯示哪個序號有問題
  - `project_case` 未填時前端擋住不送出

---

## 不在本次範圍

- 出庫 Webhook 事件（AP 操作不 fire webhook，維持現狀）
- 出庫歷史紀錄（維持 ADR 0001 決定）
- 退貨/歸還流程（單筆改回 `in_stock` 已可操作）
