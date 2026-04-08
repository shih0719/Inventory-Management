## 第二條：任務交接與持久化 (Task Handover)

1. **[Status]**: Stable (CSV ANSI-Big5 Fix)
2. **[Done]**: 
    - 將 CSV 匯出編碼從 UTF-8 + BOM 改為 **ANSI (Big5)**。
    - 使用 `iconv-lite` 進行編碼轉換，優化繁域 Windows / Excel 之相容性。
3. **[Context]**: 
    - `src/controllers/csvController.js`
4. **[Pending]**: 
    - 觀察匯入邏輯是否也需要對應的自動編碼偵測（目前固定解碼 Big5）。
5. **[Safety]**: 
    - ANSI (Big5) 無法表示部分 Unicode 特殊字元（如部分罕見字或外文），若產品名稱包含此類字元可能會出現問號。
