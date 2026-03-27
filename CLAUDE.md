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
```

### Client (run from `client/`)
```bash
npm install                           # Install dependencies
npm run dev                           # Vite dev server (port 5173)
npm run build                         # Production build
npm run lint                          # ESLint (JS/JSX)
```

### CI
CI runs `npx tsc --noEmit` + `npm run build` for server, then `npm run build` for client. No test suite exists yet (`npm test` exits with error).

## Architecture

### Server (`server/`)
- **Runtime:** Node.js + Express + TypeScript (ESM modules throughout, `.js` extensions in imports)
- **Database:** MySQL via Drizzle ORM (`server/drizzle/schema.ts` is the single source of truth for all tables)
- **DB connection:** `server/drizzle/db.ts` exports `db` (Drizzle instance), `connectDB`, `closeDB`
- **Real-time:** Socket.IO with namespace-per-game pattern (e.g., `/crash`, `/roulette`, `/wheel`)
- **Auth:** Better Auth (session-based) with username + admin plugins; config at `server/lib/auth.ts`, mounted at `/api/auth/*` via `toNodeHandler`; middleware at `server/middleware/auth.ts` (HTTP) and `server/middleware/socket/socketAuth.ts` (WebSocket); client at `client/src/lib/auth-client.js`
- **Logging:** Winston-based `LoggingService` at `server/src/services/loggingService.ts`
- **Balance management:** Centralized in `server/src/services/balanceService.ts`

### API Routes (`server/routes/`)
All mounted under `/api`: `/api/auth`, `/api/users`, `/api/games`, `/api/admin`, `/api/rewards`

### Socket Handlers (`server/src/socket/`)
Each game has its own handler file. **Crash** is fully wired (namespace-level init). **Roulette** is wired per-connection. **Landmines, Plinko, Wheel** are currently disabled (TODO comments in `server/server.ts`). **Blackjack** handler exists but is not wired.

### Client (`client/`)
- **Framework:** React 18 (JSX, not TypeScript) + Vite + Tailwind CSS v4
- **Routing:** React Router v6 with `createBrowserRouter`
- **State:** React Context (`AuthContext`, `ToastContext`) - Redux Toolkit is installed but not actively used
- **API layer:** `client/src/services/api.js` - fetch-based with cookie credentials; game-specific socket services in `client/src/services/socket/`
- **Path alias:** `@` maps to `client/src/`

### Client Structure
- `client/src/pages/` - route-level page components
- `client/src/games/` - game-specific components and utilities (crash, plinko, wheel, roulette, landmines, blackjack)
- `client/src/components/ui/` - reusable UI primitives (Button, Card, Modal, Table, etc.)
- `client/src/components/guards/` - `AuthGuard` and `AdminGuard` route protection
- `client/src/components/admin/` - admin dashboard components

### Database Schema (`server/drizzle/schema.ts`)
Tables: `users`, `session`, `account`, `verification`, `transactions`, `gameSessions`, `gameLogs`, `balances`, `gameStats`, `messages`, `loginRewards`. Drizzle config points to `./drizzle/schema.js` (the compiled output). Better Auth manages `session`, `account`, and `verification` tables.

## Key Patterns

- **ESM everywhere:** Both client and server use `"type": "module"`. Server imports use `.js` extensions even for `.ts` source files.
- **TypeScript strictness:** Server tsconfig has `strict: false` and most strict checks disabled. Don't add strict type annotations that would break this convention.
- **Game socket pattern:** Each game gets a Socket.IO namespace, auth middleware via `socketAuth`, and a handler in `server/src/socket/`. The handler receives the namespace or `(io, socket, user)` depending on init style.
- **Balance operations:** All balance changes go through `balanceService` which creates both a `balances` record and a `transactions` record atomically.

## Environment

Server config via `server/.env` (see `server/.env.example`):
- `PORT` (default 5000)
- `CLIENT_URL` (default http://localhost:5173)
- `BETTER_AUTH_SECRET` (32+ char secret for session signing)
- `BETTER_AUTH_URL` (default http://localhost:5000)
- `DATABASE_URL` (mysql://user:pass@host:port/database)

Client reads `VITE_API_URL` and `VITE_SOCKET_URL` from env (defaults to localhost:5000).
