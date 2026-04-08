## 第二條：任務交接與持久化 (Task Handover)

1. **[Status]**: Stable (Running in Docker)
2. **[Done]**: 
    - 實作了「依照型號查詢」功能，包含後端 `productsController.js` 的模糊篩選 API 與前端 `filter-model` 輸入框。
    - **[New]** 完成了全專案的 **Docker 化**。現在支援透過 `docker-compose up` 一鍵啟動，並具備 `restart: always` 的重啟能力。
    - **[New]** 實作了「系統更新」模組。包含後端 `systemController.js` (git fetch/pull & process.exit) 以及前端 Navbar 的「檢查更新」與更新提示交互。
3. **[Context]**: 
    - `src/controllers/systemController.js`
    - `public/js/app.js` (待重構)
    - `docker-compose.yml`
4. **[Pending]**: 
    - **[Law 4]** 強制重構 `public/js/app.js` (目前 1700+ 行)，將其拆分為 ES Modules 以落實模組化原則。
    - 優化 `productsController.js` (目前 252 行) 的邏輯結構。
5. **[Safety]**: 
    - 本地代碼在套用 Git 更新時需注意衝突。
    - Docker 卷掛載確保了 `database/` 與 `uploads/` 的資料持久性。
