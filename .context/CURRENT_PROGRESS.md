## 第二條：任務交接與持久化 (Task Handover)

1. **[Status]**: Stable
2. **[Done]**: 
    - 完成了前端 `public/index.html` UI 結構成立，新增了「產品櫃位」與對應的 Modals。
    - 完成了前端 `public/js/app.js` 的 JS 串接邏輯，包含增刪查改 API 以及對 Transaction/Batch 功能的屬性傳遞。
    - 在「查看櫃位內容」的表格中，為每項產品加入了「異動」及「解除綁定」的操作按鈕，並能夠自動預填所屬櫃位。
    - 將原本的「櫃位管理」Modal 改為直接在主頁面上（產品列表上方）呈現，提升管理直覺性。
    - 新增了「快速掃描 / 查詢櫃位」區塊。支援條碼掃描槍與相機掃描。
    - **[New]** 實作了 URL 參數支援 (`?location=xxx`)，掃描 QR Code 可直接開啟櫃位視窗。
    - **[New]** 新增了「櫃位標籤」生成與列印功能，整合 `qrcode.js` 自動生成包含伺服器 IP 的跳轉連結。
    - **[New]** 實作了後端 IP 分配偵測 (`/api/info`)，解決手機掃描時 `localhost` 無法存取的連線問題。
    - **[New]** 建立了 `skills/inventory_query` Skill，讓 AI Agent 能透過 API 查詢庫存，支援遠端主機 IP 配置且可在腳本內預設 `DEFAULT_HOST`。
3. **[Context]**: 
    - `public/js/app.js`
    - `server.js`
    - `public/index.html`
4. **[Pending]**: 
    - 目前功能實作已完成，暫無待辦項目。
5. **[Safety]**: 
    - 伺服器 IP 偵測依賴 Node.js `os` 模組，僅返回第一個非 Internal 的 IPv4 位址。若有多個網路卡，建議檢查顯示的 URL。
