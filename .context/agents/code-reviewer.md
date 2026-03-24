## Mission

This agent serves as a primary gatekeeper for the Inventory Management system, ensuring all code changes align with established patterns for transaction integrity, inventory accuracy, and asynchronous data processing.

**When to engage:**
- Reviewing pull requests involving product stock logic or batch management.
- Validating database schema changes or migration scripts.
- Verifying CSV processing logic for bulk imports/exports.
- Auditing error handling in Express controllers.

## Responsibilities

- **Inventory Integrity**: Ensure transactions correctly update product quantities and handle concurrent updates.
- **Data Validation**: Verify that incoming request bodies are validated before being passed to database queries.
- **Error Handling**: Confirm that controllers use try-catch blocks and provide consistent error responses (400 for user errors, 500 for system failures).
- **SQLite Optimization**: Review SQL queries for performance, proper indexing, and use of parameterized statements to prevent injection.
- **Resource Management**: Check that file streams for CSV exports/imports are properly closed and temporary files are cleaned up.

## Review Workflows

### 1. Reviewing Controller Changes
- **Input Validation**: Check if mandatory fields (e.g., `product_id`, `quantity`) are present.
- **Logic Verification**: For `transactionsController`, ensure `quantity` adjustments correctly reflect the `type` (IN vs OUT).
- **Response Consistency**: Ensure all responses return JSON with status codes following the project's convention.

### 2. Reviewing Database Operations
- **Symbol Check**: Ensure use of `db.run`, `db.get`, or `db.all` from `src/config/database.js`.
- **Transaction Safety**: For complex operations like `createBatch`, ensure related records (products, transactions) are handled atomically if possible.
- **Async/Await**: Verify that all database calls are properly awaited.

### 3. Reviewing CSV Processing
- **Memory Safety**: For `csvController`, check if large files are processed using streams rather than loading entirely into memory.
- **Edge Cases**: Ensure the importer handles malformed CSV rows or missing headers gracefully.

## Best Practices (Project-Specific)

- **SQL Conventions**: Use uppercase for SQL keywords (`SELECT`, `INSERT`, `UPDATE`).
- **Date Handling**: Store dates in ISO 8601 format to ensure consistency across the SQLite database.
- **Soft Deletes**: Use the `deleted_at` pattern implemented in `productsController.js` instead of hard-deleting records to preserve audit trails.
- **Transaction Logging**: Every stock change must be accompanied by a transaction record in the `transactions` table.

## Repository Starting Points

- `src/controllers/`: Core business logic and request handling.
- `src/routes/`: API endpoint definitions and middleware mapping.
- `src/config/`: Database initialization and global configurations.
- `src/services/`: (If present) Abstracted business logic for reusable components.

## Key Files

- `src/controllers/transactionsController.js`: Critical for inventory accuracy and stock history.
- `src/controllers/productsController.js`: Manages the core product catalog and soft-delete logic.
- `src/controllers/batchesController.js`: Handles complex grouping of products and stock arrivals.
- `src/config/database.js`: The central database interface; any changes here require high-scrutiny review.
- `src/controllers/csvController.js`: Manages bulk data entry and reporting.

## Key Symbols for Review

- `initDatabase`: Check for schema versioning and proper table creation.
- `create` (in `transactionsController`): Verify that stock levels are incremented/decremented correctly.
- `importCSV`: Review row-by-row validation logic.
- `softDelete`: Ensure `deleted_at` is set and subsequent `SELECT` queries filter out deleted items.

## Collaboration Checklist

- [ ] Does this change affect the stock count accuracy?
- [ ] Are SQL queries protected against injection using placeholders?
- [ ] Is the error handling consistent with the rest of the controllers?
- [ ] Have you checked for potential race conditions during stock updates?
- [ ] Does the UI (if applicable) require a corresponding update for these API changes?
- [ ] Are there new dependencies, and are they necessary?

## Hand-off Notes

- **Stock Discrepancies**: If a PR modifies how transactions are recorded, perform a manual audit of the `quantity` calculation logic.
- **Database Schema**: Any migration or schema change must be verified against the `initDatabase` function in `src/config/database.js`.
- **Large Imports**: Ensure `csvController` changes have been tested with files containing >1000 rows to check performance.

## Related Resources

- [Project README](../../README.md)
- [Database Schema Documentation](../docs/database.md)
- [API Specification](../docs/api-routes.md)
