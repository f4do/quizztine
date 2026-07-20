# Contributing to Quizztine

Thanks for your interest! Here's how to get started.

## Quick start

```bash
docker compose up
```

Open http://localhost:5173 for the frontend dev server, or http://localhost:3000 for the Express API.

Tests are pre-configured with seed data (5 users, 50 questions).

## Project structure

```
quizztine/
├── services/
│   ├── web-backend/     # Express API + in-process game engine
│   └── frontend/        # React SPA
├── docker-compose.yml   # Dev
└── docker-compose.prod.yml
```

## Before you submit a PR

1. **Read `AGENTS.md`** — it documents architecture decisions, patterns, and conventions.
2. **Run tests**:

   ```bash
   make test         # Backend + frontend
   make test-backend # Vitest (~262 tests)
   make test-frontend# Vitest (~104 tests)
   ```

3. **Run lint + typecheck**:

   ```bash
   make lint
   make typecheck
   ```

4. **Add tests** for new features or bug fixes. Pull requests without tests will be flagged.

## Code conventions

- **Backend**: Express routes → controllers → lib/middleware. Error hierarchy via `AppError`.
- **Engine**: Strategy patterns (`GameFlow`, `AnswerValidator`). Add new game modes via subclassing.
- **Frontend**: Hooks for state logic, presentational components for rendering. i18n via `react-i18next`.
- **Types**: Zod for runtime validation. `Record<string, unknown>` is discouraged.

## Commit format

Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `ci:`, `chore:`, `style:`, `test:`.

## Questions

Open an issue or start a discussion on GitHub.
