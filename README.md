# Quizztine

Real-time multiplayer quiz with a customizable virtual TV host. Solo or up to 20 players.

![Version](https://img.shields.io/github/v/release/f4do/quizztine)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Solo** — Practice on your weak topics, with streak bonuses
- **Multiplayer** — Up to 20 players, synchronized rounds, real-time scoring
- **Virtual host** — Customizable avatar, expressions, and welcome messages
- **Questions** — Multiple-choice with media (image/audio), categories, difficulty levels, explanations
- **Administration** — Manage questions, users, categories, and hosts
- **i18n** — French and English included, easy to extend
- **Dark/Light theme** — Auto-detection with persistence
- **Docker** — Single-container deployment, production-ready

## Quick start

```bash
# Development (hot-reload)
docker compose up

# Production
docker compose -f docker-compose.prod.yml up -d
```

Open [http://localhost:3000](http://localhost:3000) (production) or [http://localhost:5173](http://localhost:5173) (frontend dev).

### Pre-configured accounts (development)

| Username | Role | Password |
|---|---|---|
| `user` | User | `user` |
| `master1` | Quizmaster | `master1` |
| `admin1` | Admin | `admin1` |

## Architecture

Quizztine runs in a **single container** (Node.js 24) that serves both the Express API and the built frontend static files.

```
Browser (React SPA) → Express (API + Socket.IO) → in-process game engine → Postgres
                   → Express (serves frontend static files)
```

### Components

| Component | Tech | Role |
|---|---|---|
| **Backend** | Node.js + Express + TypeScript | REST API, JWT auth, CRUD, WebSocket |
| **Game engine** | TypeScript (in-process) | Room lifecycle, scoring, answer validation |
| **Frontend** | React + Vite + Tailwind CSS v4 | SPA with virtual host, i18n, dark mode |
| **Database** | PostgreSQL 18 via Prisma 7 | Users, questions, results, hosts, phrases |

### Key points

- **Auth** : JWT in httpOnly cookies (access 1h + refresh 7d), refresh token blacklist in DB (SHA-256)
- **Security** : bcryptjs, rate limiting (10 req/15min on auth), configurable CORS
- **Game engine** : Modular architecture — `GameFlow` (Strategy), `AnswerValidator` (Strategy + Registry), `ScoreCalculator` (Protocol)
- **Host** : Customizable avatar with expressions, dynamic phrases, image upload

## Configuration

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@postgres:5432/quizztine` | PostgreSQL connection string |
| `JWT_SECRET` | — | **Required in production** — JWT signing secret |
| `PORT` | `3000` | Express server port |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `UPLOAD_DIR` | `uploads` | Media upload directory |
| `LOG_LEVEL` | `info` | Log verbosity (pino) |
| `NODE_ENV` | `development` | `production` enables security defaults |
| `VITE_API_URL` | `/api` | API base URL |
| `VITE_SOCKET_URL` | `/` | Socket.IO server URL |
| `VITE_DEFAULT_LANG` | `fr` | Default UI language (fr/en) |

## Development

### Prerequisites

- Docker & Docker Compose

### Commands

```bash
make dev          # Start development with hot-reload
make test         # Run all tests
make test-backend # Backend tests (Vitest)
make test-frontend# Frontend tests (Vitest)
make lint         # Lint (frontend + backend)
make typecheck    # TypeScript checks
```

### Project structure

```
quizztine/
├── services/
│   ├── web-backend/       # Express API + game engine
│   │   ├── src/
│   │   │   ├── controllers/   # Route handlers
│   │   │   ├── engine/        # In-process game engine
│   │   │   ├── lib/           # Prisma, JWT, validation, socket, logger
│   │   │   ├── middleware/    # Auth, rate-limit, error, upload
│   │   │   ├── routes/        # Route definitions
│   │   │   └── types/         # Shared types & errors
│   │   └── prisma/            # Schema, migrations, seed
│   └── frontend/              # React SPA
│       └── src/
│           ├── components/    # UI components (host, room, ui)
│           ├── pages/         # Application pages
│           └── lib/           # Hooks, providers, i18n, API
├── docker-compose.yml         # Development
├── docker-compose.prod.yml    # Production
├── Dockerfile                 # Production build
└── Dockerfile.dev             # Development build
```

## Database

Prisma migrations run automatically on startup (`prisma migrate deploy`). To create a new migration:

```bash
cd services/web-backend
pnpm db:migrate
```

The seed file (`prisma/seed.ts`) creates demo data (users, categories, questions).

## Known gaps

- Email sending (verification tokens are generated but not sent)
- TOTP enrollment UI (schema and admin reset exist, user flow missing)
- CAPTCHA (placeholder only)
- Report error button (backend endpoint exists, no frontend UI)
- Quizmaster invite link (promotion via admin dashboard only)
- Max players validation (currently no enforcement)
- Video upload (extension allowed but not implemented)

## License

MIT — see [LICENSE](LICENSE).
