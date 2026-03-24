# Feature Developer Agent Playbook

---
type: agent
name: Feature Developer
description: Implement new features and API enhancements for the Inventory Management System
agentType: feature-developer
phases: [P, E]
generated: 2024-03-23
status: active
scaffoldVersion: "2.0.0"
---

## Mission
This agent implements new features, API endpoints, and business logic within the Inventory Management System. It focuses on maintaining architectural consistency while delivering robust, tested functionality.

**When to engage:**
- Adding new CRUD operations for entities (Products, Batches, Tags).
- Implementing complex business logic (e.g., stock adjustments, batch tracking).
- Creating new API endpoints or modifying existing routes.
- Developing CSV import/export functionality.

## Repository Context

The Inventory Management System is a Node.js/Express application. It follows a Controller-Service-Model pattern (implied) or a direct Controller-Model pattern with a focus on RESTful API design.

### Relevant Layers

- **Routes (`src/routes`)**: Defines API endpoints and maps them to controller methods.
- **Controllers (`src/controllers`)**: Handles HTTP request logic, input validation, and response formatting.
- **Models (`src/models`)**: (Implicitly located in `src/models` or equivalent) Defines data structure and database interactions.
- **Services (`src/services`)**: Business logic encapsulation (check if this directory exists).
- **Middlewares (`src/middleware`)**: Auth, validation, and error handling.

## Key Project Resources

- `README.md`: Core project setup and overview.
- `package.json`: Dependency list and scripts.
- `src/app.js` or `src/index.js`: Application entry point and middleware configuration.

## Repository Starting Points

- `src/routes/`: Route definitions for all modules.
- `src/controllers/`: Business logic and request handling.
- `src/models/`: Database schema definitions (e.g., Product, Batch, Transaction, Tag).
- `src/services/`: Reusable business logic components.
- `tests/`: Unit and integration tests.

## Key Files & Purposes

| File | Purpose |
| :--- | :--- |
| `src/controllers/productsController.js` | Core logic for product lifecycle (CRUD, soft deletes). |
| `src/controllers/batchesController.js` | Logic for inventory batches, tracking stock arrivals and expirations. |
| `src/controllers/transactionsController.js` | Records movements of inventory (in/out). |
| `src/controllers/csvController.js` | Bulk data handling via CSV import/export. |
| `src/routes/index.js` | Main router file aggregating all module routes. |

## Feature Implementation Workflow

### 1. Requirements Analysis
- Review the feature specification.
- Identify affected data models (e.g., does this need a new column in `Products`?).
- Determine if new routes are required.

### 2. Route Definition
- Add the new endpoint to the relevant file in `src/routes/`.
- Use consistent HTTP verbs: `GET` for retrieval, `POST` for creation, `PUT/PATCH` for updates, `DELETE` for removal.

### 3. Controller Development
- Implement the logic in `src/controllers/`.
- **Validation**: Ensure all incoming `req.body` and `req.params` are validated.
- **Error Handling**: Wrap logic in try-catch blocks and use the centralized error handling middleware.
- **Transactions**: For operations affecting multiple tables (e.g., creating a batch and updating product totals), use database transactions.

### 4. Logic Implementation Patterns
Follow these established patterns found in the codebase:
- **Soft Deletes**: Use the `softDelete` pattern for products (`deletedAt` or `isActive` flags) rather than hard deletion.
- **CSV Handling**: Use `csvController.js` patterns for file processing, ensuring temporary files are cleaned up.
- **Transaction Logging**: Every inventory change must trigger an entry in the `transactions` table.

### 5. Testing
- Create a corresponding test file in `tests/`.
- Write unit tests for the controller logic.
- Write integration tests for the new API endpoint.

## Best Practices

- **Consistent Response Format**: Always return JSON with a consistent structure (e.g., `{ success: true, data: ... }` or `{ success: false, error: ... }`).
- **Input Sanitization**: Never trust client input; sanitize strings and validate types.
- **Code Reuse**: If logic is needed across multiple controllers, extract it into a service file in `src/services/`.
- **Naming Conventions**: 
    - Variables/Functions: `camelCase`
    - Classes/Models: `PascalCase`
    - Routes: `kebab-case`
- **Documentation**: Update JSDoc comments for all new functions and update any API documentation files.

## Key Symbols to Reference

- `productsController.create`: Reference for adding new items.
- `batchesController.createBatch`: Reference for handling stock entry logic.
- `transactionsController.create`: Reference for audit trail creation.
- `csvController.importCSV`: Reference for handling file uploads and parsing.

## Collaboration Checklist

- [ ] Does the new feature follow the Controller-Model architecture?
- [ ] Are all new API endpoints documented in the README or API spec?
- [ ] Have you checked for breaking changes in existing `Product` or `Batch` logic?
- [ ] Is error handling robust for edge cases (e.g., database downtime, malformed CSV)?
- [ ] Are there unit tests covering at least 80% of the new logic?
- [ ] Has the `transactions` log been updated for any state-changing operations?

## Hand-off Notes
When completing a feature:
- List all new API endpoints.
- Note any changes made to the database schema.
- Specify if any new environment variables are required.
- Confirm that `npm test` passes for the entire suite.
