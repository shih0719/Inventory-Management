---
paths:
  - "tests/**"
---

# Tests (Jest + supertest)

- Run them with `npm test` (`jest --runInBand`). Tests share one in-memory database per file, so they must run serially.
- `tests/setup.js` sets `DB_PATH=:memory:`, `JWT_SECRET`, and the default admin (`eric` / `password`).
- Each file calls `setupTestDb()` in `beforeAll` and `teardownTestDb()` in `afterAll` (`tests/helpers/db.js`). That runs the real `initDatabase`, so schema, migrations and seeds are the production ones.
- Most tests are route-level. They build the app with `createApp()`, create a warehouse, give `eric` access via `user_warehouses`, log in through `/api/auth/login`, and send `Authorization` + `X-Warehouse-Id`. Copy the `auth(req)` helper pattern from an existing file such as `stockLedgerRoutes.test.js`.
- Assert on `code` for error responses, not on the English `error` text.
- Guard tests to keep green: `schemaDrift.test.js` (schema.sql vs migrations), `errorCodes.test.js` (every code translated), `warehouseIsolation.test.js` (no cross-warehouse access).
