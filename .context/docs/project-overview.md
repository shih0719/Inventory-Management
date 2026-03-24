# Project Overview

The Inventory Management system is a backend-driven application designed to streamline product tracking, stock levels, and historical transaction logging. It solves the complexity of manual inventory management by providing robust APIs for product lifecycle management, batch tracking (for expiry or shipment groups), and categorized tagging. The project benefits warehouse managers and small-to-medium enterprises requiring a structured way to handle stock movements, CSV data migrations, and audit trails.

## Codebase Reference

> **Detailed Analysis**: For complete symbol counts, architecture layers, and dependency graphs, see [`codebase-map.json`](./codebase-map.json).

## Quick Facts

- **Root**: `C:\Users\eyeye\Documents\code_test\Inventory-Management`
- **Primary Languages**: JavaScript (Node.js)
- **Entry Points**: 
    - `src/app.js` (Main application server)
    - `src/config/database.js` (Database initialization and connection)
- **Full Analysis**: [`codebase-map.json`](./codebase-map.json)

## Entry Points

- **Server Entry**: [`src/app.js`](../src/app.js) — The primary entry point that initializes the Express application, middleware, and routes.
- **Database Layer**: [`src/config/database.js`](../src/config/database.js) — Handles SQLite connection pooling and schema initialization.
- **Routing Hub**: [`src/routes/index.js`](../src/routes/index.js) (or individual files in `src/routes/`) — Maps HTTP endpoints to controller logic.

## Key Exports

See [`codebase-map.json`](./codebase-map.json) for the complete list of exported symbols.

Key logic modules include:
- `productsController`: CRUD operations and soft deletion for inventory items.
- `transactionsController`: Logic for recording stock adjustments and movements.
- `batchesController`: Management of specific product batches and expiry dates.
- `csvController`: Utilities for bulk importing and exporting data via CSV.
- `database`: Core wrappers for `run`, `get`, and `all` database operations.

## File Structure & Code Organization

- `src/controllers/` — Contains the business logic for handling requests and interacting with the database layer.
- `src/routes/` — Defines the API endpoints and connects them to the appropriate controllers.
- `src/config/` — Configuration files, specifically database setup (`database.js`) and environment settings.
- `src/utils/` (if present) — Helper functions for data parsing and validation.
- `docs/` — Technical documentation and project guides.
- `public/` or `uploads/` — Storage for static assets or CSV files during processing.

## Technology Stack Summary

**Runtime**: Node.js (LTS recommended)

**Language**: JavaScript (ES6+)

**Data Storage**: SQLite (relational database managed via `sqlite3` driver)

**Infrastructure**:
- **Framework**: Express.js for the REST API layer.
- **Package Manager**: npm
- **Utilities**: `csv-parser` or similar for data processing, `dotenv` for environment variable management.

## Core Framework Stack

The application follows a **Controller-Route-Model** architectural pattern (though the "Model" layer is often abstracted directly into the database config or controllers in this specific implementation). 

- **Backend**: Express.js provides the middleware-based request pipeline.
- **Persistence**: SQLite is used for local data storage, providing a lightweight, file-based relational system that requires no external server setup.
- **Data Exchange**: RESTful JSON APIs for standard operations and multipart/form-data for CSV file uploads.

## Development Tools Overview

See [Tooling](./tooling.md) for detailed development environment setup.

**Essential Commands**:
- `npm install` — Install all necessary Node.js dependencies.
- `npm start` — Launch the production server.
- `npm run dev` — Start the server with `nodemon` for automatic restarts during development.
- `node src/config/database.js` — (Internal usage) often triggers schema initialization.

## Getting Started Checklist

1. **Clone the repository** to your local machine.
2. **Install dependencies**: Run `npm install` in the root directory.
3. **Environment Setup**: Create a `.env` file if required (see `.env.example`) to configure ports or database paths.
4. **Initialize Database**: The application automatically calls `initDatabase` on startup, but ensure the `src/config/database.js` path is writable.
5. **Start the Server**: Run `npm run dev` to start the application.
6. **Verify**: Use a tool like Postman or `curl` to hit `GET /api/products` to ensure the system is responsive.
7. **Review [Development Workflow](./development-workflow.md)** for coding standards and PR processes.

## Next Steps

- **System Design**: Review [Architecture](./architecture.md) to understand the relationship between Batches, Products, and Transactions.
- **API Integration**: Check the route files in `src/routes/` for a full list of available endpoints.
- **Data Migration**: Consult the `csvController` documentation for details on bulk data onboarding.

## Related Resources

- [architecture.md](./architecture.md)
- [development-workflow.md](./development-workflow.md)
- [tooling.md](./tooling.md)
- [codebase-map.json](./codebase-map.json)
