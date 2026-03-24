## Mission

This agent ensures the reliability and correctness of the Inventory Management system by maintaining a robust test suite. It focuses on validating business logic, API contracts, and database integrity.

**When to engage:**
- Implementing a new API endpoint or controller method.
- Refactoring existing logic in services or controllers.
- Fixing a bug (to create a regression test).
- Increasing code coverage for the inventory, order, or user modules.

## Responsibilities

- **Unit Testing**: Validate individual utility functions and middleware.
- **Integration Testing**: Test API endpoints (Controllers -> Services -> Database) using Supertest and Vitest.
- **Edge Case Coverage**: Ensure non-happy paths (e.g., insufficient stock, unauthorized access, invalid input) are covered.
- **Mocking**: Properly mock external dependencies like `PrismaClient` or external APIs to maintain test isolation.
- **Data Cleanup**: Ensure the test database state is managed and cleaned between test runs.

## Testing Strategy & Workflows

### 1. Adding a New Controller Test
When a new controller (e.g., `productController.js`) is created:
1.  Create a corresponding test file in `tests/` (e.g., `tests/product.test.js`).
2.  Use `supertest` to make requests to the Express app.
3.  **Setup**: Use `beforeAll` or `beforeEach` to seed necessary data (Users, Categories) via Prisma.
4.  **Assertions**: Check HTTP status codes, JSON structure, and database side-effects.
5.  **Teardown**: Ensure created records are deleted or use a transaction rollback strategy.

### 2. Regression Testing for Bug Fixes
1.  Analyze the reported bug in `src/controllers` or `src/services`.
2.  Write a failing test case in the relevant test file that reproduces the bug.
3.  Verify the test fails.
4.  Apply the fix in the source code.
5.  Verify the test now passes.

### 3. Middleware Validation
- Test `authMiddleware.js` by providing valid/invalid JWTs.
- Test error handling middleware by triggering forced errors in a mock route.

## Best Practices

- **Naming Conventions**: Use descriptive `describe` blocks (e.g., `POST /products`) and `it` statements (e.g., `it should return 400 if price is negative`).
- **Isolation**: Each test file should be able to run independently. Avoid relying on global state unless explicitly handled in setup scripts.
- **Prisma Mocking**: For unit tests of services, use `vitest-mock-extended` or similar to mock the Prisma client to avoid hitting the actual database.
- **HTTP Status Codes**: Always validate specific status codes (200/201 for success, 400 for bad request, 401/403 for auth issues, 404 for not found).
- **Environment**: Ensure `NODE_ENV` is set to `test` to use the test database configuration.

## Repository Starting Points

- `src/controllers/`: Main business logic entry points. Focus here for integration tests.
- `src/routes/`: API structure. Reference this to know which URLs and methods to test.
- `src/index.js`: App entry point. Use the exported `app` instance for `supertest`.
- `tests/`: Existing test suites. Use these as templates for new tests.

## Key Files

- `prisma/schema.prisma`: The source of truth for the data model. Reference this to create valid test data.
- `src/middleware/authMiddleware.js`: Critical for testing protected routes.
- `package.json`: Check `scripts` for `test` commands (e.g., `npm test`, `npm run test:watch`).

## Architecture Context

### API Layer
- **Directories**: `src/routes`, `src/controllers`
- **Pattern**: Routes define paths -> Controllers handle logic -> Services (if any) handle DB calls.
- **Testing focus**: Supertest-based integration tests.

### Data Layer
- **Directories**: `prisma/`
- **Pattern**: Prisma ORM for Postgres access.
- **Testing focus**: Validation of constraints and relations during CRUD operations.

## Collaboration Checklist

- [ ] Identify the specific function or endpoint requiring tests.
- [ ] Check `prisma/schema.prisma` for mandatory fields required for seeding.
- [ ] Determine if the test requires authentication (requires a valid JWT or a mocked auth user).
- [ ] Create the test file using Vitest syntax.
- [ ] Run the test suite locally to ensure no regressions.
- [ ] Verify coverage for the target file.

## Related Resources

- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing/unit-testing)
- [Vitest Documentation](https://vitest.dev/guide/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
