# Quizztine — Technical notes

> **Maintain this file when making architectural changes.**
> Keep sections accurate: architecture, directory layout, HTTP contracts, patterns, and version matrix.

## Architecture (current)

Single container (mono-container). Express serves both the REST API + Socket.IO and the built frontend static files.

```
Browser (React SPA) → Express (API + Socket.IO) → in-process game engine → Postgres
                   → Express (serves frontend static files)
```

### Services

| Component | Tech | Role |
|---|---|---|
| Backend | Node.js + Express + TypeScript | REST API, auth (JWT), CRUD, WebSocket (Socket.IO) |
| Game engine | TypeScript (in-process, `src/engine/`) | Room lifecycle, scoring, answer validation |
| Frontend (built) | React + Vite + Tailwind CSS v4 | SPA, i18n, virtual host |
| Database | PostgreSQL 18 | Users, questions, results, hosts, phrases |

### Dev workflow

- **`Dockerfile.dev`** — Single container runs both backend (`pnpm dev`) and frontend (`npm run dev`) via `concurrently`, with hot-reload volume mounts.
- **`Dockerfile`** — 3-stage production build: frontend builder → backend builder → runtime. Express serves API + built frontend from `./frontend/dist`.
- **`docker-compose.yml`** — Dev: `postgres` + `app`. Volumes for hot-reload.
- **`docker-compose.prod.yml`** — Prod: `postgres` + `app`. Healthchecks, restart policies, configurable ports via `${VAR}`.
- **Entrypoint** (`docker-entrypoint.prod.sh`) — Wait for DB (max 15 retries) → `prisma migrate deploy` → `node dist/index.js`.

### Makefile

| Command | Action |
|---|---|
| `make dev` | Docker compose up (dev) |
| `make prod-up` | Docker compose up (prod, daemon) |
| `make test` | Backend + frontend tests |
| `make test-backend` | `pnpm test` in `services/web-backend` |
| `make test-frontend` | `npm test` in `services/frontend` |
| `make lint` | Frontend + backend lint |
| `make typecheck` | Frontend + backend typecheck |

### Directory layout

```
quizztine/
├── services/
│   ├── web-backend/           # Express API + in-process game engine
│   │   ├── prisma/                # Schema, migrations, seed
│   │   │   └── generated/         # Prisma Client (gitignored)
│   │   └── src/
│   │       ├── controllers/       # Route handlers (auth, host, questions, rooms, …)
│   │       ├── engine/            # In-process game engine
│   │       │   ├── types.ts
│   │       │   ├── room-store.ts
│   │       │   ├── game-flow.ts
│   │       │   ├── scoring.ts
│   │       │   ├── answer-validator.ts
│   │       │   ├── notifications.ts
│   │       │   ├── index.ts       # gameEngine facade
│   │       │   └── __tests__/
│   │       ├── lib/               # jwt, logger, prisma, socket, validation, …
│   │       ├── middleware/        # auth, rate-limit, error-handler, upload
│   │       ├── routes/            # Express route definitions
│   │       ├── types/             # Shared types & errors
│   │       ├── test/              # Shared test utilities
│   │       ├── config/
│   │       ├── app.ts
│   │       └── index.ts           # Entry point
│   └── frontend/              # React SPA
│       └── src/
│           ├── components/
│           │   ├── host/          # HostAvatar, HostBubble, HostPresenter, AvatarRenderer
│           │   ├── room/          # RoomGame, RoomPreGame, RoomReady, RoomScoreboard
│           │   └── ui/            # Button, Card, CycleSelect, Input, Section, Select
│           ├── pages/             # Home, Login, Register, RoomCreate, RoomPage, Profile,
│           │                      # Train, AdminDashboard, AdminQuestions(+/new/:id/edit),
│           │                      # AdminUsers, AdminCategories, AdminHosts
│           └── lib/               # api, auth, i18n, socket, theme, HostProvider,
│                                  # PhrasesProvider, useRoomGame, useGameTimer,
│                                  # useHostMessages, useRoomGameTypes
├── docker-compose.yml             # Dev
├── docker-compose.prod.yml        # Production
├── Dockerfile                     # Multi-stage production build
├── Dockerfile.dev                 # Dev with hot-reload
├── Makefile
└── .env.example
```

**Archived / dead code:**
- `services/quiz-engine/` — Python FastAPI service, replaced by the in-process TypeScript engine. Directory kept for reference only; not wired into Docker Compose.

### Key architectural decisions

- **Mono-container, not microservices** — The former Python quiz-engine was ported to TypeScript and runs in-process. This eliminates network hops, simplifies deployment, and removes the Docker networking overhead. Decision rationale: the engine is lightweight (~1400 lines), and scaling can be addressed later if needed.
- **In-process engine** — `src/engine/` is a self-contained module with its own tests. It communicates with controllers via the `gameEngine` facade (direct function calls, not HTTP).
- **Socket.IO** — Frontend → backend only. The backend broadcasts game events via Socket.IO; it no longer relays to an external service.
- **JWT in httpOnly cookies** — XSS-safe. Access token (1h) + refresh token (7d) signed with `jose` (HS256). Refresh token blacklist in DB (SHA-256 hashed, auto-purge every hour).
- **Structured logging** — `pino` for backend, `pino-http` middleware for request logging. `LOG_LEVEL` env var configures verbosity.
- **Graceful shutdown** — `SIGTERM`/`SIGINT` handler closes HTTP server, disconnects Socket.IO, cancels room timers, disconnects Prisma. No dangling connections.

## Stack details

### Backend (web-backend)

**Express + TypeScript**. Structure: routes → controllers → lib/middleware. Tests: Vitest (~262 tests).

**Auth:**
- Pseudo + email + password (12+ chars, hashed via `bcryptjs`)
- JWT access token (1h) + refresh token (7d) signed with `jose` (HS256), both httpOnly cookies
- JWT functions (`signAccessToken`, `signRefreshToken`, `verifyToken`) are asynchronous
- Refresh token blacklist stored in DB (`RevokedToken` table) with SHA-256 hash, auto-purge every hour
- Persistent across restarts, scalable multi-instance
- Login accepts `login` field (email or pseudo), frontend sends `{ login, password }`
- Rate-limited: 10 req / 15 min per IP on auth endpoints

**Roles** (hierarchical):
- `USER` — Free registration (valid email required). Sees own stats. Solo training on weak themes (`/train`).
- `QUIZMASTER` — Can add public/private questions, manage own questions. Promotion via admin dashboard.
- `QUIZADMIN` — Full management of all questions, users, categories, hosts.

**Cookie security:** `secure` flag set automatically based on `NODE_ENV` — `true` in production, `false` in development.

**JWT secret:** `JWT_SECRET` env var is **required in production**. Startup fails if missing. Dev default via `.env`.

**Rate limiting:**
- Auth endpoints (`/auth/login`, `/auth/register`): 10 req / 15 min per IP (`express-rate-limit`)
- Global API: 100 req / 15 min per IP (disabled by default, enable in `app.ts`)
- Error format: `{ error, code, status, details }` with code `RATE_LIMIT_EXCEEDED`

**Error format:** All API errors: `{ error, code, status, details? }`

**Prisma ORM** (v7 with `@prisma/adapter-pg`):
- Config: `prisma.config.ts` at service root (not in `package.json`). Uses `defineConfig` from `prisma/config`.
- Schema: `datasource` has no `url` — connection configured in `prisma.config.ts` and via `PrismaPg` adapter.
- Generator: `provider = "prisma-client"`, output `./generated/prisma`. Client at `prisma/generated/prisma/` (gitignored).
- Imports: use relative path `prisma/generated/prisma/client.js`, not `@prisma/client`.
- Generation: `prisma generate` does not require `DATABASE_URL` (no real DB connection needed).
- Migrations: `prisma migrate deploy` in production; dev uses `prisma db push`.

**Upload media:**
- Endpoint: `POST /upload`
- Allowed extensions: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.mp3`, `.wav`, `.ogg`, `.mp4`
- Filename: UUID via `crypto.randomUUID()` (path traversal prevention)
- Audio: recorded in browser → cut/compress → preview → upload (≤10s, ≤5 MB)
- Image: max 10 MB
- Video: not yet

### Game engine (in-process TypeScript, `src/engine/`)

The game engine lives in `services/web-backend/src/engine/`. It is self-contained with its own tests (~1200 lines of tests across 3 files).

**GameFlow Strategy** (`game-flow.ts`):
- Abstract `GameFlow` class with `ClassicFlow` implementation
- To add a game mode (duel, battle royale, marathon):
  1. Create a subclass of `GameFlow`
  2. Override `shouldFinishRound()` and `shouldEliminate()`
  3. Optionally override `onAnswer()`, `finishRound()`, `advanceQuestion()`

**AnswerValidator Strategy** (`answer-validator.ts`):
- `MCQValidator` implements set-based validation (all correct choices selected, no extras)
- `VALIDATORS` registry maps question type → validator
- To add a new question type: create validator class, register in `VALIDATORS`, add enum value in Prisma

**Scoring** (`scoring.ts`):
- `calculateScore()` returns `{ total, bonus, streak, cumulativeTime }`
- Base points: easy=10, medium=15, hard=20
- Multiplayer 3+ bonuses: first correct answer (+5), only one correct (+3)
- Solo bonus: streak (+1 per consecutive, max +10)
- No bonus for 2-player mode

**Scoring key behaviors:**
- Wrong answer: 0 points (no penalty)
- Tiebreaker: cumulative response time
- Easter egg: all players with 0 points → special message
- Timer expired: counted as wrong, "Time's up" shown
- Race condition: if deadline fires before HTTP answer arrives, returns timeout result (200 OK with `correct: false`) instead of error

**Room store** (`room-store.ts`):
- In-memory `Map<string, Room>`
- Expired room cleanup runs every 5 minutes (finished rooms > 2h old)
- Cleanup on shutdown cancels all timers
- Sessions lost on restart (acceptable for current scale)

**Server-side clock:** Elapsed time computed from `Date.now() - questionStartedAt` (not from client timestamp), avoiding clock-skew issues across players.

### Frontend (React + Vite + TypeScript)

**SPA** with React Router, i18next, Tailwind CSS v4, Socket.IO client. Tests: Vitest + React Testing Library (~104 tests).

**Key components:**
- **Host system** — `HostAvatar`, `HostBubble`, `HostPresenter`, `AvatarRenderer`. Replaces the former hardcoded Christine. Avatar rendered via `@vierweb/avataaars` (MIT). 5 expressions (smile, focused, surprised, applause, console) mapped to eye/eyebrow/mouth configs.
- **`AppHostPresenter`** — Wrapper that injects the active host config from `HostProvider` context. Drop it in any page; it auto-configures the avatar and messages.
- **Host messages** — `PhrasesProvider` (dynamic phrases from DB with weighted random selection + localStorage caching) + `useHostMessages` hook (phase-based message selection, expression computation). Falls back to i18n `host.*` keys.
- **`useRoomGame`** — Central hook orchestrating room lifecycle (pre-game → game → feedback → end). Handles socket events, timer, question fetch, answer submission, reconnection, replay. 798 lines — targeted for decomposition.
- **`useGameTimer`** — Game timer + feedback countdown with clean interval management (extracted from `useRoomGame`).
- **`useHostMessages`** — Message and expression selection per game phase. 262 lines, 31 tests.
- **`CircularTimer`** — `requestAnimationFrame` (~60fps) with green→orange→red gradient (thresholds at 10s, 5s). Stops and shows checkmark when `stopped={true}`.
- **`FeedbackBanner`** — Slide-in notification with result, points, bonus, streak, countdown bar.

**Room flow:**
- 5 phases: `pre-game` → `ready` (multi replay) → `game` → `feedback` → `end`
- Solo: auto-join + auto-start. Immediate local feedback on submit (green/red choices via `getChoiceStyle()`, which uses `correctCount` from `?game=true` response).
- Multi: synchronized rounds. All players see same question. Round ends when all answered or timer expires.
- Reconnection: `sessionStorage` stores `player-{roomId}`, `nickname-{roomId}`, `creatorPid-{roomId}`. Read on RoomPage mount; if player found in room.players, auto-rejoin via engine API.
- Disconnect: if `phase === 'waiting'`, player removed from engine. If `phase === 'playing'`, player kept and marked `disconnected`; `all_finished` excludes disconnected.
- Safety fallback: if `next-question` socket event doesn't arrive after 12s in feedback phase, `fetchQuestion()` is forced.
- Security: `?game=true` API response hides `isCorrect` in choices. Frontend detects single vs multi-correct via `correctCount` field.

**Multi-choice UI:**
- Detection via `correctCount > 1` → checkbox style (`rounded-md`) vs radio style (`rounded-full`)
- 3 pill badges in RoomGame: question number, difficulty (green/amber/rose), points

**i18n:**
- `i18next` + `react-i18next` + `i18next-browser-languagedetector`
- Default: `VITE_DEFAULT_LANG` env var (fallback `fr`)
- Detection: localStorage → `navigator.language` → `VITE_DEFAULT_LANG` → `fr`
- Files: `src/lib/locales/{fr,en}/translation.json`
- Single namespace (`translation`), keys grouped by page/component
- Admin pages prefixed `admin.*`, host messages prefixed `host.*`

**Dark/Light theme:**
- Tailwind CSS v4 `@custom-variant dark (&:where(.dark, .dark *))` — `.dark` class on `<html>`
- `ThemeProvider` (React Context) in `src/lib/theme.tsx`
- Persistence: localStorage (`quizztine-theme`) + user profile via `PATCH /auth/preferences`
- Initial detection: `prefers-color-scheme: dark` → localStorage → `light` (fallback)

### Host system

**Backend (`controllers/host.ts`):**
- `Host` model: id, name, avatarType (BUILTIN/UPLOAD/URL), avatarConfig (JSON), avatarUrl, isActive
- `HostPhrase` model: context, scope, lang, text, priority
- Zod validation on all CRUD schemas
- Activation transaction: atomically deactivates other hosts when activating one
- Fallback: returns hardcoded "Christine" with default avataaars config when no host is active
- Phrase API: weighted random selection with variable interpolation ({{pseudo}}, {{score}}, etc.)
- Public endpoints: `GET /host/active`, `GET /host/phrases/random`, `GET /host/phrases/contexts`

**Frontend:**
- `AvatarRenderer` — Maps 5 expressions to eye/eyebrow/mouth configs for `@vierweb/avataaars`
- `AdminHostsPage` — Full avatar builder with 8 CycleSelect fields (top, hair, accessories, etc.), spot color picker, upload/URL support, phrase management tab

## HTTP API (REST)

All endpoints are under the backend. No external quiz-engine API.

### Room endpoints

```
POST   /rooms                              # Create room
GET    /rooms/code/:code                   # Get room by code
GET    /rooms/:id                          # Get room state
POST   /rooms/:id/join                     # Join room
POST   /rooms/:id/start                    # Start game
GET    /rooms/:id/current-question         # Current question
POST   /rooms/:id/answer                   # Submit answer
GET    /rooms/:id/scoreboard               # Get scoreboard
POST   /rooms/:id/replay                   # Replay room
GET    /rooms/:id/results                  # Persisted results
```

### Question endpoints

```
GET    /questions                          # List (filterable)
GET    /questions/:id                      # Get single (?game=true hides correct)
POST   /questions                          # Create (QUIZMASTER+)
PATCH  /questions/:id                      # Update
DELETE /questions/:id                      # Delete
```

### Host endpoints

```
GET    /host/active                        # Active host config
GET    /host/phrases/random                # Random phrase
GET    /host/phrases/contexts              # Available contexts (QUIZADMIN)
POST   /host                               # Create (QUIZADMIN)
PATCH  /host/:id                           # Update (QUIZADMIN)
DELETE /host/:id                           # Delete (QUIZADMIN)
POST   /host/:id/fetch-avatar              # Download avatar from URL
GET    /host/phrases                        # List phrases
POST   /host/phrases                        # Create phrase
PATCH  /host/phrases/:id                    # Update phrase
DELETE /host/phrases/:id                    # Delete phrase
```

### User endpoints

```
GET    /users/me                           # Own profile
PATCH  /users/me                           # Update pseudo/email
PATCH  /users/me/password                  # Change password
DELETE /users/me                           # Delete own account
GET    /users                              # List users (QUIZADMIN)
PATCH  /users/:id                          # Edit user (QUIZADMIN)
DELETE /users/:id                          # Delete user (QUIZADMIN)
POST   /users/:id/reset-password           # Reset password (QUIZADMIN)
POST   /users/:id/reset-totp               # Disable TOTP (QUIZADMIN)
GET    /users/me/stats                     # Aggregated stats
```

### Auth endpoints

```
POST   /auth/register                      # Register
POST   /auth/login                         # Login (email or pseudo)
POST   /auth/logout                        # Logout (clears cookies + blacklists refresh)
POST   /auth/refresh                       # Refresh access token
POST   /auth/verify-email                  # Verify email with token
PATCH  /auth/preferences                   # Update language/theme
```

### Other endpoints

```
GET    /health                             # Healthcheck (pings Postgres)
POST   /upload                             # Upload media file
POST   /reports                            # Report question error
GET    /categories                         # List categories
```

## Game flow

### Solo
1. Create room (auto-generated code, no creator_player_id)
2. Auto-join via sessionStorage
3. Auto-start (no creator check — solo rooms have no `creator_player_id`)
4. Question displayed with choices + timer
5. Player selects answer → clicks "Valider" OR timer expires
6. Local feedback immediately (green/red choices, explanation)
7. `question-feedback` socket event updates score, starts 5s countdown
8. `next-question` socket event loads next question
9. After all questions → scoreboard → replay or home

### Multiplayer
1. Create room (creator identification via `creatorPid = pseudo-timestamp`)
2. Wait for players to join (join via code or direct link `/room/:id`)
3. Creator sees "Share link" (visible only to creator via sessionStorage)
4. Creator clicks "Start" (other players get 403 `NOT_CREATOR`)
5. All active players see the same question
6. Round ends when all active players have answered OR timer expires
7. Correction shown to everyone for 5 seconds
8. Next question fetched automatically
9. Final scoreboard with animation, medals, easter eggs

### Race conditions handled
- **Deadline vs answer:** If the engine's deadline timer fires before the player's HTTP answer arrives, `submitAnswer` returns `{ correct: false, points: 0 }` (200 OK) instead of a 400 error.
- **Frontend timeout vs server feedback:** If the frontend submits answer (or times out) and the deadline task has already finished the round, the `answer-error` socket event is ignored if already in feedback phase.

## Conventions

### Room creation & creator
- Backend generates `creatorPlayerId = `${user.pseudo}-${Date.now()}` ``. Only the matching player can start the game.
- `creatorPid-{roomId}` and `creatorNick-{roomId}` stored in `sessionStorage` on creation; RoomPage auto-joins on load.
- Share link visible only to creator. Others join via code or direct link.
- Authenticated nickname: pre-filled from `user.pseudo` when logged in.

### Player session
- Session keys (`sessionStorage`): `player-{roomId}`, `nickname-{roomId}`, `code-{roomId}`, `creatorPid-{roomId}`, `creatorNick-{roomId}`.
- PlayerId generation: client-side `${nickname}-${Date.now()}`.
- Stats linked to `userId` via `RoomPlayer` table (not by nickname).
- Disconnect behavior:
  - `waiting` phase: player removed, `player-left` broadcast via Socket.IO.
  - `playing` phase: player kept, marked `disconnected`; grey dot in player list.
  - `beforeunload` / React cleanup emits `player-left` only when `phase !== 'game'`.

### General
- JWT in httpOnly cookie (XSS safe).
- Structured error responses: `{ error, code, status, details? }`.
- Logging: pino structured JSON to stdout/stderr.
- Env vars: `.env.example` at project root, values via docker-compose or production env.
- All Prisma models use auto-generated UUIDs (`@default(uuid())`).
- Question choices: JSON array with `{ id, text, isCorrect }` — `isCorrect` stripped in `?game=true` responses.

## Version matrix

| Component | Version | Notes |
|---|---|---|
| Node.js | 24 (slim) | Docker image, matches local dev |
| pnpm | latest | Backend package manager |
| npm | latest (bundled) | Frontend package manager |
| PostgreSQL | 18-alpine | Docker image |
| Prisma | 7.8.0 | `@prisma/client` + `@prisma/adapter-pg` |
| React | 19 | Frontend |
| TypeScript | 7.0.2 | Both backend and frontend |

## Test coverage

| Module | Tests (approx.) | Notes |
|---|---|---|
| Backend controllers | ~200 (11 test files) | Auth, categories, host, profile, questions, reports, results, room-events, rooms, upload, users |
| Backend lib | ~40 (3 test files) | JWT, validation, socket |
| Backend engine | ~65 (3 test files) | Game flow, room store, scoring |
| **Backend total** | **~262** (17 test files) | Vitest |
| Frontend | ~104 (12 test files) | Vitest + RTL. Gaps: useRoomGame (0 tests) |
| Quiz engine (Python, archived) | 39 (3 test files) | Preserved for reference |

### Notable test gaps
- `useRoomGame` hook (798 lines) — **0 tests** (core game orchestration)
- `AdminHostsPage` (1564 lines) — **0 tests** (complex admin UI)
- `PhrasesProvider` — 6 tests covering only i18n fallback, not DB loading or caching
- `fetchAvatar` (host controller) — untested
- `notifications.ts` (engine) — untested

## Known gaps / unimplemented features

| Feature | Status | Details |
|---|---|---|
| Email sending | ❌ | Verification token generated and stored but never sent via SMTP |
| TOTP enrollment UI | ❌ | Schema exists, admin reset works, but user enrollment flow missing |
| CAPTCHA | ❌ | Placeholder comment only in reports controller |
| Report error button | ❌ | Backend endpoint exists, frontend button not implemented |
| Quizmaster invite link | ❌ | Documented feature, not implemented |
| Max players validation | ❌ | No enforcement (spec says 20) |
| Video upload | ❌ | Extension allowed, no frontend implementation |
