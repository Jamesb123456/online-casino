// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockHasClaimedToday,
  mockGenerateRewardAmount,
  mockLoginRewardCreate,
  mockGetHistoryByUserId,
  mockGetTotalRewardsByUserId,
  mockUserFindById,
  mockUserUpdateById,
  mockDbTransaction,
} = vi.hoisted(() => ({
  mockHasClaimedToday: vi.fn(),
  mockGenerateRewardAmount: vi.fn(),
  mockLoginRewardCreate: vi.fn(),
  mockGetHistoryByUserId: vi.fn(),
  mockGetTotalRewardsByUserId: vi.fn(),
  mockUserFindById: vi.fn(),
  mockUserUpdateById: vi.fn(),
  mockDbTransaction: vi.fn(),
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

vi.mock('../../../drizzle/models/LoginReward.js', () => ({
  default: {
    hasClaimedToday: mockHasClaimedToday,
    generateRewardAmount: mockGenerateRewardAmount,
    create: mockLoginRewardCreate,
    getHistoryByUserId: mockGetHistoryByUserId,
    getTotalRewardsByUserId: mockGetTotalRewardsByUserId,
  },
}));

vi.mock('../../../drizzle/models/User.js', () => ({
  default: {
    findById: mockUserFindById,
    updateById: mockUserUpdateById,
  },
}));

vi.mock('../../../drizzle/db.js', () => ({
  db: {
    transaction: mockDbTransaction,
  },
}));

vi.mock('../../../drizzle/schema.js', () => ({
  transactions: {},
  users: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  desc: vi.fn(),
}));

vi.mock('../../../src/services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import router under test
// ---------------------------------------------------------------------------

import router from '../../../routes/login-rewards.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/rewards', router);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Login Rewards routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET /api/rewards/status
  // =========================================================================
  describe('GET /status', () => {
    it('should return canClaim: true when not claimed today', async () => {
      mockHasClaimedToday.mockResolvedValue(false);

      const res = await request(createApp()).get('/api/rewards/status');

      expect(res.status).toBe(200);
      expect(res.body.canClaim).toBe(true);
      expect(res.body.nextRewardTime).toBeNull();
    });

    it('should return canClaim: false when already claimed today', async () => {
      mockHasClaimedToday.mockResolvedValue(true);

      const res = await request(createApp()).get('/api/rewards/status');

      expect(res.status).toBe(200);
      expect(res.body.canClaim).toBe(false);
      expect(res.body.nextRewardTime).toBeDefined();
    });

    it('should return 500 on error', async () => {
      mockHasClaimedToday.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp()).get('/api/rewards/status');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });

    it('should return 401 when userId is missing from request', async () => {
      // Override auth to not inject user
      const { authenticate } = await import('../../../middleware/auth.js');
      (authenticate as any).mockImplementationOnce((req, res, next) => {
        req.user = {}; // no userId
        next();
      });

      const res = await request(createApp()).get('/api/rewards/status');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Authentication required' });
    });
  });

  // =========================================================================
  // POST /api/rewards/claim
  // =========================================================================
  describe('POST /claim', () => {
    it('should claim a daily reward successfully', async () => {
      mockHasClaimedToday.mockResolvedValue(false);
      mockGenerateRewardAmount.mockReturnValue(50);
      mockUserFindById.mockResolvedValue({
        id: 1,
        balance: '1000.00',
      });

      // Mock the db.transaction to execute the callback
      mockDbTransaction.mockImplementation(async (cb) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue({}),
          }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ id: 1 }]),
                }),
              }),
            }),
          }),
        };
        return cb(tx);
      });

      const res = await request(createApp()).post('/api/rewards/claim');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        rewardAmount: 50,
        newBalance: 1050,
      });
    });

    it('should return 400 when already claimed today', async () => {
      mockHasClaimedToday.mockResolvedValue(true);

      const res = await request(createApp()).post('/api/rewards/claim');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Daily reward already claimed');
      expect(res.body.nextClaimTime).toBeDefined();
    });

    it('should return 404 when user not found', async () => {
      mockHasClaimedToday.mockResolvedValue(false);
      mockGenerateRewardAmount.mockReturnValue(25);
      mockUserFindById.mockResolvedValue(null);

      const res = await request(createApp()).post('/api/rewards/claim');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'User not found' });
    });

    it('should return 401 when userId is missing', async () => {
      const { authenticate } = await import('../../../middleware/auth.js');
      (authenticate as any).mockImplementationOnce((req, res, next) => {
        req.user = {}; // no userId
        next();
      });

      const res = await request(createApp()).post('/api/rewards/claim');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Authentication required' });
    });

    it('should return 500 when transaction fails', async () => {
      mockHasClaimedToday.mockResolvedValue(false);
      mockGenerateRewardAmount.mockReturnValue(50);
      mockUserFindById.mockResolvedValue({
        id: 1,
        balance: '1000.00',
      });
      mockDbTransaction.mockRejectedValue(new Error('Transaction error'));

      const res = await request(createApp()).post('/api/rewards/claim');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  // =========================================================================
  // GET /api/rewards/history
  // =========================================================================
  describe('GET /history', () => {
    it('should return reward history with defaults', async () => {
      const rewards = [{ id: 1, amount: 50 }, { id: 2, amount: 25 }];
      mockGetHistoryByUserId.mockResolvedValue(rewards);
      mockGetTotalRewardsByUserId.mockResolvedValue(75);

      const res = await request(createApp()).get('/api/rewards/history');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        rewards,
        totalRewards: 75,
      });
      expect(mockGetHistoryByUserId).toHaveBeenCalledWith(1, 30);
    });

    it('should accept a custom limit', async () => {
      mockGetHistoryByUserId.mockResolvedValue([]);
      mockGetTotalRewardsByUserId.mockResolvedValue(0);

      const res = await request(createApp()).get('/api/rewards/history?limit=5');

      expect(res.status).toBe(200);
      expect(mockGetHistoryByUserId).toHaveBeenCalledWith(1, 5);
    });

    it('should clamp limit to max 100', async () => {
      mockGetHistoryByUserId.mockResolvedValue([]);
      mockGetTotalRewardsByUserId.mockResolvedValue(0);

      const res = await request(createApp()).get('/api/rewards/history?limit=500');

      expect(res.status).toBe(200);
      expect(mockGetHistoryByUserId).toHaveBeenCalledWith(1, 100);
    });

    it('should default to 30 when invalid limit', async () => {
      mockGetHistoryByUserId.mockResolvedValue([]);
      mockGetTotalRewardsByUserId.mockResolvedValue(0);

      const res = await request(createApp()).get('/api/rewards/history?limit=abc');

      expect(res.status).toBe(200);
      expect(mockGetHistoryByUserId).toHaveBeenCalledWith(1, 30);
    });

    it('should return 401 when userId is missing', async () => {
      const { authenticate } = await import('../../../middleware/auth.js');
      (authenticate as any).mockImplementationOnce((req, res, next) => {
        req.user = {};
        next();
      });

      const res = await request(createApp()).get('/api/rewards/history');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Authentication required' });
    });

    it('should return 500 on error', async () => {
      mockGetHistoryByUserId.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp()).get('/api/rewards/history');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });
});
