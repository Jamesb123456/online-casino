# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Platinum Casino - a web-based online casino with real-time multiplayer games. Monorepo with separate `client/` and `server/` directories (no root package.json).

## Common Commands

### Server (run from `server/`)
```bash
npm install                           # Install dependencies
npm run dev                           # Dev server with bun --watch
npm run start:ts                      # Start with ts-node (Node.js)
npm run build                         # TypeScript compile to dist/
npx tsc --noEmit                      # Type-check without emitting
npm run db:generate                   # Generate Drizzle migrations
npm run db:migrate                    # Run Drizzle migrations
npm run db:push                       # Push schema directly (dev)
npm run seed                          # Seed database with test data
npm run init-stats                    # Initialize game stats table
npm run test                          # Run vitest unit tests
npm run test:watch                    # Run tests in watch mode
npm run test:coverage                 # Run tests with coverage report
npm run test:integration              # Run integration tests (requires MySQL)
```

### Running a Single Test
```bash
# Server unit test (from server/)
npx vitest run src/path/to/file.test.ts

# Server integration test (from server/, requires MySQL)
npx vitest run --config vitest.integration.config.ts src/__tests__/integration/games/crash.integration.test.ts

# Client test (from client/)
npx vitest run src/path/to/file.test.jsx
```

### Client (run from `client/`)
```bash
npm install                           # Install dependencies
npm run dev                           # Vite dev server (port 5173)
npm run build                         # Production build
npm run lint                          # ESLint (JS/JSX)
npm run test                          # Run vitest tests
npm run test:watch                    # Run tests in watch mode
npm run test:coverage                 # Run tests with coverage report
```

### E2E Tests (run from project root)
```bash
npx playwright test                   # Run all E2E tests
npx playwright test e2e/tests/crash.spec.ts  # Run a single E2E spec
```
Requires both server and client running. Playwright config at `playwright.config.ts`, tests in `e2e/tests/`. Three phases: auth-setup -> games (uses saved session) -> auth-tests (last, since they create new sessions).

### Docker
```bash
docker-compose up                     # Start all services (MySQL, server, client)
docker-compose -f docker-compose.dev.yml up  # Dev compose variant
docker-compose -f docker-compose.test.yml up  # Test DB for integration tests (MySQL on port 3307)
```

### CI
CI pipeline has 6 jobs: **lint** (client ESLint) -> **build** (server type-check + build, client build) -> **test** (vitest unit tests with coverage for both) + **integration-test** (game socket tests against real MySQL) + **e2e-test** (Playwright against running app) -> **security** (npm audit). CI installs extra deps `zod` and `seedrandom` for the server.

## Architecture

### Server (`server/`)
- **Runtime:** Node.js + Express + TypeScript (ESM modules throughout, `.js` extensions in imports)
- **Entry point:** `server/server.ts` exports `createApp()` factory that returns `{ app, httpServer, io }`. Integration tests use this factory to spin up isolated server instances. The `if (import.meta.url === ...)` guard at the bottom starts the server only when run directly.
- **Database:** MySQL via Drizzle ORM (`server/drizzle/schema.ts` is the single source of truth for all tables)
- **DB connection:** `server/drizzle/db.ts` exports `db` (Drizzle instance), `connectDB`, `closeDB`
- **Real-time:** Socket.IO with namespace-per-game pattern (e.g., `/crash`, `/roulette`, `/wheel`, `/blackjack`, `/plinko`, `/landmines`)
- **Auth:** Better Auth (session-based) with username + admin plugins; config at `server/lib/auth.ts`, mounted at `/api/auth/*` via `toNodeHandler`; custom auth routes at `server/routes/auth.ts` registered *before* the Better Auth catch-all; middleware at `server/middleware/socket/socketAuth.ts` (WebSocket); client at `client/src/lib/auth-client.js`
- **Logging:** Winston-based `LoggingService` at `server/src/services/loggingService.ts`
- **Balance management:** Centralized in `server/src/services/balanceService.ts`
- **Redis:** Optional `RedisService` at `server/src/services/redisService.ts` for Socket.IO adapter (horizontal scaling); server works without Redis

### API Routes (`server/routes/`)
All mounted under `/api`: `/api/auth`, `/api/users`, `/api/games`, `/api/admin`, `/api/admin/analytics`, `/api/rewards`, `/api/verify`, `/api/leaderboard`, `/api/responsible-gaming`. Health checks at `/health` (basic) and `/api/health/db` (database).

### Socket Handlers (`server/src/socket/`)
All six game namespaces are wired in `server/server.ts`. Three different initialization patterns:
- **Crash:** Namespace-level init -- handler is imported once at startup and receives the namespace, attaches its own `connection` listener
- **Blackjack:** Class-based -- `BlackjackHandler` is instantiated per-connection with the namespace, then `handleConnection(socket)` is called
- **Roulette, Landmines, Plinko, Wheel:** Per-connection init -- handler receives `(io, socket, user)` on each connection

Chat and live games handlers are initialized on the main Socket.IO namespace (not game-specific).

### Client (`client/`)
- **Framework:** React 18 (JSX, not TypeScript) + Vite + Tailwind CSS v4
- **Routing:** React Router v6 with `createBrowserRouter`; game pages are lazy-loaded, wrapped in `GameErrorBoundary` + `Suspense`
- **State:** React Context (`AuthContext`, `ToastContext` in `client/src/contexts/`)
- **API layer:** `client/src/services/api.js` - fetch-based with cookie credentials; game-specific socket services in `client/src/services/socket/`
- **Path alias:** `@` maps to `client/src/`
- **Route guards:** `AuthGuard` (authenticated users) and `AdminGuard` (admin role) in `client/src/components/guards/`
- **Testing:** Vitest + React Testing Library + jsdom; setup file at `client/src/test/setup.js`

### Database Schema (`server/drizzle/schema.ts`)
Tables: `users`, `session`, `account`, `verification`, `transactions`, `gameSessions`, `gameLogs`, `balances`, `gameStats`, `messages`, `loginRewards`. Drizzle config points to `./drizzle/schema.js` (the compiled output). Better Auth manages `session`, `account`, and `verification` tables. The `gameLogs` table uses `varchar` (not enum) for `gameType`/`eventType` because `LoggingService` writes system/admin events beyond the game enum values.

### Testing Architecture
- **Unit tests** (server): `server/**/*.test.ts` -- exclude `**/integration/**`. Config at `server/vitest.config.ts`. Uses `pool: 'forks'`.
- **Unit tests** (client): `client/src/**/*.test.{js,jsx}`. Config at `client/vitest.config.js`. Uses jsdom environment.
- **Integration tests**: `server/src/__tests__/integration/games/*.integration.test.ts`. Config at `server/vitest.integration.config.ts`. Require a real MySQL database (use `docker-compose.test.yml` for local, CI spins up a MySQL service). Helper modules in `server/src/__tests__/integration/` handle test server creation, auth, and DB cleanup.
- **E2E tests**: `e2e/tests/*.spec.ts` using Playwright. Config at `playwright.config.ts`. Run against live server+client.

## Key Patterns

- **ESM everywhere:** Both client and server use `"type": "module"`. Server imports use `.js` extensions even for `.ts` source files.
- **TypeScript strictness:** Server tsconfig has `strict: false` and most strict checks disabled. Don't add strict type annotations that would break this convention.
- **Game socket pattern:** Each game gets a Socket.IO namespace, auth middleware via `socketAuth`, and a handler in `server/src/socket/`. All namespaces verify auth on connection and disconnect unauthenticated sockets.
- **Balance operations:** All balance changes go through `balanceService` which creates both a `balances` record and a `transactions` record atomically.
- **Better Auth route ordering:** Custom auth routes (`server/routes/auth.ts`) must be registered *before* the Better Auth `app.all("/api/auth/*")` catch-all in `server.ts`, and Better Auth must be before `express.json()` middleware.
- **Server factory pattern:** `createApp()` in `server.ts` builds the Express+Socket.IO stack and returns it. This allows integration tests to create isolated server instances without the auto-start side effect.

## Environment

Server config via `server/.env` (see `server/.env.example`):
- `PORT` (default 5000)
- `CLIENT_URL` (default http://localhost:5173)
- `BETTER_AUTH_SECRET` (32+ char secret for session signing)
- `BETTER_AUTH_URL` (default http://localhost:5000)
- `DATABASE_URL` (mysql://user:pass@host:port/database)

Game timing env vars (used in integration tests to speed up game rounds):
- `CRASH_COUNTDOWN_MS`, `CRASH_NEXT_GAME_MS`
- `ROULETTE_BETTING_DURATION`, `ROULETTE_SPIN_DURATION`, `ROULETTE_RESULT_DISPLAY`
- `WHEEL_BETTING_DURATION`, `WHEEL_SPIN_DURATION`, `WHEEL_RESULT_DISPLAY`

Client reads `VITE_API_URL` and `VITE_SOCKET_URL` from env (defaults to localhost:5000).

Docker compose uses `.env.docker` for container environment variables.

### Default Seed Credentials
- **Admin:** username=`admin`, password=`admin123`
- **Player:** username=`player1`, password=`password123`
