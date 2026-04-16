## 第二條：任務交接與持久化 (Task Handover)

1. **[Status]**: Stable
2. **[Done]**: 
    - 整理並建立完整 API Reference 文件（共 25 個端點，9 個資源群組）。
    - 文件路徑：`.gemini/antigravity/brain/3368d679-3a0f-4eed-b2f9-7a36a607c882/API_REFERENCE.md`
    - 前次工作：將 CSV 匯出編碼從 UTF-8 + BOM 改為 **ANSI (Big5)**，使用 `iconv-lite` 轉換，提升 Windows/Excel 相容性。
3. **[Context]**: 
    - `src/controllers/` — 所有業務邏輯（7 個 controller 對應 7 個路由）
    - `src/routes/` — Express 路由定義
    - `server.js` — 入口點，掛載所有路由
4. **[Pending]**: 
    - 觀察 CSV 匯入邏輯是否需要自動編碼偵測（目前固定解碼 Big5）。
    - Transactions API 目前缺少 `GET /api/transactions/:id`（查單筆），可考慮補充。
    - Locations `:tag` 路由參數實際上是儲位「名稱」（非 NFC tag），命名可考慮統一重構。
5. **[Safety]**: 
    - ANSI (Big5) 無法表示部分 Unicode 特殊字元，如商品名稱有罕見字可能出現問號。
    - `POST /api/system/apply-update` 會觸發 `process.exit(1)` 強制重啟，需搭配 Docker `restart: always`。
    - Batches 批次處理為「部分成功即 COMMIT」語意，前端需留意 `errors` 陣列。
