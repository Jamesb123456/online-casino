# Frequently Asked Questions

## General

### Is this real money gambling?

No. Platinum Casino is an educational project designed to demonstrate full-stack web development concepts including real-time WebSocket communication, database-backed transaction systems, and game logic implementation. All currency is virtual and has no monetary value. If you intend to deploy this in any context involving real money, ensure full compliance with local gambling laws and regulations.

### What is the tech stack?

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Tailwind CSS 4, Vite 5 |
| Backend | Node.js, Express, TypeScript |
| Database | MySQL 8 with Drizzle ORM |
| Real-time | Socket.IO 4 |
| Auth | JWT with HTTP-only cookies |

For the complete technology breakdown, see [Technology Stack](../01-overview/technology-stack.md).

### What games are included?

Six casino games: Crash, Roulette, Blackjack, Landmines, Plinko, and Wheel. Currently, Crash and Roulette are fully operational. Blackjack, Landmines, Plinko, and Wheel have handlers written but require additional integration work. See [Current Status](../11-roadmap/current-status.md) for details.

## Setup and Configuration

### What are the default login credentials?

After running the database seed script (`npm run seed`), two accounts are available:

| Account | Username | Password | Role |
|---------|----------|----------|------|
| Admin | `admin` | `admin123` | admin |
| Player | `player1` | `password123` | user |

Change these credentials immediately in any non-local environment.

### How do I reset the database?

Drop and recreate the database, then re-run migrations and seed data:

```sql
DROP DATABASE casino;
CREATE DATABASE casino;
```

```bash
cd server
npm run db:migrate
npm run seed
```

This will restore the database to its initial state with default users and game statistics.

### How do I change the server port?

Edit `server/.env` and set the `PORT` variable:

```env
PORT=3000
```

Then restart the server. Remember to update `CLIENT_URL` on the server side and the API URL on the client side if they reference the old port.

### Does this work on Windows and Linux?

Yes. The project works on both platforms.

- **Windows:** A `start.ps1` PowerShell script is available in the project root for starting both client and server simultaneously
- **Linux/macOS:** Use standard npm commands in separate terminal sessions

```bash
# Terminal 1 - Server
cd server
npm run dev

# Terminal 2 - Client
cd client
npm run dev
```

The server uses Node.js and Express, which are cross-platform. Bun can also be used as an alternative runtime during development.

### How do I handle special characters in the database password?

If your MySQL password contains characters like `<`, `>`, `+`, `@`, or `#`, they must be URL-encoded in the `DATABASE_URL`. Use the included helper:

```bash
cd server
node encode-db-password.js
```

Copy the output into your `.env` file.

## Development

### Can I add a new game?

Yes. Adding a new game involves three parts:

1. **Server -- Socket handler:** Create a new file in `server/src/socket/` (e.g., `diceHandler.ts`). Use an existing handler like `crashHandler.ts` as a template. Implement bet placement, game logic, and result broadcasting.

2. **Server -- Namespace registration:** In `server/server.ts`, create a new Socket.IO namespace for the game:
   ```typescript
   const diceNamespace = io.of('/dice');
   diceNamespace.use(socketAuth);
   diceNamespace.on('connection', (socket) => {
     // Authentication and handler initialization
   });
   ```

3. **Client -- React components:** Create a new directory under `client/src/games/` (e.g., `client/src/games/dice/`). Build the game UI component, connect to the Socket.IO namespace, and add a route in `App.jsx`.

Use `BalanceService` on the server side for all bet and payout operations to maintain transaction integrity.

### How do I run only the server or only the client?

```bash
# Server only
cd server
npm run dev          # Development with auto-reload
npm run start:ts     # Run TypeScript directly
npm run start        # Run compiled JavaScript from dist/

# Client only
cd client
npm run dev          # Development server with HMR
npm run build        # Production build
npm run preview      # Preview production build
```

### How do I rebuild the server after making changes?

```bash
cd server
npm run build
```

This compiles TypeScript from `server/` into JavaScript in `server/dist/`. If you encounter stale build artifacts, clear the output first:

```bash
rm -rf server/dist/
cd server
npm run build
```

### Where are the database migration files?

Migrations are in `server/drizzle/migrations/`. The project uses Drizzle Kit for migration management:

```bash
cd server
npm run db:generate   # Generate migration from schema changes
npm run db:migrate    # Apply pending migrations
```

The schema is defined in files under `server/drizzle/schema/`.

## Troubleshooting Quick Reference

### The server starts but games don't work

Check [Common Issues -- Games Not Loading](./common-issues.md#games-not-loading). Most likely the game's socket handler is not initialized (commented out in `server.ts`).

### I get a 401 error on every request

Your session is likely invalid or expired. Clear your browser cookies and log in again. If the issue persists, verify that `BETTER_AUTH_SECRET` in `.env` has not changed since the session was created.

### The database won't connect

See [Common Issues -- Database Connection Errors](./common-issues.md#database-connection-errors). Verify MySQL is running, the `DATABASE_URL` is correctly formatted, and special characters in the password are URL-encoded.

### How do I check what's logged?

The `LoggingService` writes structured logs to the `game_logs` table in MySQL. You can query them directly:

```sql
SELECT * FROM game_logs ORDER BY timestamp DESC LIMIT 20;
```

Morgan logs HTTP requests to the server console in dev format. See [Logging](../10-operations/logging.md) for full details.

## Related Documents

- [Common Issues](./common-issues.md)
- [Current Status](../11-roadmap/current-status.md)
- [Development Roadmap](../11-roadmap/roadmap.md)
- [Project Summary](../01-overview/project-summary.md)
- [Logging](../10-operations/logging.md)
