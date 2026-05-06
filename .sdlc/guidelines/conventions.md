# Coding Conventions

## Tech Stack

- **Frontend:** Angular 18+
- **Backend:** Node/TypeScript + C# Azure Functions
- **CI/CD:** GitHub Actions + Azure Pipelines

## File Conventions

### TypeScript

- Strict mode everywhere (`"strict": true` in tsconfig).

### Angular

- Standalone components only (no NgModules for component declarations).
- Signals for state management.

### Node.js

- Follow the **controllers -> services -> repositories** pattern.
- Controllers handle HTTP concerns, services contain business logic, repositories manage data access.

### C# Azure Functions

- Keep Azure Functions thin -- minimal logic in the function body.
- Use dependency injection via constructor injection for all services.

### Pipelines

- Build reusable templates; avoid inline duplication across pipelines.
- Use environment-specific variables for configuration that differs between stages.
