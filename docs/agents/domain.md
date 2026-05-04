# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This repo is **single-context**. The root `CONTEXT.md` is a thin pointer into `.context/`, where the project's existing handover and reference docs live (`.context/CURRENT_PROGRESS.md`, `.context/API_REFERENCE.md`).

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — and follow its pointers into `.context/`.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context layout:

```
/
├── CONTEXT.md                ← pointer to .context/
├── .context/
│   ├── CURRENT_PROGRESS.md
│   └── API_REFERENCE.md
├── docs/adr/                 ← created lazily
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md` (or the docs it points to). Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
