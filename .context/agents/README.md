# Feature Developer Agent Playbook

This playbook provides a comprehensive guide for the **Feature Developer Agent** to implement new features, modify existing functionality, and maintain the inventory management system.

## 1. Overview of Responsibility
The Feature Developer Agent is responsible for end-to-end implementation of new capabilities. This includes:
- Analyzing requirements and mapping them to existing data structures.
- Implementing controller logic for HTTP request handling.
- Modifying or creating database models and services.
- Ensuring consistent error handling and response formats.
- Updating routes to expose new functionality.

## 2. Core Project Structure & Focus Areas

Focus your development efforts within the `src/` directory, following the established architectural patterns:

| Layer | Directory | Responsibility |
| :--- | :--- | :--- |
| **Routes** | `src/routes/` | Endpoint definitions and middleware attachment. |
| **Controllers** | `src/controllers/` | Request validation, business logic orchestration, and response formatting. |
| **Models** | `src/models/` | Data schema definitions and database interactions (Prisma). |
| **Services** | `src/services/` | Shared business logic and external integrations (e.g., CSV processing). |
| **Config** | `src/config/` | Environment variables and DB client initialization. |

## 3. Key Development Workflows

### 3.1 Adding a New Resource (CRUD)
1. **Model Definition**: Update `prisma/schema.prisma` if a new database table is required. Run migrations.
2. **Controller Implementation**: Create a new file in `src/controllers/` (e.g., `ordersController.js`).
    - Use `async/await` for all asynchronous operations.
    - Wrap logic in `try-catch` blocks.
3. **Route Registration**: Create a new file in `src/routes/` and export the router. Register it in the main entry point.
4. **Validation**: Ensure input data is validated before processing.

### 3.2 Extending Existing Features
1. **Locate Controller**: Find the relevant file in `src/controllers/` (e.g., `productsController.js`).
2. **Identify Impact**: Check if the change affects transaction history or batch management (critical for inventory integrity).
3. **Update Logic**: Implement the change following the existing functional style.
4. **Update Response**: Ensure the JSON response structure matches existing endpoints.

## 4. Coding Standards & Best Practices

### 4.1 Error Handling
Always use the established error handling pattern in controllers:
```javascript
try {
    // Logic
    res.status(200).json({ success: true, data: result });
} catch (error) {
    console.error('Error in [Feature Name]:', error);
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error',
        error: error.message 
    });
}
```

### 4.2 Database Access
- Use **Prisma** for all database interactions.
- Prefer `include` for fetching related records (e.g., including tags when fetching products).
- Use `softDelete` (updating a `deletedAt` flag) instead of hard deletes where applicable.

### 4.3 Inventory Integrity
- When modifying product quantities, always create a corresponding entry via the `transactionsController.js` logic or the `transactions` table.
- Use `batches` for tracking stock variations and expiration dates where necessary.

### 4.4 CSV Operations
- For bulk data operations, refer to `src/controllers/csvController.js`.
- Use the `csv-parser` or `fast-csv` patterns already established for imports.

## 5. Key Files & Reference Symbols

- **Products**: `src/controllers/productsController.js`
    - `getAll`, `getById`, `create`, `update`, `softDelete`
- **Transactions**: `src/controllers/transactionsController.js`
    - `create` (Central to stock movements)
- **Batches**: `src/controllers/batchesController.js`
    - `createBatch`, `getAllBatches`
- **Routes**: `src/routes/`
    - Patterns: `router.get('/', controller.getAll)`, `router.post('/', controller.create)`

## 6. Verification Checklist
- [ ] Does the new feature follow the `(req, res)` controller signature?
- [ ] Are database operations wrapped in appropriate transactions if multiple writes occur?
- [ ] Is the response format consistent: `{ success: true, data: ... }`?
- [ ] Have you checked for potential side effects on "Batches" or "Tags"?
- [ ] Is logging included for debugging purposes?
