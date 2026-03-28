# Developer Onboarding

A structured walkthrough for new developers joining the Platinum Casino project. Follow this day-by-day guide to go from zero to productive.

---

## Day 1: Get Running and Understand the Big Picture

### Clone, set up, and run locally

Follow the [Getting Started](./getting-started.md) guide end-to-end. By the end you should have:

- The repository cloned and dependencies installed for both `server/` and `client/`.
- A MySQL database running with migrations applied and seed data loaded.
- The server running on `http://localhost:5000` and the client on `http://localhost:5173`.
- Successfully logged in as both `admin` / `admin123` and `player1` / `password123`.

**Checkpoint:** Open the browser, log in as `player1`, navigate to the Crash game, and place a test bet. If the game runs and your balance updates, your environment is working.

### Understand the architecture

Read the [System Architecture](../02-architecture/system-architecture.md) document. The key takeaways:

1. **Client layer** -- React SPA (Vite + React Router + Tailwind CSS). State lives in React Context for auth and toasts; game state is local to each game component.
2. **Server layer** -- Express handles REST API requests. Socket.IO handles real-time game communication. Each game gets its own Socket.IO namespace.
3. **Service layer** -- `BalanceService` manages all balance operations. `LoggingService` persists structured logs. Game logic lives in socket handlers.
4. **Data layer** -- MySQL accessed through Drizzle ORM. Schema defined in `server/drizzle/schema.ts`, model wrappers in `server/drizzle/models/`.

Then skim these two documents:

- [Data Flow](../02-architecture/data-flow.md) -- how a request travels from client to database and back.
- [Socket Architecture](../02-architecture/socket-architecture.md) -- how game namespaces and handlers are wired up.

---

## Day 2: Explore the Codebase and Make a Change

### Key files to read first

These files give you the most context for the least reading. Read them in this order:

#### Server (start here)

| File | Why it matters |
|------|---------------|
| `server/server.ts` | Main entry point. See how Express, Socket.IO, middleware, and routes are wired together. |
| `server/drizzle/schema.ts` | The entire database schema in one file. All 8 tables, their columns, enums, and relations. |
| `server/drizzle/models/User.ts` | Example Drizzle model. Shows the Active Record-style wrapper pattern used for all models. |
| `server/middleware/auth.ts` | JWT cookie authentication. Every protected route and socket connection uses this. |
| `server/src/services/balanceService.ts` | The balance service. All bet placement, win recording, and balance queries go through here. |
| `server/src/socket/crashHandler.ts` | The most complete game handler. Shows the multiplayer game pattern with shared state, betting rounds, and cash-out logic. |
| `server/routes/auth.ts` | Authentication routes (login, register, logout). Shows the Zod validation pattern. |

#### Client (then here)

| File | Why it matters |
|------|---------------|
| `client/src/App.jsx` | All routes defined in one place. Shows the route guard pattern. |
| `client/src/contexts/AuthContext.jsx` | Authentication state management. Used by every protected page. |
| `client/src/services/api.js` | Axios instance with base URL and `withCredentials: true`. All HTTP calls go through this. |
| `client/src/services/socketService.js` | Core Socket.IO connection manager. Game-specific socket services build on top of this. |
| `client/src/games/crash/CrashGame.jsx` | The most complete game UI. Shows how a game component connects to its socket service and manages game state. |
| `client/src/games/crash/crashSocketService.js` | Socket event wrappers for the Crash game. Shows the client-side socket service pattern. |

### Tutorial: Add a new API endpoint

Practice making a change by adding a simple health-check endpoint. This touches the key parts of the stack without requiring game logic knowledge.

#### Step 1: Create the route file

Create `server/routes/health.ts`:

```typescript
import { Router } from 'express';
import { db } from '../drizzle/db.js';
import { sql } from 'drizzle-orm';

const router = Router();

// Public health check -- no auth required
router.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database connectivity check -- no auth required
router.get('/db', async (req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

export default router;
```

#### Step 2: Register the route

In `server/server.ts`, import and mount the route alongside the existing route registrations:

```typescript
import healthRoutes from './routes/health.js';

// Mount alongside existing routes
app.use('/api/health', healthRoutes);
```

#### Step 3: Verify

Start the server and test both endpoints:

```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/health/db
```

Both should return JSON with `"status": "ok"`.

#### Step 4: Clean up

This was a practice exercise. You can keep the health endpoint (it is genuinely useful) or revert the change with `git checkout -- .` if you prefer.

---

## Day 3: Understand the Game System and Add a Feature

### How games work

Every game in Platinum Casino follows the same pattern across both the client and server.

#### Server side: Socket handlers

Each game has a handler in `server/src/socket/`. The handler:

1. Receives a Socket.IO namespace.
2. Maintains game state in a closure (multiplayer games share state; single-player games use a `Map` keyed by user ID).
3. Listens for events like `place_bet`, `cash_out`, and `game_action`.
4. Uses `BalanceService` to deduct bets and credit winnings.
5. Uses `LoggingService` to log game events.
6. Emits results back to the client via socket events.

Read `server/src/socket/crashHandler.ts` for the multiplayer pattern and `server/src/socket/landminesHandler.ts` for the single-player pattern.

#### Client side: Game components

Each game lives in `client/src/games/<game-name>/` with a consistent structure:

| File | Purpose |
|------|---------|
| `<GameName>Game.jsx` | Main container. Manages game state, connects to the socket service. |
| `<GameName>Board.jsx` | Visual display (the game board, wheel, crash graph, etc.). |
| `<GameName>BettingPanel.jsx` | Bet controls (amount input, place bet button, cash out). |
| `<gameName>SocketService.js` | Socket.IO event wrappers specific to this game. |
| `<gameName>Utils.js` | Helper functions (calculations, formatting). |

#### The BalanceService

All balance operations **must** go through `BalanceService`. Never write directly to the balances or transactions tables. The service:

- `placeBet(userId, amount, gameType, metadata)` -- deducts balance and records a `game_loss` transaction.
- `recordWin(userId, betAmount, winAmount, gameType, metadata)` -- credits balance and records a `game_win` transaction.
- `getBalance(userId)` -- returns the current balance.

### Tutorial: Add a simple feature (step-by-step)

Let us add a "last 10 results" history display to an existing game. This is a realistic small feature that touches both client and server.

#### Step 1: Add a server-side event

In the relevant game handler (e.g., `crashHandler.ts`), maintain an array of recent results in the game state:

```typescript
const gameState = {
  // ... existing state
  history: [] as Array<{ multiplier: number; timestamp: number }>,
};
```

When a game round ends, push the result and trim to 10 entries:

```typescript
gameState.history.push({ multiplier: crashPoint, timestamp: Date.now() });
if (gameState.history.length > 10) gameState.history.shift();
```

Emit the history to new connections:

```typescript
socket.emit('game_history', gameState.history);
```

#### Step 2: Add a client-side component

Create a new component (e.g., `CrashHistory.jsx`) that receives the history array as a prop and renders it as a list. Follow the naming conventions in [Coding Standards](./coding-standards.md).

#### Step 3: Wire it up

In the main game component, listen for the `game_history` event in the socket service, store it in local state, and pass it to your new component.

#### Step 4: Test manually

Log in, navigate to the game, and verify the history appears and updates after each round.

---

## Key Contacts and Resources

| Resource | Where to find it |
|----------|-----------------|
| Project documentation | `docs/` directory and the [Doc Map](../DOC_MAP.md) |
| CI pipeline | `.github/workflows/ci.yml` |
| NPM scripts reference | [NPM Scripts](./npm-scripts.md) |
| Coding standards | [Coding Standards](./coding-standards.md) |
| Contributing guide | [Contributing](./contributing.md) |
| Known issues | `FIXES_NEEDED.md` and `QUICK_FIXES.md` at the project root |
| Action plan / roadmap | `ACTION_PLAN.md` at the project root |

For questions, open a GitHub issue or reach out to the project maintainers.

---

## Common Gotchas for New Developers

### ESM import extensions

The server uses ES Modules. You **must** include `.js` extensions in TypeScript imports, even when the source file is `.ts`:

```typescript
// Correct
import UserModel from '../drizzle/models/User.js';

// Wrong -- will fail at runtime
import UserModel from '../drizzle/models/User';
```

### Two context directories

The client has both `src/context/` (ToastContext) and `src/contexts/` (AuthContext). This is a historical artifact. Check both directories when looking for a context provider.

### Duplicate game component locations

Some game components exist in both `src/components/games/` (legacy) and `src/games/` (primary). The `src/games/` versions are canonical. If you see duplicates, work in `src/games/`.

### Cookie-based authentication

Authentication uses HTTP-only cookies, not `Authorization` headers. The Axios instance in `client/src/services/api.js` is configured with `withCredentials: true`. If you add a new HTTP client or fetch call, you must include credentials or auth will not work.

### Socket authentication

Socket.IO connections also require authentication. The `socketAuth` middleware in `server/middleware/socket/socketAuth.ts` validates JWT tokens passed in the `auth` handshake option. If your socket connection is rejected, check that the user is logged in and the token cookie is being sent.

### BalanceService is the only way

Never modify user balances by writing directly to the database. Always use `BalanceService.placeBet()` and `BalanceService.recordWin()`. Direct writes bypass transaction logging and will cause balance inconsistencies.

### MySQL password special characters

If your MySQL password contains characters like `@`, `<`, `>`, or `&`, they must be URL-encoded in `DATABASE_URL`. Use `node encode-db-password.js` in the `server/` directory.

### Bun vs Node.js

The `npm run dev` server script uses Bun. If you do not have Bun installed, use `npm run start:ts` (Node.js with ts-node) or `npm run dev:full` (Node.js with nodemon) instead.

### Client path aliases

The client uses `@` as an alias for `src/`. Use `@/components/ui/Button` instead of relative paths like `../../../components/ui/Button`.

### TypeScript strictness

The server's `tsconfig.json` has `strict: false`. Some files use `// @ts-nocheck` at the top. This is technical debt, not a pattern to follow. Write type-safe code in new files.

---

## Glossary

| Term | Definition |
|------|-----------|
| **Namespace** | A Socket.IO namespace (e.g., `/crash`, `/roulette`). Each game runs in its own namespace for event isolation. |
| **Handler** | A server-side function in `server/src/socket/` that manages game logic and socket events for one namespace. |
| **BalanceService** | The singleton service that manages all user balance operations (bets, wins, adjustments). Found at `server/src/services/balanceService.ts`. |
| **LoggingService** | The service that persists structured game and system events to the `game_logs` table. Uses static methods. |
| **Drizzle** | The TypeScript ORM used to interact with MySQL. Schema is defined in `server/drizzle/schema.ts`. |
| **Model** | A wrapper around Drizzle queries for a single table (e.g., `User.ts`, `Transaction.ts`). Provides `findById`, `create`, `update` methods. |
| **Game module** | A self-contained directory in `client/src/games/` containing all components, socket services, and utilities for one game. |
| **Route guard** | A React component (`AuthGuard`, `AdminGuard`) that checks authentication before rendering a protected route. |
| **Seed** | The process of populating the database with initial data (admin account, player accounts, game stats) via `npm run seed`. |
| **Migration** | A SQL file in `server/drizzle/migrations/` generated by Drizzle Kit that applies schema changes to the database. |
| **Crash point** | The randomly generated multiplier at which the Crash game ends. Players must cash out before this point to win. |
| **House edge** | The mathematical advantage the casino has on each game. Calculated in `server/src/utils/gameUtils.ts`. |
| **HTTP-only cookie** | A cookie that cannot be read by JavaScript (prevents XSS attacks). Used to store the JWT authentication token. |
| **Namespace isolation** | The pattern of giving each game its own Socket.IO namespace so events from one game do not interfere with another. |

---

## Related Documents

- [Getting Started](./getting-started.md) -- environment setup guide (Day 1 prerequisite)
- [System Architecture](../02-architecture/system-architecture.md) -- architecture overview (Day 1 reading)
- [Data Flow](../02-architecture/data-flow.md) -- request lifecycle diagrams
- [Socket Architecture](../02-architecture/socket-architecture.md) -- namespace and handler patterns
- [Coding Standards](./coding-standards.md) -- conventions to follow when writing code
- [Project Structure](./project-structure.md) -- directory layout and file descriptions
- [NPM Scripts Reference](./npm-scripts.md) -- available commands for building and running
- [Contributing Guide](./contributing.md) -- PR workflow and review process
