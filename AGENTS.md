# AGENTS.md

## Dev environment tips
- Install dependencies with `npm install` before running scaffolds.
- Use `npm run dev` for the interactive TypeScript session that powers local experimentation.
- Run `npm run build` to refresh the CommonJS bundle in `dist/` before shipping changes.
- Store generated artefacts in `.context/` so reruns stay deterministic.

## Testing instructions
- Execute `npm run test` to run the Jest suite.
- Append `-- --watch` while iterating on a failing spec.
- Trigger `npm run build && npm run test` before opening a PR to mimic CI.
- Add or update tests alongside any generator or CLI changes.

## PR instructions
- Follow Conventional Commits (for example, `feat(scaffolding): add doc links`).
- Cross-link new scaffolds in `docs/README.md` and `agents/README.md` so future agents can find them.
- Attach sample CLI output or generated markdown when behaviour shifts.
- Confirm the built artefacts in `dist/` match the new source changes.

## Repository map
- `database/` — explain what lives here and when agents should edit it.
- `package-lock.json/` — explain what lives here and when agents should edit it.
- `package.json/` — explain what lives here and when agents should edit it.
- `public/` — explain what lives here and when agents should edit it.
- `README.md/` — explain what lives here and when agents should edit it.
- `server.js/` — explain what lives here and when agents should edit it.
- `src/` — explain what lives here and when agents should edit it.
- `uploads/` — explain what lives here and when agents should edit it.

## AI Context References
- Documentation index: `.context/docs/README.md`
- Agent playbooks: `.context/agents/README.md`
- Contributor guide: `CONTRIBUTING.md`

## Planner Agent (規劃代理人規範)

### 1. 核心任務拆分 (Task Slicing)
當接收到新功能開發請求時，**禁止直接撰寫業務邏輯程式碼**。你必須先執行以下步驟：
- **微小單元化**：將需求拆解為預計開發時間不超過 2 小時的「原子任務」。
- **垂直切片**：確保每個單元都能獨立運行（例如：DB Schema -> API -> UI）。
- **Git 命名建議**：為每個單元提供分支命名建議（如 `feat/device-status-schema`）。

### 2. 介面合約先導 (Contract-First)
在拆分任務的同時，必須明確定義「介面」：
- **Data Models**：定義資料結構 (TypeScript Interfaces/Types)。
- **Communication**：定義 API 格式 (tRPC/REST) 或 MQTT Topic 規範。
- **Mocking**：明確標註哪些單元可以先用假資料（Mock Data）替代，以實現併行開發。

### 3. 分支開發流 (Branch Strategy)
- 確保**基礎結構（Schema/Types）**優先於**業務邏輯**。
- 確保**後端/協定層**優先於**前端/表現層**。

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues at `shih0719/Inventory-Management` via the `gh` CLI. See [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).

### Triage labels

Uses the five canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) as-is. See [docs/agents/triage-labels.md](docs/agents/triage-labels.md).

### Domain docs

Single-context. `CONTEXT.md` at the repo root points into `.context/`; ADRs in `docs/adr/` (created lazily). See [docs/agents/domain.md](docs/agents/domain.md).