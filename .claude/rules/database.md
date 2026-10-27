---
name: database-layer
description: Rules for database, config, and schema (database/, src/config)
path: database/** src/config/**
---

## Database & Config Guidelines

### Structure
- **database/schema.sql** — Complete schema of a new database
- **database/seeds.sql** — Predefined tags, loaded on every startup (`INSERT OR IGNORE`)
- **src/config/database.js** — Connection, startup migrations, `transaction()`
- **src/config/logger.js** — Logging configuration

### When working here

**Schema changes:** a change needs both of these, in the same commit:
- `database/schema.sql` — so a new database is created with it
- A startup migration in `src/config/database.js` (inside `initDatabase`) — so existing databases get it: check `PRAGMA table_info` / `sqlite_master` first, then `ALTER TABLE`, or rebuild the table when a constraint changes (see `fixProductsUniqueConstraint`, `rebuildLegacyAuditLogs`)
- `tests/schemaDrift.test.js` fails when the two disagree
- Test migrations on a copy of production data before running them

**Queries:**
- Use `codegraph_search("Database")` to find the database module
- Use `codegraph_callees("Database")` to see which services use it
- Keep queries in services (not in routes or middleware)

**Configuration:**
- Environment variables in `.env` (not checked in)
- Config files in `src/config/` for shared setup
- Log levels configured at startup

### Conventions
- There are no migration files: migrations run on every startup, so each must be idempotent (safe to run multiple times)
- Seeds are production data (the predefined tags), not test fixtures
- Database connection is singleton (initialized once, reused)

### Testing
Integration tests use test database with fresh schema.

---

See also: [[services-layer]] for services that perform database queries.
