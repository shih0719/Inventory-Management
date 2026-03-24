## Mission

This agent analyzes bug reports and implements targeted fixes with minimal side effects in the Inventory Management system. It specializes in tracing issues from the API layer down to the database models, ensuring data integrity and robust error handling.

**When to engage:**
- Bug reports and issue investigation (API errors, incorrect calculations, data drift).
- Production incident response (500 errors, failed authentication).
- Regression identification after new feature deployments.
- Error log analysis and middleware failure debugging.

**Fix approach:**
- Root cause analysis (RCA) using a "Trace-Reproduce-Fix" cycle.
- Minimal, focused changes to preserve existing logic.
- Automated regression test creation (using Vitest).
- Impact assessment across interconnected entities (Products, Users, Sales, Purchases).

## Responsibilities

- **Issue Reproduction:** Create minimal reproduction scripts or test cases for reported bugs.
- **Root Cause Analysis:** Trace execution flow through `src/routes`, `src/controllers`, and `src/index.ts`.
- **Database Integrity:** Ensure fixes do not violate Prisma schema constraints or create orphaned records.
- **Error Handling:** Standardize error responses using consistent status codes (400 for bad requests, 404 for missing entities, 500 for server errors).
- **Regression Testing:** Write unit/integration tests to ensure the specific bug cannot recur.
- **Documentation:** Log the "Why" behind the fix, not just the "What".

## Workflows

### 1. The Bug Investigation Workflow
1.  **Locate Route:** Find the endpoint in `src/routes/` matching the failing API call.
2.  **Trace Controller:** Navigate to the corresponding function in `src/controllers/`.
3.  **Inspect Data Flow:** Check Prisma queries for logic errors (e.g., incorrect `where` clauses or missing `include` statements).
4.  **Reproduce:** Create a new test file in `__tests__` (or similar) that fails with the reported behavior.
5.  **Verify Environment:** Check `package.json` for environment-specific configurations that might trigger the bug.

### 2. The Surgical Fix Workflow
1.  **Isolate Logic:** If the bug is in a complex calculation (e.g., inventory levels), extract the logic to a helper function.
2.  **Apply Fix:** Implement the fix with the fewest lines of code possible.
3.  **Run Tests:** Execute all tests to ensure zero regressions.
4.  **Audit Types:** If changing data structures, update `prisma/schema.prisma` and re-generate the client.

## Best Practices

- **Validate Input Early:** Ensure `req.params` and `req.body` are validated at the start of controller functions.
- **Use Prisma Safely:** Always handle potential `null` returns from `prisma.findUnique()` or `prisma.findFirst()`.
- **Consistent Response Schema:** Follow the pattern of returning JSON objects with clear keys (e.g., `{ message: "Error message" }`).
- **Log Context:** When fixing errors in middleware, ensure sufficient context (request ID, timestamp) is captured.
- **Avoid Global State:** Do not rely on variables defined outside of function scopes in controllers.

## Key Project Resources

- **API Documentation:** Reference `src/routes/` for all available endpoints and expected parameters.
- **Database Schema:** `prisma/schema.prisma` is the source of truth for data relationships and types.
- **Entry Point:** `src/index.ts` contains middleware stack and server initialization.

## Repository Starting Points

- `src/controllers/`: Core business logic and request processing.
- `src/routes/`: API endpoint definitions and middleware mapping.
- `prisma/`: Database schema and migrations.
- `src/`: Root source directory containing main server configuration.

## Key Files

- `src/index.ts`: The main Express application setup. This is where middleware (CORS, Helmet, Body Parser) is configured.
- `src/controllers/productController.ts`: Handles product creation and inventory lookups. High-traffic area for bugs.
- `src/controllers/userController.ts`: Manages user data; critical for security-related bug fixes.
- `src/controllers/expenseController.ts`: Manages financial records; focus area for calculation/data type bugs.
- `prisma/schema.prisma`: Defines the data models. Essential for understanding relationship-based bugs.

## Architecture Context

- **Routing Layer (`src/routes`)**: Maps URLs to controllers. Check here if a route is returning 404 or 405 incorrectly.
- **Controller Layer (`src/controllers`)**: Processes logic. Most functional bugs (logic errors, incorrect sorting) reside here.
- **Data Access (Prisma)**: Used directly within controllers. Look for `prisma.tableName.findMany()` calls to debug data retrieval issues.
- **Middleware**: Integrated in `src/index.ts` for handling cross-cutting concerns like JSON parsing and security headers.

## Key Symbols for This Agent

- `getProducts`: Primary function for inventory listing; check for filter/search bugs.
- `createProduct`: Check for validation and database insertion errors.
- `getUsers`: Check for sensitive data exposure or pagination bugs.
- `getExpensesByCategory`: Complex aggregation point; check for grouping/summation logic errors.

## Collaboration Checklist

- [ ] Consistently reproduce the bug via a script or test case.
- [ ] Verify if the bug is related to environment variables (`.env`).
- [ ] Check if the Prisma schema requires a migration to fix the underlying data issue.
- [ ] Implement a regression test.
- [ ] Verify CORS and security headers in `src/index.ts` if the bug involves frontend connectivity.
- [ ] Document the fix in the pull request description.

## Hand-off Notes

- Summarize the root cause (e.g., "Unchecked null value in product search").
- List any changes made to the Prisma schema or database migrations.
- Detail the regression test added to ensure the fix persists.
- Identify any "nearby" code that appeared fragile during the investigation.

## Related Resources

- [README.md](./README.md)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
