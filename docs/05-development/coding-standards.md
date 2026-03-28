# Coding Standards

Conventions, patterns, and practices used throughout the Platinum Casino codebase. These are derived from the existing code rather than aspirational -- follow them to maintain consistency.

## Language and Module System

### Server

- **Language:** TypeScript (`.ts` files throughout `server/src/`, `server/routes/`, `server/drizzle/`)
- **Module system:** ES Modules (`"type": "module"` in `package.json`)
- **Import extensions:** Always include `.js` extensions in import paths, even when importing `.ts` files. This is required by the ESM loader.
  ```typescript
  import UserModel from '../drizzle/models/User.js';
  import LoggingService from '../services/loggingService.js';
  ```
- **TypeScript strictness:** The `tsconfig.json` has `strict: false` with most strict checks individually disabled. The codebase uses `// @ts-nocheck` at the top of files that predate full type coverage.
- **Target:** ES2022

### Client

- **Language:** JavaScript with JSX (`.jsx` files for components, `.js` for utilities and services)
- **Module system:** ES Modules (`"type": "module"` in `package.json`)
- **Build tool:** Vite 5 with `@vitejs/plugin-react`
- **Path aliases:** `@` is aliased to `/src` in `vite.config.js`
  ```jsx
  import Button from '@/components/ui/Button';
  ```

## File Naming Conventions

| Category | Convention | Examples |
|----------|-----------|----------|
| React components | PascalCase `.jsx` | `CrashGame.jsx`, `BlackjackTable.jsx`, `AuthGuard.jsx` |
| Utility/helper files | camelCase `.js` or `.ts` | `blackjackUtils.js`, `gameUtils.ts`, `plinkoUtils.ts` |
| Socket services (client) | camelCase with `SocketService` suffix | `crashSocketService.js`, `wheelSocketService.js` |
| Socket handlers (server) | camelCase with `Handler` suffix | `crashHandler.ts`, `rouletteHandler.ts` |
| Service classes (server) | camelCase with `Service` suffix | `balanceService.ts`, `loggingService.ts` |
| API services (client) | camelCase with `Service` suffix | `authService.js`, `gameService.js`, `adminService.js` |
| Drizzle models | PascalCase `.ts` | `User.ts`, `Transaction.ts`, `GameLog.ts` |
| Page components | PascalCase with `Page` suffix | `HomePage.jsx`, `CrashPage.jsx`, `LoginPage.jsx` |
| Context providers | PascalCase with `Context` suffix | `AuthContext.jsx`, `ToastContext.jsx` |

## Directory Organization Patterns

### Game module pattern (client)

Each game lives in its own directory under `src/games/` with a consistent structure:

```
src/games/<game-name>/
├── <GameName>Game.jsx           # Main game container component
├── <GameName>Board.jsx          # Game board / visual display
├── <GameName>BettingPanel.jsx   # Bet controls
├── <GameName>ActiveBets.jsx     # Active bets list (multiplayer games)
├── <GameName>PlayersList.jsx    # Connected players (multiplayer games)
├── <gameName>SocketService.js   # Socket.IO event wrappers
└── <gameName>Utils.js           # Game-specific helper functions
```

### Socket handler pattern (server)

Each game has a dedicated Socket.IO namespace handler in `server/src/socket/`. Handlers follow this structure:

```typescript
// Export a default function that receives the Socket.IO namespace
export default function initCrashHandlers(namespace) {
  // Local game state
  const gameState = { ... };

  // Connection handler
  namespace.on('connection', (socket) => {
    // Event listeners
    socket.on('place_bet', async (data) => { ... });
    socket.on('cash_out', async (data) => { ... });

    // Disconnect cleanup
    socket.on('disconnect', () => { ... });
  });
}
```

Key characteristics:
- One handler function per game, receiving a Socket.IO namespace
- Game state is scoped within the handler function closure
- Multiplayer games (crash, roulette, wheel) maintain shared state across all connected players
- Single-player games (blackjack, landmines, plinko) maintain per-user state via Maps

## Service Layer Patterns

### Server services (class-based singletons)

Services on the server are implemented as classes exported as singleton instances:

```typescript
class BalanceService {
  async placeBet(userId, betAmount, gameType, metadata = {}) { ... }
  async recordWin(userId, betAmount, winAmount, gameType, metadata = {}) { ... }
  async getBalance(userId) { ... }
}

export default new BalanceService();
```

`LoggingService` is the exception -- it uses static methods instead of instance methods, so it does not need instantiation:

```typescript
class LoggingService {
  static async logGameAction(userId, gameType, eventType, eventDetails = {}) { ... }
  static async logBetPlaced(gameType, sessionId, userId, amount) { ... }
}

export default LoggingService;
```

### Client services (plain functions or objects)

Client-side services export functions or object literals rather than classes:

```javascript
// authService.js
const authService = {
  login: async (username, password) => { ... },
  register: async (username, password) => { ... },
  logout: async () => { ... },
  getCurrentUser: async () => { ... },
};
export default authService;
```

## Authentication Pattern

### JWT in HTTP-only cookies

Authentication uses Better Auth sessions stored in HTTP-only cookies -- not in `localStorage` or `Authorization` headers.

**Server side** (`middleware/auth.ts`):
```typescript
const session = await auth.api.getSession({
  headers: fromNodeHeaders(req.headers),
});
(req as AuthenticatedRequest).user = {
  userId: Number(session.user.id),
  username: session.user.username || session.user.name,
  role: session.user.role || 'user',
};
```

**Route protection middleware:**
- `authenticate` -- validates the Better Auth session and attaches user to the request
- `adminOnly` -- requires `role === 'admin'`
- `userOrAdmin` -- requires `role === 'user'` or `role === 'admin'`

**Client side:**
- `AuthContext` manages user state and exposes `login`/`logout` functions
- `AuthGuard` and `AdminGuard` components wrap protected routes
- Axios is configured with `withCredentials: true` so cookies are sent automatically

## Validation Pattern

### Zod schemas on route handlers

Request body validation uses Zod schemas defined inline in route files:

```typescript
import { z } from 'zod';

const registerSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(6).max(128),
});

router.post('/register', authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  }
  const { username, password } = parsed.data;
  // ...
});
```

## Database Patterns

### Drizzle ORM with MySQL

- **Schema definition:** All tables are defined in `server/drizzle/schema.ts` using Drizzle's `mysqlTable` builder
- **Relations:** Defined alongside tables using `relations()` from `drizzle-orm`
- **Type inference:** `InferSelectModel` and `InferInsertModel` generate TypeScript types from the schema
- **Models:** Each table has a corresponding model file in `drizzle/models/` that wraps common queries (find, create, update, delete)
- **Migrations:** Generated by Drizzle Kit into `drizzle/migrations/` as raw SQL files

### Enum handling

MySQL enums are defined as Drizzle enum types and reused across tables:

```typescript
export const userRoleEnum = mysqlEnum('user_role', ['user', 'admin']);
export const transactionTypeEnum = mysqlEnum('transaction_type', [
  'deposit', 'withdrawal', 'game_win', 'game_loss', 'admin_adjustment', 'bonus', 'login_reward'
]);
```

## Logging

### LoggingService

All game events, authentication actions, and admin operations are logged through `LoggingService` rather than ad-hoc `console.log` calls:

```typescript
await LoggingService.logBetPlaced('crash', sessionId, userId, amount);
await LoggingService.logBetResult('crash', sessionId, userId, betAmount, winAmount, isWin);
await LoggingService.logGameStart('roulette', sessionId, { players: count });
await LoggingService.logAuthAction(userId, 'login', { ip: req.ip });
await LoggingService.logAdminAction(adminId, 'balance_adjustment', { targetUser, amount });
```

Logs are persisted to the `game_logs` table in MySQL.

## Security Middleware

The server applies the following security measures:

- **Helmet** -- sets security-related HTTP headers
- **CORS** -- restricted to `CLIENT_URL` with credentials enabled
- **Rate limiting** -- `express-rate-limit` on authentication endpoints (5 requests per 15 minutes)
- **Cookie-parser** -- parses HTTP-only auth cookies

## State Management (Client)

- **Authentication state:** React Context (`AuthContext`)
- **Toast notifications:** React Context (`ToastContext`)
- **Game state:** Local component state within each game module
- **Redux Toolkit:** Installed as a dependency but not yet actively used

## Styling

- **Framework:** Tailwind CSS v4 via `@tailwindcss/vite` plugin
- **Approach:** Utility-first classes directly in JSX
- **Theme:** Shared values in `src/styles/theme.js` and `src/styles/styleGuide.js`

## Code Quality

- **Linting:** ESLint configured for `.js` and `.jsx` files with React and React Hooks plugins
- **Zero warnings policy:** `--max-warnings 0` flag in the lint script
- **CI checks:** TypeScript type checking (`tsc --noEmit`) and production builds on every push and pull request

---

## Related Documents

- [Project Structure](./project-structure.md) -- where each pattern is applied in the directory tree
- [Getting Started](./getting-started.md) -- setup instructions referencing these tools and conventions
- [NPM Scripts Reference](./npm-scripts.md) -- build, lint, and dev commands
- [System Architecture](../02-architecture/system-architecture.md) -- how these patterns fit the overall architecture
- [Socket Architecture](../02-architecture/socket-architecture.md) -- detailed socket handler design
- [Data Flow](../02-architecture/data-flow.md) -- how services, middleware, and handlers interact at runtime
