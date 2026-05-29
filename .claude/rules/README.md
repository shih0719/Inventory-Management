# 模組規則系統

## 架構

```
.claude/
├── CLAUDE.md           # 全局骨架（CodeGraph、項目結構、通用指引）
├── rules/              # 模組規則（路徑限定自動加載）
│   ├── api.md         # src/routes, src/controllers
│   ├── services.md    # src/services
│   ├── middleware.md  # src/middleware
│   ├── frontend.md    # vite-app
│   └── database.md    # database, src/config
└── settings*.json     # 權限和鉤子配置
```

## 工作原理

當你在某個目錄編輯代碼時，Claude Code 會自動加載相關的規則文件：

| 你編輯的位置 | 加載的規則 |
|---|---|
| `src/routes/`, `src/controllers/` | `rules/api.md` |
| `src/services/` | `rules/services.md` |
| `src/middleware/` | `rules/middleware.md` |
| `vite-app/` | `rules/frontend.md` |
| `database/`, `src/config/` | `rules/database.md` |

每份規則檔頭部有 `path:` 字段，只有在匹配的目錄中才會被加載。

## 規則檔結構

```markdown
---
name: kebab-case-slug
description: 一行描述
path: src/routes/** src/controllers/**
---

## 指引標題

[內容...]

[[相關規則名稱]] 用於交叉引用
```

- **name** — 規則的內部 ID（kebab-case）
- **description** — Claude Code 用來判斷何時載入
- **path** — Glob 模式，匹配時自動加載

## 添加新規則

1. 在 `.claude/rules/` 創建 `my-module.md`
2. 添加 frontmatter 和 `path:` 字段
3. 寫入模組特定的指引
4. 用 `[[name]]` 引用相關規則

## 好處

✅ **精簡上下文** — 只加載當前工作目錄的相關規則  
✅ **模組聚焦** — 每份規則专注於一个領域  
✅ **易於擴展** — 添加新規則不會污染全局配置  
✅ **清晰導航** — 規則之間相互引用，形成知識網絡
