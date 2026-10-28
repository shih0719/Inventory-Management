## 📐 CodeGraph

This project uses CodeGraph — a tree-sitter-parsed AST knowledge graph for fast structural search. Reads are sub-millisecond.

**When to use:**
- "Where is X defined?" → `codegraph_search`
- "What calls Y?" → `codegraph_callers`  
- "How does X reach Y?" → `codegraph_trace` (one call, whole path incl. callbacks)
- "Focused context for task T?" → `codegraph_context`
- "Show several related symbols" → `codegraph_explore`

**Key rules:**
- Answer directly — don't delegate. Use `codegraph_context` first, then `codegraph_explore` for sources.
- Trust codegraph results (full AST parse). Don't re-verify with grep.
- For flow tracing: start with `codegraph_trace`, not `codegraph_search` + `codegraph_callers`.

---

## 📁 Project Structure

Express + SQLite backend (CommonJS) and a React + TypeScript frontend, for a multi-warehouse inventory system.

- **src/app.js**: `createApp()`, route mounting, auth and warehouse middleware; `server.js` starts it
- **src/routes**, **src/controllers**: HTTP endpoints and handlers
- **src/services**: domain logic: Stock Ledger, AP units, outbound, shipments, audit, auth, backup
- **src/middleware/authMiddleware.js**: `verifyAuth` (JWT), `requireRole`, `requireWarehouse`
- **src/utils**: `errorItem.js` (coded error responses), `formatTimestamps.js`
- **src/config**: `database.js` (connection, startup migrations, `transaction`), `logger.js` (winston)
- **database**: `schema.sql` (new databases), `seeds.sql` (predefined tags)
- **vite-app**: the frontend, built into `public/` with `npm run build`
- **tests**: Jest + supertest against an in-memory database (`npm test`)

Terms: use the glossary in `CONTEXT.md` (Product, SKU, AP / 序號品, Quantity Type, Stock Ledger, ...). Decisions: `docs/adr/`.

## 🔧 Module rules

`.claude/rules/*.md` load only when you work on files matching their `paths:` frontmatter:

| Rule | Paths |
|---|---|
| `api.md` | `src/app.js`, `src/routes/`, `src/controllers/`, `src/middleware/` |
| `services.md` | `src/services/`, `src/utils/` |
| `database.md` | `database/`, `src/config/` |
| `frontend.md` | `vite-app/` |
| `tests.md` | `tests/` |

Write rules only from what the code actually does. When the code changes a convention, update its rule in the same commit.

---

## 🧠 Behavioral Guidelines

These reduce common LLM coding mistakes. Apply them to all work.

### 1. Think Before Coding
- **Don't assume.** Explicitly state assumptions and ask for clarification.
- **If multiple interpretations exist,** present them—don't pick silently.
- **Push back** if a simpler approach exists. Stop and ask if confused.

### 2. Simplicity First
- **Implement the minimum code** that solves the problem.
- **No speculative features, flexibility, or config options** beyond the request.
- **If 200 lines could be 50,** rewrite it. Prefer direct solutions.

### 3. Surgical Changes
- **Touch only what you must.** Match existing style and patterns.
- **Never "improve" adjacent code,** comments, or formatting unless explicitly asked.
- **Every changed line should trace directly to the request.**

### 4. Goal-Driven Execution
- **Define success criteria first.** Loop until verified.
- **Write a test that reproduces the bug,** then make it pass.
- **For multi-step tasks,** state a brief plan with verification steps before implementing.

---

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `shih0719/Inventory-Management`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` glossary + `docs/adr/`. See `docs/agents/domain.md`.
