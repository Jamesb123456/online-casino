# Testing Strategy

This document defines the testing approach for the Platinum Casino project, covering frameworks, configuration, naming conventions, real test examples, mocking patterns, coverage targets, and CI integration.

---

## Table of Contents

- [Frameworks and Tooling](#frameworks-and-tooling)
- [Test File Naming Conventions](#test-file-naming-conventions)
- [Framework Setup](#framework-setup)
  - [Server Vitest Configuration](#server-vitest-configuration)
  - [Client Vitest Configuration](#client-vitest-configuration)
- [Running Tests](#running-tests)
- [Unit Test Examples](#unit-test-examples)
  - [BalanceService.placeBet()](#balanceserviceplacebet)
  - [BalanceService.hasSufficientBalance()](#balanceservicehasssufficientbalance)
- [Integration Test Examples](#integration-test-examples)
  - [POST /api/auth/register](#post-apiauthregister)
  - [POST /api/auth/login](#post-apiauthlogin)
- [Component Test Examples](#component-test-examples)
  - [Button Component](#button-component)
  - [AuthContext](#authcontext)
- [Mocking Patterns](#mocking-patterns)
  - [Database Model Mocks](#database-model-mocks)
  - [Service Layer Mocks](#service-layer-mocks)
  - [External Library Mocks](#external-library-mocks)
- [Coverage Configuration and Targets](#coverage-configuration-and-targets)
- [CI Integration](#ci-integration)
- [Related Documents](#related-documents)

---

## Frameworks and Tooling

| Layer | Tool | Purpose |
|---|---|---|
| Server test runner | [Vitest](https://vitest.dev/) | Fast, ESM-native test runner |
| Server coverage | [@vitest/coverage-v8](https://vitest.dev/guide/coverage.html) | V8-based code coverage |
| Server HTTP testing | [supertest](https://github.com/ladjs/supertest) | HTTP assertion library for Express routes |
| Client test runner | [Vitest](https://vitest.dev/) | Shared runner with server |
| Client DOM | [@testing-library/react](https://testing-library.com/docs/react-testing-library/intro/) | React component rendering |
| Client assertions | [@testing-library/jest-dom](https://github.com/testing-library/jest-dom) | DOM-specific matchers (`toBeInTheDocument`, `toHaveTextContent`) |
| E2E | [Playwright](https://playwright.dev/) | Cross-browser end-to-end testing |

---

## Test File Naming Conventions

Tests are co-located next to the source files they cover. Integration and E2E tests live in dedicated `__tests__/` directories.

```
server/
  src/
    services/
      balanceService.ts
      balanceService.test.ts          # Unit test (co-located)
    utils/
      gameUtils.ts
      gameUtils.test.ts               # Unit test (co-located)
      plinkoUtils.ts
      plinkoUtils.test.ts             # Unit test (co-located)
  routes/
    auth.ts
  __tests__/
    integration/
      auth.test.ts                    # Integration test
      admin.test.ts                   # Integration test
    e2e/
      gameFlow.test.ts                # E2E test

client/
  src/
    components/
      ui/
        Button.jsx
        Button.test.jsx               # Component test (co-located)
    contexts/
      AuthContext.jsx
      AuthContext.test.jsx             # Context test (co-located)
    __tests__/
      e2e/
        userJourney.test.ts            # E2E test
```

**Pattern rules:**

- Unit and component tests: `<filename>.test.ts` or `<filename>.test.jsx` next to the source file.
- Integration tests: `server/__tests__/integration/<area>.test.ts`.
- E2E tests: `server/__tests__/e2e/<flow>.test.ts` or `client/src/__tests__/e2e/<flow>.test.ts`.

---

## Framework Setup

### Server Vitest Configuration

Install dependencies:

```bash
cd server
npm install -D vitest @vitest/coverage-v8 supertest @types/supertest
```

Create `server/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: '.',
    include: [
      'src/**/*.test.ts',
      '__tests__/**/*.test.ts'
    ],
    exclude: [
      'node_modules',
      'dist',
      '__tests__/e2e/**'           // E2E tests run separately via Playwright
    ],
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/services/**/*.ts',
        'src/utils/**/*.ts',
        'src/socket/**/*.ts',
        'routes/**/*.ts',
        'middleware/**/*.ts'
      ],
      exclude: [
        '**/*.test.ts',
        'drizzle/migrations/**'
      ],
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50
      }
    },
    // Prevent tests from running in parallel when they share database state
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});
```

Create the test setup file at `server/test/setup.ts`:

```ts
import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Suppress console output during tests
beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Set required environment variables for tests
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';
```

Add scripts to `server/package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:unit": "vitest run --include 'src/**/*.test.ts'",
    "test:integration": "vitest run --include '__tests__/integration/**/*.test.ts'"
  }
}
```

### Client Vitest Configuration

Install dependencies:

```bash
cd client
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

Create `client/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['node_modules', 'dist', 'src/__tests__/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/components/**/*.{js,jsx}',
        'src/contexts/**/*.{js,jsx}',
        'src/services/**/*.{js,jsx}',
        'src/hooks/**/*.{js,jsx}'
      ],
      exclude: ['**/*.test.*', 'src/test/**'],
      thresholds: {
        statements: 50,
        branches: 40,
        functions: 50,
        lines: 50
      }
    },
    css: false        // Skip CSS processing in tests for speed
  }
});
```

Create the client test setup file at `client/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Add scripts to `client/package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## Running Tests

```bash
# ---- Server ----
cd server

# Run all server tests once
npm test

# Run tests in watch mode during development
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# ---- Client ----
cd client

# Run all client tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# ---- E2E ----
# From project root
npx playwright test
npx playwright test --ui          # Interactive UI mode
npx playwright show-report        # View HTML report
```

---

## Unit Test Examples

### BalanceService.placeBet()

File: `server/src/services/balanceService.test.ts`

This test verifies that `placeBet()` calls `updateBalance()` with the bet amount negated and the correct transaction type. The database models are fully mocked so the test runs in isolation.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Drizzle model imports BEFORE importing the service
vi.mock('../../drizzle/models/User.js', () => ({
  default: {
    findById: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../../drizzle/models/Transaction.js', () => ({
  default: {
    create: vi.fn(),
  },
}));

vi.mock('../../drizzle/models/Balance.js', () => ({
  default: {
    create: vi.fn(),
  },
}));

import balanceService from './balanceService.js';
import UserModel from '../../drizzle/models/User.js';
import TransactionModel from '../../drizzle/models/Transaction.js';
import BalanceModel from '../../drizzle/models/Balance.js';

describe('BalanceService.placeBet()', () => {
  const userId = 1;
  const betAmount = 50;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default stubs: user has enough balance
    vi.mocked(UserModel.findById).mockResolvedValue({
      id: userId,
      username: 'testuser',
      balance: '500.00',
      role: 'user',
      isActive: true,
    } as any);

    vi.mocked(TransactionModel.create).mockResolvedValue({
      id: 1,
      userId,
      amount: (-betAmount).toString(),
      type: 'game_loss',
      status: 'completed',
    } as any);

    vi.mocked(UserModel.update).mockResolvedValue({
      id: userId,
      balance: '450.00',
    } as any);

    vi.mocked(BalanceModel.create).mockResolvedValue({} as any);
  });

  it('deducts the bet amount from the user balance', async () => {
    const result = await balanceService.placeBet(userId, betAmount, 'crash');

    // The bet amount is passed as a negative value to updateBalance
    expect(UserModel.findById).toHaveBeenCalledWith(userId);
    expect(TransactionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        amount: (-betAmount).toString(),
        type: 'game_loss',
        gameType: 'crash',
        status: 'completed',
      })
    );
    expect(UserModel.update).toHaveBeenCalledWith(userId, { balance: '450' });
    expect(result.transaction).toBeDefined();
    expect(result.user).toBeDefined();
  });

  it('always negates the bet amount even if a positive value is provided', async () => {
    await balanceService.placeBet(userId, 25, 'plinko');

    // placeBet passes -Math.abs(betAmount) to updateBalance
    expect(TransactionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '-25' })
    );
  });

  it('throws when the user does not exist', async () => {
    vi.mocked(UserModel.findById).mockResolvedValue(null);

    await expect(
      balanceService.placeBet(userId, betAmount, 'crash')
    ).rejects.toThrow('User not found');
  });

  it('throws when the user has insufficient balance', async () => {
    vi.mocked(UserModel.findById).mockResolvedValue({
      id: userId,
      balance: '10.00',
    } as any);

    await expect(
      balanceService.placeBet(userId, 50, 'crash')
    ).rejects.toThrow('Insufficient balance');
  });

  it('forwards metadata to the transaction record', async () => {
    const metadata = { autoCashoutAt: 2.5, gameId: 'game_123' };

    await balanceService.placeBet(userId, betAmount, 'crash', metadata);

    expect(TransactionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ metadata })
    );
  });
});
```

### BalanceService.hasSufficientBalance()

```ts
describe('BalanceService.hasSufficientBalance()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when balance is greater than the requested amount', async () => {
    vi.mocked(UserModel.findById).mockResolvedValue({
      id: 1,
      balance: '500.00',
    } as any);

    const result = await balanceService.hasSufficientBalance(1, 100);
    expect(result).toBe(true);
  });

  it('returns true when balance equals the requested amount exactly', async () => {
    vi.mocked(UserModel.findById).mockResolvedValue({
      id: 1,
      balance: '100.00',
    } as any);

    const result = await balanceService.hasSufficientBalance(1, 100);
    expect(result).toBe(true);
  });

  it('returns false when balance is less than the requested amount', async () => {
    vi.mocked(UserModel.findById).mockResolvedValue({
      id: 1,
      balance: '50.00',
    } as any);

    const result = await balanceService.hasSufficientBalance(1, 100);
    expect(result).toBe(false);
  });

  it('returns false when the user does not exist', async () => {
    vi.mocked(UserModel.findById).mockResolvedValue(null);

    const result = await balanceService.hasSufficientBalance(999, 100);
    expect(result).toBe(false);
  });

  it('returns false when an unexpected error occurs', async () => {
    vi.mocked(UserModel.findById).mockRejectedValue(new Error('DB down'));

    const result = await balanceService.hasSufficientBalance(1, 100);
    expect(result).toBe(false);
  });
});
```

---

## Integration Test Examples

Integration tests exercise full Express route handlers with mocked database models but real middleware, validation, and serialization logic. The server app is imported and driven with `supertest`.

### POST /api/auth/register

File: `server/__tests__/integration/auth.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

// Mock models before importing the router
vi.mock('../../drizzle/models/User.js', () => ({
  default: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../../drizzle/models/Balance.js', () => ({
  default: {
    create: vi.fn(),
  },
}));

vi.mock('../../src/services/loggingService.js', () => ({
  default: {
    logAuthAction: vi.fn(),
    logSystemEvent: vi.fn(),
  },
}));

import authRouter from '../../routes/auth.js';
import UserModel from '../../drizzle/models/User.js';
import Balance from '../../drizzle/models/Balance.js';

// Build a minimal Express app that mirrors the real server mount
function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  return app;
}

describe('POST /api/auth/register', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('creates a new user and returns 201 with user data', async () => {
    vi.mocked(UserModel.findOne).mockResolvedValue(null); // no existing user
    vi.mocked(UserModel.create).mockResolvedValue({
      id: 1,
      username: 'newplayer',
      role: 'user',
      balance: '1000',
      isActive: true,
    } as any);
    vi.mocked(Balance.create).mockResolvedValue({} as any);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'newplayer', password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual(
      expect.objectContaining({
        id: 1,
        username: 'newplayer',
        role: 'user',
        balance: 1000,
      })
    );
    // HTTP-only cookie is set
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/authToken=/);
  });

  it('returns 400 when the username already exists', async () => {
    vi.mocked(UserModel.findOne).mockResolvedValue({ id: 99, username: 'taken' } as any);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'taken', password: 'secret123' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Username already exists');
  });

  it('returns 400 when payload validation fails', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'ab', password: '123' }); // too short

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid payload');
    expect(res.body.errors).toBeDefined();
  });

  it('returns 400 when the body is empty', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({});

    expect(res.status).toBe(400);
  });

  it('creates an initial balance record with the welcome bonus', async () => {
    vi.mocked(UserModel.findOne).mockResolvedValue(null);
    vi.mocked(UserModel.create).mockResolvedValue({
      id: 5,
      username: 'bonususer',
      role: 'user',
    } as any);
    vi.mocked(Balance.create).mockResolvedValue({} as any);

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'bonususer', password: 'password1' });

    expect(Balance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 5,
        amount: '1000',
        type: 'deposit',
      })
    );
  });
});
```

### POST /api/auth/login

```ts
import bcrypt from 'bcryptjs';

describe('POST /api/auth/login', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns user data and sets an auth cookie on valid credentials', async () => {
    const hashedPassword = await bcrypt.hash('mypassword', 12);

    vi.mocked(UserModel.findOne).mockResolvedValue({
      id: 1,
      username: 'player1',
      passwordHash: hashedPassword,
      role: 'user',
      balance: '250.50',
      isActive: true,
    } as any);

    // Also mock updateById for the lastLogin update
    (UserModel as any).updateById = vi.fn().mockResolvedValue({});

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'player1', password: 'mypassword' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Login successful');
    expect(res.body.user.balance).toBe(250.5);
    expect(res.headers['set-cookie'][0]).toMatch(/authToken=/);
  });

  it('returns 401 for a non-existent username', async () => {
    vi.mocked(UserModel.findOne).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ghost', password: 'anything' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('returns 401 for an incorrect password', async () => {
    const hashedPassword = await bcrypt.hash('rightpassword', 12);

    vi.mocked(UserModel.findOne).mockResolvedValue({
      id: 1,
      username: 'player1',
      passwordHash: hashedPassword,
      isActive: true,
    } as any);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'player1', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('returns 401 when the account is disabled', async () => {
    const hashedPassword = await bcrypt.hash('mypassword', 12);

    vi.mocked(UserModel.findOne).mockResolvedValue({
      id: 1,
      username: 'banned',
      passwordHash: hashedPassword,
      isActive: false,
    } as any);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'banned', password: 'mypassword' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Account is disabled');
  });

  it('returns 400 for invalid payload (short username)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ab', password: 'secret123' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid payload');
  });
});
```

---

## Component Test Examples

### Button Component

File: `client/src/components/ui/Button.test.jsx`

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from './Button';

describe('Button component', () => {
  it('renders children text', () => {
    render(<Button>Place Bet</Button>);
    expect(screen.getByRole('button', { name: /place bet/i })).toBeInTheDocument();
  });

  it('applies the primary variant by default', () => {
    render(<Button>Primary</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-primary');
  });

  it('applies the danger variant classes', () => {
    render(<Button variant="danger">Delete</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-red-600');
  });

  it('applies size classes', () => {
    render(<Button size="lg">Large</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('py-3');
    expect(btn.className).toContain('px-6');
  });

  it('renders full width when fullWidth is true', () => {
    render(<Button fullWidth>Full Width</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('w-full');
  });

  it('applies disabled styling and prevents clicks', async () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);
    const btn = screen.getByRole('button');

    expect(btn).toBeDisabled();
    expect(btn.className).toContain('opacity-50');
    expect(btn.className).toContain('cursor-not-allowed');

    await userEvent.click(btn);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);

    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('defaults to type="button"', () => {
    render(<Button>Default Type</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('can be rendered as type="submit"', () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('applies the glow class when glow prop is true', () => {
    render(<Button glow>Glow</Button>);
    expect(screen.getByRole('button').className).toContain('shadow-glow');
  });

  it('merges custom className', () => {
    render(<Button className="my-extra-class">Custom</Button>);
    expect(screen.getByRole('button').className).toContain('my-extra-class');
  });
});
```

### AuthContext

File: `client/src/contexts/AuthContext.test.jsx`

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, AuthContext } from './AuthContext';
import React, { useContext } from 'react';

// Mock the services that AuthContext depends on
vi.mock('../services/authService', () => ({
  default: {
    getCurrentUser: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  },
}));

vi.mock('../services/socketService', () => ({
  default: {
    initializeSocket: vi.fn(),
    disconnectSocket: vi.fn(),
  },
}));

import authService from '../services/authService';
import socketService from '../services/socketService';

// Helper component to consume and expose context values for testing
function AuthConsumer() {
  const { user, loading, error, isAuthenticated, login, logout, register, updateBalance } =
    useContext(AuthContext);
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="error">{error || 'none'}</span>
      {user && <span data-testid="username">{user.username}</span>}
      {user && <span data-testid="balance">{user.balance}</span>}
      <button onClick={() => login({ username: 'player1', password: 'pw' })}>Login</button>
      <button onClick={() => logout()}>Logout</button>
      <button onClick={() => register({ username: 'newuser', password: 'pw123' })}>Register</button>
      <button onClick={() => updateBalance(999)}>Update Balance</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // By default the initial session check finds no user
    vi.mocked(authService.getCurrentUser).mockRejectedValue(new Error('No session'));
  });

  it('starts in a loading state and resolves to unauthenticated', async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    // After the initial auth check finishes, loading should be false
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('error').textContent).toBe('none');
  });

  it('restores an existing session on mount', async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue({
      id: 1,
      username: 'returning_player',
      balance: 500,
    });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });
    expect(screen.getByTestId('username').textContent).toBe('returning_player');
  });

  it('sets user state after a successful login', async () => {
    vi.mocked(authService.login).mockResolvedValue({
      user: { id: 1, username: 'player1', balance: 1000 },
      token: 'jwt-token-here',
    });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    // Click login
    await userEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });
    expect(screen.getByTestId('username').textContent).toBe('player1');
    expect(socketService.disconnectSocket).toHaveBeenCalled();
    expect(socketService.initializeSocket).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'jwt-token-here', userId: 1 })
    );
  });

  it('clears user state after logout', async () => {
    // Start authenticated
    vi.mocked(authService.getCurrentUser).mockResolvedValue({
      id: 1,
      username: 'player1',
      balance: 1000,
    });
    vi.mocked(authService.logout).mockResolvedValue(undefined);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });

    await userEvent.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('false');
    });
    expect(socketService.disconnectSocket).toHaveBeenCalled();
  });

  it('updates the balance in user state', async () => {
    vi.mocked(authService.getCurrentUser).mockResolvedValue({
      id: 1,
      username: 'player1',
      balance: 1000,
    });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('balance').textContent).toBe('1000');
    });

    await userEvent.click(screen.getByText('Update Balance'));

    expect(screen.getByTestId('balance').textContent).toBe('999');
  });
});
```

---

## Mocking Patterns

### Database Model Mocks

Every Drizzle ORM model used in the server is imported via its path under `drizzle/models/`. Mock the default export with `vi.mock()` at the top of the test file.

```ts
vi.mock('../../drizzle/models/User.js', () => ({
  default: {
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateById: vi.fn(),
    find: vi.fn(),
    findAll: vi.fn(),
    delete: vi.fn(),
  },
}));
```

Then use `vi.mocked()` to set return values per test:

```ts
vi.mocked(UserModel.findById).mockResolvedValue({
  id: 1,
  username: 'testuser',
  balance: '500.00',
  role: 'user',
  isActive: true,
} as any);
```

### Service Layer Mocks

When testing route handlers, mock the service layer to avoid transitive database calls:

```ts
vi.mock('../../src/services/balanceService.js', () => ({
  default: {
    getBalance: vi.fn(),
    placeBet: vi.fn(),
    recordWin: vi.fn(),
    updateBalance: vi.fn(),
    hasSufficientBalance: vi.fn(),
    manualAdjustment: vi.fn(),
  },
}));
```

### External Library Mocks

For libraries like `bcryptjs` or `jsonwebtoken`, mock only when you need deterministic behavior:

```ts
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$12$hashedvalue'),
    compare: vi.fn().mockResolvedValue(true),
    genSalt: vi.fn().mockResolvedValue('$2a$10$salt'),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('mock.jwt.token'),
    verify: vi.fn().mockReturnValue({ userId: 1, username: 'testuser', role: 'user' }),
  },
}));
```

For client-side mocks of browser APIs:

```ts
// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });
```

---

## Coverage Configuration and Targets

### Phase Targets

| Phase | Line Coverage | Branch Coverage | Timeline |
|---|---|---|---|
| Initial | >= 50% | >= 40% | First testing sprint |
| Intermediate | >= 70% | >= 60% | Mid-development |
| Long-term | >= 80% | >= 75% | Ongoing maintenance |

### Priority Order

Coverage efforts should be applied in this order, reflecting business risk:

1. **Game logic and balance calculations** -- money handling, multiplier math, payout formulas
2. **Authentication and authorization** -- JWT, password hashing, role checks
3. **API endpoint handlers** -- input validation, error responses, status codes
4. **Database model operations** -- Drizzle ORM query builders
5. **Client UI components** -- interactive controls, form inputs, game displays
6. **E2E flows** -- full user journeys

### Viewing Reports

After running `npm run test:coverage`, open the HTML report:

```bash
# Server
open server/coverage/index.html

# Client
open client/coverage/index.html
```

The `lcov` reporter also generates `lcov.info` files compatible with IDE coverage overlays and third-party services like Codecov.

---

## CI Integration

Tests integrate into the existing GitHub Actions pipeline defined in `.github/workflows/ci.yml`. The current pipeline builds and typechecks both server and client. Test steps should be added after the build steps.

Recommended additions to `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: |
            server/package-lock.json
            client/package-lock.json

      # ---- Server ----
      - name: Install server deps
        working-directory: server
        run: |
          npm ci
          npm i zod seedrandom --no-save

      - name: Typecheck server
        working-directory: server
        run: npx tsc --noEmit

      - name: Build server
        working-directory: server
        run: npm run build

      - name: Run server tests
        working-directory: server
        run: npm run test:coverage
        env:
          JWT_SECRET: ci-test-secret
          NODE_ENV: test

      - name: Upload server coverage
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: server-coverage
          path: server/coverage/

      # ---- Client ----
      - name: Install client deps
        working-directory: client
        run: npm ci

      - name: Build client
        working-directory: client
        run: npm run build

      - name: Run client tests
        working-directory: client
        run: npm run test:coverage

      - name: Upload client coverage
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: client-coverage
          path: client/coverage/
```

Key points about the CI test setup:

- **Environment variables**: `JWT_SECRET` and `NODE_ENV` are set directly in the workflow since tests never connect to a real database.
- **Coverage artifacts**: HTML reports are uploaded as build artifacts so reviewers can download and inspect them from the Actions tab.
- **Fail-fast**: If any test fails, the workflow exits with a non-zero code and blocks the PR merge.
- **No database required**: All database calls are mocked in tests, so no MySQL service container is needed for unit and integration tests. If future tests need a real database, add a `services:` block with MySQL.

---

## Related Documents

- [Test Examples](./test-examples.md) -- additional test patterns for sockets, game logic, admin routes, and E2E
- [Database Schema](../09-database/schema.md) -- table definitions that tests validate against
- [Data Models](../09-database/data-models.md) -- ORM model methods targeted by unit tests
- [Migrations](../09-database/migrations.md) -- migration context for integration test database setup
- [API Reference](../04-api/) -- endpoint contracts that integration tests assert
- [Architecture Overview](../02-architecture/) -- system structure that informs test boundaries
- [CI/CD Pipeline](../06-devops/) -- deployment pipeline where tests run
