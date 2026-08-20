# 架構改進機會 (Architectural Deepening Opportunities)

本文檔記錄了 Inventory Management 系統的深化機會 — 通過重構將淺層模組整合成更具槓桿性的深層模組。

## 核心問題

系統目前採用 **Transaction Script 模式**，所有業務邏輯集中在 Controllers 中：
- 控制器直接操作資料庫 (無 Repository Pattern)
- 數量管理邏輯散落在 4 個 Controllers 中 (重複 6+ 次)
- 驗證邏輯分散且重複
- 難以獨立測試業務邏輯 (Express 耦合)

> ℹ️ 本文部分章節以 **Webhook** 為例說明重構動機；Webhook 功能目前**尚未實作**（無對應 route/service），僅作為假想情境。

---

## 深化機會清單

### **1. Extract Product Domain Model**

**涉及檔案**:
- `src/controllers/productsController.js`
- `src/controllers/transactionsController.js`
- `src/controllers/batchesController.js`
- `src/controllers/productUnitsController.js`
- `src/services/quantityStateService.js`

**問題**：
- 數量欄位選擇邏輯重複 6+ 次：`const quantityField = type === "accountable" ? "accountable_quantity" : "non_accountable_quantity"`
- 控制器直接存取 Product 欄位，無封裝
- 最低庫存檢查、AP 限制等業務規則散落各處

**解決方案**：
建立 `Product` 類，封裝：
- `getQuantityField(type)` — 根據類型返回數量欄位名
- `updateQuantity(delta, type)` — 驗證並計算新數量
- `isLowStock()` — 檢查是否低於 min_stock 閾值
- `canTrackSerial()` — AP 操作是否允許

**收益**：
- **局部性 (Locality)**: 數量邏輯集中在一處，不分散於 Controllers
- **槓桿度 (Leverage)**: 任何新的數量規則 (如「有帳數量不可為負」) 自動應用到全系統
- **可測性**: `Product.updateQuantity()` 可獨立測試，無需 Express 模擬

**範例**：
```javascript
// 改進前：transactionsController 中
const quantityField = quantity_type === "accountable" ? "accountable_quantity" : "non_accountable_quantity";
const currentQty = product[quantityField];
const validation = quantityStateService.validate(currentQty, quantity_change, { quantityType: quantity_type });

// 改進後：Product 模組
const product = new Product(dbRow);
const result = product.updateQuantity(quantity_change, quantity_type);
if (!result.ok) throw new QuantityError(result.reason);
```

---

### **2. Extract Transaction Use Case / Interactor**

**涉及檔案**:
- `src/controllers/transactionsController.js`
- `src/services/quantityStateService.js`
- `src/services/webhookService.js`

**問題**：
- `transactionsController.create()` 混合 HTTP 關注 (解析 req、送 res) 與業務邏輯 (驗證、更新數量、觸發 webhook)
- 難以獨立測試業務邏輯 (必須模擬 Express)
- 無法從 CLI、背景任務或外部系統重用該邏輯

**解決方案**：
提取 `CreateTransactionUseCase`：
```typescript
class CreateTransactionUseCase {
  async execute(
    productId: number,
    tagId: number,
    quantity: number,
    quantityType: string,
    locationId?: number,
    remarks?: string
  ): Promise<Transaction>
}
```

工作流：
1. 驗證輸入 (產品存在、tag 合法、數量有效)
2. 透過 Product 模型更新數量
3. 持久化 Transaction 記錄
4. 觸發 webhook (inventory.changed, inventory.low)
5. 回傳完整 Transaction 物件

Controller 變薄：驗證請求 → 呼叫 use case → 格式化回應

**收益**：
- **可測性**: 業務邏輯獨立於 Express，可單元測試
- **可重用性**: Use cases 可從 CLI、batch jobs、webhook handlers 呼叫
- **清晰度**: Use case 按工作流命名 (CreateTransaction, BulkSellAP, CreateBatch)，一目瞭然

**測試對比**：
```javascript
// 改進前：需模擬 Express request/response
it('should create transaction', async () => {
  const req = { body: { ... }, params: { productId: 1 } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await transactionsController.create(req, res);
  expect(res.json).toHaveBeenCalled();
});

// 改進後：純業務邏輯測試
it('should create transaction', async () => {
  const useCase = new CreateTransactionUseCase(repository);
  const result = await useCase.execute(1, 2, 10, 'accountable');
  expect(result.quantity_change).toBe(10);
  expect(result.id).toBeDefined();
});
```

---

### **3. Extract Repository Pattern**

**涉及檔案**:
- 所有 Controllers (`src/controllers/*.js`)
- `src/config/database.js`

**問題**：
- 9 個 Controllers 直接構建 SQL 並呼叫 `db.run()`, `db.get()`, `db.all()`
- Schema 變更會波及所有檔案
- 分頁邏輯重複 4+ 次 (productsController, transactionsController, batchesController, productUnitsController)
- 無 Query Builder 或 Criteria 抽象

**解決方案**：
建立 Repositories：
```javascript
class ProductRepository {
  async findById(id): Product
  async findBySKU(sku): Product
  async findAll(filter): Product[]
  async save(product): Transaction
}

class TransactionRepository {
  async save(transaction): Transaction
  async findByProductId(id, pagination): Transaction[]
}

class BatchRepository {
  async findById(id): Batch
  async save(batch, transactions): Promise<{ batchId, transactionIds }>
}
```

每個 Repository 負責構建 SQL、執行查詢、對應回領域物件。

**收益**：
- **局部性**: Schema 變更隔離在 Repositories
- **槓桿度**: 分頁、查詢構建、驗證邏輯可集中
- **可測性**: Repositories 可被記憶體內實作替換 (用於測試)
- **換層性**: 未來可升級到 ORM，只需改 Repositories

**交界點清晰化**：
```javascript
// 改進前：Schema 暴露在 Controller
const products = await db.all(
  'SELECT * FROM products WHERE is_deleted = 0 LIMIT ? OFFSET ?',
  [limit, offset]
);

// 改進後：透過 Repository
const products = await productRepository.findAll({
  deleted: false,
  page: pageNum,
  limit: pageSize
});
```

---

### **4. Extract Webhook Service Contract**

**涉及檔案**:
- `src/services/webhookService.js`
- `src/controllers/webhooksController.js`
- `src/controllers/transactionsController.js`
- `src/controllers/batchesController.js`

**問題**：
- Controllers 呼叫 `webhookService.fire()` 採用 Fire-and-Forget，無 SLA 保證
- 若 webhook 失敗，呼叫端無法知悉或重試
- Webhook 日誌存在資料庫，但無警示、無手動重試機制
- 交付狀態對外不可見 (opacity)

**解決方案**：
明確化 Webhook 交付合約：

1. **Delivery Ticket 模式**：`fire()` 不回傳 Promise，而是回傳票據
   ```javascript
   const ticket = webhookService.fire('inventory.changed', { productId: 1, ... });
   // ticket = { ticketId: 'evt-123', subscriptionIds: [1, 2, 3] }
   ```

2. **交付狀態端點**：
   ```javascript
   GET /webhooks/delivery-status/:ticketId
   // { ticketId, event, status, attemptedAt, results: [...] }
   ```

3. **死信隊列** (可選)：失敗超過 3 次的交付進入隊列，支援手動重試

4. **SLA 文檔**：
   - Fire-and-forget (非同步，client 無需等待)
   - 最多重試 3 次 (exponential backoff: 1s, 3s, 9s)
   - 失敗不會回滾業務操作 (eventually consistent)

**收益**：
- **局部性**: Webhook 交付語意文檔化且可測
- **可觀測性**: 系統可回報哪些 webhook 成功/失敗
- **槓桿度**: 重試、circuit-breaker、死信隊列邏輯集中，其他服務可複用
- **除錯性**: 操作人員可查詢交付狀態排查問題

---

### **5. Extract Tag Repository & Service**

**涉及檔案**:
- `src/controllers/productUnitsController.js`
- `src/controllers/tagsController.js`

**問題**：
- Tags 是魔術字符串 ('INBOUND', 'OUTBOUND')，在 `productUnitsController` 中重複查詢
- 若 tag 不存在，代碼默默跳過操作 (line 140: `if (inboundTag) { ... }`)，無錯誤拋出
- 重新命名 tag 需在全碼基搜尋字符串
- 無集中的 Tag 定義點

**解決方案**：
建立 `TagRepository` 與 `TagService`：
```javascript
class TagService {
  async initialize() {  // 啟動時載入所有 tags
    this.tagsByName = await tagRepository.findAll();
  }
  
  getByName(name) {  // O(1) 記憶體查詢，無 DB 呼叫
    const tag = this.tagsByName[name];
    if (!tag) throw new TagNotFoundError(`Tag '${name}' not found`);
    return tag;
  }
}
```

在容器啟動時初始化，快取到記憶體。Controllers 改用：
```javascript
const inboundTag = tagService.getByName('INBOUND');  // 拋出例外若缺失
```

**收益**：
- **局部性**: Tag 參考集中，易於重命名
- **槓桿度**: 可在一處新增 tag 驗證、稽核、快取邏輯
- **清晰度**: 呼叫端知道 tags 是什麼；若缺失會快速失敗

---

### **6. Extract Validation & DTO Layer**

**涉及檔案**:
- 所有 Controllers (`src/controllers/*.js`)

**問題**：
- 驗證邏輯嵌入 Controllers，散落各地
- Batch 驗證發生在 3 階段流程的第 1 階段，難以獨立測試
- 驗證規則無法被 CLI、匯入、或其他入口點重用
- 無 structured validation errors (每個 controller 回傳格式不同)

**解決方案**：
建立 Validators 與 DTOs：
```javascript
class CreateTransactionValidator {
  static validate(data): ValidationResult {
    // { ok, errors: [{ field, message }], data: ParsedDTO }
  }
}

class CreateBatchValidator {
  static validate(items): ValidationResult {
    // 驗證每個 item，回傳 ok items 與 failed items
  }
}

// DTO 代表已驗證的資料
class CreateTransactionDTO {
  productId: number;
  tagId: number;
  quantity: number;
  quantityType: string;
}
```

Controller 變簡單：
```javascript
const validation = CreateTransactionValidator.validate(req.body);
if (!validation.ok) return res.status(400).json({ errors: validation.errors });
const dto = validation.data;
const transaction = await createTransactionUseCase.execute(dto);
```

**收益**：
- **清晰度**: 驗證規則明確且命名
- **可測性**: Validators 是純函式，可單元測試
- **可重用性**: 驗證可用於 API、CLI、匯入流程
- **一致性**: 所有端點驗證錯誤格式統一

---

## 實施優先級建議

### 優先級 1: Product Domain Model + Transaction Use Case
**原因**: 基礎性改進，解鎖後續重構。完成後，Repository Pattern 和 Validation 變得自然。

### 優先級 2: Repository Pattern  
**原因**: 實現後，schema 變更波及面縮小，Controllers 進一步變薄。

### 優先級 3: Tag Service + Webhook Contract
**原因**: 中等收益，改進可觀測性與容錯性，相對低風險。

### 優先級 4: Validation & DTO Layer
**原因**: 高收益但改動廣泛，宜在 use cases 穩定後進行。

---

## 刪除測試 (Deletion Test)

對於候選模組，應用「刪除測試」驗證其是否值得深化：

| 模組 | 刪除會發生什麼？ | 結論 |
|------|---|---|
| `Product Domain Model` | 數量邏輯散落回 4 個 Controllers | ✓ 值得深化 (集中複雜性) |
| `CreateTransactionUseCase` | 業務邏輯無法從非 HTTP 入口點呼叫 | ✓ 值得深化 (可重用性) |
| `Repository Pattern` | SQL 構建與 schema 邏輯分散於 Controllers | ✓ 值得深化 (集中維護點) |
| `TagService` | 硬編碼字符串與 DB 查詢回到各 Controllers | ✓ 值得深化 (集中定義) |
| `WebhookContract` | 交付狀態對外不可見，故障排查困難 | ✓ 值得深化 (可觀測性) |

---

## 架構詞彙 (Language)

本文檔使用一致的架構術語（參考 `/improve-codebase-architecture` 技能）：

- **Module** — 任何有介面與實作的東西 (function, class, package)
- **Interface** — 呼叫端須知的一切 (型別、不變量、錯誤模式、順序、設定)
- **Depth** — 介面槓桿度：少量介面後隱藏大量行為 = 深層，介面複雜度接近實作 = 淺層
- **Seam** — 介面存活的地方；無須編輯即可改變行為的位置 (dependency injection)
- **Locality** — 集中性：相關變更、錯誤、知識集中在一個地方
- **Leverage** — 呼叫端獲得的：一個模組為多少個呼叫端提供一致的行為

---

## 領域術語 (Domain Language)

遵循 `CONTEXT.md` 中定義的術語：
- **Product** — 庫存基本單位 (SKU 唯一識別)
- **AP / 序號品** — 序號追蹤的產品個體
- **Transaction** — 庫存異動紀錄 (不可變)
- **Quantity Type** — Accountable (有帳) vs Non-Accountable (無帳)
- **Batch** — 一次操作的相關 Transactions 集合
- **Event / Webhook** — 系統廣播的領域事件

---

## 決策記錄

- **為何不用 ORM?** 現有 `sqlite3` API 便於控制流程。ORM 改進可後續逐步採納 (Repository 層會隱藏細節)。
- **為何不立即 refactor?** 系統運作良好，重構應由實際維護成本驅動。建議先監測哪些深化機會帶來最大回報。
- **為何先做 Product Model?** 數量邏輯是全系統最重複、最易出錯的部分。集中它會立即提升測試與變更信心。

---

## 相關文件

- `CONTEXT.md` — 領域術語表
- `docs/adr/0001-ap-no-history-tracking.md` — AP 設計決策
