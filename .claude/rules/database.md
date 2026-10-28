---
paths:
  - "database/**"
  - "src/config/**"
---

# Database (SQLite)

## Files
- `database/schema.sql`: the full schema for a new database.
- `database/seeds.sql`: the predefined tags, loaded on every startup with `INSERT OR IGNORE`. This is production data, not test fixtures.
- `src/config/database.js`: the single connection, startup migrations (`initDatabase`), `run`/`get`/`all` and `transaction`.

## Schema changes need both of these, in the same commit
1. Change `database/schema.sql`, so new databases get it.
2. Add a startup migration in `initDatabase`, so existing databases get it. Check `PRAGMA table_info` / `PRAGMA index_list` first, then `ALTER TABLE`. Rebuild the table when a constraint changes (see the products UNIQUE fix and the audit_logs rebuild in the same file).

There are no migration files. Migrations run on every startup, so each one must be idempotent. `tests/schemaDrift.test.js` fails when a new database and a migrated old one end up with different schemas.

## Transactions
- All requests share one connection. `db.transaction(async (tx) => ...)` runs BEGIN/COMMIT, rolls back on throw, and runs one transaction at a time.
- Inside the callback, query through `tx` and pass `tx` to services. A nested `db.transaction` call joins the open one.
- `db.run/get/all` calls from other requests wait until the open transaction finishes, so keep transactions short and never wait on user input or I/O inside one.
- `db.afterCommit(fn)` runs `fn` after the outermost transaction commits and drops it on rollback; outside a transaction it runs at once. Errors are logged, never thrown. Use it for I/O that follows a write (the stock webhook / LINE push).
- `db.transactionLocal(key, init)` returns one value per open transaction (created by `init` on first use), so several calls in one transaction can share it — `stockNotifier` uses it to send one message per transaction.
