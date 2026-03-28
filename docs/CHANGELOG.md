# Changelog

All notable changes to the Platinum Casino project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project uses pre-release versioning until a stable public release.

---

## [Unreleased]

### Added
- Contribution guide with PR workflow, branch naming, and code review checklist.
- Developer onboarding walkthrough (day-by-day guide for new team members).
- This changelog.
- **Documentation sections:** Integrations (13), AI Agents (14), Compliance (15).
- **ADR-006:** Better Auth migration decision record.
- **Provably fair system** -- HMAC-SHA256 verification for crash and roulette games (`provablyFairService.ts`, `/api/verify` endpoints).
- **Leaderboard** -- Player rankings by daily/weekly/allTime periods (`/api/leaderboard`).
- **Responsible gaming** -- Self-exclusion (1-365 days), activity summaries, gaming limits placeholders (`/api/responsible-gaming/*`).
- **New client pages** -- LeaderboardPage, VerifyPage, ResponsibleGamingPage, NotFoundPage.
- **New components** -- GameErrorBoundary (per-game error boundary), MobileBottomNav (fixed bottom nav).
- **Redis integration** -- Optional caching layer with graceful degradation for balance and game stats.
- **Request ID middleware** -- UUID v4 correlation IDs for all requests.
- **Socket rate limiting** -- Per-user, per-event rate limiter for Socket.IO.
- **Zod validation schemas** -- All game events, admin operations validated with typed schemas.
- **Docker deployment** -- Production docker-compose with MySQL, server, nginx client; dev compose for MySQL only.
- **Makefile** -- 15 automation targets for dev, build, test, Docker, database operations.
- **Vitest test suites** -- 67+ test files across server and client with coverage thresholds.

### Changed
- **Authentication migrated from JWT to Better Auth** -- Session-based auth with database-backed sessions, cookie caching, and username/admin plugins. Replaced custom JWT middleware with Better Auth session validation. (commit `078fca1`)
- **All 6 game handlers now wired** -- Blackjack, Plinko, Wheel, Landmines previously disabled, now all active with dedicated Socket.IO namespaces.
- **CI pipeline expanded** -- From 1 job (build) to 4 jobs: lint, build, test (with coverage artifacts), security (npm audit).
- **Database schema updated** -- Added Better Auth tables (session, account, verification), extended users table with email/name/ban fields.
- **All documentation updated** -- Fixed JWT references to Better Auth, corrected tech stack (native fetch not Axios, Context API not Redux), updated version numbers.
- **Documentation expanded** -- 57 files (20,756 lines) to 73 files (29,259 lines) with full accuracy audit.

---

## [1.0.0-dev] - 2026-03-27

The initial development milestone. The application is fully functional locally with six casino games, real-time multiplayer support, an admin panel, and a MySQL-backed data layer.

### Added
- **Games:** Crash, Roulette, Blackjack, Plinko, Wheel of Fortune, and Landmines -- each with dedicated Socket.IO namespaces and client game modules.
- **Authentication:** Better Auth session-based auth with HTTP-only cookies. Login, register, logout, and session persistence.
- **Login rewards:** Daily reward system that grants bonus balance on consecutive logins.
- **Admin panel:** Dashboard with player management, game statistics, and manual transaction creation.
- **Balance service:** Centralized `BalanceService` for all bet placement, win recording, and balance adjustments with full transaction logging.
- **Logging service:** Structured event logging via `LoggingService` persisting to the `game_logs` table (game events, auth actions, admin operations).
- **Real-time chat:** Global chat system with `ChatBox` component and `chatHandler` socket namespace.
- **Live games feed:** `liveGamesHandler` broadcasting active game activity across the platform.
- **Client UI library:** Reusable components -- Button, Card, Modal, Table, Input, Badge, Toast, Loading spinner, ErrorBoundary.
- **Route guards:** `AuthGuard` and `AdminGuard` components protecting client-side routes.
- **Windows startup scripts:** `start.bat`, `start.ps1`, and `start-safely.bat` for one-command local setup.
- **CI pipeline:** GitHub Actions workflow running TypeScript type checking, server build, and client build on every push and PR to `main`.
- **Documentation suite:** Architecture docs, API reference, development guides, database schema docs, security docs, and troubleshooting guides across 12 documentation sections.

### Changed
- **Database migration from MongoDB to MySQL** -- Complete data layer rewrite from MongoDB/Mongoose to MySQL with Drizzle ORM. New typed schema (`drizzle/schema.ts`), Active Record-style model wrappers, and SQL migration system. This was the single largest architectural change in the project. (commits `9622925`, `ff6ccf6`)
- **Server migrated from JavaScript to TypeScript** -- All server source files converted from `.js` to `.ts` with ES Module syntax. (commit `6054731`)
- **Crash game handler restructured** -- Improved state management, error handling, and code organization in the crash game socket handler. (commit `6e860d0`)
- **Authentication simplified** -- Removed email-based features, streamlined to username/password only. Added role-based access (`user`, `admin`). (commits `b103e66`, `0d4e035`)
- **README enhanced** -- Improved setup instructions and project overview. (commit `662d984`)

### Fixed
- **CI TypeScript build failures** -- Resolved type errors and missing dependencies causing CI pipeline failures. Added `zod` and `seedrandom` to CI install step. (commit `7088b01`)
- **Roulette payout logic** -- Corrected payout calculations for various bet types. (commit `6c005cd`)
- **Admin dashboard** -- Fixed dashboard rendering and added missing backend imports. (commit `af8db42`)
- **Authentication and roles** -- Fixed role assignment during registration and login flow after MongoDB-to-MySQL migration. (commit `9622925`)

### Security
- **Helmet middleware** -- Security-related HTTP headers applied to all responses.
- **Rate limiting** -- `express-rate-limit` on authentication endpoints (5 requests per 15 minutes).
- **CORS restriction** -- Origin locked to `CLIENT_URL` environment variable with credentials enabled.
- **Input validation** -- Zod schemas on route handlers for request body validation.
- **Cookie security** -- Session tokens stored in HTTP-only cookies to prevent XSS-based session theft.

---

## Related Documents

- [System Architecture](./02-architecture/system-architecture.md) -- high-level architecture overview
- [Getting Started](./05-development/getting-started.md) -- setup instructions
- [Contributing Guide](./05-development/contributing.md) -- how to contribute and PR workflow
- [Roadmap](./11-roadmap/) -- planned future changes
