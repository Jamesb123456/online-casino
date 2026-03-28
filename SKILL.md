---
name: online-casino-patterns
description: Coding patterns extracted from the online-casino repository - a full-stack multiplayer casino platform (Platinum Casino)
version: 2.0.0
source: local-git-analysis
analyzed_commits: 38
---

# Platinum Casino - Coding Patterns

## Commit Conventions

This project uses **conventional commits** with optional scopes. ~79% of commits follow this convention.

| Prefix | Usage | Count |
|--------|-------|-------|
| `chore:` / `chore(scope):` | Maintenance, misc updates | 10 |
| `feat:` / `feat(scope):` | New features (games, auth, admin) | 9 |
| `refactor:` / `refactor(scope):` | Code restructuring, migrations | 6 |
| `fix:` / `fix(scope):` | Bug fixes | 3 |
| `docs:` | Documentation updates | 2 |

Common scopes: `auth`, `ci`, `admin`, `server`, `db`, `ts`, `scripts`, game names (`roulette`, `plinko`, `landmines`, `mines`, `chat`, `balance`, `dashboard`)

45% of conventional commits use scoped format like `feat(auth):` or `fix(ci):`.

## Code Architecture

### Monorepo Structure

```
online-casino/
├── client/                        # React frontend (Vite + JSX)
│   └── src/
│       ├── App.jsx                # Root app with routing
│       ├── components/            # Shared UI components
│       │   ├── admin/             # Admin panel components
│       │   ├── chat/              # Live chat components
│       │   ├── guards/            # Route guards (AuthGuard, AdminGuard)
│       │   └── ui/                # Generic UI primitives (Button, Card, Modal, Table, etc.)
│       ├── contexts/              # React context providers (AuthContext, ToastContext)
│       ├── games/                 # Game-specific components
│       │   ├── blackjack/
│       │   ├── crash/
│       │   ├── landmines/
│       │   ├── plinko/
│       │   ├── roulette/
│       │   └── wheel/
│       ├── hooks/                 # Custom React hooks
│       ├── layouts/               # Layout wrappers (MainLayout)
│       ├── lib/                   # Auth client (better-auth)
│       ├── pages/                 # Route page components
│       │   ├── admin/             # Admin pages
│       │   └── games/             # Game pages (lazy-loaded)
│       ├── services/              # API and socket services
│       │   ├── admin/             # Admin API service
│       │   └── socket/            # Per-game socket services
│       └── test/                  # Test setup (vitest + jsdom)
│
├── server/                        # Express + TypeScript backend
│   ├── drizzle/                   # Database layer
│   │   ├── db.ts                  # DB connection (exports db, connectDB, closeDB)
│   │   ├── schema.ts             # Drizzle schema definition (single source of truth)
│   │   ├── models/               # Per-table model files (PascalCase.ts)
│   │   └── migrations/           # SQL migration files
│   ├── lib/                      # Better Auth config
│   ├── middleware/                # Express + socket middleware
│   │   └── socket/               # Socket auth + rate limiting
│   ├── routes/                   # REST API routes (mounted under /api)
│   ├── scripts/                  # Utility scripts (seed, migrate, createAdmin)
│   ├── src/
│   │   ├── services/             # Business logic services
│   │   │   ├── balanceService.ts  # Centralized balance operations
│   │   │   ├── loggingService.ts  # Winston-based logging
│   │   │   ├── provablyFairService.ts
│   │   │   └── redisService.ts    # Optional Redis for Socket.IO adapter
│   │   ├── socket/               # Socket.IO game handlers
│   │   ├── utils/                # Shared utilities
│   │   └── validation/           # Input validation
│   ├── types/                    # TypeScript type definitions
│   └── server.ts                 # Entry point
│
├── docker-compose.yml            # Production Docker setup
├── docker-compose.dev.yml        # Dev Docker setup
├── .github/workflows/ci.yml     # CI pipeline (lint → build → test → security)
├── Makefile                      # Build automation
└── start.sh                     # Linux startup script
```

### Naming Conventions

| Layer | Convention | Example |
|-------|-----------|---------|
| Client components | PascalCase `.jsx` | `CrashGame.jsx`, `RouletteWheel.jsx` |
| Client services | camelCase `.js` | `crashSocketService.js`, `authService.js` |
| Client pages | PascalCase `Page.jsx` | `GamesPage.jsx`, `LoginPage.jsx` |
| Server handlers | camelCase `Handler.ts` | `crashHandler.ts`, `wheelHandler.ts` |
| Server routes | lowercase `.ts` | `auth.ts`, `admin.ts` |
| Server models | PascalCase `.ts` | `User.ts`, `Balance.ts` |
| Server services | camelCase `Service.ts` | `balanceService.ts`, `loggingService.ts` |

## Tech Stack

### Frontend
- **React 18** with JSX (not TSX)
- **Vite 5** for build tooling
- **Tailwind CSS v4** via `@tailwindcss/vite`
- **React Router v6** for routing (lazy-loaded game pages with Suspense)
- **React Context** for state (AuthContext, ToastContext)
- **Socket.IO Client** for real-time game communication
- **Fetch API** with cookie credentials for REST calls (no Axios)
- **Better Auth** client for session-based auth
- **Vitest + React Testing Library + jsdom** for testing

### Backend
- **Express.js 4** with TypeScript (ESM modules, `.js` extensions in imports)
- **Socket.IO 4** for real-time multiplayer games
- **Drizzle ORM** with MySQL (mysql2)
- **Better Auth** (session-based) with username + admin plugins
- **Winston** for structured logging
- **Helmet + CORS + express-rate-limit** for security
- **bcryptjs** for password hashing
- **decimal.js** for precise balance arithmetic
- **Optional Redis** (ioredis) for Socket.IO adapter
- **Vitest + Supertest** for testing
- **TypeScript 5** with `strict: false`

### Database
- **MySQL** via Drizzle ORM
- Migrations managed with `drizzle-kit`
- Schema defined in `server/drizzle/schema.ts`

## Workflows

### Adding a New Game

Games follow a consistent 6-step pattern:

1. **Server handler** - Create `server/src/socket/{gameName}Handler.ts`
   - Manages game state, bets, and outcomes via Socket.IO
   - Uses `balanceService` for balance operations
   - Uses `loggingService` for game event logging

2. **Client socket service** - Create `client/src/services/socket/{gameName}SocketService.js`
   - Wraps Socket.IO events for the game
   - Provides connect/disconnect and event emission helpers

3. **Client game components** - Create `client/src/games/{gameName}/`
   - Main game component: `{GameName}Game.jsx`
   - Sub-components follow pattern: `{GameName}Board.jsx`, `{GameName}BettingPanel.jsx`
   - Multiplayer games add: `{GameName}ActiveBets.jsx`, `{GameName}PlayersList.jsx`

4. **Client page** - Create `client/src/pages/games/{GameName}Page.jsx`

5. **Register handler** in `server/server.ts` (socket namespace initialization)

6. **Add route** in `client/src/App.jsx` (lazy-loaded with Suspense + GameErrorBoundary)

### Socket Handler Initialization Patterns

Three different patterns exist in `server/server.ts`:

| Pattern | Games | How It Works |
|---------|-------|-------------|
| Namespace-level | Crash | Handler imported once at startup, receives namespace, attaches own `connection` listener |
| Class-based | Blackjack | `BlackjackHandler` instantiated per-connection, `handleConnection(socket)` called |
| Per-connection | Roulette, Landmines, Plinko, Wheel | Handler receives `(io, socket, user)` on each connection |

### Database Migration

1. Modify schema in `server/drizzle/schema.ts` and/or model in `server/drizzle/models/`
2. Generate migration: `npm run db:generate` (from `server/`)
3. Run migration: `npm run db:migrate` (from `server/`)
4. Or push directly in dev: `npm run db:push`

### Adding a New API Route

1. Create route file in `server/routes/{name}.ts`
2. Register in `server/server.ts` with `app.use('/api/{name}', routeHandler)`
3. **Important:** Custom auth routes must be registered *before* the Better Auth catch-all `app.all("/api/auth/*")`

### Adding a New Feature (Full Stack)

Observed pattern from login rewards implementation:

1. **Database:** Add model in `server/drizzle/models/` + update `server/drizzle/schema.ts`
2. **Server route:** Create `server/routes/{feature}.ts`
3. **Server entry:** Register route in `server/server.ts`
4. **Client page:** Create page in `client/src/pages/`
5. **Client routing:** Add route in `client/src/App.jsx`
6. **Client UI:** Update Header/Nav/Layout as needed
7. **Types:** Update `server/types/` if new interfaces needed

## File Co-Change Patterns

These files frequently change together, indicating tight coupling:

| Group | Files |
|-------|-------|
| **Crash game** | `crashHandler.ts` + `crashSocketService.js` + `CrashGame.jsx` |
| **Auth system** | `lib/auth.ts` + `socketAuth.ts` + `auth-client.js` + `AuthContext.jsx` |
| **Admin panel** | `admin.ts` (route) + `adminService.js` + `PlayerManagement.jsx` + `Dashboard.jsx` |
| **Balance operations** | `balanceService.ts` + `Balance.ts` (model) + game handlers |
| **Schema changes** | `schema.ts` + all model files in `drizzle/models/` + route files |
| **Server config** | `server.ts` + `package.json` + route files |

## Key Patterns

### Socket Authentication
- Socket connections authenticated via `server/middleware/socket/socketAuth.ts`
- Login required to play games (enforced since `feat(auth)` commit)
- All namespaces verify auth on connection and disconnect unauthenticated sockets

### Balance Service
- Centralized balance operations through `server/src/services/balanceService.ts`
- All game handlers use this service for bet/payout processing
- Balance changes create both a `balances` record and `transactions` record atomically

### Better Auth Integration
- Session-based auth (migrated from custom JWT)
- Custom auth routes registered *before* Better Auth catch-all
- Better Auth registered *before* `express.json()` middleware
- Client uses `better-auth` client from `client/src/lib/auth-client.js`

### Logging
- Winston-based logging via `server/src/services/loggingService.ts`
- Game events, auth events, and errors are logged
- `gameLogs` table uses `varchar` (not enum) for `gameType`/`eventType` to support system/admin events

### Admin System
- Admin role with dedicated routes (`server/routes/admin.ts`)
- Admin UI in `client/src/components/admin/`
- Player management, game statistics, dashboard views
- Admin creation via `server/scripts/createAdmin.ts`

## Evolution History

The project has undergone several major migrations:

| Date | Migration | Commit |
|------|-----------|--------|
| 2025-06-24 | MongoDB to MySQL with Drizzle ORM | `96229256` |
| 2025-06-24 | Server JavaScript to TypeScript | `60547319` |
| 2025-10-05 | Enhanced logging + MySQL/Drizzle refinements | `ff6ccf67` |
| 2026-03-27 | Custom JWT to Better Auth (session-based) | `078fca1b` |

Most frequently modified file: `server/src/socket/crashHandler.ts` (8 commits) - the crash game has been the most iterated-upon feature.
