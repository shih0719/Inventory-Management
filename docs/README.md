# 文檔索引 (Documentation Index)

本目錄包含 Inventory Management 系統的各類文檔。

## 檔案組織

本目錄下的文檔分為核心與營運兩大類。詳見 [`ORGANIZATION.md`](ORGANIZATION.md)：為何某些文檔放根目錄，某些放 docs/ 內。

---

## 核心文檔

### 系統設計與決策

| 檔案 | 標籤 | 描述 |
|------|------|------|
| [`improve.md`](improve.md) | 📈 **優化建議** | 架構深化機會清單，列舉 6 個重構候選、優先級與實施建議 |
| [`adr/0001-ap-no-history-tracking.md`](adr/0001-ap-no-history-tracking.md) | 📋 **架構決策紀錄** | AP (序號品) 設計決策：不追蹤歷史紀錄的理由與影響 |

### API 與集成

| 檔案 | 標籤 | 描述 |
|------|------|------|
| [`API.md`](API.md) | 🔗 **API 參考** | 完整 API 端點文檔（10 個路由、參數、回應範例、常見操作） |

### 營運與部署

詳見 [`operations/README.md`](operations/README.md)

| 檔案 | 標籤 | 描述 |
|------|------|------|
| [`operations/BACKUP.md`](operations/BACKUP.md) | 🔄 **備份與復原** | 資料庫備份策略、備份位置、手動復原步驟 |
| [`operations/LOGGING.md`](operations/LOGGING.md) | 📝 **日誌系統** | 日誌架構、日誌等級、日誌查詢與分析 |
| [`operations/UPDATE.md`](operations/UPDATE.md) | 🚀 **更新部署** | 應用更新機制、部署流程、重啟策略 |

### Agent 配置文檔

| 檔案 | 標籤 | 描述 |
|------|------|------|
| [`agents/domain.md`](agents/domain.md) | 🤖 **Agent 指引** | 領域知識提示，用於 Claude Code agents 理解系統架構 |
| [`agents/issue-tracker.md`](agents/issue-tracker.md) | 🤖 **Agent 指引** | Issue tracker 整合指引，用於 agents 管理工單 |
| [`agents/triage-labels.md`](agents/triage-labels.md) | 🤖 **Agent 指引** | 問題分類標籤定義，用於 agents 進行分流 |

---

## 文檔類型說明

### 🔗 API 參考 (API.md)
- **目的**: 列舉所有 API 端點、參數、回應格式與範例
- **受眾**: 開發者、API 消費者、前端工程師、外部系統集成
- **更新頻率**: 每當新增或修改 API 端點時
- **格式**: 分類列表 + cURL 範例 + 常見操作流程

### 📈 優化建議 (improve.md)
- **目的**: 識別與優先化架構改進機會
- **受眾**: 架構師、senior 開發者、refactor 決策者
- **更新頻率**: 按需 (每當發現新的深化機會時)
- **相關文檔**: 參考 `CONTEXT.md` (領域術語) 與 ADRs (既有決策)

### 📋 架構決策紀錄 (ADR, docs/adr/)
- **目的**: 記錄重要架構決策的背景、方案、取捨、與未來觸發條件
- **格式**: Markdown，遵循 MADR 格式 (問題、決策、替代方案、取捨)
- **命名**: `NNNN-kebab-case-title.md`
- **受眾**: 
  - **主要**: Code reviewers（為何用這個設計）、新成員（為何不是那樣做）
  - **查詢**: 考慮改變某個決定時（查看「後續觸發條件」）
- **何時讀**:
  - Code review 時：「這個設計看起來很奇怪，為什麼？」→ 查 ADR
  - 加入團隊時：「為什麼 AP 沒有歷史記錄？」→ 查 ADR
  - 評估改進時：「要改回方案 C 嗎？」→ 查 ADR 的「後續觸發條件」
  
  **不是**日常開發者天天讀的文檔，而是按需查詢的參考

### 🔄 營運與部署 (operations/)
詳見 [`operations/README.md`](operations/README.md)

**子文檔**：
- **BACKUP.md** — 備份策略、復原步驟、驗證方法 (面向 DevOps、SRE)
- **LOGGING.md** — 日誌系統、查詢、故障排除 (面向全隊)
- **UPDATE.md** — 更新機制、部署流程、回滾步驟 (面向 DevOps、release manager)

### 🤖 Agent 指引 (agents/)
- **目的**: 為 Claude Code agents 提供系統上下文
- **用途**: 在 Claude Code 中自動讀取，幫助 agents 理解領域、工單管理、分流規則
- **受眾**: Claude Code agents (間接供人類使用)

---

## 導航

### 如果你想...

- **查詢 API 端點與參數** → 進入 [`API.md`](API.md)
  - 「如何建立產品？」→ 查 POST /api/products
  - 「出貨流程的完整步驟」→ 查「常見操作範例」

- **了解系統該如何改進** → 閱讀 [`improve.md`](improve.md)
  
- **理解某個設計決策的原因** → 查看 `adr/` 目錄
  - 「為什麼 AP 沒有歷史記錄？」→ [`adr/0001-ap-no-history-tracking.md`](adr/0001-ap-no-history-tracking.md)
  - 「考慮改變這個決定嗎？」→ 查 ADR 的「後續觸發條件」

- **進行備份、更新或監控** → 進入 [`operations/`](operations/) 資料夾
  - 具體的備份步驟 → [`operations/BACKUP.md`](operations/BACKUP.md)
  - 日誌查詢與故障排除 → [`operations/LOGGING.md`](operations/LOGGING.md)
  - 應用部署更新 → [`operations/UPDATE.md`](operations/UPDATE.md) 或 [`operations/DEPLOYMENT.md`](operations/DEPLOYMENT.md)

- **讓 Claude Code agents 更聰明** → 編輯 [`agents/`](agents/) 中的提示詞與配置

---

## 文檔維護

### 新增文檔時的檢查清單

- [ ] 在此 README 的表格中加入條目
- [ ] 使用恰當的標籤 (📈 優化、📋 決策、🔄 運維、📝 日誌、🚀 部署、🤖 Agent)
- [ ] 填寫描述 (一句話概括內容)
- [ ] 標註文檔受眾
- [ ] 如適用，新增相關文檔交叉參考

### 文檔衰退處理

過時文檔應該：
1. 在相關區段標註 `⚠️ [已廢棄]` 或 `⚠️ [需更新]`
2. 標註更新日期與原因
3. 若有替代文檔，在頂部加連結

範例：
```markdown
⚠️ **此檔案已廢棄** (2025-11-01)  
改用 [`new-approach.md`](new-approach.md)
```

---

## 相關檔案

- 專案根目錄 [`CONTEXT.md`](../CONTEXT.md) — 領域術語表，所有文檔應遵循此語言
- [`../.claude/skills/`](../.claude/skills/) — Claude Code skills 定義
