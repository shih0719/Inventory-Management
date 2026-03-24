# Tooling & Productivity Guide

This guide outlines the development environment, scripts, and configurations used in the Inventory Management system. Maintaining a consistent setup ensures that all contributors can build, test, and deploy features with minimal friction and maximum reliability.

The goal of this tooling is to automate repetitive tasks, catch errors early through static analysis, and provide a seamless "inner loop" development experience.

## Required Tooling

To contribute to this project, you must have the following tools installed:

*   **Node.js (v18.x or higher)**: The core runtime. We recommend using `nvm` (Node Version Manager) to manage versions.
*   **npm (v9.x or higher)**: Used for dependency management and running lifecycle scripts.
*   **SQLite3**: The project uses a local SQLite database (`src/config/database.js`). While the `sqlite3` npm package handles the driver, having the [SQLite CLI](https://www.sqlite.org/cli.html) or a GUI tool like [DB Browser for SQLite](https://sqlitebrowser.org/) is highly recommended for manual data inspection.
*   **Git**: Required for version control.

**Initial Setup:**
```bash
# Clone the repository
git clone <repository-url>
cd Inventory-Management

# Install dependencies
npm install

# Initialize the local database
# This triggers the initDatabase logic in src/config/database.js
npm run init-db
```

## Recommended Automation

We use automation to maintain code quality and speed up development cycles.

### Development Scripts
*   **`npm run dev`**: Starts the Express server using `nodemon`. This monitors file changes in `src/` and automatically restarts the process.
*   **`npm run start`**: Standard production start command.
*   **`npm run test`**: Executes the test suite. Use `npm run test:watch` during active development to re-run tests on file save.

### Linting & Formatting
The project enforces a consistent coding style to prevent bikeshedding and reduce PR review overhead:
*   **ESLint**: Catch logical errors and enforce JavaScript best practices. Run via `npm run lint`.
*   **Prettier**: Handles all code formatting (tabs, quotes, trailing commas). Run via `npm run format`.

### Git Hooks (Husky)
The project is configured with Husky hooks:
*   **Pre-commit**: Automatically runs linting and formatting checks. If these fail, the commit is blocked until the code is fixed. This ensures the main branch always stays clean.

## IDE / Editor Setup

While you can use any editor, **Visual Studio Code (VS Code)** is recommended due to the pre-configured workspace settings.

### Recommended Extensions
*   **ESLint (`dbaeumer.vscode-eslint`)**: Real-time feedback on linting errors directly in the editor.
*   **Prettier - Code formatter (`esbenp.prettier-vscode`)**: Enables "Format on Save" for consistent styling.
*   **SQLite Viewer**: Allows you to view the project's `.sqlite` files directly within VS Code.
*   **REST Client**: Useful for testing the API endpoints defined in `src/routes`.

### Workspace Settings
In `.vscode/settings.json`, ensure the following is configured:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

### Debugging
A `launch.json` profile is provided to debug the Express application. You can set breakpoints in controllers (e.g., `src/controllers/productsController.js`) and step through the logic when a request hits the route.

## Productivity Tips

### Database Inspection
Since the database is a local file, you can quickly reset your environment by deleting the `.sqlite` file and running the initialization script again. This is particularly useful when testing complex batch transactions or CSV imports.

### CSV Testing Workflow
The `csvController.js` provides a `downloadTemplate` function. When testing the import feature:
1.  Start the server.
2.  Hit the `/api/csv/template` endpoint to get a correctly formatted file.
3.  Use this file to test `importCSV` functionality, ensuring columns match the expected schema for Products and Batches.

### Terminal Aliases
For frequent tasks, consider adding these aliases to your `.zshrc` or `.bashrc`:
```bash
alias inv-dev='npm run dev'
alias inv-test='npm run test'
alias inv-db='sqlite3 ./database.sqlite'
```

### API Testing
Instead of manual browser testing, use the exported logic in `controllers` to verify behavior. For example, testing `getAll` in `productsController.js` can be done quickly via a `curl` command or a saved Postman collection.

## Related Resources
- [Development Workflow](./development-workflow.md): Detailed guide on branching, commits, and PR processes.
