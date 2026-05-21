# ⚡ 快速開始 — 前端現代化重構

## 📌 當前狀態
✅ **重構完成** — Day 1, 2, 3 全部完成  
✅ **Vite 開發服務器** 運行中 (http://localhost:5174)  
✅ **生產構建** 成功 (dist/ 已生成)  

---

## 🎯 立即測試（5 分鐘）

### 1️⃣ 訪問開發環境
```bash
# 瀏覽器打開
http://localhost:5174
```

**預期結果：**
- ✅ 頁面加載，顯示產品列表表格
- ✅ Navigation bar 頂部有「下載範本」「匯入」「匯出」按鈕
- ✅ Console（F12）無紅色錯誤

### 2️⃣ 快速功能檢查
| 功能 | 操作 | 預期 |
|-----|------|-----|
| **產品加載** | 頁面打開 | 自動加載產品列表 |
| **搜尋** | 輸入 SKU 並點擊搜尋 | 表格過濾更新 |
| **編輯** | 點擊「Edit」按鈕 | 彈出產品編輯模態框 |
| **刪除** | 點擊「Delete」按鈕 | 確認對話框出現 |
| **通知** | 任何操作後 | 右上角短暫顯示成功/失敗提示 |
| **CSV 匯出** | 點擊「匯出 CSV」 | 下載 CSV 檔案 |

### 3️⃣ 檢查開發者工具
```
F12 開啟開發者工具 → Console 標籤
```

**應該看到：**
```
✅ Tags loaded
✓ Locations loaded
✓ Products loaded
✓ Transactions loaded
✓ Batches loaded
✓ Webhooks loaded
✓ Product units loaded
✓ Event listeners bound
✅ 應用初始化完成
```

**如果看到紅色錯誤，請記錄錯誤信息並參考「故障排除」**

---

## 📁 文件結構一覽

```
public/
├── src/
│   ├── main.js              ← 應用入點
│   ├── state.js             ← 全局狀態
│   ├── mutations.js         ← 狀態修改規範
│   ├── styles/main.css      ← Tailwind + 自定義樣式
│   └── modules/             ← 8 個業務模塊
│       ├── products.js      (產品 CRUD)
│       ├── locations.js     (儲位)
│       ├── transactions.js  (異動)
│       ├── batches.js       (批次)
│       ├── webhooks.js      (訂閱)
│       ├── productUnits.js  (AP)
│       ├── csvImportExport.js
│       └── utils.js         (通知、格式化)
├── dist/                    ← 生產構建輸出
├── index.html               ← 主頁面（已更新）
├── package.json             ← NPM 依賴 + 腳本
├── vite.config.js          ← Vite 配置
├── tailwind.config.js      ← Tailwind 配置
└── postcss.config.js       ← PostCSS 配置
```

---

## ⚙️ 常用命令

### 開發工作流
```bash
cd public

# 啟動開發服務器（自動監聽文件變化）
npm run dev

# 停止開發服務器
Ctrl+C

# 安裝新依賴
npm install [package-name]
```

### 生產構建
```bash
cd public

# 構建生產資源（生成 dist/）
npm run build

# 預覽生產構建
npm run preview
```

---

## 🔧 常見問題快速回答

### Q: Vite 已經在運行，我可以修改代碼嗎？
✅ **是的！** 修改 `src/` 中的任何文件後，Vite 會自動熱更新（無需刷新頁面）。

### Q: 為什麼我看到 Tailwind CDN 被移除了？
✅ **正確！** Tailwind 現在本地編譯（`npm run build` 時），包體積更小，性能更好。

### Q: 新代碼如何部署到生產？
```bash
# 1. 進行必要的修改
# 2. 重新構建
npm run build
# 3. 將 dist/ 中的文件部署到服務器
```

### Q: 如何添加新的模塊？
1. 在 `src/modules/newFeature.js` 中創建新文件
2. 導出函數（例：`export function doSomething() { ... }`)
3. 在 `src/main.js` 中導入並綁定到 `window.__modules`
4. 完成！

### Q: 怎樣回到舊的 app.js 版本？
❌ **不建議** — 新的模塊化架構是為了未來維護。如需調試，舊 `js/app.js` 仍在備份中。

---

## 📊 重構對比

| 指標 | 舊版 | 新版 | 改進 |
|------|------|------|------|
| 主文件行數 | 2300+ | 每個 100-300 | 🟢 80% ↓ |
| CSS 方案 | CDN | 本地編譯 | 🟢 更快 |
| 開發體驗 | 手動刷新 | 熱更新 | 🟢 自動 |
| 包體積 | 未優化 | 優化 | 🟢 更小 |
| 框架遷移 | 困難 | 容易 | 🟢 預留 |

---

## 🚀 下一步建議

### 立即執行
1. ✅ 在瀏覽器測試（http://localhost:5174）
2. ✅ 檢查 Console 無錯誤
3. ✅ 測試核心功能（產品、異動、批次）

### 短期（今天）
- 修復任何發現的功能缺陷
- 運行 `npm run build` 驗證生產構建
- 更新部署腳本（參考 `docs/DEPLOYMENT_VITE.md`）

### 中期（本週）
- 考慮 HTML 分割（預留給 Vue/React 遷移）
- 添加單元測試（Jest + 模塊化測試）
- 性能分析與優化

### 長期（未來）
- 遷移到 Vue 3 / React（架構已支持，只需改 UI 層）
- PWA 支持（離線模式）
- 更高級的狀態管理工具

---

## 📞 需要幫助？

### 檢查列表
- [ ] Vite 開發服務器運行中
- [ ] http://localhost:5174 頁面加載正常
- [ ] Console 無紅色錯誤
- [ ] 產品列表加載
- [ ] 至少一個操作（編輯/刪除）工作正常

### 如果還有問題
1. 檢查 `REFACTOR_SUMMARY.md` — 完整的測試清單
2. 檢查 `docs/DEPLOYMENT_VITE.md` — 部署與配置
3. 檢查 `docs/adr/0002-frontend-modularization-with-vite.md` — 架構決策

---

**🎉 恭喜！** 你現在已經有一個現代化的、可維護的、為未來框架遷移做好準備的前端！

祝開發順利！ 🚀
