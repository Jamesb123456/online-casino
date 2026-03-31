# Core Project Memory

## Purpose

This file stores **long-term stable knowledge about the project**.

It contains architecture information, critical workflows, key constraints, and major project decisions.

This file acts as **permanent memory for AI agents** so they quickly understand how the project works.

Unlike `.claude/learning.md`, which records debugging discoveries and issues, this file stores **stable truths that should rarely change**.

---

## Project Purpose

Platinum Casino is a web-based online casino platform with real-time multiplayer games. It is a monorepo with separate `client/` (React 18 + Vite) and `server/` (Node.js + Express + TypeScript) directories. There is no root `package.json`.

---

## System Architecture

- **Monorepo** with two independent packages: `client/` and `server/`.
- **Server** is an Express REST API with Socket.IO for real-time game communication.
- **Client** is a React 18 SPA served by Vite in development and built to static files for production.
- **Database** is MySQL accessed via Drizzle ORM. The schema is defined in `server/drizzle/schema.ts`.
- **Real-time games** use a namespace-per-game Socket.IO pattern (e.g., `/crash`, `/roulette`, `/wheel`).
- **Authentication** uses Better Auth (session-based) with HTTP-only cookies for session management.

---

## Core Technologies

| Layer       | Technology                                      |
|-------------|------------------------------------------------|
| Frontend    | React 18 (JSX), Vite, Tailwind CSS v4, React Router v6 |
| Backend     | Node.js, Express, TypeScript (ESM), Socket.IO  |
| Database    | MySQL, Drizzle ORM                             |
| Auth        | Better Auth (session-based, HTTP-only cookies)  |
| Logging     | Winston (`LoggingService`)                     |
| Build       | TypeScript compiler (server), Vite (client)    |
| Runtime     | Node.js / Bun (dev via `bun --watch`)          |

---

## Critical Workflows

### Build Pipeline
1. **Server:** `npx tsc --noEmit` (type-check) then `npm run build` (compile to `dist/`).
2. **Client:** `npm run build` (Vite production build).
3. **CI** runs both in sequence. No test suite exists yet.

### Database Migrations
- Schema source of truth: `server/drizzle/schema.ts`.
- Generate migrations: `npm run db:generate`.
- Apply migrations: `npm run db:migrate`.
- Dev push (no migration file): `npm run db:push`.
- Seed data: `npm run seed`.

### Development Startup
1. Start MySQL database.
2. Run `npm run dev` in `server/` (bun --watch on port 5000).
3. Run `npm run dev` in `client/` (Vite on port 5173).

---

## Key Constraints

- **ESM everywhere.** Both client and server use `"type": "module"`. Server TypeScript imports must use `.js` extensions.
- **TypeScript strictness is OFF.** Server `tsconfig.json` has `strict: false`. Do not introduce strict type annotations.
- **All balance changes** must go through `balanceService` which creates both a `balances` record and a `transactions` record atomically. Never modify balances directly.
- **No root package.json.** Commands must be run from `client/` or `server/` directories.
- **Socket auth** is required on all game namespaces via `socketAuth` middleware.

---

## Important Project Decisions

- Migrated from MongoDB to MySQL with Drizzle ORM (commit `ff6ccf6`).
- Crash game handler was refactored with improved state management (commit `6e860d0`).
- Socket.IO namespace-per-game pattern chosen over single namespace with rooms.
- React Context (`AuthContext`, `ToastContext`) used for state rather than Redux Toolkit (which is installed but unused).

---

## Important Paths

| Path                            | Purpose                                           |
|---------------------------------|---------------------------------------------------|
| `/client/`                      | React frontend application                        |
| `/server/`                      | Express + Socket.IO backend                       |
| `/server/drizzle/schema.ts`     | Single source of truth for database schema        |
| `/server/drizzle/db.ts`         | Database connection (Drizzle instance)             |
| `/server/src/socket/`           | Game socket handlers (one file per game)           |
| `/server/src/services/`         | Business logic services (balance, logging)         |
| `/server/routes/`               | REST API route handlers                            |
| `/server/middleware/`           | Auth middleware (HTTP and WebSocket)                |
| `/client/src/games/`            | Game-specific frontend components                  |
| `/client/src/components/ui/`    | Reusable UI primitives                             |
| `/client/src/services/`         | API and socket service layers                      |
| `/docs/`                        | Project documentation                              |
| `/.claude/`                     | AI agent configuration, memory, and learning log   |
| `/CLAUDE.md`                    | Root project instructions for Claude Code          |

---

## Agent Operating Rules

1. **Read before writing.** Always read existing code before modifying it.
2. **ESM imports.** Use `.js` extensions in all server-side TypeScript imports.
3. **Balance safety.** All balance mutations must go through `balanceService`.
4. **No strict types.** Do not add strict TypeScript annotations to the server.
5. **Log discoveries.** Document debugging findings in `.claude/learning.md`.
6. **Log stable knowledge.** Document architecture insights in `.claude/memories.md`.
7. **Run from correct directory.** Server commands from `server/`, client commands from `client/`.
8. **Do not break CI.** Verify changes pass `npx tsc --noEmit` and `npm run build` before committing.
9. **Use Playwright for browser automation.** Always use Playwright MCP (`mcp__playwright__*`) instead of Chrome MCP (`mcp__claude-in-chrome__*`) for any browser interaction tasks.

---

## Core Memory Entries

### Core Memory Entry

- **Date:** 2026-03-27
- **Agent:** Claude Code (Opus 4.6)
- **Topic:** Initial knowledge system setup
- **Context:** Created the persistent AI knowledge system for this repository.
- **Core Knowledge:** The `.claude/memories.md` and `.claude/learning.md` files form the persistent memory system for all AI agents working in this repo. Agents must read these files before starting work and must log discoveries during work.
- **Reason:** Prevents knowledge loss between agent sessions and stops repeated debugging of the same issues.
