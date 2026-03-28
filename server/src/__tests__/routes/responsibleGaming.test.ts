// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockDbSelect, mockDbUpdate, mockDbExecute } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbExecute: vi.fn(),
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

// Build a chainable mock for drizzle queries
function chainable(result) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(result);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  return chain;
}

const selectChain = chainable([{ isActive: true }]);
const updateChain = chainable([]);

vi.mock('../../../drizzle/db.js', () => ({
  db: {
    select: (...args) => selectChain.select(...args),
    update: (...args) => updateChain.update(...args),
    execute: mockDbExecute,
  },
}));

vi.mock('../../../drizzle/schema.js', () => ({
  users: {
    id: 'id',
    isActive: 'isActive',
    updatedAt: 'updatedAt',
  },
  transactions: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args) => args),
  sql: (strings, ...values) => ({ strings, values }),
}));

vi.mock('../../../src/services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import router under test
// ---------------------------------------------------------------------------

import router from '../../../routes/responsible-gaming.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/responsible-gaming', router);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Responsible Gaming routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain mocks
    selectChain.where.mockResolvedValue([{ isActive: true }]);
    updateChain.where.mockResolvedValue([]);
  });

  // =========================================================================
  // GET /api/responsible-gaming/limits
  // =========================================================================
  describe('GET /limits', () => {
    it('should return limits for an active user', async () => {
      selectChain.where.mockResolvedValue([{ isActive: true }]);

      const res = await request(createApp()).get('/api/responsible-gaming/limits');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        isActive: true,
        selfExcluded: false,
        dailyDepositLimit: null,
        dailyLossLimit: null,
        sessionTimeLimit: null,
        cooldownUntil: null,
      });
    });

    it('should show selfExcluded: true when user is inactive', async () => {
      selectChain.where.mockResolvedValue([{ isActive: false }]);

      const res = await request(createApp()).get('/api/responsible-gaming/limits');

      expect(res.status).toBe(200);
      expect(res.body.selfExcluded).toBe(true);
      expect(res.body.isActive).toBe(false);
    });

    it('should return 404 when user not found', async () => {
      selectChain.where.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/responsible-gaming/limits');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'User not found' });
    });

    it('should return 401 when userId is missing', async () => {
      const { authenticate } = await import('../../../middleware/auth.js');
      (authenticate as any).mockImplementationOnce((req, res, next) => {
        req.user = {};
        next();
      });

      const res = await request(createApp()).get('/api/responsible-gaming/limits');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: 'Authentication required' });
    });

    it('should return 500 on database error', async () => {
      selectChain.where.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp()).get('/api/responsible-gaming/limits');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error fetching responsible gaming limits' });
    });
  });

  // =========================================================================
  // POST /api/responsible-gaming/self-exclude
  // =========================================================================
  describe('POST /self-exclude', () => {
    it('should self-exclude for the specified number of days', async () => {
      updateChain.where.mockResolvedValue([]);

      const res = await request(createApp())
        .post('/api/responsible-gaming/self-exclude')
        .send({ days: 7 });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        message: expect.stringContaining('7 day(s)'),
      });
      expect(res.body.reactivateAt).toBeDefined();
    });

    it('should default to 1 day when days is not provided', async () => {
      updateChain.where.mockResolvedValue([]);

      const res = await request(createApp())
        .post('/api/responsible-gaming/self-exclude')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('1 day(s)');
    });

    it('should clamp days to valid range (1-365)', async () => {
      updateChain.where.mockResolvedValue([]);

      // Out of range: 0 -> defaults to 1
      const res = await request(createApp())
        .post('/api/responsible-gaming/self-exclude')
        .send({ days: 0 });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('1 day(s)');
    });

    it('should clamp days >365 to 1 (default)', async () => {
      updateChain.where.mockResolvedValue([]);

      const res = await request(createApp())
        .post('/api/responsible-gaming/self-exclude')
        .send({ days: 500 });

      expect(res.status).toBe(200);
      // Since 500 > 365, the condition rawDays <= 365 is false, so it defaults to 1
      expect(res.body.message).toContain('1 day(s)');
    });

    it('should return 401 when userId is missing', async () => {
      const { authenticate } = await import('../../../middleware/auth.js');
      (authenticate as any).mockImplementationOnce((req, res, next) => {
        req.user = {};
        next();
      });

      const res = await request(createApp())
        .post('/api/responsible-gaming/self-exclude')
        .send({ days: 7 });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: 'Authentication required' });
    });

    it('should return 500 on database error', async () => {
      updateChain.where.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp())
        .post('/api/responsible-gaming/self-exclude')
        .send({ days: 7 });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error processing self-exclusion' });
    });
  });

  // =========================================================================
  // GET /api/responsible-gaming/activity-summary
  // =========================================================================
  describe('GET /activity-summary', () => {
    it('should return activity summary for last 7 and 30 days', async () => {
      // The route dynamically imports drizzle-orm for sql, then executes two queries.
      // We mock db.execute for both calls.
      mockDbExecute
        .mockResolvedValueOnce([{ totalTransactions: 10, totalLosses: '200', totalWins: '500' }])
        .mockResolvedValueOnce([{ totalTransactions: 50, totalLosses: '1000', totalWins: '2000' }]);

      const res = await request(createApp()).get('/api/responsible-gaming/activity-summary');

      expect(res.status).toBe(200);
      expect(res.body.last7Days).toMatchObject({
        totalGames: 10,
        totalWins: 500,
        totalLosses: 200,
        netResult: 300,
      });
      expect(res.body.last30Days).toMatchObject({
        totalGames: 50,
        totalWins: 2000,
        totalLosses: 1000,
        netResult: 1000,
      });
    });

    it('should handle zero activity', async () => {
      mockDbExecute
        .mockResolvedValueOnce([{ totalTransactions: 0, totalLosses: '0', totalWins: '0' }])
        .mockResolvedValueOnce([{ totalTransactions: 0, totalLosses: '0', totalWins: '0' }]);

      const res = await request(createApp()).get('/api/responsible-gaming/activity-summary');

      expect(res.status).toBe(200);
      expect(res.body.last7Days.netResult).toBe(0);
      expect(res.body.last30Days.netResult).toBe(0);
    });

    it('should handle mysql2 [rows, fields] format', async () => {
      // mysql2 returns [rows, fields]
      mockDbExecute
        .mockResolvedValueOnce([[{ totalTransactions: 5, totalLosses: '100', totalWins: '300' }], []])
        .mockResolvedValueOnce([[{ totalTransactions: 20, totalLosses: '500', totalWins: '800' }], []]);

      const res = await request(createApp()).get('/api/responsible-gaming/activity-summary');

      expect(res.status).toBe(200);
      expect(res.body.last7Days.totalGames).toBe(5);
    });

    it('should return 401 when userId is missing', async () => {
      const { authenticate } = await import('../../../middleware/auth.js');
      (authenticate as any).mockImplementationOnce((req, res, next) => {
        req.user = {};
        next();
      });

      const res = await request(createApp()).get('/api/responsible-gaming/activity-summary');

      expect(res.status).toBe(401);
    });

    it('should return 500 on database error', async () => {
      mockDbExecute.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp()).get('/api/responsible-gaming/activity-summary');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error fetching activity summary' });
    });
  });
});
