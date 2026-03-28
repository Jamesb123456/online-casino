# Test Suite Documentation

Platinum Casino comprehensive test suite covering server and client codebases.

## Quick Start

```bash
# Run all server tests
cd server && npm test

# Run all client tests
cd client && npm test

# Run with coverage reports
cd server && npm run test:coverage
cd client && npm run test:coverage

# Watch mode (re-runs on file changes)
cd server && npm run test:watch
cd client && npm run test:watch
```

## Test Architecture

### Server Tests (`server/src/__tests__/`)

| Category | Directory | Framework | Description |
|----------|-----------|-----------|-------------|
| Unit - Services | `__tests__/` | Vitest | BalanceService, LoggingService, ProvablyFairService, RedisService |
| Unit - Utils | `__tests__/` | Vitest | Game utilities, Plinko physics |
| Unit - Middleware | `__tests__/` | Vitest | Auth, RequestId, SocketAuth, SocketRateLimit |
| Unit - Validation | `__tests__/` | Vitest | Zod schemas for all game events and admin operations |
| Unit - Models | `__tests__/models/` | Vitest | User, Transaction, GameLog, GameSession, GameStat, LoginReward, Message |
| Unit - Handlers | `__tests__/` | Vitest | Crash, Roulette, Wheel, Landmines, Blackjack, Plinko, Chat socket handlers |
| Integration - Routes | `__tests__/routes/` | Vitest + Supertest | All API routes (auth, users, games, admin, leaderboard, rewards, etc.) |

### Client Tests (`client/src/__tests__/`)

| Category | Directory | Framework | Description |
|----------|-----------|-----------|-------------|
| Unit - UI Components | `__tests__/components/` | Vitest + RTL | Button, Card, Input, Modal, Badge, Table, Toast, Loading, ApiStatus |
| Unit - Contexts | `__tests__/contexts/` | Vitest + RTL | AuthContext, ToastContext |
| Unit - Services | `__tests__/services/` | Vitest | API service, Socket service |
| Unit - Guards | `__tests__/guards/` | Vitest + RTL | AuthGuard, AdminGuard |
| Component - Pages | `__tests__/pages/` | Vitest + RTL | Home, Login, Register, Profile, Games, Leaderboard, NotFound, Rewards |
| Component - Games | `__tests__/games/` | Vitest + RTL | Crash, Blackjack, Plinko, Roulette, Wheel, Landmines |
| Component - Layout | `__tests__/components/` | Vitest + RTL | Header, Footer |

## Testing Frameworks & Tools

### Server
- **Vitest** - Test runner with native TypeScript/ESM support
- **Supertest** - HTTP assertion library for Express route testing
- **@vitest/coverage-v8** - V8 code coverage provider

### Client
- **Vitest** - Test runner with jsdom environment
- **@testing-library/react** - React component testing utilities
- **@testing-library/user-event** - User interaction simulation
- **@testing-library/jest-dom** - Custom DOM matchers
- **@vitest/coverage-v8** - V8 code coverage provider

## Coverage Requirements

### Server
- **Lines:** 70%
- **Functions:** 65%
- **Branches:** 60%
- **Statements:** 70%

### Client
- **Lines:** 60%
- **Functions:** 55%
- **Branches:** 50%
- **Statements:** 60%

Coverage reports are generated in `coverage/` directories (HTML, LCOV, JSON).

## How to Add New Tests

### Server Unit Test Template

```typescript
// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Define mock functions with vi.hoisted()
const { mockDependency } = vi.hoisted(() => ({
  mockDependency: vi.fn(),
}));

// 2. Mock modules with .js extensions (ESM)
vi.mock('../path/to/dependency.js', () => ({
  default: { method: mockDependency },
}));

// 3. Import module under test AFTER mocks
import ModuleUnderTest from '../path/to/module.js';

describe('ModuleUnderTest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do something', () => {
    // Arrange
    mockDependency.mockReturnValue('result');
    // Act
    const result = ModuleUnderTest.method();
    // Assert
    expect(result).toBe('expected');
  });
});
```

### Client Component Test Template

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Component from '@/components/Component';

describe('Component', () => {
  it('should render correctly', () => {
    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    );
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### Socket Handler Test Template

```typescript
// @ts-nocheck
// ... mocks ...

function createMockSocket(user = { userId: 1, username: 'test', balance: '1000' }) {
  const eventHandlers = new Map();
  return {
    id: `socket_${Math.random().toString(36).slice(2)}`,
    user,
    emit: vi.fn(),
    broadcast: { emit: vi.fn() },
    disconnect: vi.fn(),
    on: vi.fn((event, handler) => eventHandlers.set(event, handler)),
    _trigger: async (event, ...args) => {
      const handler = eventHandlers.get(event);
      if (handler) return handler(...args);
    },
  };
}

function createMockNamespace() {
  const connectionHandlers = [];
  return {
    emit: vi.fn(),
    on: vi.fn((event, handler) => {
      if (event === 'connection') connectionHandlers.push(handler);
    }),
    _simulateConnection: (socket) => {
      for (const h of connectionHandlers) h(socket);
    },
  };
}
```

## Mocking Patterns

### Database Mocks (Drizzle ORM)
All database operations are mocked via `vi.mock()` on `drizzle/db.js`. The mock `db` object provides chainable methods: `select().from().where()`, `insert().values()`, `update().set().where()`, etc.

### Service Mocks
External services (Redis, logging, auth) are always mocked. Each service mock uses `vi.hoisted()` for the mock functions.

### Socket.IO Mocks
Socket handlers are tested with mock namespace/socket objects that simulate the Socket.IO API. Use `_trigger()` to simulate incoming events and `emit` spy to verify outgoing events.

### Auth Mocks
For route tests, the `authenticate` middleware is mocked to inject a test user. For socket tests, `socket.user` is set directly.

## Naming Conventions

- Test files: `*.test.ts` (server), `*.test.jsx` (client)
- Describe blocks: match the module/component name
- Test descriptions: start with "should" for clarity

## CI Integration

Tests run automatically on:
- Every push to `main`/`master`
- Every pull request targeting `main`/`master`

The CI pipeline:
1. **Lint** - ESLint on client code
2. **Build** - TypeScript check + build for both server and client
3. **Test** - Runs both test suites with coverage enforcement
4. **Security** - `npm audit` on both packages

Coverage reports are uploaded as CI artifacts and retained for 14 days.

## Troubleshooting

### Common Issues

**"Cannot find module" errors in server tests:**
Ensure mock paths use `.js` extensions (ESM convention), even for `.ts` source files.

**JSDOM errors in client tests:**
Ensure vitest config has `environment: 'jsdom'` and setup file imports `@testing-library/jest-dom`.

**Timeout errors:**
Default timeout is 10s. For long-running tests, increase with `{ timeout: 30000 }` in the test options.

**Mock not working:**
Ensure `vi.mock()` calls are at the top level (not inside describe/it blocks) and that `vi.clearAllMocks()` is called in `beforeEach`.
