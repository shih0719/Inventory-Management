# CSV 導入審計記錄系統 (最小版本)

## 📋 新增功能

### 1. 自動記錄導入歷史
每次成功導入 CSV 時，系統會自動記錄：
- **導入 ID** - 用於追蹤
- **導入者** - 執行導入的使用者名稱
- **時間戳** - 導入的日期和時間
- **數量統計**：
  - 新增產品數
  - 更新產品數
  - 錯誤行數
- **檔案資訊** - 原始檔案名稱和編碼
- **詳細資訊** - 導入的完整摘要

### 2. 審計日誌
導入完成後，系統會在 `audit_logs` 中記錄：
```
user_id: 執行導入的使用者
action: "IMPORT"
resource_type: "CSV_IMPORT"
resource_id: 導入記錄的 ID
timestamp: 自動記錄
```

### 3. 導入歷史查詢 API
#### 獲取所有導入記錄
```bash
GET /api/csv/imports?limit=50&offset=0
```

**回覆範例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "created_by_user": "benjamin",
      "imported_count": 5,
      "updated_count": 3,
      "error_count": 0,
      "file_name": "inventory.csv",
      "encoding": "Big5 (Traditional Chinese)",
      "details": {
        "total_rows": 8,
        "new_products": 5,
        "updated_products": 3,
        "errors": 0,
        "warnings": 0
      },
      "created_at": "2026-05-27T15:30:45Z"
    }
  ],
  "pagination": {
    "total": 10,
    "offset": 0,
    "limit": 50
  }
}
```

#### 獲取單個導入詳情
```bash
GET /api/csv/imports/{importId}
```

**回覆範例：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "created_by_user": "benjamin",
    "imported_count": 5,
    "updated_count": 3,
    "error_count": 0,
    "file_name": "inventory.csv",
    "encoding": "Big5 (Traditional Chinese)",
    "details": {
      "total_rows": 8,
      "new_products": 5,
      "updated_products": 3,
      "errors": 0,
      "warnings": 0
    },
    "created_at": "2026-05-27T15:30:45Z"
  }
}
```

---

## 💡 如何使用

### 導入 CSV 後
導入完成時，會返回 `import_id`：

```json
{
  "success": true,
  "message": "導入完成。新增 5 個產品，更新 3 個產品。",
  "import_id": 1,
  "imported": 5,
  "updated": 3,
  "encoding": "Big5 (Traditional Chinese)"
}
```

### 查詢導入記錄
使用 `import_id` 查詢該次導入的詳細資訊：

```bash
curl http://localhost:3000/api/csv/imports/1
```

### 查看完整歷史
查看所有導入記錄（分頁）：

```bash
# 第 1 頁（前 50 筆）
curl http://localhost:3000/api/csv/imports?limit=50&offset=0

# 第 2 頁
curl http://localhost:3000/api/csv/imports?limit=50&offset=50
```

---

## 📊 審計追蹤

### 場景 1：誤導入怎麼辦？

1. **查看導入記錄**
   ```bash
   GET /api/csv/imports/{importId}
   ```
   - 確認導入的時間、數量、檔案名稱

2. **查看審計日誌**
   ```bash
   GET /api/audit-logs?resource_type=CSV_IMPORT&resource_id={importId}
   ```
   - 確認誰執行了導入

3. **手動修復**
   - 編輯產品以糾正錯誤的數據
   - 所有修改都會被記錄在審計日誌中

### 場景 2：追蹤產品變更歷史

想知道某個產品什麼時候被導入或更新：
```bash
GET /api/audit-logs?resource_type=product&resource_id={productId}
```

---

## 🗄️ 資料庫結構

### csv_imports 表
```sql
CREATE TABLE csv_imports (
    id INTEGER PRIMARY KEY,              -- 導入 ID
    created_by_user TEXT,                -- 執行導入的使用者
    imported_count INTEGER,              -- 新增的產品數
    updated_count INTEGER,               -- 更新的產品數
    error_count INTEGER,                 -- 錯誤行數
    file_name TEXT,                      -- 原始檔案名稱
    encoding TEXT,                       -- 檔案編碼
    details TEXT,                        -- JSON 格式的詳細資訊
    created_at TEXT                      -- 導入時間戳
);
```

### audit_logs 擴展
導入時會添加記錄：
```sql
INSERT INTO audit_logs (user_id, action, resource_type, resource_id, timestamp)
VALUES (?, 'IMPORT', 'CSV_IMPORT', ?, now());
```

---

## ⚡ 便利的 TypeScript API

### 前端使用

```typescript
import { getImportHistory, getImportDetail } from '@/api/csv';

// 獲取導入歷史
const { data: imports, pagination } = await getImportHistory(50, 0);
console.log(`總共 ${pagination.total} 次導入`);

// 獲取單個導入詳情
const { data: importDetail } = await getImportDetail(1);
console.log(`導入者: ${importDetail.created_by_user}`);
console.log(`新增: ${importDetail.imported_count}, 更新: ${importDetail.updated_count}`);
```

---

## 🔍 常見用途

| 需求 | API 調用 |
|------|---------|
| 查看最近 10 次導入 | `GET /api/csv/imports?limit=10&offset=0` |
| 查看特定導入的詳情 | `GET /api/csv/imports/{importId}` |
| 查看誰執行了導入 | 檢查 `csv_imports.created_by_user` |
| 查看導入時間 | 檢查 `csv_imports.created_at` |
| 查看導入的影響 | 檢查 `imported_count` 和 `updated_count` |
| 追蹤誰修改了產品 | `GET /api/audit-logs?resource_id={productId}` |

---

## 🚀 下一步改進 (後續版本)

- [ ] CSV 預覽功能（導入前驗證）
- [ ] 交易支持（確保一致性）
- [ ] 導入回滾功能
- [ ] 批量導入操作追蹤

---

## ✅ 總結

現在，每次 CSV 導入都會被完整記錄，你可以：
1. ✅ 追蹤**誰**執行了導入
2. ✅ 確認**何時**導入
3. ✅ 查看**導入了什麼**（數量、檔案名稱）
4. ✅ 查詢導入的**詳細摘要**
5. ✅ 通過 API 查詢完整的導入歷史

避免了無記錄導入的問題！
