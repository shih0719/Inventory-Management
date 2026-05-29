---
name: services-layer
description: Rules for business logic and data services (src/services)
path: src/services/**
---

## Services Layer Guidelines

### Purpose
Services encapsulate business logic, database queries, and integration with external systems. They are stateless, testable, and framework-agnostic.

### Structure
Each service exports functions that:
- Accept simple data types (IDs, objects, arrays) — no req/res objects
- Return promises (async operations) or plain values
- Throw errors on failure (caught by caller)

### When working here

**Inventory operations:**
- Use `inventory-operations` skill for creating transactions, batch updates, serial tracking
- Example: creating a shipment, transferring stock, recording adjustments

**Inventory queries:**
- Use `inventory-query` skill to check stock levels, search products, list low-stock items
- Example: getting current quantity, finding by SKU, inventory dashboard data

**Custom queries:**
- Use `codegraph_context("task description")` to see all services related to a feature
- Use `codegraph_trace("serviceA", "serviceB")` to trace how one service reaches another

### Conventions
- Service names: `<domain>Service.js` (e.g., `authService.js`, `quantityStateService.js`)
- Functions are pure or clearly document side effects
- Database calls via single database module (not scattered)
- Error messages include enough context to debug (what was attempted, why it failed)

### Testing
Unit tests mock dependencies; integration tests use a real test database.

---

See also: [[api-layer]] for controller integration.
