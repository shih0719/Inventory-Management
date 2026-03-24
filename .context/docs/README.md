# Technical Documentation Hub

Welcome to the central documentation repository for the Inventory Management system. This directory provides detailed technical guides, architecture overviews, and workflow specifications for developers and maintainers.

## 📖 Documentation Index

Start with the project overview to understand the system's goals, then dive into specific technical guides as needed.

| Guide | File | Description |
| --- | --- | --- |
| **Project Overview** | [project-overview.md](./project-overview.md) | Roadmap, architecture, and stakeholder notes. |
| **Development Workflow** | [development-workflow.md](./development-workflow.md) | Branching rules, CI config, and contributing guide. |
| **Testing Strategy** | [testing-strategy.md](./testing-strategy.md) | Test configurations, CI gates, and quality assurance. |
| **Tooling & Productivity** | [tooling.md](./tooling.md) | CLI scripts, automation workflows, and IDE configs. |

---

## 🏗️ System Architecture

The application is a Node.js-based inventory system designed for high traceability and bulk data management. It utilizes a relational data model managed via a custom SQLite abstraction.

### Core Modules

1.  **Product Management**: Handles the lifecycle of inventory items, including metadata tagging and soft-deletion capabilities.
2.  **Batch Tracking**: Manages specific lots of products, allowing for granular tracking of stock based on manufacturing or arrival dates.
3.  **Transaction Engine**: Maintains an immutable audit trail of all inventory movements (additions, removals, and adjustments).
4.  **Data Integration**: Provides robust CSV import/export functionality for bulk updates and reporting.

### Data Layer
Database operations are centralized in `src/config/database.js`, which provides an asynchronous wrapper for SQLite operations:
- `initDatabase()`: Handles schema initialization and migrations.
- `run()`, `get()`, `all()`: Standardized methods for executing queries.

---

## 📁 Repository Snapshot

- `src/` — TypeScript source files, controllers, and core logic.
- `public/` — Static assets and frontend resources.
- `uploads/` — Temporary storage for CSV processing.
- `database/` — Local database storage.
- `server.js` — Application entry point.

### Key Controller Reference

| Controller | Primary Responsibilities |
| --- | --- |
| `productsController.js` | CRUD operations, soft deletes, and product retrieval. |
| `batchesController.js` | Batch creation and lot-based stock management. |
| `transactionsController.js` | Recording stock history and per-product transaction logs. |
| `csvController.js` | Template generation, bulk CSV imports, and data exports. |
| `tagsController.js` | Management of product categorization labels. |

---

## 🚀 Quick Start for Developers

1.  **Onboarding**: Read the [Project Overview](./project-overview.md) to understand the business logic.
2.  **Setup**: Follow the [Development Workflow](./development-workflow.md) to configure your local environment and database.
3.  **Standards**: Refer to the [Testing Strategy](./testing-strategy.md) before submitting Pull Requests to ensure all CI gates are met.
4.  **Efficiency**: Check the [Tooling Guide](./tooling.md) for helpful CLI scripts and automation.
