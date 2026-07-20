# Quizztine 🎯

Quizztine est une application de quiz en ligne multi/solo, conçue comme un plateau de jeu télévisé animé par un **présentateur virtuel** personnalisable. Créez des salons, jouez en solo pour vous entraîner, ou affrontez vos amis en temps réel.

![Quizztine](https://img.shields.io/badge/version-2.5.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Fonctionnalités

- **Solo** — Entraînement sur vos thèmes faibles, avec streak bonus
- **Multiplayer** — Jusqu'à 20 joueurs, rounds synchronisés, score en temps réel
- **Présentateur virtuel** — Personnalisez l'avatar, les expressions et les messages d'accueil
- **Questions** — QCM avec médias (image/audio), catégories, difficultés, explications
- **Administration** — Crud questions, utilisateurs, catégories, présentateurs
- **i18n** — Français et anglais inclus, extensible
- **Thème dark/light** — Détection automatique + persistance
- **Docker** — Déploiement mono-conteneur prêt pour la production

## Démarrage rapide

```bash
# Développement (hot-reload)
docker compose up

# Production
docker compose -f docker-compose.prod.yml up -d
```

Accédez à l'application : [http://localhost:3000](http://localhost:3000) (production) ou [http://localhost:5173](http://localhost:5173) (développement frontend).

### Comptes pré-configurés (développement)

| Pseudo | Rôle | Mot de passe |
|---|---|---|
| `user` | User | `user` |
| `master1` | Quizmaster | `master1` |
| `admin1` | Quizadmin | `admin1` |

## Architecture

Quizztine fonctionne dans un **conteneur unique** (Node.js 24) qui sert à la fois l'API backend et les fichiers statiques du frontend.

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Navigateur │────▶│   Express (API)  │────▶│   Postgres   │
│  (React SPA) │     │   + Socket.IO    │     │              │
│              │◀────│   + Engine (in-  │◀────│              │
│              │     │     process)     │     │              │
└──────────────┘     │   + Frontend     │     └──────────────┘
                     │     statique     │
                     └──────────────────┘
```

### Services

| Composant | Technologie | Rôle |
|---|---|---|
| **Backend** | Node.js + Express + TypeScript | API REST, auth JWT, CRUD, WebSocket (Socket.IO) |
| **Moteur de jeu** | TypeScript (in-process) | Logique de salon, scoring, validation, rounds |
| **Frontend** | React + Vite + Tailwind CSS v4 | SPA avec présentateur virtuel, i18n, thème |
| **Base de données** | PostgreSQL 18 via Prisma 7 | Utilisateurs, questions, résultats, hôtes |

### Points clés

- **Auth** : JWT en httpOnly cookie (access 1h + refresh 7d), blacklist des refresh tokens en BDD (SHA-256)
- **Sécurité** : bcryptjs, rate limiting (10 req/15min sur auth), CORS configurable
- **Quiz-engine** : Architecture modulaire — `GameFlow` (Strategy), `AnswerValidator` (Strategy + Registry), `ScoreCalculator` (Protocol)
- **Présentateur** : Système d'hôte personnalisable (avataaars, upload image, phrases dynamiques)

## Configuration

### Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@postgres:5432/quizztine` | URL de connexion PostgreSQL |
| `JWT_SECRET` | — | **Obligatoire en production** — secret pour signer les JWT |
| `PORT` | `3000` | Port du serveur Express |
| `CORS_ORIGIN` | `http://localhost:5173` | Origine autorisée pour CORS |
| `UPLOAD_DIR` | `uploads` | Dossier de stockage des fichiers uploadés |
| `LOG_LEVEL` | `info` | Niveau de log (pino) |
| `NODE_ENV` | `development` | `production` active les sécurités (cookie secure, JWT required) |
| `VITE_API_URL` | `/api` | URL de l'API (relative en production derrière nginx/Express) |
| `VITE_SOCKET_URL` | `/` | URL du serveur Socket.IO |
| `VITE_DEFAULT_LANG` | `fr` | Langue par défaut (fr/en) |

## Développement

### Prérequis

- Docker & Docker Compose
- Node.js 26 (optionnel, pour outils locaux)

### Commandes

```bash
make dev          # Démarrage en mode développement (hot-reload)
make test         # Lance tous les tests
make test-backend # Tests backend (Vitest)
make test-frontend# Tests frontend (Vitest)
make lint         # Lint (frontend + backend)
make typecheck    # Vérification TypeScript
```

### Structure du projet

```
quizztine/
├── services/
│   ├── web-backend/       # Backend Express + moteur de jeu
│   │   ├── src/
│   │   │   ├── controllers/   # Logique métier
│   │   │   ├── engine/        # Moteur de jeu in-process
│   │   │   ├── lib/           # Prisma, JWT, validation, socket, logger
│   │   │   ├── middleware/    # Auth, rate-limit, error, upload
│   │   │   ├── routes/        # Définition des routes
│   │   │   └── types/         # Types & erreurs
│   │   └── prisma/            # Schéma, migrations, seed
│   └── frontend/              # Application React
│       └── src/
│           ├── components/    # Composants UI (host, room, ui)
│           ├── pages/         # Pages de l'application
│           └── lib/           # Hooks, providers, i18n, API
├── docker-compose.yml         # Développement
├── docker-compose.prod.yml    # Production
├── Dockerfile                 # Build production
└── Dockerfile.dev             # Build développement
```

## Base de données

Les migrations Prisma sont appliquées automatiquement au démarrage (`prisma migrate deploy`). Pour créer une migration :

```bash
cd services/web-backend
pnpm db:migrate
```

Le fichier de seed (`prisma/seed.ts`) crée des données de démonstration (utilisateurs, catégories, questions).

## Licence

MIT — voir [LICENSE](LICENSE).
