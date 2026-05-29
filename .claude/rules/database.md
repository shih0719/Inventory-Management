---
name: database-layer
description: Rules for database, config, and schema (database/, src/config)
path: database/** src/config/**
---

## Database & Config Guidelines

### Structure
- **database/** — Schema migrations, seeders, connection setup
- **src/config/database.js** — Database client initialization
- **src/config/logger.js** — Logging configuration

### When working here

**Schema changes:**
- Create migrations in `database/migrations/` for schema updates
- Never modify schema directly; use migrations for auditability
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
- Migration files: `YYYYMMDD_HHmmss_description.js`
- Migrations are idempotent (safe to run multiple times)
- Seeds populate test data; don't use in production
- Database connection is singleton (initialized once, reused)

### Testing
Integration tests use test database with fresh schema.

---

See also: [[services-layer]] for services that perform database queries.
