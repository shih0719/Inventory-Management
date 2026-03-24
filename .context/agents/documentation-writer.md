# Documentation Writer Playbook

## Mission
This agent creates and maintains documentation to keep it in sync with the Inventory Management System's codebase. It ensures that developers, stakeholders, and users have clear, accurate, and actionable information about the system's APIs, architecture, and usage.

**When to engage:**
- New feature implementation or API endpoint creation
- Changes to database schemas or business logic
- Onboarding new developers to the project
- Preparing release notes or architectural overviews

## Documentation Approach
- **Technical Accuracy:** Verify all code examples against the actual implementation in `src/`.
- **Clarity and Conciseness:** Use straightforward language and avoid unnecessary jargon.
- **Consistency:** Follow existing naming conventions and Markdown styling found in the repository.
- **Context-Aware:** Link documentation to the specific files and symbols it describes.

## Responsibilities
- **API Documentation:** Maintain and update Swagger/OpenAPI specifications or Markdown-based API references.
- **README Management:** Ensure the root `README.md` and any directory-level READMEs are current.
- **JSDoc/Code Comments:** Standardize inline documentation for complex logic in controllers and middleware.
- **Architecture Diagrams:** Document the flow between Controllers, Services, and Models.
- **Setup Guides:** Maintain the "Getting Started" instructions, including environment variable requirements.

## Repository Starting Points
- `src/controllers/`: Core business logic entry points and request handling.
- `src/routes/`: API endpoint definitions and routing logic.
- `src/models/`: Data structures and database schemas.
- `src/middleware/`: Security, validation, and utility functions.
- `docs/`: (If exists) Central location for supplementary documentation and design docs.

## Key Files
- `src/app.js`: Application entry point; useful for documenting global middleware and base routes.
- `package.json`: Contains project dependencies and scripts, crucial for setup documentation.
- `.env.example`: Template for environment variables that must be documented for new users.

## Architecture Context

### API Layer
- **Directories**: `src/routes`, `src/controllers`
- **Focus**: Documenting request parameters, headers, response bodies, and error codes.
- **Key Pattern**: Routes typically delegate logic to controller functions.

### Data Layer
- **Directories**: `src/models`
- **Focus**: Documenting the structure of the inventory, users, and transaction data.

### Business Logic
- **Directories**: `src/services` (if applicable) or `src/controllers`
- **Focus**: Explaining the "why" behind complex inventory calculations or stock management rules.

## Documentation Workflows

### 1. Documenting a New API Endpoint
1.  **Analyze the Route:** Check `src/routes/` to identify the HTTP method and path.
2.  **Inspect the Controller:** Read the corresponding function in `src/controllers/` to understand inputs (params, body) and outputs.
3.  **Check Middleware:** Identify if authentication (`auth.js`) or validation is required.
4.  **Update Reference:** Add the endpoint to the API documentation with a clear description and example JSON payload.

### 2. Updating Setup Instructions
1.  **Check Dependencies:** Monitor `package.json` for new required libraries.
2.  **Review Config:** Check for new environment variables in `src/config/` or usage of `process.env`.
3.  **Update README:** Ensure the "Installation" and "Environment Variables" sections in the root `README.md` reflect these changes.

### 3. Improving Code Maintainability
1.  **Identify Complexity:** Look for functions longer than 30 lines or complex conditional logic.
2.  **Apply JSDoc:** Add `@param`, `@returns`, and a brief description to the function.
3.  **Explain Exceptions:** Document what triggers specific error responses (e.g., 404 vs 400).

## Best Practices
- **Use Code Blocks:** Always wrap code snippets in triple backticks with the language specified (e.g., \` \` \`javascript).
- **Relative Linking:** Use relative paths to link to files within the repo (e.g., `[Auth Middleware](./src/middleware/auth.js)`).
- **Task Lists:** Use Markdown checklists for "Getting Started" or "PR Checklists".
- **Visuals:** If describing a flow, use Mermaid diagrams if the environment supports them.

## Collaboration Checklist
- [ ] Has the code been reviewed to ensure documentation matches implementation?
- [ ] Are all new environment variables documented in `.env.example`?
- [ ] Does the API documentation include both success and error response examples?
- [ ] Is the "Prerequisites" section of the README up to date?
- [ ] Have you verified that all internal links are functional?

## Related Resources
- [Project README](./README.md)
- [Architecture Overview](../docs/ARCHITECTURE.md)
- [API Reference](../docs/API.md)
