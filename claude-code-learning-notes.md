# Claude Code 學習筆記
> 從對話中整理的問題與核心洞見

---

## Q1：最近大家推薦的編程輔助工具是什麼？
**核心問題：** 不是問工具排名，而是問社群在用什麼**方法論**來提升 AI 編程效率。

**關鍵發現：**
- Superpowers（⭐174k）— 完整開發流程強制執行
- Andrej Karpathy Skills（⭐101k）— 優化 CLAUDE.md 行為
- Matt Pocock Skills（⭐46.6k）— grill→spec→slice→ship→refactor 五階段循環
- CodeGraph — 用知識圖譜取代讀檔，降低 35% API 成本、70% tool calls
- Caveman Skill — 削減 75% 輸出 token

---

## Q2：Superpowers 是專為多 agent 使用的嗎？
**核心問題：** 想釐清工具的定位，避免誤用。

**核心洞見：**
Superpowers 本質是**單一 agent 的工作流方法論**，子 agent 只出現在「執行任務」和「code review」兩個環節，不是全程多 agent。它的真正價值是把工程文化（TDD、規格確認、review）編碼成強制流程。

---

## Q3：很難用 prompt 解釋整個專案，應該朝哪個方向學習？
**核心問題：** 如何讓 Claude 理解大型專案的全貌，而不是每次重新解釋。

**解法層次：**
1. **CLAUDE.md**（今天就能做）— 永久專案記憶，一次寫好每次載入
2. **Spec 先行**— 讓 Claude 先出規格，你審核後再執行；把 20 個模糊決策變成已知答案
3. **grill-me skill**— 說不清楚時讓 Claude 來問你，平均問 16–50 個問題釐清需求

---

## Q4：大型專案能否依模組區分上下文，避免稀釋？
**核心問題：** 上下文視窗有限，整個專案塞進去會互相干擾。

**解法：階層式 CLAUDE.md**
```
project/
├── CLAUDE.md              ← 全局：架構、規範、禁忌
├── src/
│   ├── auth/CLAUDE.md     ← 只講 auth 模組
│   ├── payments/CLAUDE.md ← 只講 payments 模組
│   └── api/CLAUDE.md      ← 只講 API 規範
```
- `.claude/rules/` 可加 frontmatter 限定路徑，只在匹配目錄生效
- Skills 按需載入，不常用但重要的知識放 skill，需要時才召喚
- 結果：上下文永遠是「全局骨架 + 當前模組細節」

---

## Q5：更新時 Claude 不會自動歸類，存到黑盒子裡
**核心問題：** Auto Memory 的儲存位置不透明，不知道怎麼取回。

**根本原因：**
- CLAUDE.md 是你寫的指令
- MEMORY.md 是 Claude 自動存的學習內容（黑盒子就是這裡）
- MEMORY.md 啟動時只載入**前 200 行或 25KB**，其他按需讀取

**找回方法：**
```bash
/memory                              # 開啟記憶文件選擇器
ls ~/.claude/projects/<project>/memory/
cat ~/.claude/projects/<project>/memory/MEMORY.md
```

**真正解法：** 重要架構知識不要依賴 Auto Memory，手動維護各模組 CLAUDE.md 並版本控制。

---

## Q6：在根目錄 CLAUDE.md 告訴他每次寫入都要在子類修改，但常有遺漏
**核心問題：** 光靠文字指令無法保證 Claude 每次都執行。

**根本原因：**
CLAUDE.md 指令是「建議」，不是「強制執行的政策」。Claude 是概率系統，不能用它做確定性的事。

**解法：Hooks（唯一硬性機制）**
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit|MultiEdit",
      "hooks": [{"type": "command", "command": "node ~/.claude/hooks/check-module-context.js"}]
    }],
    "Stop": [...]
  }
}
```
- **PostToolUse** — 每次寫入後自動檢查模組歸類
- **Stop** — 任務結束前驗證，未完成不讓 Claude 說「完成了」

---

## Q7：Claude Code 的完整機制有哪些？
**核心問題：** 想建立完整的心智模型，而不是零散學習。

**完整機制地圖：**

| 層次 | 機制 | 本質 |
|------|------|------|
| 記憶層 | CLAUDE.md / Rules / MEMORY.md | 告訴 Claude「這個專案是什麼」 |
| 行為層 | Hooks / Settings.json | **唯一真正強制**的機制 |
| 擴充層 | Skills / Plugins | 告訴 Claude「這種任務用這個流程」 |
| 整合層 | MCP / Sub-agents | 讓 Claude 連接外部系統或分身執行 |
| 規劃層 | Plan Mode / Spec 文件 | 執行前先審核決策 |

---

## Q8：記憶層不可靠的根本原因
**核心問題：** 為什麼照著做還是會出錯？

**可靠性層次（由低到高）：**
```
最不可靠
    ↑  Auto Memory（Claude 自己決定存什麼、存哪裡）
    │  子目錄 CLAUDE.md（要進入才載入）
    │  MEMORY.md（有 200 行上限）
    │  根目錄 CLAUDE.md（每次載入，但只是建議）
    ↓  Hooks（唯一硬性機制）
最可靠
```

**核心洞見：** 記憶層的設計目的是「提示 Claude」，不是「控制 Claude」。把它當控制機制用，必然不穩定。

---

## Q9：行為層缺乏強制的問題
**核心問題：** 如何讓 Claude 的行為可預測、可驗證？

**核心洞見：**
```
CLAUDE.md 指令 → Claude 看到 → Claude 決定要不要遵守（概率）
Hook 腳本      → 事件觸發   → 強制執行，Claude 無法跳過（確定）
```

Hooks 也分兩種強度：
- `additionalContext` — 告訴 Claude 有問題，Claude 自己決定
- `exit code 阻斷` — 直接攔截，Claude 無法繼續

---

## Q10：五大方法中有沒有集大成的解法？
**核心問題：** 哪個工具同時解決記憶層和行為層的問題？

**對照表：**

| 方法 | 記憶層 | 行為層 |
|------|--------|--------|
| Superpowers | ✅ session hook 強制注入 | ✅ 流程結構無法跳步 |
| Andrej Karpathy | ✅ 優化 CLAUDE.md 結構 | ❌ 只是更好的建議 |
| Matt Pocock | 🔶 確保規格清楚 | ❌ 只是流程建議 |
| CodeGraph | ✅ 索引取代記憶 | ❌ 不處理行為 |
| Caveman | ❌ | ❌ |

**最完整組合：**
```
CodeGraph      → 解決記憶依賴（根本不需要記那麼多）
+ Superpowers  → 解決流程執行
+ 自訂 Hook    → 解決模組更新遺漏
```

---

## Q11：上下文稀釋問題，三種根本不同的解法
**核心問題：** 不靠模組切割，還有什麼方式防止上下文被稀釋？

**三種思路：**

| 思路 | 攻擊的問題 | 工具 |
|------|-----------|------|
| 查索引不讀文件 | 探索本身消耗上下文 | CodeGraph |
| 子 agent 隔離 | 歷史積累污染當前任務 | Superpowers |
| 先規格後執行 | 不確定性驅動無效探索 | Matt Pocock |

---

## Q12：跨 session 的永久記憶怎麼做？
**核心問題：** 難道每次開新任務都要從頭讀一次專案？

**三層記憶架構：**

| 層次 | 誰維護 | 何時載入 | 工具 |
|------|--------|---------|------|
| 靜態永久 | 你 | 每次啟動全部載入 | CLAUDE.md |
| 動態累積 | Claude | 啟動時注入壓縮摘要 | claude-mem |
| 按需查詢 | 系統 | 任務需要時才抽取 | CodeGraph / Memory Bank |

**核心洞見：** 真正的問題不是「每次要讀多少」，而是「上次學到的有沒有被保存下來」。正確架構是用 SessionStart hook 注入知識庫，Stop hook 提取本次學到的東西，讓知識隨時間累積。

---

## Q13：讓 Claude 維護 API 文檔，每次先讀取，這是哪一層？
**核心問題：** 想確認自己的做法在哪個層次，有沒有更好的方式。

**這是第一層（靜態永久記憶）。**

**隱藏問題：**「每次都先讀取」本身就在消耗上下文。

**更好的設計：**
```markdown
# 現在做法
任務開始 → 讀整份 API 文檔 → 開始工作

# 更好做法
任務開始 → 只查詢「這個任務涉及的 API」→ 開始工作
```

在 CLAUDE.md 裡改成：
```markdown
## API 文檔
位置：/docs/api-reference.md
使用方式：需要某個功能時查詢，不要在任務開始時全部讀取
```

API 文檔再大時，考慮用 CodeGraph 建立索引，讓 Claude 用查詢取代讀取。

---

## 核心學習路徑總結

```
1. 寫好 CLAUDE.md（全局骨架）
2. 各模組子目錄各自的 CLAUDE.md
3. 重要知識寫成 Skills（按需載入）
4. Hooks 做強制驗證（PostToolUse + Stop）
5. claude-mem 做動態累積記憶
6. CodeGraph 解決大型 codebase 的探索成本
```

**最終洞見：Claude Code 的設計假設你是架構師，不是使用者。你負責設計工作流程和驗證邏輯，Claude 是執行者。**
