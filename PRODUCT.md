# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

公司內部團隊，三種角色混用同一套系統，沒有單一主要使用者：

- **倉管人員**：在倉庫現場做入庫、出庫、盤點與 AP（序號品）登記。
- **業務／專案人員**：查詢庫存、建立出貨單（Shipment），追蹤客戶與案子（project_case）。
- **主管／管理者**：查看報表、低庫存警示與審計日誌，管理倉庫和使用者權限。

角色對應系統權限 `admin` / `manager` / `view`。

## Product Purpose

讓公司內部準確掌握多個倉庫的庫存：每一筆數量變動都留下不可改寫的 Transaction 歷史，有帳與無帳庫存分開計算，高單價商品（AP）逐台追蹤序號和去向。

成功的標準：帳面數量和實際庫存一致，出貨能追溯到客戶與案子，操作錯誤可以從歷史和審計日誌查出來。

## Positioning

這是一套公司自用的內部工具，不對外販售。它依照這家公司自己的帳務模型打造：

- 有帳／無帳雙軌數量（Quantity Type）。
- AP 序號品的生命週期（in_stock → sold，出貨時必須填 project_case）。
- 批次異動採 Strict Mode，任一項驗證失敗就整批取消（全有或全無）。

## Operating Context

- **輸入方式**：搭配條碼掃碼槍，輸入 SKU 或 AP 的 serial_number。掃碼槍等同快速鍵盤輸入，輸入框需要能接住連續掃描。
- **多倉庫**：使用者先選定目前的倉庫，所有資料和 API 請求都限定在該倉庫範圍內（`X-Warehouse-Id`）。
- **CSV 匯入匯出**：使用 Big5 編碼，讓 Excel 開啟繁中不會亂碼。
- **部署**：Docker 部署在公司內部主機。每 6 小時自動備份，可設定每週用 Email 寄送備份。
- **主要裝置**：尚未確認。目前只確認會搭配掃碼槍；桌機、平板、手機的比重待定。

## Capabilities and Constraints

- 商品 CRUD 採軟刪除；SKU 是業務主鍵，CSV 匯入以 SKU 做 upsert。
- 每筆 Transaction 是一筆不可改寫的歷史紀錄，目前沒有刪除機制。
- AP（`product_units`，`track_serial = 1` 的商品）：
  - serial_number 全域唯一，會 trim 並轉成大寫。
  - 新增或刪除 AP 不會自動同步 `accountable_quantity`，UI 只在兩者不一致時顯示警示。
- Shipment 不追蹤物流狀態；Transaction 最多只能屬於一張 Shipment；刪除 Shipment 只解除關聯。
- 低庫存只比較 `accountable_quantity` 和 `min_stock`；`min_stock = 0` 表示不警示。
- 介面語系：繁中、簡中、英文、日文（en / zh / zh-cn / ja）。
- 認證目前只支援 local 帳密；Microsoft SSO 還沒實作。
- 領域術語以 `CONTEXT.md` 為準。

## Brand Commitments

產品在各語系的名稱：

| 語系 | 名稱 |
|---|---|
| 英文 | Stockroom |
| 繁中 | 小倉庫存 |
| 日文 | 在庫管理室 |
| 簡中 | 小仓库存 |

除了產品名稱，沒有其他已確認的品牌資產或語氣規範。

## Evidence on Hand

- 領域術語表：`CONTEXT.md`
- 架構決策：`docs/adr/`
- API 文件：`docs/api/README.md`
- 營運文件：`docs/operations/`

這是內部工具，沒有客戶推薦、案例或對外宣傳素材，也不應捏造這類內容。

## Product Principles

1. **帳要對得起來**：數量的正確性和可追溯性優先於操作速度。所有變動都經由 Transaction 留痕。
2. **錯誤要擋在前面**：批次全有或全無、序號正規化、出貨必填案子。寧可拒絕，也不要寫入半套資料。
3. **掃碼優先的輸入**：高頻操作要能靠掃碼槍和鍵盤完成，不依賴滑鼠多次點擊。
4. **同一套介面服務三種角色**：用權限控制能做什麼，而不是為不同角色各做一套系統。
