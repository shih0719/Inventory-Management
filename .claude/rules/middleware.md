---
name: middleware-layer
description: Rules for middleware (src/middleware)
path: src/middleware/**
---

## Middleware Guidelines

### Purpose
Middleware intercepts requests to authenticate, log, validate, or handle errors before they reach controllers.

### Current middleware
- **authMiddleware** — Verifies JWT tokens, attaches user to `req.user`

### When adding middleware

**Authentication & Authorization:**
- Check token validity before each protected route
- Attach user info to `req.user` for downstream access
- Use `codegraph_search("authMiddleware")` to find where it's mounted

**Error handling:**
- Central error handler at the end of the middleware stack catches all thrown errors
- Don't try/catch inside middleware unless you're intentionally transforming the error

**Logging:**
- Log request start, response status, and errors
- Include request ID for tracing

### Conventions
- Middleware signature: `(req, res, next) => { ... next() }`
- Always call `next()` to pass to the next handler
- Use `res.status().json()` for error responses

---

See also: [[api-layer]] for route definitions that use middleware.
