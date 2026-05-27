# CSV 匯入失敗場景詳細說明

## 📋 編碼支援

系統自動偵測並支援以下編碼：
- **Big5** (繁體中文) - 預設編碼
- **UTF-8** - 自動偵測 (若檔案包含 UTF-8 BOM)
- **GB2312/GBK** - 透過 Big5 相容處理

> ⚠️ **建議**: 使用 Excel 存檔為「CSV UTF-8 (逗點分隔)」格式，避免編碼問題

---

## ❌ 失敗場景總覽

| 場景代碼 | 失敗原因 | HTTP 狀態 | 是否中止導入 | 使用者應採取的行動 |
|---------|--------|---------|-----------|-----------------|
| `FILE_NOT_PROVIDED` | 未選擇檔案 | 400 | ✅ 是 | 選擇 CSV 檔案後重試 |
| `INVALID_FILE_TYPE` | 檔案格式不是 .csv | 400 | ✅ 是 | 確保檔案副檔名為 .csv |
| `FILE_TOO_LARGE` | 檔案超過 5MB | 400 | ✅ 是 | 分割檔案或刪除不必要的行 |
| `EMPTY_FILE` | CSV 檔案無資料 | 400 | ✅ 是 | 檢查檔案是否只有標題行 |
| `CSV_PARSE_ERROR` | 無法解析 CSV 結構 | 400 | ✅ 是 | 檢查檔案編碼和格式 |
| `INVALID_HEADERS` | 缺少必要欄位 | 400 | ✅ 是 | 添加: SKU, Name, Type 欄位 |
| `MISSING_REQUIRED_FIELDS` | 某行缺少必要資料 | 400 | ❌ 否 | 填入 SKU、Name、Type 資訊 |
| `INVALID_SKU_FORMAT` | SKU 包含非法字符 | 400 | ❌ 否 | 使用字母、數字、- 或 _ |
| `INVALID_QUANTITY` | 數量為非數字或負數 | 400 | ❌ 否 | 輸入非負整數 |
| `INVALID_MIN_STOCK` | 最低庫存為非數字或負數 | 400 | ❌ 否 | 輸入非負整數 |
| `DUPLICATE_SKU_IN_IMPORT` | SKU 在同一導入中重複 | 200 | ❌ 否 | ⚠️ 警告:使用最後出現的值 |
| `DUPLICATE_SKU` | SKU 已存在於資料庫 | 400 | ❌ 否 | 檢查 SKU 拼寫或使用更新 |
| `DATABASE_ERROR` | 資料庫操作失敗 | 400 | ❌ 否 | 聯絡管理員 |
| `SERVER_ERROR` | 伺服器內部錯誤 | 500 | ✅ 是 | 重試或聯絡技術支援 |

---

## 📝 詳細場景說明

### 1. FILE_NOT_PROVIDED (未選擇檔案)
**錯誤訊息**: `No file uploaded`
**詳細説明**: 請選擇一個CSV檔案進行上傳
```
原因: 沒有偵測到上傳的檔案
解決: 點擊「選擇檔案」按鈕並選擇一個 .csv 檔案
```

---

### 2. INVALID_FILE_TYPE (檔案格式不是 CSV)
**錯誤訊息**: `Only CSV files allowed`
**詳細説明**: 只接受CSV檔案格式
```
原因: 上傳的檔案副檔名不是 .csv
例: inventory.xlsx, inventory.txt, inventory.xls
解決: 在 Excel 中使用「另存新檔」→「CSV (逗點分隔)」
```

---

### 3. FILE_TOO_LARGE (檔案超過限制)
**錯誤訊息**: `File size exceeds limit`
**詳細説明**: 檔案大小超過限制
```
原因: 上傳的檔案超過 5MB 上限
限制: 5 MB
解決: 
  - 分割成多個較小的檔案
  - 刪除不必要的欄位
  - 只包含新增和更新的產品
```

---

### 4. EMPTY_FILE (CSV 無資料)
**錯誤訊息**: `CSV file is empty`
**詳細説明**: 檔案沒有包含任何數據行
```
原因: CSV 檔案只有標題行或完全為空
預期: 至少包含 1 行數據
解決: 確保檔案包含：
  - 第 1 行: 標題 (SKU,Name,Type,...)
  - 第 2+ 行: 產品數據
```

---

### 5. CSV_PARSE_ERROR (無法解析 CSV)
**錯誤訊息**: `Unable to parse CSV file`
**詳細説明**: 檔案可能已損壞或編碼不正確
```
原因: 
  - CSV 結構損壞（引號不配對）
  - 編碼不正確（非 Big5 或 UTF-8）
  - 檔案被損壞
解決:
  1. 檢查編碼：在 Notepad++ 中打開，確認編碼為 "Big5" 或 "UTF-8"
  2. 重新存檔：在 Excel 中「另存新檔」→「CSV (逗點分隔)」
  3. 檢查引號：確保逗點和引號使用正確
```

---

### 6. INVALID_HEADERS (缺少必要欄位)
**錯誤訊息**: `Missing required fields`
**詳細説明**: CSV 標題行缺少必要欄位
```
原因: 第一行標題不包含 SKU, Name, Type
範例:
  ❌ 錯誤: Name,Type,Model (缺少 SKU)
  ✅ 正確: SKU,Name,Type,Model,IsAccount,NoAccount,MinStock

必要欄位:
  - SKU         (產品編碼，不能重複)
  - Name        (產品名稱)
  - Type        (產品類型)

可選欄位:
  - Model       (型號)
  - IsAccount   (可計數庫存)
  - NoAccount   (不可計數庫存)
  - MinStock    (最低庫存量)
```

---

### 7. MISSING_REQUIRED_FIELDS (資料列缺少必要欄位)
**錯誤訊息**: `Row 5: Missing required fields`
**詳細説明**: 某一行的必要欄位為空
```
原因: 行 5 中，SKU、Name 或 Type 為空
例: SKU="", Name="印表機", Type="耗材" → ❌ SKU 缺失
解決:
  1. 檢查行 5 的所有必要欄位是否有值
  2. 不要留空白單元格
  3. 確保每行都有: SKU, Name, Type
```

---

### 8. INVALID_SKU_FORMAT (SKU 格式無效)
**錯誤訊息**: `Invalid SKU format`
**詳細説明**: SKU 包含非法字符
```
原因: SKU 只能包含字母、數字、連字號 (-) 和下劃線 (_)
例:
  ❌ 錯誤: "SKU@001", "SKU 001", "SKU.001"
  ✅ 正確: "SKU-001", "SKU_001", "SKU001"
解決:
  - 移除空格、特殊字符
  - 只使用字母 (A-Z)、數字 (0-9)、- 或 _
```

---

### 9. INVALID_QUANTITY (數量無效)
**錯誤訊息**: `Invalid quantity (IsAccount/NoAccount)`
**詳細説明**: 數量欄位不是非負整數
```
原因: 可計數 (IsAccount) 或不可計數 (NoAccount) 數量無效
例:
  ❌ 錯誤: "10.5", "-5", "abc", "10個"
  ✅ 正確: "0", "5", "100"
解決:
  - 輸入整數 (無小數點)
  - 不能為負數
  - 移除單位 (個、件等)
```

---

### 10. INVALID_MIN_STOCK (最低庫存無效)
**錯誤訊息**: `Invalid MinStock value`
**詳細説明**: 最低庫存欄位不是非負整數
```
原因: MinStock 欄位無效
規則: 同 INVALID_QUANTITY
```

---

### 11. DUPLICATE_SKU_IN_IMPORT (同導入中重複 SKU)
**類型**: ⚠️ **警告** (非中止錯誤)
**訊息**: `SKU duplicated in this import`
**詳細説明**: SKU 在同一個導入檔案中出現多次
```
原因: 檔案中行 5 和行 12 都有 SKU="SKU-001"
處理: 系統將使用最後出現的值 (行 12)
解決: 刪除重複的行，只保留一個
```

---

### 12. DUPLICATE_SKU (SKU 已存在於資料庫)
**錯誤訊息**: `SKU already exists in database`
**詳細説明**: 此 SKU 已在資料庫中存在
```
原因: SKU="SKU-001" 已經在系統中有記錄
選項 A - 檢查拼寫: 確認 SKU 是否打錯了
選項 B - 執行更新: 
  - 移除此行，改用「編輯產品」功能
  - 或在 CSV 中確保 SKU 唯一
選項 C - 批量更新:
  - 導出現有產品 (Export CSV)
  - 修改數量和資訊
  - 重新導入 (系統會自動偵測並更新)
```

---

### 13. DATABASE_ERROR (資料庫操作失敗)
**錯誤訊息**: `Database operation failed`
**詳細説明**: 資料庫無法處理此請求
```
可能原因:
  - 資料庫連線中斷
  - 儲存空間已滿
  - 權限問題
解決: 聯絡技術支援或系統管理員
```

---

### 14. SERVER_ERROR (伺服器內部錯誤)
**錯誤訊息**: `Server error`
**詳細説明**: 伺服器發生非預期的錯誤
```
解決:
  1. 檢查檔案格式和編碼
  2. 稍後重試
  3. 如果問題持續，聯絡技術支援
```

---

## ✅ 成功的導入回覆範例

```json
{
  "success": true,
  "message": "導入完成。新增 5 個產品，更新 3 個產品。",
  "imported": 5,
  "updated": 3,
  "encoding": "Big5 (Traditional Chinese)",
  "warnings": [
    {
      "row": 7,
      "reason": "DUPLICATE_SKU_IN_IMPORT",
      "message": "SKU 在此導入中重複: SKU-001",
      "details": "此 SKU 已在前面的行中出現。將使用最後一次出現的數據"
    }
  ]
}
```

---

## 🔧 部分成功的導入回覆範例

```json
{
  "success": true,
  "message": "導入完成。新增 3 個產品，更新 2 個產品。",
  "imported": 3,
  "updated": 2,
  "encoding": "UTF-8 (BOM detected)",
  "errors": [
    {
      "row": 5,
      "reason": "MISSING_REQUIRED_FIELDS",
      "message": "缺少必要欄位: SKU",
      "details": "行 5 的必要欄位不能為空。已收到: SKU=\"\", Name=\"印表機\", Type=\"耗材\""
    },
    {
      "row": 8,
      "reason": "INVALID_QUANTITY",
      "message": "可計數數量 (IsAccount) 無效",
      "details": "必須是非負整數。收到: \"abc\""
    }
  ]
}
```

---

## 💡 常見問題

### Q: Excel 存檔時應該選擇哪種格式？
**A**: 選擇「CSV (逗點分隔)(*.csv)」或「CSV UTF-8 (逗點分隔)(*.csv)」

### Q: 為什麼我的 CSV 無法解析？
**A**: 檢查編碼。右鍵 > 內容，或在 Notepad++ 中檢查編碼設定

### Q: 我可以同時導入和更新產品嗎？
**A**: 是的！系統會自動偵測：
- 新 SKU → 新增產品
- 現有 SKU → 更新產品

### Q: 如果導入失敗，會有多少行被保存？
**A**: 系統會逐行處理。失敗的行會跳過，成功的行會被保存

### Q: 我應該從哪裡下載 CSV 範本？
**A**: 點擊「下載範本」按鈕以取得正確格式的範本

---

## 📞 技術支援

如有任何問題，請提供以下資訊：
1. 完整的錯誤訊息（含原因代碼）
2. CSV 檔案範本（前 5 行）
3. 檔案編碼設定
4. 瀏覽器版本和作業系統
