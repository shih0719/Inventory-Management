---
paths:
  - "src/app.js"
  - "src/routes/**"
  - "src/controllers/**"
  - "src/middleware/**"
---

# API layer: routes, controllers, middleware

## Mounting and auth (`src/app.js`)
- Routes that need a warehouse are mounted on `warehouseRouter`, which applies `verifyAuth` + `requireWarehouse` for you. A new warehouse-scoped route is one line there.
- `/api/auth` and `/api/backup` are mounted without `verifyAuth`; `/api/warehouses` and `/api/users` use `verifyAuth` only.
- `verifyAuth` checks the `Authorization: Bearer <JWT>` header and sets `req.user` (`role`, `warehouses`).
- `requireWarehouse` reads the `X-Warehouse-Id` header, checks it is in `req.user.warehouses`, and sets `req.warehouseId`.
- Writes are gated in the route file with `requireRole(["manager", "admin"])`; user, warehouse and audit-log admin routes use `requireRole(["admin"])`.

## Controllers
- Every query on warehouse data filters by `req.warehouseId` (`... AND warehouse_id = ?`). Missing this leaks data between warehouses (`tests/warehouseIsolation.test.js`).
- Each handler wraps its body in `try/catch` and answers itself; the central error handler in `app.js` is rarely reached. Expected errors are 4xx with a code, unexpected ones are `res.status(500)`.
- Success responses use `{ success: true, data, pagination? }`; the frontend's `api/client.ts` unwraps that envelope.
- Controllers may call `db` directly for reads and simple writes. Anything that changes a product quantity goes through the Stock Ledger (see services rule).
- Log user-visible changes with `auditService.logAction(...)`, inside the same `db.transaction` as the write when there is one.

## Error responses (ADR 0004)
- 4xx body: `failure(code, englishMessage, params, errors)` from `src/utils/errorItem.js`, giving `{ success: false, code, params, error }`.
- List errors (batch lines, CSV rows, serials): `errorItem(label, { code, params, reason })`.
- Service errors (`LedgerError`, `OutboundError`, `ApUnitError`) already carry `code`/`params`; map them with `instanceof` (`LedgerError` has `toBody()`).
- Every new `code` needs a translation in `SERVER_ERRORS` (`vite-app/src/lib/i18n.ts`) in all four languages, otherwise `tests/errorCodes.test.js` fails.
- Auth, middleware, transactions, shipments, warehouses and users still return plain English errors without a code. Add codes when you touch them; don't copy the old shape.
