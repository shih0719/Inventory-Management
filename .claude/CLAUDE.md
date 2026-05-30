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
