---
name: api-layer
description: Rules for API routes and controllers (src/routes, src/controllers)
path: src/routes/** src/controllers/**
---

## API Layer Guidelines

### Structure
- **Routes** (`src/routes/*.js`) — Express router definitions, HTTP method handlers
- **Controllers** (`src/controllers/*.js`) — Request validation, business logic orchestration, response formatting

### When working here

**Prefer codegraph for:**
- Finding where a route is defined: `codegraph_search("routeName")`
- What controllers a route uses: `codegraph_callees("routerGet")` 
- What services a controller depends on: `codegraph_callees("someController")`

**Conventions:**
- Controllers accept `(req, res, next)`, call services, return JSON responses
- Error handling via middleware chain — don't try/catch inside controllers unless catching service errors
- Use `res.status().json()` for responses
- Validate req.body/params early in controller; delegate business logic to services

**Testing:** Integration tests in `tests/` hit real routes and check response codes.

---

See also: [[services-layer]] for business logic rules.
