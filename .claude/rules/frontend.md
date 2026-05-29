---
name: frontend-layer
description: Rules for frontend code (vite-app/)
path: vite-app/**
---

## Frontend Guidelines (Vite App)

### Setup
- Vite bundler with HMR (hot module reloading)
- Component-based architecture
- API calls to backend via `/api/*` routes

### When working here

**Component development:**
- Use `/run` skill to start the dev server and test changes
- Check browser DevTools for errors and network requests
- Test the feature end-to-end before marking complete

**API integration:**
- Fetch from `fetch('/api/...')` or client SDK
- Handle loading, error, and success states
- Display user-friendly error messages from server responses

### Conventions
- Components are modular and accept props
- State management follows the framework pattern (React hooks, Vue composition API, etc.)
- Styles scoped to components (avoid global CSS conflicts)
- Test critical user flows (login, CRUD operations)

### Testing
Visual testing in the browser is primary; unit tests for utility functions.

---

See also: [[api-layer]] for backend endpoints the frontend consumes.
