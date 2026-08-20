# 文檔組織結構說明

本文檔說明為何特定的 .md 檔案放在根目錄，其他的放在 `docs/` 內。

## 文件位置決策

### ✅ 保留在根目錄的文件

| 檔案 | 原因 |
|------|------|
| **CONTEXT.md** | 領域術語表 — 全隊每日參考，需高度可見性。Git convention 將核心文件放根目錄 |
| **CHANGELOG.md** | 版本變更紀錄 — Semantic Versioning 與 Keep a Changelog 標準慣例：放根目錄。Release notes 與 git tag 通常參考此檔 |
| **README.md** | 專案首頁 — 新開發者首先閱讀，放根目錄是標準 |
| **claude-code-learning-notes.md** | Claude Code 工作流筆記 |

### 📁 移入 docs/ 的文件

| 檔案 | 目標位置 | 原因 |
|------|---------|------|
| DEPLOYMENT.md | docs/operations/DEPLOYMENT.md | 營運相關，與 BACKUP、UPDATE、LOGGING 同類 |

### 📊 完整目錄結構

```
Inventory-Management/
├── CHANGELOG.md              # 🏆 根目錄：版本變更紀錄
├── CONTEXT.md                # 🏆 根目錄：領域術語表（全隊核心參考）
├── README.md                 # 🏆 根目錄：專案首頁
├── DOCKER.md                 # 根目錄：Docker 部署指南
├── docker-compose.yml        # Docker Compose 服務定義
├── Dockerfile                # 多階段建置（前端 + 後端）
├── claude-code-learning-notes.md # 根目錄：Claude Code 工作流筆記
│
├── vite-app/                 # 前端（React + TS + Vite）
│   └── src/
│       ├── components/
│       ├── api/
│       ├── hooks/
│       ├── context/
│       └── lib/
│
├── docs/
│   ├── README.md             # 📚 文檔首頁與索引
│   ├── ORGANIZATION.md       # 📚 本檔案：文檔組織說明
│   ├── improve.md            # 📈 架構優化建議
│   ├── DEPLOYMENT_VITE.md    # 前端 Vite 建置流程
│   ├── API_EXAMPLES.md       # API 請求/回應範例
│   ├── SHIPMENT_FEATURE.md   # Shipment 功能需求（歷史規劃）
│   ├── MVP_RBAC_AUDIT.md     # MVP 規劃（已實作）
│   ├── BUG-FIX-loading-issue.md
│   │
│   ├── adr/
│   │   ├── 0001-ap-no-history-tracking.md
│   │   ├── 0001-auth-provider-abstraction.md
│   │   └── 0002-frontend-modularization-with-vite.md
│   │
│   ├── api/
│   │   └── README.md         # API 端點清單
│   │
│   ├── agents/
│   │   ├── domain.md
│   │   ├── issue-tracker.md
│   │   └── triage-labels.md
│   │
│   └── operations/           # 🔧 營運與部署文檔
│       ├── README.md         # 營運首頁
│       ├── DEPLOYMENT.md     # 本地開發 & 生產部署
│       ├── UPDATE.md         # 應用更新與回滾
│       ├── BACKUP.md         # 備份與復原
│       └── LOGGING.md        # 日誌查詢與故障排除
```

---

## 檔案分類邏輯

### 根目錄 (Repo Root)

存放以下檔案：
1. **version/changelog**: CHANGELOG.md（發布版本的歷史記錄）
2. **domain glossary**: CONTEXT.md（全隊共用的領域術語）
3. **project entry**: README.md（專案首頁）
4. **ai guidance**: `.claude/` 目錄（Claude Code 設定、rules、skills）

**特徵**：高度可見、快速存取、面向全隊、初入專案時優先閱讀

### docs/

存放以下檔案：

1. **深化文檔**: improve.md（架構優化機會）
   - 受眾：架構師、senior 開發者、refactor 決策者
   - 何時讀：計畫重構、評估架構改進時

2. **決策紀錄**: adr/（為何做出某個決定）
   - 受眾：**主要是 code reviewer、新成員、未來的決策者**
   - 何時讀：code review 時發現某個設計，想理解**為什麼不這樣做**；加入團隊時理解既有的取捨；考慮改變某個決定時查詢**後續觸發條件**
   - **不是**給日常開發者天天讀的文檔

3. **agent 配置**: agents/（提示詞、領域知識）
   - 受眾：Claude Code agents（間接供人類編輯提示詞）
   - 何時讀：agents 需要理解系統時；編輯 agent 指引時

4. **營運文檔**: operations/（備份、部署、日誌、故障排查）
   - 受眾：DevOps、SRE、值班工程師、開發者（故障排查時）
   - 何時讀：日常營運；應急故障排查

**特徵**：詳細、分類清晰、按用途查閱、輔助參考

---

## 導航原則

### 我想了解...

| 問題 | 查看檔案 |
|------|--------|
| 這個專案是什麼？ | 根目錄 `README.md` |
| 系統有哪些術語/概念？ | 根目錄 `CONTEXT.md` |
| 為什麼做了這個設計決定？ | `docs/adr/` |
| 系統該如何改進？ | `docs/improve.md` |
| 如何部署/更新應用？ | `docs/operations/DEPLOYMENT.md` 或 `UPDATE.md` |
| 如何備份與復原資料？ | `docs/operations/BACKUP.md` |
| 如何查詢日誌？ | `docs/operations/LOGGING.md` |
| Claude Code agents 如何理解系統？ | `docs/agents/` |

### 版本公告

| 問題 | 查看檔案 |
|------|--------|
| 這個版本有什麼新功能/改進？ | 根目錄 `CHANGELOG.md` |
| 與上一版本有什麼破壞性變更？ | 根目錄 `CHANGELOG.md`（Breaking Changes 部分） |

---

## 未來擴展

若未來需要新增文檔，遵循此原則：

1. **影響全隊、需高度可見性** → 考慮放根目錄（如 ROADMAP.md、CONTRIBUTING.md）
2. **詳細、分類型文檔** → 放 `docs/`（如 docs/architecture/、docs/guides/）
3. **營運相關** → 放 `docs/operations/`
4. **決策紀錄** → 放 `docs/adr/`
5. **Agent 配置** → 放 `docs/agents/`

---

## 維護責任

| 檔案/資料夾 | 主要維護者 | 審核頻率 |
|----------|---------|--------|
| CONTEXT.md | Architecture team | 每次新增領域概念時 |
| CHANGELOG.md | Release manager | 每個版本發布時 |
| docs/adr/ | 決策參與者 | 決策完成後立即記錄 |
| docs/improve.md | Architecture team | 每次架構評估時 |
| docs/operations/ | DevOps / SRE | 每次營運流程變更時 |
| docs/agents/ | Development team | 每次 agent 功能擴展時 |

