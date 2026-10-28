---
paths:
  - "src/services/**"
  - "src/utils/**"
---

# Services

## Shape
- Services are plain CommonJS modules: functions plus, where needed, one error class (`LedgerError`, `OutboundError`, `ApUnitError`) that carries `code`, `params` and an English message (ADR 0004).
- They take plain values (ids, input objects, an `actor`), never `req`/`res`.
- Functions that may run inside a transaction take the connection as their first argument (`tx` / `conn`) instead of requiring `db` themselves; see `stockLedger.js` and `apUnits.js`.
- File names are not uniform (`apUnits.js`, `stockLedger.js`, `transactionQuery.js`, `*Service.js`). Name a new file after the domain term in `CONTEXT.md`.

## Stock Ledger is the only writer of quantities
- `stockLedger.apply(tx, movements, ctx)` is the only code that changes `accountable_quantity` / `non_accountable_quantity` (ADR 0003). It validates every movement, writes one Transaction per movement and records the audit log.
- Use `stockLedger.check(tx, movements)` to validate without writing (e.g. a pre-validation pass in a batch).
- After the caller's transaction commits, all `apply` calls of that transaction become one event in `stockNotifier.js` (`record`; the outbound adds its shipment with `annotate`). Only events with a shipment are sent, as JSON to `STOCK_WEBHOOK_URL` and a LINE push to `LINE_TO` (each only when configured), scheduled with `db.afterCommit`. Use `db.afterCommit` for any other I/O that must follow a commit; never do I/O inside the transaction.
- The ledger does not open a DB transaction. The caller wraps its own writes and the ledger call in one `db.transaction(async (tx) => ...)`.

## AP (serial-tracked products)
- AP rules live in `apUnits.js`. Use its plan/apply pairs: `planInbound`/`applyInbound`, `planOutbound`/`markSold`, `planTransfer`/`applyTransfer`.
- Normalise serials with `normalizeSerial`; the frontend uses the same rule (`vite-app/src/lib/serial.ts`).
- Read the AP and Stock Ledger entries in `CONTEXT.md` before changing either.
