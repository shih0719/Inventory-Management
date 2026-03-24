# Development Workflow

This document outlines the standard engineering processes for contributing to the Inventory Management system. Our goal is to maintain a high-quality codebase while enabling rapid iteration through clear standards and automated validation.

The workflow follows a standard iterative cycle:
1.  **Task Selection**: Identify a task from the project backlog or issue tracker.
2.  **Implementation**: Develop the feature or fix in a dedicated branch, ensuring local tests pass.
3.  **Validation**: Submit a Pull Request for peer review and automated CI checks.
4.  **Integration**: Merge into the main branch for deployment.

## Branching & Releases

We use a feature-branching model to ensure the `main` branch remains stable and deployable at all times.

-   **Branch Naming Conventions**:
    -   `main`: The production-ready branch. Direct commits are prohibited.
    -   `feature/description`: For new functionality (e.g., `feature/batch-tracking`).
    -   `fix/description`: For bug fixes (e.g., `fix/csv-import-validation`).
    -   `refactor/description`: For code improvements that don't change functionality.
    -   `docs/description`: For documentation-only changes.
-   **Release Cadence**: Releases are cut from `main` following successful integration of features. We use Semantic Versioning (SemVer).
-   **Tagging**: Releases are marked with git tags (e.g., `v1.2.0`). Each tag represents a stable snapshot of the system including the SQLite database schema and API controllers.

## Local Development

To set up the environment and begin development, follow these steps:

-   **Install Dependencies**: 
    ```bash
    npm install
    ```
-   **Initialize Database**: The system uses SQLite. Ensure the local database is initialized by running:
    ```bash
    # This runs the initDatabase function from src/config/database.js
    npm run migrate
    ```
-   **Start Development Server**: Runs the application with hot-reloading (via nodemon or similar).
    ```bash
    npm run dev
    ```
-   **Run Tests**: Execute the test suite before pushing any changes.
    ```bash
    npm test
    ```
-   **Linting**: Ensure code style consistency.
    ```bash
    npm run lint
    ```
-   **Build**: Compile or prepare assets for distribution.
    ```bash
    npm run build
    ```

## Code Review Expectations

All code changes must undergo a peer review via a Pull Request (PR) before being merged into `main`.

**Reviewer Checklist**:
-   **Functionality**: Does the code solve the intended problem?
-   **Test Coverage**: Are there new tests for new logic? Refer to [testing-strategy.md](./testing-strategy.md) for requirements.
-   **Architecture**: Does the change respect the existing Controller/Config separation? (e.g., database logic belongs in `src/config`, request handling in `src/controllers`).
-   **Documentation**: Are API changes reflected in the documentation?
-   **Security**: Does the code handle user input safely (especially in CSV imports and database queries)?

**Approvals**:
-   At least one approving review from a maintainer is required.
-   All CI status checks (linting, tests) must be green.
-   For AI-assisted development, refer to `AGENTS.md` for guidelines on how to credit and verify agent-generated code.

## Onboarding Tasks

If you are new to the repository, please complete these steps to familiarize yourself with the system:

1.  **Environment Setup**: Follow the [Local Development](#local-development) steps to get the app running.
2.  **Explore the API**: Review `src/routes` to understand the available endpoints for Products, Transactions, and Batches.
3.  **Data Flow**: Trace a `create` request in `src/controllers/productsController.js` down to the `src/config/database.js` execution to understand the persistence layer.
4.  **First Issue**: Look for issues tagged `good-first-issue`. These usually involve adding validation to a controller or expanding test coverage for a specific utility.

## Related Resources

-   [Testing Strategy](./testing-strategy.md) - Details on unit and integration testing.
-   [Tooling](./tooling.md) - Overview of the development tools and CLI utilities used in this project.
