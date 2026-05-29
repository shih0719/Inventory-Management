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

- **src/routes** — API endpoints
- **src/controllers** — HTTP request handlers
- **src/services** — Business logic layer
- **src/middleware** — Auth, logging, error handling
- **src/config** — Database, logger setup
- **vite-app** — Frontend (React/Vue)
- **database** — Schema migrations, seeders
- **tests** — Unit & integration tests

Module-specific rules are in `.claude/rules/` — loaded only when working in that directory.

---

## 🔧 How to Use This Project

Skills like `inventory-operations` and `inventory-query` are available for inventory-specific tasks.

### Module-specific Rules

When you edit code in a specific directory, module-specific rules from `.claude/rules/` are automatically loaded:

- **`src/routes/`, `src/controllers/`** → [[api-layer]]
- **`src/services/`** → [[services-layer]]
- **`src/middleware/`** → [[middleware-layer]]
- **`vite-app/`** → [[frontend-layer]]
- **`database/`, `src/config/`** → [[database-layer]]

See [`.claude/rules/README.md`](rules/README.md) for how the hierarchical rules system works.
