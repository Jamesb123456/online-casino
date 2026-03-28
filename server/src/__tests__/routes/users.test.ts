// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockFindById, mockFind, mockFindOne, mockCreate, mockUpdateById, mockGetLatestBalance, mockGetBalanceHistory, mockBalanceCreate, mockTransactionFind, mockTransactionCreate } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockFind: vi.fn(),
  mockFindOne: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdateById: vi.fn(),
  mockGetLatestBalance: vi.fn(),
  mockGetBalanceHistory: vi.fn(),
  mockBalanceCreate: vi.fn(),
  mockTransactionFind: vi.fn(),
  mockTransactionCreate: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../middleware/auth.js', () => ({
  authenticate: vi.fn((req, res, next) => {
    req.user = { userId: 1, username: 'testuser', role: 'user' };
    next();
  }),
  adminOnly: vi.fn((req, res, next) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Access denied. Admin only.' });
    next();
  }),
  userOrAdmin: vi.fn((req, res, next) => next()),
}));

vi.mock('../../../drizzle/models/User.js', () => ({
  default: {
    findById: mockFindById,
    find: mockFind,
    findOne: mockFindOne,
    create: mockCreate,
    updateById: mockUpdateById,
  },
}));

vi.mock('../../../drizzle/models/Balance.js', () => ({
  default: {
    getLatestBalance: mockGetLatestBalance,
    getBalanceHistory: mockGetBalanceHistory,
    create: mockBalanceCreate,
  },
}));

vi.mock('../../../drizzle/models/Transaction.js', () => ({
  default: {
    find: mockTransactionFind,
    create: mockTransactionCreate,
  },
}));

vi.mock('../../../src/services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import router under test (after mocks)
// ---------------------------------------------------------------------------

import router from '../../../routes/users.js';
import bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', router);
  return app;
}

const baseUser = {
  id: 1,
  username: 'testuser',
  role: 'user',
  balance: '1000.00',
  isActive: true,
  createdAt: new Date('2025-01-01'),
  lastLogin: new Date('2025-06-01'),
  updatedAt: new Date('2025-06-01'),
  passwordHash: '$2a$12$hashedpassword',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Users routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET /api/users/me
  // =========================================================================
  describe('GET /me', () => {
    it('should return current user data when authenticated', async () => {
      mockFindById.mockResolvedValue(baseUser);

      const res = await request(createApp()).get('/api/users/me');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 1,
        username: 'testuser',
        role: 'user',
        balance: 1000,
        isActive: true,
      });
      expect(mockFindById).toHaveBeenCalledWith(1);
    });

    it('should return 404 when user is not found', async () => {
      mockFindById.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/users/me');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'User not found' });
    });

    it('should return 500 when database throws', async () => {
      mockFindById.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp()).get('/api/users/me');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error fetching user data' });
    });

    it('should default balance to 0 when user has no balance', async () => {
      mockFindById.mockResolvedValue({ ...baseUser, balance: null });

      const res = await request(createApp()).get('/api/users/me');

      expect(res.status).toBe(200);
      expect(res.body.balance).toBe(0);
    });
  });

  // =========================================================================
  // GET /api/users/profile
  // =========================================================================
  describe('GET /profile', () => {
    it('should return user profile with balance from Balance model', async () => {
      mockFindById.mockResolvedValue(baseUser);
      mockGetLatestBalance.mockResolvedValue({ amount: 500 });

      const res = await request(createApp()).get('/api/users/profile');

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        id: 1,
        username: 'testuser',
        balance: 500,
      });
    });

    it('should return 0 balance when no balance record exists', async () => {
      mockFindById.mockResolvedValue(baseUser);
      mockGetLatestBalance.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/users/profile');

      expect(res.status).toBe(200);
      expect(res.body.user.balance).toBe(0);
    });

    it('should return 404 when user is not found', async () => {
      mockFindById.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/users/profile');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'User not found' });
    });

    it('should return 500 when an error occurs', async () => {
      mockFindById.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp()).get('/api/users/profile');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error fetching profile' });
    });
  });

  // =========================================================================
  // PUT /api/users/profile
  // =========================================================================
  describe('PUT /profile', () => {
    it('should update password when current password is correct', async () => {
      mockFindById.mockResolvedValue(baseUser);
      (bcrypt.compare as any).mockResolvedValue(true);
      (bcrypt.hash as any).mockResolvedValue('$2a$12$newhash');
      mockUpdateById.mockResolvedValue({ ...baseUser });

      const res = await request(createApp())
        .put('/api/users/profile')
        .send({ currentPassword: 'oldpass', newPassword: 'newpass123' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Profile updated successfully' });
      expect(mockUpdateById).toHaveBeenCalledWith(1, expect.objectContaining({
        passwordHash: '$2a$12$newhash',
      }));
    });

    it('should return 400 when current password is incorrect', async () => {
      mockFindById.mockResolvedValue(baseUser);
      (bcrypt.compare as any).mockResolvedValue(false);

      const res = await request(createApp())
        .put('/api/users/profile')
        .send({ currentPassword: 'wrongpass', newPassword: 'newpass123' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Current password is incorrect' });
    });

    it('should succeed with no changes when no password fields provided', async () => {
      mockFindById.mockResolvedValue(baseUser);

      const res = await request(createApp())
        .put('/api/users/profile')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Profile updated successfully' });
      expect(mockUpdateById).not.toHaveBeenCalled();
    });

    it('should return 404 when user is not found', async () => {
      mockFindById.mockResolvedValue(null);

      const res = await request(createApp())
        .put('/api/users/profile')
        .send({ currentPassword: 'old', newPassword: 'new123' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'User not found' });
    });

    it('should return 500 when database throws', async () => {
      mockFindById.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp())
        .put('/api/users/profile')
        .send({});

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error updating profile' });
    });
  });

  // =========================================================================
  // GET /api/users/balance
  // =========================================================================
  describe('GET /balance', () => {
    it('should return user balance', async () => {
      mockGetLatestBalance.mockResolvedValue({ amount: 750 });

      const res = await request(createApp()).get('/api/users/balance');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ balance: 750 });
    });

    it('should return 0 when no balance record exists', async () => {
      mockGetLatestBalance.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/users/balance');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ balance: 0 });
    });

    it('should return 500 on error', async () => {
      mockGetLatestBalance.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp()).get('/api/users/balance');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error fetching balance' });
    });
  });

  // =========================================================================
  // GET /api/users/balance/history
  // =========================================================================
  describe('GET /balance/history', () => {
    it('should return balance history', async () => {
      const history = [{ id: 1, amount: 1000 }, { id: 2, amount: 900 }];
      mockGetBalanceHistory.mockResolvedValue(history);

      const res = await request(createApp()).get('/api/users/balance/history');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(history);
      expect(mockGetBalanceHistory).toHaveBeenCalledWith(1, 100);
    });

    it('should return 500 on error', async () => {
      mockGetBalanceHistory.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp()).get('/api/users/balance/history');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error fetching balance history' });
    });
  });

  // =========================================================================
  // GET /api/users/transactions
  // =========================================================================
  describe('GET /transactions', () => {
    it('should return transactions with default parameters', async () => {
      const txns = [{ id: 1, type: 'deposit', amount: 100 }];
      mockTransactionFind.mockResolvedValue(txns);

      const res = await request(createApp()).get('/api/users/transactions');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(txns);
      expect(mockTransactionFind).toHaveBeenCalledWith(
        { userId: 1 },
        { sort: { createdAt: -1 }, limit: 50 }
      );
    });

    it('should filter by valid type', async () => {
      mockTransactionFind.mockResolvedValue([]);

      const res = await request(createApp())
        .get('/api/users/transactions?type=deposit');

      expect(res.status).toBe(200);
      expect(mockTransactionFind).toHaveBeenCalledWith(
        { userId: 1, type: 'deposit' },
        expect.any(Object)
      );
    });

    it('should ignore invalid type', async () => {
      mockTransactionFind.mockResolvedValue([]);

      const res = await request(createApp())
        .get('/api/users/transactions?type=invalid_type');

      expect(res.status).toBe(200);
      // The filter should not include the invalid type
      expect(mockTransactionFind).toHaveBeenCalledWith(
        { userId: 1 },
        expect.any(Object)
      );
    });

    it('should respect limit parameter and clamp to max 100', async () => {
      mockTransactionFind.mockResolvedValue([]);

      const res = await request(createApp())
        .get('/api/users/transactions?limit=200');

      expect(res.status).toBe(200);
      expect(mockTransactionFind).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ limit: 100 })
      );
    });

    it('should default to 50 limit when invalid limit is passed', async () => {
      mockTransactionFind.mockResolvedValue([]);

      const res = await request(createApp())
        .get('/api/users/transactions?limit=abc');

      expect(res.status).toBe(200);
      expect(mockTransactionFind).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ limit: 50 })
      );
    });

    it('should filter by date range', async () => {
      mockTransactionFind.mockResolvedValue([]);

      const res = await request(createApp())
        .get('/api/users/transactions?startDate=2025-01-01&endDate=2025-12-31');

      expect(res.status).toBe(200);
      const calledFilter = mockTransactionFind.mock.calls[0][0];
      expect(calledFilter.createdAt).toBeDefined();
      expect(calledFilter.createdAt.$gte).toBeInstanceOf(Date);
      expect(calledFilter.createdAt.$lte).toBeInstanceOf(Date);
    });

    it('should ignore invalid dates', async () => {
      mockTransactionFind.mockResolvedValue([]);

      const res = await request(createApp())
        .get('/api/users/transactions?startDate=not-a-date');

      expect(res.status).toBe(200);
    });

    it('should return 500 on error', async () => {
      mockTransactionFind.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp()).get('/api/users/transactions');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error fetching transactions' });
    });
  });
});
