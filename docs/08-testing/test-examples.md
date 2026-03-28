# Test Examples -- Advanced Patterns

This document provides additional test examples beyond the core patterns covered in [Testing Strategy](./testing-strategy.md). Each section targets a specific area of the Platinum Casino codebase with production-realistic test code.

---

## Table of Contents

- [Socket.IO Handler Testing](#socketio-handler-testing)
  - [Crash Game Handler](#crash-game-handler)
- [Game Logic Testing](#game-logic-testing)
  - [Crash Multiplier Generation](#crash-multiplier-generation)
  - [Plinko Path and Multiplier](#plinko-path-and-multiplier)
  - [Blackjack Hand Evaluation](#blackjack-hand-evaluation)
- [Admin Route Testing with Auth](#admin-route-testing-with-auth)
  - [GET /api/admin/users](#get-apiadminusers)
  - [POST /api/admin/transactions](#post-apiadmintransactions)
- [E2E Test Example with Playwright](#e2e-test-example-with-playwright)
  - [Playwright Configuration](#playwright-configuration)
  - [Registration and Game Flow](#registration-and-game-flow)
- [Related Documents](#related-documents)

---

## Socket.IO Handler Testing

Testing Socket.IO handlers requires creating an in-memory server and connecting a client socket to it. This pattern avoids needing a running server process.

### Crash Game Handler

File: `server/src/socket/crashHandler.test.ts`

The crash handler is the most complex socket handler in the project. It manages a shared game state across all connected players, broadcasts multiplier ticks, and integrates with `BalanceService` for bet and cashout transactions.

```ts
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { AddressInfo } from 'net';

// Mock the services the crash handler depends on
vi.mock('../services/balanceService.js', () => ({
  default: {
    getBalance: vi.fn(),
    placeBet: vi.fn(),
    recordWin: vi.fn(),
  },
}));

vi.mock('../services/loggingService.js', () => ({
  default: {
    logGameStart: vi.fn(),
    logGameEnd: vi.fn(),
    logGameEvent: vi.fn(),
    logBetPlaced: vi.fn(),
    logBetResult: vi.fn(),
  },
}));

vi.mock('../utils/gameUtils.js', () => ({
  calculateHouseEdge: vi.fn().mockReturnValue(0.01),
}));

import BalanceService from '../services/balanceService.js';
import initCrashHandlers from './crashHandler.js';

/**
 * Helper: create an HTTP + Socket.IO server pair on a random port,
 * attach the crash handler to a namespace, and return cleanup functions.
 */
function createTestServer() {
  const httpServer = createServer();
  const ioServer = new Server(httpServer, {
    cors: { origin: '*' },
  });

  // The crash handler attaches to a namespace
  const crashNamespace = ioServer.of('/crash');

  // Attach a mock user to every connecting socket (simulates auth middleware)
  crashNamespace.use((socket, next) => {
    (socket as any).user = {
      userId: (socket.handshake.auth as any).userId ?? 1,
      username: (socket.handshake.auth as any).username ?? 'testplayer',
      balance: '1000',
    };
    next();
  });

  return new Promise<{
    ioServer: Server;
    httpServer: ReturnType<typeof createServer>;
    port: number;
    cleanup: () => Promise<void>;
  }>((resolve) => {
    httpServer.listen(0, () => {
      const port = (httpServer.address() as AddressInfo).port;

      // Initialize the crash handlers on the namespace
      initCrashHandlers(crashNamespace);

      resolve({
        ioServer,
        httpServer,
        port,
        cleanup: async () => {
          ioServer.close();
          httpServer.close();
        },
      });
    });
  });
}

/**
 * Helper: connect a client socket to the crash namespace.
 */
function connectClient(port: number, auth: Record<string, any> = {}): Promise<ClientSocket> {
  return new Promise((resolve) => {
    const socket = ClientIO(`http://localhost:${port}/crash`, {
      auth: { userId: 1, username: 'testplayer', ...auth },
      transports: ['websocket'],
    });
    socket.on('connect', () => resolve(socket));
  });
}

describe('Crash Handler -- Socket.IO', () => {
  let port: number;
  let cleanup: () => Promise<void>;
  let client: ClientSocket;

  beforeEach(async () => {
    vi.clearAllMocks();
    const server = await createTestServer();
    port = server.port;
    cleanup = server.cleanup;
  });

  afterEach(async () => {
    if (client?.connected) client.disconnect();
    await cleanup();
  });

  it('sends initial game state on connection', async () => {
    const gameState = await new Promise<any>((resolve) => {
      client = ClientIO(`http://localhost:${port}/crash`, {
        auth: { userId: 1, username: 'testplayer' },
        transports: ['websocket'],
      });
      client.on('gameState', (data) => resolve(data));
    });

    expect(gameState).toHaveProperty('isGameRunning');
    expect(gameState).toHaveProperty('currentMultiplier');
  });

  it('sends game history on connection', async () => {
    const history = await new Promise<any>((resolve) => {
      client = ClientIO(`http://localhost:${port}/crash`, {
        auth: { userId: 1, username: 'testplayer' },
        transports: ['websocket'],
      });
      client.on('gameHistory', (data) => resolve(data));
    });

    expect(Array.isArray(history)).toBe(true);
  });

  it('accepts a valid bet via the placeBet event', async () => {
    vi.mocked(BalanceService.getBalance).mockResolvedValue(500);
    vi.mocked(BalanceService.placeBet).mockResolvedValue({
      user: { id: 1, balance: '450' },
      transaction: { id: 1 },
    } as any);

    client = await connectClient(port);

    // Wait for gameStarting event (game auto-starts during init)
    await new Promise<void>((resolve) => {
      client.on('gameStarting', () => resolve());
      // If the game is already in waiting/countdown, we may get gameState first
      client.on('gameState', (data) => {
        if (!data.isGameRunning) resolve();
      });
    });

    const response = await new Promise<any>((resolve) => {
      client.emit('placeBet', { amount: 50, autoCashoutAt: 2.0 }, (res: any) => {
        resolve(res);
      });
    });

    expect(response.success).toBe(true);
    expect(BalanceService.placeBet).toHaveBeenCalledWith(
      1,
      50,
      'crash',
      expect.objectContaining({ autoCashoutAt: 2.0 })
    );
  });

  it('rejects a bet with insufficient balance', async () => {
    vi.mocked(BalanceService.getBalance).mockResolvedValue(10);

    client = await connectClient(port);

    // Wait for initial state
    await new Promise<void>((resolve) => {
      client.on('gameState', () => resolve());
    });

    const response = await new Promise<any>((resolve) => {
      client.emit('placeBet', { amount: 500 }, (res: any) => resolve(res));
    });

    expect(response.success).toBe(false);
    expect(response.error).toBe('Insufficient balance');
  });

  it('rejects a bet with an invalid amount', async () => {
    client = await connectClient(port);

    await new Promise<void>((resolve) => {
      client.on('gameState', () => resolve());
    });

    const response = await new Promise<any>((resolve) => {
      client.emit('placeBet', { amount: -10 }, (res: any) => resolve(res));
    });

    expect(response.success).toBe(false);
    expect(response.error).toBe('Invalid bet amount');
  });

  it('broadcasts playerJoined to other connected clients', async () => {
    // Connect first client
    const client1 = ClientIO(`http://localhost:${port}/crash`, {
      auth: { userId: 1, username: 'player1' },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      client1.on('connect', () => resolve());
    });

    // Listen for playerJoined on client1 before connecting client2
    const joinedPromise = new Promise<any>((resolve) => {
      client1.on('playerJoined', (data) => resolve(data));
    });

    // Connect second client
    const client2 = ClientIO(`http://localhost:${port}/crash`, {
      auth: { userId: 2, username: 'player2' },
      transports: ['websocket'],
    });

    const joined = await joinedPromise;

    expect(joined.username).toBe('player2');

    client1.disconnect();
    client2.disconnect();
    client = null as any; // prevent afterEach from disconnecting again
  });
});
```

---

## Game Logic Testing

Game logic utilities are pure functions, making them straightforward to unit test without mocks.

### Crash Multiplier Generation

File: `server/src/utils/gameUtils.test.ts` (partial -- crash-related tests)

The `calculateHouseEdge` function returns predefined edge values per game type. These tests ensure the configuration values remain correct.

```ts
import { describe, it, expect } from 'vitest';
import {
  calculateHouseEdge,
  calculatePayout,
  calculateHandValue,
  isBlackjack,
  isBusted,
  determineWinner,
  shouldDealerHit,
  createDeck,
  shuffleArray,
} from './gameUtils.js';

describe('calculateHouseEdge()', () => {
  it('returns 0.01 (1%) for crash games', () => {
    expect(calculateHouseEdge('crash')).toBe(0.01);
  });

  it('returns 0.02 (2%) for plinko games', () => {
    expect(calculateHouseEdge('plinko')).toBe(0.02);
  });

  it('returns 0.005 (0.5%) for blackjack', () => {
    expect(calculateHouseEdge('blackjack')).toBe(0.005);
  });

  it('returns 0.027 (2.7%) for roulette', () => {
    expect(calculateHouseEdge('roulette')).toBe(0.027);
  });

  it('returns 0.04 (4%) for wheel', () => {
    expect(calculateHouseEdge('wheel')).toBe(0.04);
  });

  it('returns 0.02 as the default for unknown game types', () => {
    expect(calculateHouseEdge('unknown_game')).toBe(0.02);
  });
});

describe('calculatePayout()', () => {
  const bet = 100;

  it('pays 1.5x the bet for a blackjack', () => {
    expect(calculatePayout(bet, 'blackjack')).toBe(150);
  });

  it('pays 1:1 for a player win', () => {
    expect(calculatePayout(bet, 'player')).toBe(100);
  });

  it('returns 0 for a push (tie)', () => {
    expect(calculatePayout(bet, 'push')).toBe(0);
  });

  it('returns the negative bet for a dealer win', () => {
    expect(calculatePayout(bet, 'dealer')).toBe(-100);
  });
});

describe('createDeck()', () => {
  it('produces a deck of 52 cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
  });

  it('contains 4 suits with 13 values each', () => {
    const deck = createDeck();
    const suits = new Set(deck.map((c) => c.suit));
    expect(suits.size).toBe(4);

    for (const suit of suits) {
      const cardsInSuit = deck.filter((c) => c.suit === suit);
      expect(cardsInSuit).toHaveLength(13);
    }
  });

  it('contains no duplicates', () => {
    const deck = createDeck();
    const keys = deck.map((c) => `${c.value}_${c.suit}`);
    expect(new Set(keys).size).toBe(52);
  });
});

describe('shuffleArray()', () => {
  it('returns an array of the same length', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(original);
    expect(shuffled).toHaveLength(original.length);
  });

  it('does not mutate the original array', () => {
    const original = [1, 2, 3, 4, 5];
    const copy = [...original];
    shuffleArray(original);
    expect(original).toEqual(copy);
  });

  it('contains all the same elements', () => {
    const original = [10, 20, 30, 40, 50];
    const shuffled = shuffleArray(original);
    expect(shuffled.sort()).toEqual(original.sort());
  });
});
```

### Plinko Path and Multiplier

File: `server/src/utils/plinkoUtils.test.ts`

The plinko utilities use a deterministic PRNG seeded by a string, so identical seeds must produce identical paths.

```ts
import { describe, it, expect } from 'vitest';
import { generatePath, calculateMultiplier } from './plinkoUtils.js';

describe('generatePath()', () => {
  it('returns an array whose length equals the number of rows', () => {
    const path = generatePath(16, 'seed-abc');
    expect(path).toHaveLength(16);
  });

  it('produces deterministic results for the same seed', () => {
    const pathA = generatePath(16, 'deterministic-seed');
    const pathB = generatePath(16, 'deterministic-seed');
    expect(pathA).toEqual(pathB);
  });

  it('produces different results for different seeds', () => {
    const pathA = generatePath(16, 'seed-one');
    const pathB = generatePath(16, 'seed-two');
    // It is astronomically unlikely (but theoretically possible) that two
    // different seeds produce the same 16-element path.
    expect(pathA).not.toEqual(pathB);
  });

  it('clamps all positions between 0 and the row count', () => {
    // Run many seeds to exercise clamping boundaries
    for (let i = 0; i < 100; i++) {
      const path = generatePath(16, `stress-seed-${i}`);
      for (const pos of path) {
        expect(pos).toBeGreaterThanOrEqual(0);
        expect(pos).toBeLessThanOrEqual(16);
      }
    }
  });

  it('starts from a centered position', () => {
    // The first bounce moves from center, so path[0] should be center +/- 1
    const rows = 16;
    const center = Math.floor((rows + 1) / 2); // 8
    const path = generatePath(rows, 'center-test');
    expect(Math.abs(path[0] - center)).toBeLessThanOrEqual(1);
  });
});

describe('calculateMultiplier()', () => {
  const rows = 16;
  const center = rows / 2; // 8

  it('returns a low multiplier for center landing positions (medium risk)', () => {
    const mult = calculateMultiplier(center, rows, 'medium');
    // Center should yield the base multiplier for medium risk (0.5)
    expect(mult).toBe(0.5);
  });

  it('returns a higher multiplier for edge positions (medium risk)', () => {
    const edgeMult = calculateMultiplier(0, rows, 'medium');
    const centerMult = calculateMultiplier(center, rows, 'medium');
    expect(edgeMult).toBeGreaterThan(centerMult);
  });

  it('returns higher edge multipliers for higher risk levels', () => {
    const lowEdge = calculateMultiplier(0, rows, 'low');
    const medEdge = calculateMultiplier(0, rows, 'medium');
    const highEdge = calculateMultiplier(0, rows, 'high');

    expect(medEdge).toBeGreaterThan(lowEdge);
    expect(highEdge).toBeGreaterThan(medEdge);
  });

  it('never returns a multiplier below 0.1', () => {
    // Test all positions and risk levels
    for (const risk of ['low', 'medium', 'high'] as const) {
      for (let slot = 0; slot <= rows; slot++) {
        const mult = calculateMultiplier(slot, rows, risk);
        expect(mult).toBeGreaterThanOrEqual(0.1);
      }
    }
  });

  it('rounds to two decimal places', () => {
    for (let slot = 0; slot <= rows; slot++) {
      const mult = calculateMultiplier(slot, rows, 'medium');
      const rounded = Math.round(mult * 100) / 100;
      expect(mult).toBe(rounded);
    }
  });

  it('produces a symmetric payout curve', () => {
    // Position N from left should match position N from right
    for (let offset = 0; offset <= center; offset++) {
      const leftMult = calculateMultiplier(offset, rows, 'medium');
      const rightMult = calculateMultiplier(rows - offset, rows, 'medium');
      expect(leftMult).toBe(rightMult);
    }
  });
});
```

### Blackjack Hand Evaluation

File: `server/src/utils/gameUtils.test.ts` (continued)

```ts
describe('calculateHandValue()', () => {
  it('sums numbered cards at face value', () => {
    const hand = [
      { suit: 'hearts', value: '5', image: '' },
      { suit: 'spades', value: '7', image: '' },
    ];
    expect(calculateHandValue(hand)).toBe(12);
  });

  it('scores face cards (J, Q, K) as 10', () => {
    const hand = [
      { suit: 'hearts', value: 'J', image: '' },
      { suit: 'diamonds', value: 'Q', image: '' },
      { suit: 'clubs', value: 'K', image: '' },
    ];
    expect(calculateHandValue(hand)).toBe(30);
  });

  it('scores Ace as 11 when the total is 21 or less', () => {
    const hand = [
      { suit: 'hearts', value: 'A', image: '' },
      { suit: 'spades', value: '9', image: '' },
    ];
    expect(calculateHandValue(hand)).toBe(20);
  });

  it('demotes Ace from 11 to 1 when the total would exceed 21', () => {
    const hand = [
      { suit: 'hearts', value: 'A', image: '' },
      { suit: 'spades', value: '9', image: '' },
      { suit: 'clubs', value: '5', image: '' },
    ];
    // 11 + 9 + 5 = 25, so Ace demotes to 1: 1 + 9 + 5 = 15
    expect(calculateHandValue(hand)).toBe(15);
  });

  it('handles multiple Aces correctly', () => {
    const hand = [
      { suit: 'hearts', value: 'A', image: '' },
      { suit: 'spades', value: 'A', image: '' },
      { suit: 'clubs', value: '9', image: '' },
    ];
    // 11 + 11 + 9 = 31 -> demote one Ace: 1 + 11 + 9 = 21
    expect(calculateHandValue(hand)).toBe(21);
  });

  it('returns 0 for an empty hand', () => {
    expect(calculateHandValue([])).toBe(0);
  });

  it('returns 0 for null/undefined', () => {
    expect(calculateHandValue(null)).toBe(0);
  });
});

describe('isBlackjack()', () => {
  it('returns true for Ace + 10-value card', () => {
    const hand = [
      { suit: 'hearts', value: 'A', image: '' },
      { suit: 'spades', value: 'K', image: '' },
    ];
    expect(isBlackjack(hand)).toBe(true);
  });

  it('returns false for 21 achieved with more than 2 cards', () => {
    const hand = [
      { suit: 'hearts', value: '7', image: '' },
      { suit: 'spades', value: '7', image: '' },
      { suit: 'clubs', value: '7', image: '' },
    ];
    expect(isBlackjack(hand)).toBe(false);
  });
});

describe('determineWinner()', () => {
  const ace = { suit: 'hearts', value: 'A', image: '' };
  const king = { suit: 'spades', value: 'K', image: '' };
  const five = { suit: 'hearts', value: '5', image: '' };
  const six = { suit: 'clubs', value: '6', image: '' };
  const ten = { suit: 'diamonds', value: '10', image: '' };

  it('returns "blackjack" when only the player has blackjack', () => {
    expect(determineWinner([ace, king], [ten, six, five])).toBe('blackjack');
  });

  it('returns "push" when both have blackjack', () => {
    expect(determineWinner([ace, king], [ace, ten])).toBe('push');
  });

  it('returns "dealer" when the player busts', () => {
    const bust = [ten, king, five]; // 25
    expect(determineWinner(bust, [ten, six])).toBe('dealer');
  });

  it('returns "player" when the dealer busts', () => {
    expect(determineWinner([ten, six], [ten, king, five])).toBe('player');
  });

  it('returns "player" when the player has a higher total', () => {
    expect(determineWinner([ten, king], [ten, six])).toBe('player');
  });

  it('returns "push" when both have the same total', () => {
    expect(determineWinner([ten, six], [ten, six])).toBe('push');
  });
});

describe('shouldDealerHit()', () => {
  it('returns true when the dealer total is 16 or less', () => {
    const hand = [
      { suit: 'hearts', value: '10', image: '' },
      { suit: 'spades', value: '6', image: '' },
    ];
    expect(shouldDealerHit(hand)).toBe(true);
  });

  it('returns false when the dealer total is 17 or more', () => {
    const hand = [
      { suit: 'hearts', value: '10', image: '' },
      { suit: 'spades', value: '7', image: '' },
    ];
    expect(shouldDealerHit(hand)).toBe(false);
  });
});
```

---

## Admin Route Testing with Auth

Admin routes require a valid JWT token in an HTTP-only cookie and an `admin` role. These tests verify both the authorization layer and the business logic.

### GET /api/admin/users

File: `server/__tests__/integration/admin.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import request from 'supertest';

// Mock all models the admin router uses
vi.mock('../../drizzle/models/User.js', () => ({
  default: {
    find: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    updateById: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../drizzle/models/Transaction.js', () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    updateById: vi.fn(),
  },
}));

vi.mock('../../drizzle/models/GameStat.js', () => ({
  default: {
    findAll: vi.fn(),
  },
}));

vi.mock('../../drizzle/models/Balance.js', () => ({
  default: {
    create: vi.fn(),
    getLatestBalance: vi.fn(),
  },
}));

import adminRouter from '../../routes/admin.js';
import { authenticate } from '../../middleware/auth.js';
import UserModel from '../../drizzle/models/User.js';
import Transaction from '../../drizzle/models/Transaction.js';
import Balance from '../../drizzle/models/Balance.js';

const JWT_SECRET = 'test-jwt-secret';
process.env.JWT_SECRET = JWT_SECRET;

/**
 * Helper: build an Express app with cookie parser, auth middleware,
 * and the admin router mounted at /api/admin.
 */
function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/admin', adminRouter);
  return app;
}

/**
 * Helper: generate a signed JWT cookie header for supertest.
 */
function authCookie(payload: { userId: number; username: string; role: string }): string {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  return `authToken=${token}`;
}

describe('GET /api/admin/users', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();

    // The auth middleware calls UserModel.findById to verify the token
    vi.mocked(UserModel.findById).mockResolvedValue({
      id: 99,
      username: 'admin',
      role: 'admin',
      isActive: true,
    } as any);
  });

  it('returns 403 when the caller is not an admin', async () => {
    // Override findById to return a regular user
    vi.mocked(UserModel.findById).mockResolvedValue({
      id: 1,
      username: 'player',
      role: 'user',
      isActive: true,
    } as any);

    const res = await request(app)
      .get('/api/admin/users')
      .set('Cookie', authCookie({ userId: 1, username: 'player', role: 'user' }));

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Access denied');
  });

  it('returns 401 when no auth cookie is present', async () => {
    const res = await request(app).get('/api/admin/users');

    expect(res.status).toBe(401);
  });

  it('returns the list of users for an admin', async () => {
    vi.mocked(UserModel.find).mockResolvedValue([
      { id: 1, username: 'alice', role: 'user', balance: '500', isActive: true, createdAt: new Date(), lastLogin: new Date() },
      { id: 2, username: 'bob', role: 'user', balance: '200', isActive: false, createdAt: new Date(), lastLogin: null },
    ] as any);

    const res = await request(app)
      .get('/api/admin/users')
      .set('Cookie', authCookie({ userId: 99, username: 'admin', role: 'admin' }));

    expect(res.status).toBe(200);
    expect(res.body.players).toHaveLength(2);
    expect(res.body.totalCount).toBe(2);
    // Verify sensitive data like passwordHash is not exposed
    expect(res.body.players[0]).not.toHaveProperty('passwordHash');
  });
});
```

### POST /api/admin/transactions

```ts
describe('POST /api/admin/transactions', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();

    // Admin user for auth middleware
    vi.mocked(UserModel.findById).mockResolvedValue({
      id: 99,
      username: 'admin',
      role: 'admin',
      isActive: true,
    } as any);
  });

  it('creates a credit transaction and returns the new balance', async () => {
    vi.mocked(Balance.getLatestBalance).mockResolvedValue({ amount: 500 } as any);
    vi.mocked(Transaction.create).mockResolvedValue({ id: 10, type: 'credit', amount: 100 } as any);
    vi.mocked(Balance.create).mockResolvedValue({} as any);

    const res = await request(app)
      .post('/api/admin/transactions')
      .set('Cookie', authCookie({ userId: 99, username: 'admin', role: 'admin' }))
      .send({
        userId: 1,
        type: 'credit',
        amount: 100,
        description: 'Promotional bonus',
      });

    expect(res.status).toBe(201);
    expect(res.body.newBalance).toBe(600); // 500 + 100
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        type: 'credit',
        amount: 100,
        status: 'completed',
      })
    );
  });

  it('rejects a debit that would make the balance negative', async () => {
    vi.mocked(Balance.getLatestBalance).mockResolvedValue({ amount: 50 } as any);

    const res = await request(app)
      .post('/api/admin/transactions')
      .set('Cookie', authCookie({ userId: 99, username: 'admin', role: 'admin' }))
      .send({
        userId: 1,
        type: 'debit',
        amount: 100,
        description: 'Penalty',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Insufficient balance');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/admin/transactions')
      .set('Cookie', authCookie({ userId: 99, username: 'admin', role: 'admin' }))
      .send({ userId: 1 }); // missing type, amount, description

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Missing required fields');
  });

  it('returns 404 when the target user does not exist', async () => {
    // Override findById: first call is for auth (returns admin), second call is for target user
    vi.mocked(UserModel.findById)
      .mockResolvedValueOnce({ id: 99, username: 'admin', role: 'admin', isActive: true } as any)
      .mockResolvedValueOnce(null); // target user not found

    const res = await request(app)
      .post('/api/admin/transactions')
      .set('Cookie', authCookie({ userId: 99, username: 'admin', role: 'admin' }))
      .send({
        userId: 999,
        type: 'credit',
        amount: 100,
        description: 'Ghost user',
      });

    expect(res.status).toBe(404);
  });
});
```

---

## E2E Test Example with Playwright

End-to-end tests exercise the full stack (client + server + database) through a real browser. Playwright launches a browser, navigates to the running application, and interacts with it as a user would.

### Playwright Configuration

Install Playwright (from the project root):

```bash
npm init playwright@latest
```

Create `playwright.config.ts` at the project root:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,          // Casino tests may share state, run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start the dev servers before running tests
  webServer: [
    {
      command: 'cd server && npm run dev',
      port: 5000,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'cd client && npm run dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
```

### Registration and Game Flow

File: `e2e/registration-and-game.spec.ts`

This test walks through a complete user journey: register a new account, verify the welcome balance, navigate to a game, and confirm the UI elements render correctly.

```ts
import { test, expect } from '@playwright/test';

// Generate a unique username per test run to avoid collisions
const uniqueUser = `e2e_player_${Date.now()}`;
const password = 'TestPassword123';

test.describe('Registration and Game Flow', () => {
  test('registers a new user and receives the welcome bonus', async ({ page }) => {
    await page.goto('/');

    // Navigate to the registration form
    await page.click('text=Register');
    // Alternatively: await page.goto('/register');

    // Fill in the registration form
    await page.fill('input[name="username"]', uniqueUser);
    await page.fill('input[name="password"]', password);

    // Submit the form
    await page.click('button[type="submit"]');

    // Should redirect to the main page and show the user's balance
    await expect(page.locator('[data-testid="user-balance"]')).toBeVisible({
      timeout: 10_000,
    });

    // Verify the welcome bonus of 1000 is displayed
    const balanceText = await page.locator('[data-testid="user-balance"]').textContent();
    expect(balanceText).toContain('1000');
  });

  test('navigates to the crash game page', async ({ page }) => {
    // Log in with the user created above
    await page.goto('/');
    await page.click('text=Login');
    await page.fill('input[name="username"]', uniqueUser);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for authentication to complete
    await expect(page.locator('[data-testid="user-balance"]')).toBeVisible({
      timeout: 10_000,
    });

    // Navigate to the crash game
    await page.click('text=Crash');

    // Verify crash game elements are visible
    await expect(page.locator('[data-testid="crash-multiplier"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="bet-input"]')).toBeVisible();
    await expect(page.locator('button:has-text("Place Bet")')).toBeVisible();
  });

  test('places a bet in the crash game', async ({ page }) => {
    // Log in
    await page.goto('/');
    await page.click('text=Login');
    await page.fill('input[name="username"]', uniqueUser);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page.locator('[data-testid="user-balance"]')).toBeVisible({
      timeout: 10_000,
    });

    // Navigate to crash game
    await page.click('text=Crash');
    await expect(page.locator('[data-testid="bet-input"]')).toBeVisible({
      timeout: 10_000,
    });

    // Enter a bet amount
    await page.fill('[data-testid="bet-input"]', '50');

    // Wait for the game to be in a bettable state (waiting or countdown)
    // then place the bet
    const placeBetButton = page.locator('button:has-text("Place Bet")');
    await expect(placeBetButton).toBeEnabled({ timeout: 15_000 });
    await placeBetButton.click();

    // Verify the bet was accepted -- the balance should decrease
    // or a bet confirmation should appear
    await expect(
      page.locator('[data-testid="active-bet"], [data-testid="bet-confirmed"]')
    ).toBeVisible({ timeout: 5_000 });
  });

  test('admin can view the dashboard', async ({ page }) => {
    // This test assumes an admin account exists in the test database
    await page.goto('/');
    await page.click('text=Login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'adminpassword');
    await page.click('button[type="submit"]');

    // Navigate to admin dashboard
    await page.goto('/admin');

    // Verify dashboard elements are visible
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="total-users"]')).toBeVisible();
    await expect(page.locator('[data-testid="recent-transactions"]')).toBeVisible();
  });
});
```

### E2E Best Practices

- **Test data isolation**: Generate unique usernames with timestamps to avoid collisions between test runs.
- **Selectors**: Prefer `data-testid` attributes over CSS classes or text content. Add them to components as needed for test stability.
- **Timeouts**: Casino games involve real-time state transitions (countdown, game running, crashed). Use generous timeouts for elements that depend on game state.
- **Screenshots on failure**: The Playwright config captures screenshots and videos on failure. These are saved to the `test-results/` directory and uploaded as CI artifacts.
- **Database cleanup**: For CI environments, either use a dedicated test database that is reset before each run, or ensure tests create their own data and do not depend on pre-existing state.

---

## Related Documents

- [Testing Strategy](./testing-strategy.md) -- framework setup, core test examples, mocking patterns, CI configuration
- [Database Schema](../09-database/schema.md) -- table definitions used in test fixtures
- [API Reference](../04-api/) -- endpoint contracts validated by integration tests
- [Architecture Overview](../02-architecture/) -- system boundaries that inform what to mock vs. test end-to-end
- [Security](../07-security/) -- auth middleware patterns tested in admin route examples
- [CI/CD Pipeline](../06-devops/) -- where E2E tests fit in the deployment workflow
