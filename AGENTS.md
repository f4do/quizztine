# Quizztine

Containerized quiz app with 3 services.

## Architecture

| Service | Tech | Public endpoint | Role |
|---|---|---|---|
| `services/web-backend/` | Node.js + Express + TypeScript | — (API REST) | Auth'd users manage questions stored in external Postgres via Prisma |
| `services/frontend/` | React + Vite + TypeScript | `/`, `/room/create`, `/room/:id`, `/admin/*` | Create/join quiz rooms (solo or multiplayer); admin dashboard for quizmaster+ |
| `services/quiz-engine/` | Python + FastAPI | — (internal) | Room logic, question picking, quiz flow |

Data flow: Frontend → Web backend → Quiz engine (internal).

## Stack detail

- **Web backend**: Express + TypeScript, Prisma 7 (Postgres, via `@prisma/adapter-pg`), JWT auth (httpOnly cookie + refresh via `jose`), Zod validation, Vitest tests (unit + integration). Structure: routes/controllers/middleware. WebSocket (Socket.IO) for multiplayer relayed to quiz-engine via internal HTTP.
- **Frontend**: React + Vite + React Router + Tailwind CSS + native `fetch` + Socket.IO client. UI inspirée d'un jeu TV de culture générale animé par **Christine** (présentatrice virtuelle). Tests: Vitest + React Testing Library (unit), e2e planned later.
- **Quiz engine**: FastAPI + pytest + ruff + mypy + httpx/httpx2. Tests: unit + integration.

### Backend specifics

**Auth**: pseudo + email + password (12+ chars, no complexity, hashé via \`bcrypt\` natif). JWT access token (1h) + refresh token (7d) signés avec `jose` (HS256), both httpOnly cookies. Les fonctions JWT (`signAccessToken`, `signRefreshToken`, `verifyToken`) sont asynchrones. Email verification via confirmation link on registration. TOTP mandatory for quizmaster/admin, optional for user. TOTP recovery: admin reset only. Logout clears cookies server-side and blacklists refresh token.

**Rate limiting**:
- Auth endpoints (`/auth/login`, `/auth/register`) : 10 req / 15 min par IP (`express-rate-limit`)
- Global API : 100 req / 15 min par IP (désactivé par défaut, activable dans `app.ts`)
- Réponse structurée : `{ error, code, status, details }` avec code `RATE_LIMIT_EXCEEDED`

**Sécurité des cookies** : le flag `secure` des cookies JWT est configuré automatiquement selon `NODE_ENV` — `true` en production, `false` en développement.

**JWT secret** : la variable d'environnement `JWT_SECRET` est **obligatoire en production**. Le démarrage échoue immédiatement si elle est absente. En développement, une valeur par défaut est utilisée via `.env`.

**Refresh token blacklist** : les refresh tokens révoqués sont stockés en base de données (table `RevokedToken`) avec hash SHA-256 et expiration automatique (7 jours). Une purge automatique nettoie les entrées expirées toutes les heures. Ce mécanisme est persistant (survit aux redémarrages) et scalable (multi-instance compatible).

**Login**: accepts `login` field (email or pseudo). Frontend sends `{ login, password }`, label shows "Email or pseudo". Rate limité à 10 req / 15 min par IP.

**Roles** (hierarchical, managed by admin):
- `user` — free registration (valid email + verification required). Reserves a nickname, sees own stats (games, scores, % success by theme). Solo training sessions on weak themes (`/train`).
- `quizmaster` — everything from `user` + can add public/private questions + full management of own private questions. Promotion via invite link (if user exists, the link adds rights) or admin checkbox.
- `quizadmin` — everything from `quizmaster` + management of all questions + user management.

**Question model**: text + optional uploaded media (audio/video/image), multiple choices (2-4, 1 or more correct — answer is correct only if ALL correct choices are selected; checkboxes for multiple correct, radio for single correct), explanation, sourceUrl, category (predefined list, admin can add), difficulty (easy/medium/hard), visibility (public/private), questionType (MCQ — extensible pour d'autres types). Private questions visible only by their author and quizadmins.

**Private questions in room creation**: if the connected user is quizmaster+, a toggle "Include my private questions" appears. The web-backend filters questions by visibility and role, then sends eligible IDs + correct choice indices to the quiz-engine.

**Error reporting**: "Report error" button under each question (during or after quiz). Modal with textarea (reason). Anti-abuse:
  - Non-auth: IP rate limit (3/h) + CAPTCHA
  - User: global rate limit (10/h, rolling 1h window)
  - Quizmaster+: no limit
Stored in web-backend (`QuestionReport` table).

**Upload media**: via web-backend (`POST /upload`). Files stored on local filesystem (`uploads/`).
  - **Extensions autorisées** : `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.mp3`, `.wav`, `.ogg`, `.mp4` (validé côté middleware)
  - **Filename** : UUID généré côté serveur via `crypto.randomUUID()` (prévention path traversal)
  - **Audio**: recorded in browser → cut/compress → preview for validation → upload if duration ≤ 10s and size ≤ 5 MB
  - **Image**: simple upload, max 10 MB
  - **Video**: not yet

**Score**:
  - Correct answer: 10 pts (easy), 15 (medium), 20 (hard)
  - Multi 3+ players: bonus "first to answer right" (client timestamp + ping correction) + bonus "only one answered right"
  - Multi 2 players: difficulty points only, no bonus
  - Solo: base points + streak bonus (visual reward + points)
  - Streak: displayed + visual reward + small point bonus
  - Wrong answer: 0 points (no penalty; future game modes may add penalties)
  - Tiebreaker: cumulative response time (displayed on scoreboard). Easter egg if all players have 0 points.
  - Modular architecture to support future game modes.

**Multiplayer synchronization**: all active players see the same question. The round ends once every active player has answered or the timer has expired. The correction is then shown to everyone for 5 seconds, after which the next question is fetched automatically. Solo behaves the same way (auto-advance after feedback).

**Timer expired**: counted as wrong, "Time's up" screen with correction displayed, then next question.

**Quiz-engine down**: short timeout on HTTP call → 503 error with "Service temporarily unavailable".

**Quiz-engine notifications**: engine → backend HTTP callbacks (`question-finished`, `next-question`, `game-finished`, `results`) incluent un retry avec exponential backoff (3 tentatives, 1s/2s/4s) pour résister aux indisponibilités temporaires du backend.

**Race condition answer/timeout**: Quand le `_deadline_task` du moteur finit le round avant que la réponse HTTP du frontend n'arrive, le endpoint `POST /answer` retourne un résultat timeout (200 OK) au lieu d'une erreur 400. Voir `routes.py:submit_answer` — le check `feedback_until is not None` renvoie `AnswerResponse(correct=False, points=0)` au lieu de `ROUND_FINISHED`.

### Frontend game flow specifics

**Solo game flow** :
- Le timer expiré ou le clic "Valider" passe immédiatement la phase en `feedback` (local, sans attendre le serveur)
- Les choix s'affichent en vert/rouge via `getChoiceStyle()` — le frontend connaît les bonnes réponses depuis `fetchQuestion()` qui charge `choiceCorrect`
- Le `question-feedback` (socket) met à jour le score et démarre le countdown 5s
- Le `next-question` (socket) charge la question suivante
- Fallback de sécurité : si `next-question` n'arrive pas après 12s en phase `feedback`, `fetchQuestion()` est forcé

**CircularTimer** : animation fluide via `requestAnimationFrame` (~60fps). S'arrête et affiche un checkmark quand `stopped={true}` (hasAnswered). Dégradé vert→orange→rouge avec seuils à 10s et 5s.

**FeedbackBanner** : notification coulissante au-dessus de la question. Slide-in animé. Affiche résultat, points, bonus, streak, barre de progression du countdown.

**Race condition gérée** : quand le frontend soumet une réponse (ou timeout) et que le `_deadline_task` du moteur a déjà fini le round, le `answer-error` du socket est ignoré si déjà en phase `feedback`.

**Layout boutons Login/Register** : `grid-cols-2 min-w-[210px]` — les boutons gardent une largeur stable entre les langues.

**Prisma ORM** : Prisma 7 (`prisma-client` generator, plus `prisma-client-js`). Points clés :
- **Config** : `prisma.config.ts` à la racine du service (fichier explicitement copié dans Docker). Utilise `defineConfig` de `prisma/config`. Ne pas mettre de config prisma dans `package.json`.
- **Schema** : le `datasource` ne contient plus `url` — la connexion est configurée dans `prisma.config.ts` et dans `PrismaClient` via l'adapter.
- **Driver adapter** : `@prisma/adapter-pg` obligatoire. `new PrismaClient({ adapter })` — plus de constructeur sans options.
- **Generateur** : `provider = "prisma-client"` avec `output = "./generated/prisma"`. Le client est généré dans `prisma/generated/prisma/` (gitignoré).
- **Imports** : remplacent `@prisma/client` par le chemin relatif vers `prisma/generated/prisma/client.js`. Le fichier `client.ts` exporte tout (PrismaClient, Prisma namespace, enums, model types) via `export * from "./enums"`.
- **Génération** : `prisma generate` ne nécessite pas de DATABASE_URL (pas de connexion réelle).
- **Seed** : doit aussi utiliser `PrismaPg` adapter — `new PrismaClient({ adapter })`.
- **Migration Prisma 6→7** réalisée. Breaking changes : driver adapter obligatoire, imports changés, schema sans url, plus de middleware `$use`.

**Types de questions extensibles** : le champ `questionType` (enum `MCQ`) discrimine le type de question. Le quiz-engine utilise un pattern `AnswerValidator` (Strategy) pour valider les réponses selon le type. Ajouter un nouveau type de question implique :
1. Ajouter la valeur dans l'enum `QuestionType` (Prisma + Engine)
2. Implémenter un `AnswerValidator` (Engine)
3. L'enregistrer dans le registry `VALIDATORS`

### Quiz-engine architecture patterns

**GameFlow strategy** (`src/game_flow.py`) : la boucle de jeu est extraite dans une classe `GameFlow` abstraite. L'implémentation `ClassicFlow` gère le flow standard (round fini quand tous ont répondu ou timer expire). Pour ajouter un mode de jeu (duel, battle royale, marathon) :
1. Créer une sous-classe de `GameFlow`
2. Surcharger `should_finish_round()` et `should_eliminate()`
3. Optionnellement surcharger `on_answer()`, `finish_round()`, `advance_question()`

**ScoreResult** (`src/scoring.py`) : le calcul de score retourne un `ScoreResult` dataclass (`total`, `bonus`, `new_streak`) au lieu d'un tuple. Le `ScoreCalculator` utilise des protocols injectables (`BonusCalculator`, `StreakCalculator`) pour les bonus multi, solo, streak. Ajouter un nouveau système de score (malus, multiplicateur, wager) implique :
1. Ajouter le champ dans `ScoreResult`
2. Implémenter le calcul dans un `BonusCalculator` ou `StreakCalculator`
3. L'injecter dans `ScoreCalculator`

**AnswerValidator** (`src/answer_validator.py`) : pattern Strategy pour valider les réponses selon le type de question. `MCQValidator` implémente la validation ensembliste (tous les bons choix sélectionnés, pas d'extra). Registry `VALIDATORS` pour associer un type à son validateur.

## HTTP contract: web-backend ↔ quiz-engine

All calls are internal (backend → engine), no auth needed between services.

### Backend → Engine

```
POST /rooms                    # Create a room
{
  questions: [{ id: number, correctChoices: number[], difficulty: "easy" | "medium" | "hard", questionType: "MCQ" }],
  mode: "solo" | "multi_private" | "multi_public",
  timer: number,               # seconds
  id: string,                  # optional, reused from backend DB
  code: string,                # optional, room code for display
  creator_player_id: string    # optional, marks the room creator
}

POST /rooms/:id/join           # Player joins
{ player_id: string, nickname: string }
# 200 OK on success
# 409 NICKNAME_TAKEN if nickname already in room (non-disconnected)

POST /rooms/:id/start?player_id=xxx   # Start the game
# 200 if creator (or if solo — no creator_player_id set)
# 403 NOT_CREATOR if wrong player tries to start

GET  /rooms/:id
# Returns: { id, code, mode, timer, status, player_count, current_question_index, players: [{ id, nickname, score, streak, cumulativeTime, disconnected, answered }] }

GET  /rooms/:id/current-question/:playerId
# Returns: { questionId: number, index: number }

POST /rooms/:id/answer/:playerId
{ questionId: number, selectedChoices: number[], clientTimestamp: number }
# Returns provisional score: { correct: boolean, points: number, bonus: number, streak: number, cumulativeTime: number }
# Final scoring (including multiplayer bonuses) is computed once the round ends.

GET  /rooms/:id/scoreboard
# Returns: [{ playerId, nickname, score, streak, cumulativeTime }]
```

### Engine → Backend

Les callbacks engine → backend incluent un retry avec exponential backoff (3 tentatives, 1s/2s/4s) pour résister aux indisponibilités temporaires.

```
POST /rooms/:id/results           # Game finished, final results
{
  scores: [{ playerId, nickname, score, streak, cumulativeTime }],
  answers: [{ playerId, questionId, correct, timeSpent }]
}

POST /rooms/:id/question-finished # All active players answered / timer expired
{
  question_id: number,
  correct_choices: number[],
  results: [{ playerId, nickname, correct, points, bonus, streak, cumulativeTime }]
}

POST /rooms/:id/next-question     # Feedback delay elapsed, next question available
{ question_index: number }

POST /rooms/:id/game-finished     # All questions answered, game over
{}
```

### Backend result endpoints

```
GET /rooms/:id/results          # Fetch persisted final results
# Returns: { result: { id, roomId, mode, createdAt, scores[], answers[] } }

GET /users/me/stats             # Fetch current user aggregated stats (auth)
# Returns: { stat: { gamesPlayed, totalScore }, themeStats: [{ category, totalAnswered, correctCount, successRate }] }

GET /users/me                   # Fetch current user extended profile (auth)
# Returns: { user: { id, pseudo, email, role, language, theme, emailVerified, createdAt } }

PATCH /users/me                 # Update pseudo / email (auth)
# Body: { pseudo?: string, email?: string }
# Returns: { user: { id, pseudo, email, role, language, theme, emailVerified, createdAt } }

PATCH /users/me/password        # Change password (auth)
# Body: { currentPassword: string, password: string, confirmPassword: string }
# Returns: { message: string }

DELETE /users/me                # Delete own account (auth)
# Body: { password: string }
# Returns: { message: string }

GET /users                      # List users (QUIZADMIN)
# Returns: { users: [{ id, pseudo, email, role, totpEnabled, emailVerified, createdAt }] }

PATCH /users/:id                # Edit user pseudo/email/role (QUIZADMIN)
# Body: { pseudo?: string, email?: string, role?: "USER" | "QUIZMASTER" | "QUIZADMIN" }
# Returns: { user: { id, pseudo, email, role, totpEnabled, emailVerified, createdAt } }

DELETE /users/:id               # Delete a user (QUIZADMIN, cannot self-delete)
# Returns: { message: string }

POST /users/:id/reset-password  # Reset user password (QUIZADMIN)
# Body: { password: string, confirmPassword: string }
# Returns: { message: string }

POST /users/:id/reset-totp      # Disable user TOTP (QUIZADMIN)
# Returns: { message: string }
```

Results persistence:
- `POST /rooms/:id/results` stores scores and answers in `GameResult`, `PlayerScore`, `PlayerAnswer`.
- User stats (`UserStat`, `UserThemeStat`) are updated by matching the player's `nickname` to `User.pseudo`.

## Directory layout

```
services/
├── web-backend/     # Node + Express
│   ├── prisma/           # Schema + migrations + seed
│   └── prisma/generated/ # Prisma Client généré (gitignoré)
├── frontend/        # React + Vite
└── quiz-engine/     # Python + FastAPI
docker-compose.yml
Makefile
```

## Dev workflow

- **`make dev`** — `docker compose up` with hot-reload (multi-container)
- **`make test`** — all tests (Vitest backend/frontend + pytest engine)
- **`make test-backend`** — `pnpm test` in `services/web-backend`
- **`make test-frontend`** — `pnpm test` in `services/frontend`
- **`make test-engine`** — `pytest -v` in `services/quiz-engine`
- **`make lint`** — Prettier check (frontend), ruff (Python), ESLint (backend)
- **`make lint-engine`** — `ruff check src/ tests/`
- **`make typecheck`** — tsc (frontend), mypy (engine)
- **`make typecheck-engine`** — `mypy src/`

### Test coverage

| Service | Tests | Files | Stack |
|---|---|---|---|
| Web backend | 180 | 17 | Vitest, mocks Prisma/fetch/Socket.IO |
| Frontend | 10 | 5 | Vitest + React Testing Library + jsdom (UI tests additionnels prévus) |
| Quiz engine | 39 | 2 | pytest + pytest-asyncio |

Backend : tous les contrôleurs, middlewares et librairies sont testés (auth, questions, categories, upload, reports, rooms, users, results, room-events, engine-client, socket, JWT/jose, validation, errors, rate-limit).
Frontend : setup Vitest + RTL avec `src/test/utils.tsx` (wrapper providers Router/i18n/Auth/Theme), premiers tests des composants atomiques et pages.

## Frontend pages

| Route | Page | Content |
|---|---|---|
| `/` | Home | Title + "Create a room" button + nickname field + "Join" button |
| `/room/create` | Creation | Mode (solo/multi private/multi public), question count (10/20/50/custom with multi-category pseudo-random selection), category, difficulty, nickname (if not auth'd), "Include my private questions" toggle (if quizmaster+), random code + invite link (multiplayer only) |
| `/room/:id` | Room | Pre-game (code, creator auto-join, share link visible only to creator, players incl. disconnected status, start), game (QCM + media, timer 30s, green/red feedback + explanation), end (scoreboard + animation) |
| `/train` | Solo training | Solo sessions on weak themes (based on user stats) |
| `/profile` | User profile | Edit account (pseudo/email/password), preferences, stats, delete account |
| `/admin` | Admin dashboard | Overview cards: questions/users/categories counts, shortcuts |
| `/admin/questions` | Questions list | Filter by category/difficulty/visibility; edit/delete own questions (quizmaster+) / all (quizadmin) |
| `/admin/questions/new` | Create question | Full question form with media upload + audio recorder |
| `/admin/questions/:id/edit` | Edit question | Same form, pre-filled; author or quizadmin only |
| `/admin/users` | Users management | QUIZADMIN only: change user roles |
| `/admin/categories` | Categories management | QUIZADMIN only: add/delete categories |

### Notes

- **Interface jeu TV** : l'ensemble de l'UI est conçue comme un plateau de jeu télévisé de culture générale, animé par **Christine** (présentatrice virtuelle). Christine apparaît via des composants dédiés (`ChristineAvatar`, `ChristineBubble`, `ChristinePresenter`) qui affichent des messages contextuels (accueil, félicitations, encouragement, explications) selon le déroulement de la partie.
- **Christine avatar** : SVG vectoriel avec 5 expressions (`smile`, `focused`, `surprised`, `applause`, `console`), affiché en bas à droite avec bulle de dialogue.
- **Phrases contextuelles** : Christine réagit au contexte — bonne réponse, erreur, temps écoulé, seul à avoir bon/tort, sans-faute, score faible. Les clés i18n sont dans `christine.*`.
- **Timer circulaire** : composant `CircularTimer` avec dégradé vert→orange→rouge et animation de pulsation.
- **Palette TV** : rouge show `#C41E3A`, violet `#6B1E5E`, or `#FFD700`, crème `#FFF8E7`. Polices : `Bebas Neue` (titres) + `Montserrat` (corps).
- **Multi private**: account required to create, not to join
- **Questions**: text + optionally audio, video or image
- **Feedback**: after each question, correct answer + explanation (source links) + player result (green/red)
- **Timer**: configurable in options, 30s default
- **Scoreboard**: final ranking with animation
- **Non-auth room creation**: solo only
- **Join methods**: code (on home page) or direct link (`/room/:id`)
- **Max players per room**: 20
- **Disconnection**: player can rejoin and continue from current question
- **Question order**: same random shuffle for all players in a room

## Conventions

### Room creation & creator

- **Creator identification**: web-backend generates `` creatorPlayerId = `${user.pseudo}-${Date.now()}` `` and passes it to quiz-engine as `creator_player_id`. Only the player matching this `player_id` can start the game; others receive 403 `NOT_CREATOR`. Solo rooms have no `creator_player_id`, so no check is performed.
- **Creator auto-join**: when a room is created, `creatorPid-{roomId}` and `creatorNick-{roomId}` are stored in `sessionStorage`. RoomPage detects them on load and auto-joins the creator via the engine API.
- **Share link**: visible only to the creator (guarded by `creatorPid` in sessionStorage). Other players join via the code or direct link.
- **Authenticated nickname**: when a user is logged in, the nickname field is pre-filled from `user.pseudo` and hidden in multiplayer as well as solo.

### Player session & reconnection

- **Session keys** (`sessionStorage`): `player-{roomId}`, `nickname-{roomId}`, `code-{roomId}`, `creatorPid-{roomId}`, `creatorNick-{roomId}`.
- **PlayerId generation**: client-side as `${nickname}-${Date.now()}` (or `creatorPid` for the creator).
- **Disconnect behavior**:
  - During `waiting` phase: player is removed from engine and `player-left` is broadcast via Socket.IO.
  - During `playing` phase: player is kept in the engine room and marked `disconnected`; player list shows a grey dot. `all_finished` excludes disconnected players so the game can continue.
  - `beforeunload` and React cleanup emit `player-left` only when `phase !== 'game'`; during a game the player stays in the engine room.
- **Reconnection**: on RoomPage mount, reads `player-{roomId}` from `sessionStorage`. If the player id is found in `room.players`, it auto-rejoins via the engine API. A disconnected creator can also reconnect using `creatorPid`.

### General

- Postgres is an external dependency (not in compose for prod; dev compose includes it)
- Web backend owns auth, DB, and question validation; quiz-engine is stateless regarding auth/roles
- Quiz-engine holds game sessions in memory only. On restart, active rooms are lost (acceptable).
- Frontend only talks to web-backend (SPA); backend calls quiz-engine internally
- Quiz-engine is pure: no concept of user, role, or visibility. Web backend filters questions and sends eligible IDs + correct choices to the engine.
- JWT stored in httpOnly cookie (XSS safe)
- WebSocket (Socket.IO): frontend → web-backend only; backend relays events to quiz-engine via internal HTTP
- Web-backend generates the room code and ID, then transmits the session to quiz-engine
- At game end, quiz-engine POSTs results to `POST /rooms/:id/results` on the web-backend
- All API errors follow format: `{ error, code, status, details? }`
- Logging: structured JSON to stdout/stderr
- Environment variables: `.env.example` files in each service, actual values via docker-compose / production env
- Dev: multi-container compose. Prod: single container (Node + Python + built frontend served by Express)
- Refresh tokens blacklist : persisté en BDD (table `RevokedToken`) au lieu de la mémoire — scale multi-instance
- Types de questions extensibles via `questionType` (Prisma enum) + `AnswerValidator` pattern (Engine)
- Prisma config : `prisma.config.ts` à la racine du service web-backend (pas dans `package.json`). Client généré dans `prisma/generated/prisma/`

## Version matrix

Versions actuelles des outils utilisés dans le projet (Docker et host) :

| Composant | Version | Image / Source |
|---|---|---|
| Node.js (backend) | 26 (slim) | `node:26-slim` |
| Node.js (frontend) | 26 (alpine) | `node:26-alpine` |
| pnpm (backend) | latest | `pnpm@latest` dans Dockerfile |
| npm (frontend) | latest (bundled) | vient avec `node:26-alpine` |
| Python (engine) | 3.14 | `python:3.14-slim` |
| pip (engine) | latest (bundled) | vient avec `python:3.14-slim` |
| PostgreSQL | 18 | `postgres:18-alpine` |
| Prisma | 7.8.0 | `prisma@7.8.0` + `@prisma/client@7.8.0` |

Le projet utilise **pnpm** pour le backend et **npm** pour le frontend. Les versions des dépendances npm/Python suivent les `^` / `>=` dans leurs fichiers de lock respectifs.

## Ports

| Service | Port |
|---|---|
| Frontend (Vite dev) | 5173 |
| Web backend | 3000 |
| Quiz engine | 8001 (host) / 8000 (container) |

## Internationalization (i18n)

- **Frontend only**. Backend error messages stay in English (API contract).
- **Library**: `i18next` + `react-i18next` + `i18next-browser-languagedetector`
- **Default language**: `VITE_DEFAULT_LANG` env var (fallback `fr`)
- **Detection order**: localStorage (user choice) → navigator.language → VITE_DEFAULT_LANG → `fr`
- **Language files**: `src/lib/locales/{fr,en}/translation.json`
- **Structure**: single namespace (`translation`), keys grouped by page/component (e.g. `home.title`, `room.game.submit`)
- **Language switcher**: dropdown in Layout header, persists to localStorage + user profile via `PATCH /auth/preferences`
- **Admin pages** (`/admin/*`) are included in i18n; keys prefixed `admin.*`
- **Adding a language**: create new folder `src/lib/locales/{lang}/translation.json`, mirror key structure

## Light/dark theme

- **Mechanism**: Tailwind CSS v4 `@custom-variant dark (&:where(.dark, .dark *))` — `.dark` class on `<html>`
- **Provider**: `ThemeProvider` (React Context) in `src/lib/theme.tsx`
- **Persistence**: localStorage (`quizztine-theme`) + user profile via `PATCH /auth/preferences`
- **Initial detection**: `prefers-color-scheme: dark` → localStorage → `light` (fallback)
- **Toggle**: `ThemeSwitcher` (sun/moon icon, no i18n text) in Layout header, next to `LanguageSwitcher`; saves to backend when authenticated
- **Scope**: all pages (Layout + HomePage + LoginPage + RegisterPage + RoomCreatePage + RoomPage + TrainPage + AdminLayout + admin pages)
- **Color mapping**: bg-white → dark:bg-gray-800, bg-gray-50 → dark:bg-gray-950, text-gray-900 → dark:text-gray-100, etc.
