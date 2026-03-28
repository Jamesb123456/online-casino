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
npm run test                          # Run vitest tests
npm run test:watch                    # Run tests in watch mode
npm run test:coverage                 # Run tests with coverage report
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

### Docker
```bash
docker-compose up                     # Start all services (MySQL, server, client)
docker-compose -f docker-compose.dev.yml up  # Dev compose variant
```

### CI
CI pipeline has 4 stages: **lint** (client ESLint) → **build** (server type-check + build, client build) → **test** (vitest with coverage for both) → **security** (npm audit). CI installs extra deps `zod` and `seedrandom` for the server.

## Architecture

### Server (`server/`)
- **Runtime:** Node.js + Express + TypeScript (ESM modules throughout, `.js` extensions in imports)
- **Database:** MySQL via Drizzle ORM (`server/drizzle/schema.ts` is the single source of truth for all tables)
- **DB connection:** `server/drizzle/db.ts` exports `db` (Drizzle instance), `connectDB`, `closeDB`
- **Real-time:** Socket.IO with namespace-per-game pattern (e.g., `/crash`, `/roulette`, `/wheel`, `/blackjack`, `/plinko`, `/landmines`)
- **Auth:** Better Auth (session-based) with username + admin plugins; config at `server/lib/auth.ts`, mounted at `/api/auth/*` via `toNodeHandler`; custom auth routes at `server/routes/auth.ts` registered *before* the Better Auth catch-all; middleware at `server/middleware/socket/socketAuth.ts` (WebSocket); client at `client/src/lib/auth-client.js`
- **Logging:** Winston-based `LoggingService` at `server/src/services/loggingService.ts`
- **Balance management:** Centralized in `server/src/services/balanceService.ts`
- **Redis:** Optional `RedisService` at `server/src/services/redisService.ts` for Socket.IO adapter (horizontal scaling); server works without Redis

### API Routes (`server/routes/`)
All mounted under `/api`: `/api/auth`, `/api/users`, `/api/games`, `/api/admin`, `/api/rewards`, `/api/verify`, `/api/leaderboard`, `/api/responsible-gaming`. Health checks at `/health` (basic) and `/api/health/db` (database).

### Socket Handlers (`server/src/socket/`)
All six game namespaces are wired in `server/server.ts`. Three different initialization patterns:
- **Crash:** Namespace-level init — handler is imported once at startup and receives the namespace, attaches its own `connection` listener
- **Blackjack:** Class-based — `BlackjackHandler` is instantiated per-connection with the namespace, then `handleConnection(socket)` is called
- **Roulette, Landmines, Plinko, Wheel:** Per-connection init — handler receives `(io, socket, user)` on each connection

Chat and live games handlers are initialized on the main Socket.IO namespace (not game-specific).

### Client (`client/`)
- **Framework:** React 18 (JSX, not TypeScript) + Vite + Tailwind CSS v4
- **Routing:** React Router v6 with `createBrowserRouter`; game pages are lazy-loaded, wrapped in `GameErrorBoundary` + `Suspense`
- **State:** React Context (`AuthContext`, `ToastContext` in `client/src/contexts/`)
- **API layer:** `client/src/services/api.js` - fetch-based with cookie credentials; game-specific socket services in `client/src/services/socket/`
- **Path alias:** `@` maps to `client/src/`
- **Route guards:** `AuthGuard` (authenticated users) and `AdminGuard` (admin role) in `client/src/components/guards/`
- **Testing:** Vitest + React Testing Library + jsdom; setup file at `client/src/test/setup.js`

### Client Structure
- `client/src/pages/` - route-level page components
- `client/src/games/` - game-specific components and utilities (crash, plinko, wheel, roulette, landmines, blackjack)
- `client/src/components/ui/` - reusable UI primitives (Button, Card, Modal, Table, etc.)
- `client/src/components/guards/` - `AuthGuard` and `AdminGuard` route protection
- `client/src/components/admin/` - admin dashboard components

### Database Schema (`server/drizzle/schema.ts`)
Tables: `users`, `session`, `account`, `verification`, `transactions`, `gameSessions`, `gameLogs`, `balances`, `gameStats`, `messages`, `loginRewards`. Drizzle config points to `./drizzle/schema.js` (the compiled output). Better Auth manages `session`, `account`, and `verification` tables. The `gameLogs` table uses `varchar` (not enum) for `gameType`/`eventType` because `LoggingService` writes system/admin events beyond the game enum values.

## Key Patterns

- **ESM everywhere:** Both client and server use `"type": "module"`. Server imports use `.js` extensions even for `.ts` source files.
- **TypeScript strictness:** Server tsconfig has `strict: false` and most strict checks disabled. Don't add strict type annotations that would break this convention.
- **Game socket pattern:** Each game gets a Socket.IO namespace, auth middleware via `socketAuth`, and a handler in `server/src/socket/`. All namespaces verify auth on connection and disconnect unauthenticated sockets.
- **Balance operations:** All balance changes go through `balanceService` which creates both a `balances` record and a `transactions` record atomically.
- **Better Auth route ordering:** Custom auth routes (`server/routes/auth.ts`) must be registered *before* the Better Auth `app.all("/api/auth/*")` catch-all in `server.ts`, and Better Auth must be before `express.json()` middleware.

## Environment

Server config via `server/.env` (see `server/.env.example`):
- `PORT` (default 5000)
- `CLIENT_URL` (default http://localhost:5173)
- `BETTER_AUTH_SECRET` (32+ char secret for session signing)
- `BETTER_AUTH_URL` (default http://localhost:5000)
- `DATABASE_URL` (mysql://user:pass@host:port/database)

Client reads `VITE_API_URL` and `VITE_SOCKET_URL` from env (defaults to localhost:5000).

Docker compose uses `.env.docker` for container environment variables.

### Default Seed Credentials
- **Admin:** username=`admin`, password=`admin123`
- **Player:** username=`player1`, password=`password123`
