# Test Infrastructure

## Overview

Platinum Casino uses [Vitest](https://vitest.dev/) as the test runner for both the server and client. Each has its own configuration file, coverage thresholds, and directory conventions. Tests are organized by layer and feature to make it straightforward to find and maintain them.

---

## Client Test Configuration

**File:** `client/vitest.config.js`

| Setting              | Value                                                    |
|----------------------|----------------------------------------------------------|
| **Framework**        | Vitest with `@vitejs/plugin-react`                       |
| **Environment**      | `jsdom` (simulates a browser DOM)                        |
| **Setup file**       | `./src/test/setup.js`                                    |
| **Test patterns**    | `src/**/*.test.{js,jsx}`, `src/**/*.spec.{js,jsx}`      |
| **Timeout**          | 10 seconds per test                                      |
| **Path alias**       | `@` resolves to `./src`                                  |
| **Coverage provider**| V8                                                       |

### Setup File

**File:** `client/src/test/setup.js`

The setup file imports `@testing-library/jest-dom`, which adds custom DOM matchers to the `expect` API (e.g., `toBeInTheDocument()`, `toHaveTextContent()`, `toBeVisible()`).

```js
import '@testing-library/jest-dom';
```

### Coverage Thresholds

| Metric       | Minimum |
|--------------|---------|
| Lines        | 30%     |
| Functions    | 25%     |
| Branches     | 20%     |
| Statements   | 30%     |

### Coverage Reporters

`text`, `text-summary`, `lcov`, `html`, `json-summary`

### Coverage Exclusions

| Excluded path       | Reason                              |
|---------------------|-------------------------------------|
| `src/test/**`       | Test utilities and setup files      |
| `**/*.test.*`       | Test files themselves               |
| `**/*.spec.*`       | Spec files themselves               |
| `src/main.jsx`      | Application entry point             |

---

## Server Test Configuration

**File:** `server/vitest.config.ts`

| Setting              | Value                                                    |
|----------------------|----------------------------------------------------------|
| **Framework**        | Vitest                                                   |
| **Environment**      | `node`                                                   |
| **Test patterns**    | `**/*.test.ts`, `**/*.spec.ts`                           |
| **Timeout**          | 10 seconds per test                                      |
| **Pool**             | `forks` (separate process per test file)                 |
| **Coverage provider**| V8                                                       |

### Why `forks` Pool?

The server tests use the `forks` pool to run each test file in a separate child process. This provides strong isolation between test files, preventing shared state from database connections, socket handlers, or singleton services from leaking between suites.

### Coverage Thresholds

| Metric       | Minimum |
|--------------|---------|
| Lines        | 50%     |
| Functions    | 45%     |
| Branches     | 40%     |
| Statements   | 50%     |

### Coverage Reporters

`text`, `text-summary`, `lcov`, `html`, `json-summary`

### Coverage Inclusions

| Included path             | Content                        |
|---------------------------|--------------------------------|
| `src/**/*.ts`             | Services, handlers, utilities  |
| `routes/**/*.ts`          | HTTP route handlers            |
| `middleware/**/*.ts`       | HTTP and socket middleware      |
| `drizzle/models/**/*.ts`  | Drizzle ORM model definitions  |

### Coverage Exclusions

| Excluded path       | Reason                                    |
|---------------------|-------------------------------------------|
| `**/*.test.ts`      | Test files themselves                     |
| `**/*.spec.ts`      | Spec files themselves                     |
| `dist/**`           | Compiled output                           |
| `scripts/**`        | One-off scripts (seed, migrate, etc.)     |
| `drizzle/db.ts`     | Database connection setup (infrastructure)|
| `drizzle/schema.ts` | Schema definitions (declarative)          |
| `lib/auth.ts`       | Better Auth configuration (third-party)   |

---

## Test Directory Structure

### Server: `server/src/__tests__/`

```
server/src/__tests__/
  models/                        # Drizzle model unit tests
    GameLog.test.ts
    GameSession.test.ts
    GameStat.test.ts
    LoginReward.test.ts
    Message.test.ts
    Transaction.test.ts
    User.test.ts
  routes/                        # HTTP route integration tests
    admin.test.ts
    auth.test.ts
    games.test.ts
    leaderboard.test.ts
    loginRewards.test.ts
    responsibleGaming.test.ts
    users.test.ts
    verify.test.ts
  authMiddleware.test.ts         # HTTP auth middleware
  balanceService.test.ts         # Balance service logic
  blackjackHandler.test.ts       # Blackjack socket handler
  chatHandler.test.ts            # Chat socket handler
  crashHandler.test.ts           # Crash game socket handler
  edgeCases.test.ts              # Cross-cutting edge cases
  gameUtils.test.ts              # Shared game utilities
  landminesHandler.test.ts       # Landmines socket handler
  loggingService.test.ts         # Winston logging service
  plinkoHandler.test.ts          # Plinko socket handler
  plinkoUtils.test.ts            # Plinko-specific utilities
  provablyFairService.test.ts    # Provably fair RNG service
  redisService.test.ts           # Redis service layer
  requestId.test.ts              # Request ID middleware
  rouletteHandler.test.ts        # Roulette socket handler
  schemas.test.ts                # Zod validation schemas
  security.test.ts               # Security-related tests
  smoke.test.ts                  # Basic smoke tests
  socketAuth.test.ts             # Socket authentication middleware
  socketRateLimit.test.ts        # Socket rate limiting middleware
  wheelHandler.test.ts           # Wheel game socket handler
```

### Client: `client/src/__tests__/`

```
client/src/__tests__/
  components/                    # UI component tests
    ApiStatus.test.jsx
    Badge.test.jsx
    Button.test.jsx
    Card.test.jsx
    Footer.test.jsx
    Header.test.jsx
    Input.test.jsx
    Loading.test.jsx
    Modal.test.jsx
    Table.test.jsx
    Toast.test.jsx
  contexts/                      # React context tests
    AuthContext.test.jsx
    ToastContext.test.jsx
  games/                         # Game component tests
    BlackjackGame.test.jsx
    CrashGame.test.jsx
    LandminesGame.test.jsx
    PlinkoGame.test.jsx
    RouletteGame.test.jsx
    WheelGame.test.jsx
  guards/                        # Route guard tests
    AdminGuard.test.jsx
    AuthGuard.test.jsx
  pages/                         # Page component tests
    GamesPage.test.jsx
    HomePage.test.jsx
    LeaderboardPage.test.jsx
    LoginPage.test.jsx
    NotFoundPage.test.jsx
    ProfilePage.test.jsx
    RegisterPage.test.jsx
    RewardsPage.test.jsx
  services/                      # Service layer tests
    api.test.js
    socketService.test.js
  security.test.js               # Client-side security tests
  smoke.test.jsx                 # Basic smoke tests
```

---

## Running Tests

### Client

```bash
cd client

# Run all tests
npm test

# Run tests in watch mode
npx vitest

# Run tests with coverage
npm run test:coverage

# Run a specific test file
npx vitest src/__tests__/components/Button.test.jsx

# Run tests matching a pattern
npx vitest --filter "Modal"
```

### Server

```bash
cd server

# Run all tests
npm test

# Run tests in watch mode
npx vitest

# Run tests with coverage
npm run test:coverage

# Run a specific test file
npx vitest src/__tests__/schemas.test.ts

# Run tests matching a pattern
npx vitest --filter "crash"
```

### Both (via Makefile)

```bash
# Run all tests (server + client)
make test

# Run all tests with coverage
make test-coverage
```

---

## Writing Tests

### Server Test Conventions

- Test files live in `server/src/__tests__/` and mirror the source structure.
- Use `.test.ts` extension.
- Socket handler tests should mock the Socket.IO namespace and socket objects.
- Service tests should mock database calls via Drizzle.
- Route tests should test the full HTTP request/response cycle.

### Client Test Conventions

- Test files live in `client/src/__tests__/` organized by category.
- Use `.test.jsx` for component tests and `.test.js` for non-component tests.
- Use `@testing-library/react` for rendering and interacting with components.
- Use `@testing-library/jest-dom` matchers for DOM assertions.
- Mock API calls and socket services to isolate component behavior.
- Wrap components that consume context in the appropriate providers.

---

## Related Documents

- [Testing Strategy](./testing-strategy.md) -- Overall testing philosophy and priorities
- [Test Examples](./test-examples.md) -- Concrete test patterns and examples
- [CI/CD Pipeline](../06-devops/ci-cd.md) -- How tests run in continuous integration
- [Validation Schemas](../03-features/validation-schemas.md) -- The Zod schemas tested in `schemas.test.ts`
