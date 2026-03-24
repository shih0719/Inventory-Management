# Testing Strategy

This document defines the testing standards, tools, and processes used to ensure the reliability and integrity of the Inventory Management system. Our strategy focuses on a multi-layered approach that validates individual units of logic, complex database interactions, and end-to-end workflows like CSV processing.

## Testing Strategy

Quality is maintained through a combination of automated testing and strict code quality gates. Our philosophy emphasizes:
- **Database Integrity**: Since the application relies on SQLite for state, tests must ensure data consistency during transactions and batch operations.
- **Isolation**: Unit tests must mock database calls to ensure speed and reliability.
- **Regression Prevention**: Every bug fix requires a corresponding test case to prevent future regressions.
- **Automated Validation**: All tests and linting rules are enforced via the CI/CD pipeline before code can be merged.

## Test Types

- **Unit Tests**: 
    - **Framework**: Jest
    - **Naming Convention**: `*.test.js`
    - **Scope**: Individual controller functions (e.g., `productsController.js` logic) and database utility wrappers in `src/config/database.js`.
    - **Tooling**: Jest mocks for isolating database queries from business logic.

- **Integration Tests**: 
    - **Framework**: Jest and Supertest
    - **Naming Convention**: `*.integration.test.js`
    - **Scope**: API endpoints in `src/routes/`. These tests validate the interaction between controllers, the database, and the request/response lifecycle.
    - **Environment**: Uses a temporary in-memory SQLite database to ensure a clean state for every test suite.

- **E2E (End-to-End) Tests**: 
    - **Framework**: Jest (or Playwright if a frontend is attached)
    - **Naming Convention**: `*.e2e.test.js`
    - **Scope**: Full system workflows, such as the `importCSV` -> `createBatch` -> `updateProduct` flow.
    - **Harnesses**: Requires a fully initialized environment using `initDatabase()` before execution.

## Running Tests

Use the following commands to execute the test suite:

```bash
# Run all tests (Unit, Integration, and E2E)
npm run test

# Run tests in watch mode for active development
npm run test -- --watch

# Run tests and generate a code coverage report
npm run test -- --coverage

# Run a specific test suite
npm run test src/controllers/productsController.test.js

# Run tests matching a specific description pattern
npm run test -t "should create a new product"
```

## Quality Gates

To maintain high code standards, the following gates must be passed before merging any Pull Request:

- **Coverage Requirements**:
    - **Global Threshold**: Minimum 80% statement coverage.
    - **Critical Logic**: 100% coverage for `src/config/database.js` and transaction-related logic in `transactionsController.js`.
- **Linting**: No errors allowed from `npm run lint` (ESLint).
- **Functionality**:
    - All tests must pass in the CI environment.
    - No "skipped" tests allowed in the `main` branch.
- **Manual Review**: At least one peer review focusing on test edge cases (e.g., handling invalid CSV formats or database lock conditions).

## Troubleshooting

**Database Locked Errors**:
Because SQLite handles concurrent writes by locking the file, integration tests running in parallel may occasionally fail with `SQLITE_BUSY`. 
- **Solution**: Use the `--runInBand` flag in Jest to run database-heavy tests sequentially: `npm run test -- --runInBand`.

**Async Controller Failures**:
Ensure all controller tests properly await the `run`, `get`, and `all` promises from `src/config/database.js`. Unhandled promises can lead to "hanging" test suites.

**CSV Path Issues**:
When testing `importCSV` or `exportCSV`, ensure that the `tmp` or `uploads` directories exist in the test environment. Use the `downloadTemplate` function within tests to generate valid mock data for imports.

---

**Related Documents**:
- [Development Workflow](./development-workflow.md)
