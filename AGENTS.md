# AGENTS.md - Development Guide for TopRouter

This document provides essential information for AI agents working on the TopRouter codebase. TopRouter is a high-performance, payment-free AI intelligent routing gateway with 14-dimensional multilingual static analysis and dynamic fallback routing.

## Project Overview

- **Language**: TypeScript (ES modules)
- **Runtime**: Node.js (ESM)
- **Package Manager**: npm
- **Entry Point**: `src/core/classifier.ts` (core classification engine)
- **Configuration**: `tsconfig.json` (strict TypeScript settings)

## Build Commands

Currently, the project does not have a formal build process. The source TypeScript files are executed directly via `ts-node`. Ensure dependencies are installed with `npm install` before running commands. Suggested commands:

```bash
# Type check only (no emit)
npm run typecheck

# Compile TypeScript to JavaScript (if outDir configured)
npm run build

# Run the test classifier script
npm run test:manual
```

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "test:manual": "ts-node test-classifier.ts"
  }
}
```

## Linting & Formatting

No linting or formatting tool is currently configured. Consider adding:

- **ESLint** with `@typescript-eslint` plugin
- **Prettier** for consistent code style

If added, typical commands would be:

```bash
npm run lint          # Run ESLint
npm run lint:fix      # Auto-fix lint issues
npm run format        # Format code with Prettier
npm run format:check  # Check formatting without changes
```

## Testing

The project currently uses a simple manual test script (`test-classifier.ts`). No test framework is installed. Consider adding:

- **Jest** or **Vitest** for unit testing
- **Supertest** for API testing (if applicable)

If using Jest, add these scripts:

```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Generate coverage report
```

To run a single test file:

```bash
npm test -- path/to/test.ts
```

## Code Style Guidelines

Follow these conventions based on existing code patterns:

### Imports

- Use ES module `import`/`export` syntax.
- Place imports at the top of the file.
- Use double quotes for module specifiers: `import { something } from "./module.js";`
  - Note: With `module: "nodenext"`, relative import paths need explicit `.js` (or `.ts`) extensions. Use `.js` for TypeScript source files.
- Group imports logically (external dependencies first, then internal modules).
- Use `import type` for type-only imports when `verbatimModuleSyntax` is enabled.

Example:
```typescript
import { Classifier } from "./classifier.js";
import type { ScoringResult } from "./types.js";
```

### Naming Conventions

- **Variables & functions**: `camelCase`
- **Classes & interfaces**: `PascalCase`
- **Type aliases & enums**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE` for true constants, otherwise `camelCase`
- **Files**: `kebab-case` for file names (e.g., `keyword-manager.ts`)

### Typing

- Always explicitly type function parameters and return types.
  - Arrow function parameters must also be explicitly typed, even when using array methods like `filter`, `map`, etc.
- Use TypeScript's strict mode (enabled in tsconfig).
- Prefer `interface` for object shapes that will be extended or implemented.
- Use `type` for unions, intersections, and simple aliases.
- Avoid `any`; use `unknown` or specific types.
- Leverage `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` for safety.

### Strings

- Use double quotes (`"`) for string literals.
- Use template literals for interpolation and multi-line strings.

### Comments

- Use JSDoc-style comments (`/** ... */`) for public APIs (classes, methods, exports).
- Use inline comments (`//`) for complex logic explanations.
- Bilingual comments (Chinese/English) are acceptable where needed for team clarity.

### Error Handling

- Throw `Error` objects with descriptive messages.
- Catch errors at appropriate boundaries.
- Consider using `Result`-type patterns for predictable error handling (not yet implemented).

### Formatting

- Indent with 2 spaces (as seen in source files).
- Use semicolons at the end of statements.
- Keep lines under 100 characters (consider readability).
- Blank lines between logical sections.

## TypeScript Configuration

Key tsconfig settings:

- `"strict": true` – enables all strict type-checking options
- `"verbatimModuleSyntax": true` – ensures import/export consistency
- `"noUncheckedIndexedAccess": true` – array and object index accesses are checked
- `"exactOptionalPropertyTypes": true` – optional properties must be explicitly undefined
- `"module": "nodenext"` – Node.js ES modules
- `"target": "esnext"` – latest ECMAScript features

Do not modify these without understanding their impact on type safety.

## Git Conventions

- Commit messages should follow the conventional commits format: `<type>(<scope>): <description>`
- Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Use English for commit messages.
- Branch naming: `feature/<short-description>`, `fix/<issue>`, `docs/<topic>`

## Cursor & Copilot Rules

No `.cursorrules` or `.github/copilot-instructions.md` files exist yet. If added, agents should adhere to their directives.

## Agent Workflow

When implementing changes, follow these steps:

1. **Type checking**: Run `npm run typecheck` (or `tsc --noEmit`) to ensure no TypeScript errors.
2. **Testing**: If tests exist, run `npm test` (or `npm run test:manual` for the current manual test).
3. **Linting/formatting**: If linting/formatting tools are configured, run `npm run lint` and `npm run format`.
4. **Commit**: Follow Git conventions, ensuring commit messages are descriptive.

## Additional Notes

- The project is in early development; expect frequent changes.
- The core algorithm is a 14-dimensional weighted classifier with multilingual keyword support.
- Future work includes Go implementation for microsecond-level L1 scanning.
- Keep the codebase free of payment‑related logic (remove `Payment`, `Balance`, `X402` modules).

---

*Last updated: 2026‑02‑28*