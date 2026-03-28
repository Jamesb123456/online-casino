// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockHasSufficientBalance, mockPlaceBet, mockGameSessionCreate } = vi.hoisted(() => ({
  mockHasSufficientBalance: vi.fn(),
  mockPlaceBet: vi.fn(),
  mockGameSessionCreate: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../middleware/auth.js', () => ({
  authenticate: vi.fn((req, res, next) => {
    req.user = { userId: 1, username: 'testuser', role: 'user' };
    next();
  }),
  adminOnly: vi.fn((req, res, next) => next()),
  userOrAdmin: vi.fn((req, res, next) => next()),
}));

vi.mock('../../../src/services/balanceService.js', () => ({
  default: {
    hasSufficientBalance: mockHasSufficientBalance,
    placeBet: mockPlaceBet,
  },
}));

vi.mock('../../../drizzle/models/GameSession.js', () => ({
  default: {
    create: mockGameSessionCreate,
  },
}));

vi.mock('../../../src/services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
  },
}));

// express-rate-limit: return a pass-through middleware so rate limiting does not interfere with tests
vi.mock('express-rate-limit', () => ({
  default: vi.fn(() => (req, res, next) => next()),
}));

// ---------------------------------------------------------------------------
// Import router under test (after mocks)
// ---------------------------------------------------------------------------

import router from '../../../routes/games.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/games', router);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Games routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET /api/games/
  // =========================================================================
  describe('GET /', () => {
    it('should return a list of all available games', async () => {
      const res = await request(createApp()).get('/api/games');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(6);

      const gameIds = res.body.map((g: any) => g.id);
      expect(gameIds).toContain('crash');
      expect(gameIds).toContain('plinko');
      expect(gameIds).toContain('wheel');
      expect(gameIds).toContain('roulette');
      expect(gameIds).toContain('blackjack');
      expect(gameIds).toContain('landmines');
    });

    it('each game should have required fields', async () => {
      const res = await request(createApp()).get('/api/games');

      for (const game of res.body) {
        expect(game).toHaveProperty('id');
        expect(game).toHaveProperty('name');
        expect(game).toHaveProperty('description');
        expect(game).toHaveProperty('minBet');
        expect(game).toHaveProperty('maxBet');
        expect(game).toHaveProperty('thumbnail');
        expect(typeof game.minBet).toBe('number');
        expect(typeof game.maxBet).toBe('number');
      }
    });
  });

  // =========================================================================
  // POST /api/games/:gameId/bet
  // =========================================================================
  describe('POST /:gameId/bet', () => {
    it('should place a bet successfully', async () => {
      mockHasSufficientBalance.mockResolvedValue(true);
      mockGameSessionCreate.mockResolvedValue({ id: 42 });
      mockPlaceBet.mockResolvedValue({});

      const res = await request(createApp())
        .post('/api/games/crash/bet')
        .send({ betAmount: 100 });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        message: 'Bet placed successfully',
        gameId: 'crash',
        betAmount: 100,
        sessionId: 42,
      });
      expect(mockHasSufficientBalance).toHaveBeenCalledWith(1, 100);
      expect(mockGameSessionCreate).toHaveBeenCalledWith(expect.objectContaining({
        userId: 1,
        gameType: 'crash',
        initialBet: 100,
        totalBet: 100,
        isCompleted: false,
      }));
      expect(mockPlaceBet).toHaveBeenCalledWith(1, 100, 'crash', { sessionId: 42 });
    });

    it('should return 400 for invalid gameId', async () => {
      const res = await request(createApp())
        .post('/api/games/invalidgame/bet')
        .send({ betAmount: 100 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Invalid gameId' });
    });

    it('should return 400 for invalid bet amount (negative)', async () => {
      const res = await request(createApp())
        .post('/api/games/crash/bet')
        .send({ betAmount: -10 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Invalid bet amount' });
    });

    it('should return 400 for invalid bet amount (zero)', async () => {
      const res = await request(createApp())
        .post('/api/games/crash/bet')
        .send({ betAmount: 0 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Invalid bet amount' });
    });

    it('should return 400 for missing bet amount', async () => {
      const res = await request(createApp())
        .post('/api/games/crash/bet')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Invalid bet amount' });
    });

    it('should return 400 when insufficient balance', async () => {
      mockHasSufficientBalance.mockResolvedValue(false);

      const res = await request(createApp())
        .post('/api/games/roulette/bet')
        .send({ betAmount: 50000 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Insufficient balance' });
    });

    it('should accept all valid game types', async () => {
      const gameTypes = ['crash', 'plinko', 'wheel', 'roulette', 'blackjack', 'landmines'];

      for (const gameId of gameTypes) {
        mockHasSufficientBalance.mockResolvedValue(true);
        mockGameSessionCreate.mockResolvedValue({ id: 1 });
        mockPlaceBet.mockResolvedValue({});

        const res = await request(createApp())
          .post(`/api/games/${gameId}/bet`)
          .send({ betAmount: 10 });

        expect(res.status).toBe(200);
        expect(res.body.gameId).toBe(gameId);
      }
    });

    it('should return 500 when service throws', async () => {
      mockHasSufficientBalance.mockRejectedValue(new Error('Service error'));

      const res = await request(createApp())
        .post('/api/games/crash/bet')
        .send({ betAmount: 100 });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Server error while placing bet' });
    });

    it('should coerce string betAmount to number', async () => {
      mockHasSufficientBalance.mockResolvedValue(true);
      mockGameSessionCreate.mockResolvedValue({ id: 10 });
      mockPlaceBet.mockResolvedValue({});

      const res = await request(createApp())
        .post('/api/games/crash/bet')
        .send({ betAmount: '50' });

      expect(res.status).toBe(200);
      expect(res.body.betAmount).toBe(50);
    });
  });
});
