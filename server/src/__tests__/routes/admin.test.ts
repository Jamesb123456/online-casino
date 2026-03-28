// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockUserFind,
  mockUserFindAll,
  mockUserFindById,
  mockUserFindOne,
  mockUserCreate,
  mockUserUpdateById,
  mockTransactionFind,
  mockTransactionCount,
  mockTransactionCreate,
  mockTransactionFindById,
  mockTransactionUpdateById,
  mockGameStatFindAll,
  mockBalanceGetLatestBalance,
  mockBalanceCreate,
  mockBalanceServiceManualAdjustment,
  mockDbExecute,
} = vi.hoisted(() => ({
  mockUserFind: vi.fn(),
  mockUserFindAll: vi.fn(),
  mockUserFindById: vi.fn(),
  mockUserFindOne: vi.fn(),
  mockUserCreate: vi.fn(),
  mockUserUpdateById: vi.fn(),
  mockTransactionFind: vi.fn(),
  mockTransactionCount: vi.fn(),
  mockTransactionCreate: vi.fn(),
  mockTransactionFindById: vi.fn(),
  mockTransactionUpdateById: vi.fn(),
  mockGameStatFindAll: vi.fn(),
  mockBalanceGetLatestBalance: vi.fn(),
  mockBalanceCreate: vi.fn(),
  mockBalanceServiceManualAdjustment: vi.fn(),
  mockDbExecute: vi.fn(),
}));

// Tracks which user the auth middleware injects (admin vs. regular user)
const { mockAuthUser } = vi.hoisted(() => ({
  mockAuthUser: { userId: 1, username: 'admin', role: 'admin' },
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../middleware/auth.js', () => ({
  authenticate: vi.fn((req, res, next) => {
    req.user = mockAuthUser;
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
    find: mockUserFind,
    findAll: mockUserFindAll,
    findById: mockUserFindById,
    findOne: mockUserFindOne,
    create: mockUserCreate,
    updateById: mockUserUpdateById,
  },
}));

vi.mock('../../../drizzle/models/Transaction.js', () => ({
  default: {
    find: mockTransactionFind,
    count: mockTransactionCount,
    create: mockTransactionCreate,
    findById: mockTransactionFindById,
    updateById: mockTransactionUpdateById,
  },
}));

vi.mock('../../../drizzle/models/GameStat.js', () => ({
  default: {
    findAll: mockGameStatFindAll,
  },
}));

vi.mock('../../../drizzle/models/Balance.js', () => ({
  default: {
    getLatestBalance: mockBalanceGetLatestBalance,
    create: mockBalanceCreate,
  },
}));

vi.mock('../../../src/services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
  },
}));

vi.mock('../../../src/services/balanceService.js', () => ({
  default: {
    manualAdjustment: mockBalanceServiceManualAdjustment,
  },
}));

vi.mock('../../../drizzle/db.js', () => ({
  db: {
    execute: mockDbExecute,
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$12$hashed'),
    compare: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import router under test
// ---------------------------------------------------------------------------

import router from '../../../routes/admin.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', router);
  return app;
}

const sampleUser = {
  id: 10,
  username: 'player1',
  role: 'user',
  balance: '500.00',
  isActive: true,
  createdAt: new Date('2025-01-01'),
  lastLogin: new Date('2025-06-01'),
  updatedAt: new Date('2025-06-01'),
  passwordHash: '$2a$12$hash',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Admin routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated as admin
    mockAuthUser.role = 'admin';
    mockAuthUser.userId = 1;
    mockAuthUser.username = 'admin';
  });

  // =========================================================================
  // Authorization: non-admin access
  // =========================================================================
  describe('Authorization', () => {
    it('should reject non-admin users on GET /users', async () => {
      mockAuthUser.role = 'user';

      const res = await request(createApp()).get('/api/admin/users');

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ message: 'Access denied. Admin only.' });
    });

    it('should reject non-admin users on POST /users', async () => {
      mockAuthUser.role = 'user';

      const res = await request(createApp())
        .post('/api/admin/users')
        .send({ username: 'new', password: 'pass123', role: 'user' });

      expect(res.status).toBe(403);
    });

    it('should reject non-admin users on GET /dashboard', async () => {
      mockAuthUser.role = 'user';

      const res = await request(createApp()).get('/api/admin/dashboard');

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // GET /api/admin/users
  // =========================================================================
  describe('GET /users', () => {
    it('should return all users as admin', async () => {
      mockUserFind.mockResolvedValue([sampleUser]);

      const res = await request(createApp()).get('/api/admin/users');

      expect(res.status).toBe(200);
      expect(res.body.players).toHaveLength(1);
      expect(res.body.totalCount).toBe(1);
      expect(res.body.players[0]).toMatchObject({
        id: 10,
        username: 'player1',
        role: 'user',
      });
      // Should NOT leak passwordHash
      expect(res.body.players[0]).not.toHaveProperty('passwordHash');
    });

    it('should return 500 on error', async () => {
      mockUserFind.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp()).get('/api/admin/users');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error fetching users' });
    });
  });

  // =========================================================================
  // POST /api/admin/users
  // =========================================================================
  describe('POST /users', () => {
    it('should create a new user', async () => {
      mockUserFindOne.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue({
        id: 20,
        username: 'newuser',
        role: 'user',
        isActive: true,
        createdAt: new Date(),
      });

      const res = await request(createApp())
        .post('/api/admin/users')
        .send({ username: 'newuser', password: 'password123', role: 'user' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: 20,
        username: 'newuser',
        role: 'user',
        isActive: true,
      });
    });

    it('should return 400 when user already exists', async () => {
      mockUserFindOne.mockResolvedValue(sampleUser);

      const res = await request(createApp())
        .post('/api/admin/users')
        .send({ username: 'player1', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'User already exists' });
    });

    it('should return 400 for validation errors (short username)', async () => {
      const res = await request(createApp())
        .post('/api/admin/users')
        .send({ username: 'ab', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Username must be at least 3 characters');
    });

    it('should return 400 for validation errors (short password)', async () => {
      const res = await request(createApp())
        .post('/api/admin/users')
        .send({ username: 'validuser', password: '12' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Password must be at least 6 characters');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(createApp())
        .post('/api/admin/users')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 500 on DB error', async () => {
      mockUserFindOne.mockResolvedValue(null);
      mockUserCreate.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp())
        .post('/api/admin/users')
        .send({ username: 'newuser', password: 'password123' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error creating user' });
    });
  });

  // =========================================================================
  // PUT /api/admin/users/:id
  // =========================================================================
  describe('PUT /users/:id', () => {
    it('should update a user', async () => {
      mockUserFindById.mockResolvedValue(sampleUser);
      mockUserUpdateById.mockResolvedValue({
        ...sampleUser,
        username: 'updated',
        updatedAt: new Date(),
      });

      const res = await request(createApp())
        .put('/api/admin/users/10')
        .send({ username: 'updated' });

      expect(res.status).toBe(200);
      expect(res.body.username).toBe('updated');
    });

    it('should return 404 when user not found', async () => {
      mockUserFindById.mockResolvedValue(null);

      const res = await request(createApp())
        .put('/api/admin/users/999')
        .send({ username: 'updated' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'User not found' });
    });

    it('should validate the update body', async () => {
      const res = await request(createApp())
        .put('/api/admin/users/10')
        .send({ username: 'ab' }); // too short

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Username must be at least 3 characters');
    });

    it('should hash the password if provided', async () => {
      mockUserFindById.mockResolvedValue(sampleUser);
      mockUserUpdateById.mockResolvedValue({ ...sampleUser, updatedAt: new Date() });

      const res = await request(createApp())
        .put('/api/admin/users/10')
        .send({ password: 'newpassword123' });

      expect(res.status).toBe(200);
      expect(mockUserUpdateById).toHaveBeenCalledWith(10, expect.objectContaining({
        passwordHash: '$2a$12$hashed',
      }));
    });

    it('should return 500 on error', async () => {
      mockUserFindById.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp())
        .put('/api/admin/users/10')
        .send({ username: 'updated' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error updating user' });
    });
  });

  // =========================================================================
  // DELETE /api/admin/users/:id
  // =========================================================================
  describe('DELETE /users/:id', () => {
    it('should soft-delete (deactivate) a user', async () => {
      mockUserFindById.mockResolvedValue(sampleUser);
      mockUserUpdateById.mockResolvedValue({ ...sampleUser, isActive: false });

      const res = await request(createApp()).delete('/api/admin/users/10');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'User deactivated successfully' });
      expect(mockUserUpdateById).toHaveBeenCalledWith(10, expect.objectContaining({
        isActive: false,
      }));
    });

    it('should return 404 when user not found', async () => {
      mockUserFindById.mockResolvedValue(null);

      const res = await request(createApp()).delete('/api/admin/users/999');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'User not found' });
    });

    it('should return 400 when user is already deactivated', async () => {
      mockUserFindById.mockResolvedValue({ ...sampleUser, isActive: false });

      const res = await request(createApp()).delete('/api/admin/users/10');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'User is already deactivated' });
    });

    it('should return 500 on error', async () => {
      mockUserFindById.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp()).delete('/api/admin/users/10');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error deleting user' });
    });
  });

  // =========================================================================
  // POST /api/admin/users/:id/balance
  // =========================================================================
  describe('POST /users/:id/balance', () => {
    it('should adjust balance upward (positive amount)', async () => {
      mockBalanceServiceManualAdjustment.mockResolvedValue({
        user: { ...sampleUser, balance: '700.00' },
        transaction: { id: 100 },
      });

      const res = await request(createApp())
        .post('/api/admin/users/10/balance')
        .send({ amount: 200, reason: 'Bonus' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Balance updated', newBalance: 700 });
    });

    it('should adjust balance downward (negative amount)', async () => {
      mockBalanceServiceManualAdjustment.mockResolvedValue({
        user: { ...sampleUser, balance: '300.00' },
        transaction: { id: 101 },
      });

      const res = await request(createApp())
        .post('/api/admin/users/10/balance')
        .send({ amount: -200, reason: 'Penalty' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Balance updated', newBalance: 300 });
    });

    it('should return 400 when amount is zero', async () => {
      const res = await request(createApp())
        .post('/api/admin/users/10/balance')
        .send({ amount: 0 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Amount must be a non-zero finite number' });
    });

    it('should return 400 when amount is not a number', async () => {
      const res = await request(createApp())
        .post('/api/admin/users/10/balance')
        .send({ amount: 'abc' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Amount must be a non-zero finite number' });
    });

    it('should return 400 when resulting balance would be negative', async () => {
      mockBalanceServiceManualAdjustment.mockRejectedValue(new Error('Insufficient balance'));

      const res = await request(createApp())
        .post('/api/admin/users/10/balance')
        .send({ amount: -200 });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Insufficient balance' });
    });

    it('should return 404 when user not found', async () => {
      mockBalanceServiceManualAdjustment.mockRejectedValue(new Error('User not found'));

      const res = await request(createApp())
        .post('/api/admin/users/999/balance')
        .send({ amount: 100 });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'User not found' });
    });

    it('should return 500 on error', async () => {
      mockBalanceServiceManualAdjustment.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp())
        .post('/api/admin/users/10/balance')
        .send({ amount: 100 });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error adjusting balance' });
    });

    it('should accept string amounts', async () => {
      mockBalanceServiceManualAdjustment.mockResolvedValue({
        user: { ...sampleUser, balance: '600.00' },
        transaction: { id: 102 },
      });

      const res = await request(createApp())
        .post('/api/admin/users/10/balance')
        .send({ amount: '100' });

      expect(res.status).toBe(200);
      expect(res.body.newBalance).toBe(600);
    });
  });

  // =========================================================================
  // GET /api/admin/dashboard
  // =========================================================================
  describe('GET /dashboard', () => {
    it('should return dashboard stats', async () => {
      mockTransactionFind.mockResolvedValue([]);
      mockGameStatFindAll.mockResolvedValue([
        { gameType: 'crash', name: 'Crash', totalGamesPlayed: 100, houseProfit: 500 },
      ]);
      mockDbExecute.mockResolvedValue([[{ totalUsers: 2, activeUsers: 1, totalBalance: 1500 }]]);

      const res = await request(createApp()).get('/api/admin/dashboard');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        totalPlayers: 2,
        activePlayers: 1,
        totalBalance: 1500,
        totalGames: 100,
        alerts: [],
      });
    });

    it('should return 500 on error', async () => {
      mockTransactionFind.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp()).get('/api/admin/dashboard');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error fetching dashboard data' });
    });
  });

  // =========================================================================
  // GET /api/admin/games
  // =========================================================================
  describe('GET /games', () => {
    it('should return game statistics', async () => {
      mockGameStatFindAll.mockResolvedValue([
        { gameType: 'crash', name: 'Crash', totalGamesPlayed: 200, houseProfit: 1000 },
        { gameType: 'roulette', name: 'Roulette', totalGamesPlayed: 150, houseProfit: 750 },
      ]);

      const res = await request(createApp()).get('/api/admin/games');

      expect(res.status).toBe(200);
      expect(res.body.games).toHaveLength(2);
      expect(res.body.games[0]).toMatchObject({
        name: 'Crash',
        played: 200,
        profit: 1000,
      });
    });

    it('should sort games by totalGamesPlayed descending', async () => {
      mockGameStatFindAll.mockResolvedValue([
        { gameType: 'plinko', name: 'Plinko', totalGamesPlayed: 50, houseProfit: 100 },
        { gameType: 'crash', name: 'Crash', totalGamesPlayed: 200, houseProfit: 500 },
      ]);

      const res = await request(createApp()).get('/api/admin/games');

      expect(res.status).toBe(200);
      expect(res.body.games[0].played).toBeGreaterThanOrEqual(res.body.games[1].played);
    });

    it('should return 500 on error', async () => {
      mockGameStatFindAll.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp()).get('/api/admin/games');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error fetching game stats' });
    });
  });

  // =========================================================================
  // GET /api/admin/transactions
  // =========================================================================
  describe('GET /transactions', () => {
    it('should return paginated transactions', async () => {
      mockTransactionFind.mockResolvedValue([{ id: 1 }]);
      mockTransactionCount.mockResolvedValue(1);

      const res = await request(createApp()).get('/api/admin/transactions');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        transactions: [{ id: 1 }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should accept filter parameters', async () => {
      mockTransactionFind.mockResolvedValue([]);
      mockTransactionCount.mockResolvedValue(0);

      const res = await request(createApp())
        .get('/api/admin/transactions?userId=5&type=deposit&status=completed&page=2&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.page).toBe(2);
      expect(res.body.limit).toBe(10);
    });

    it('should clamp limit to max 100', async () => {
      mockTransactionFind.mockResolvedValue([]);
      mockTransactionCount.mockResolvedValue(0);

      const res = await request(createApp())
        .get('/api/admin/transactions?limit=500');

      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(100);
    });

    it('should filter by date range', async () => {
      mockTransactionFind.mockResolvedValue([]);
      mockTransactionCount.mockResolvedValue(0);

      const res = await request(createApp())
        .get('/api/admin/transactions?startDate=2025-01-01&endDate=2025-12-31');

      expect(res.status).toBe(200);
    });

    it('should return 500 on error', async () => {
      mockTransactionFind.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp()).get('/api/admin/transactions');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error fetching transactions' });
    });
  });

  // =========================================================================
  // POST /api/admin/transactions
  // =========================================================================
  describe('POST /transactions', () => {
    it('should create a credit transaction', async () => {
      mockUserFindById.mockResolvedValue(sampleUser);
      mockBalanceGetLatestBalance.mockResolvedValue({ amount: '500' });
      mockTransactionCreate.mockResolvedValue({ id: 200 });
      mockBalanceCreate.mockResolvedValue({});
      mockUserUpdateById.mockResolvedValue({});

      const res = await request(createApp())
        .post('/api/admin/transactions')
        .send({ userId: 10, type: 'credit', amount: 100, description: 'Admin credit' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        message: 'Transaction created successfully',
        newBalance: 600,
      });
    });

    it('should create a debit transaction', async () => {
      mockUserFindById.mockResolvedValue(sampleUser);
      mockBalanceGetLatestBalance.mockResolvedValue({ amount: '500' });
      mockTransactionCreate.mockResolvedValue({ id: 201 });
      mockBalanceCreate.mockResolvedValue({});
      mockUserUpdateById.mockResolvedValue({});

      const res = await request(createApp())
        .post('/api/admin/transactions')
        .send({ userId: 10, type: 'debit', amount: 100, description: 'Admin debit' });

      expect(res.status).toBe(201);
      expect(res.body.newBalance).toBe(400);
    });

    it('should return 400 when debit would result in negative balance', async () => {
      mockUserFindById.mockResolvedValue(sampleUser);
      mockBalanceGetLatestBalance.mockResolvedValue({ amount: '50' });

      const res = await request(createApp())
        .post('/api/admin/transactions')
        .send({ userId: 10, type: 'debit', amount: 100, description: 'Admin debit' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Insufficient balance' });
    });

    it('should return 404 when user does not exist', async () => {
      mockUserFindById.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/admin/transactions')
        .send({ userId: 999, type: 'credit', amount: 100, description: 'Test' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'User not found' });
    });

    it('should validate required fields', async () => {
      const res = await request(createApp())
        .post('/api/admin/transactions')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should validate type enum (credit/debit)', async () => {
      const res = await request(createApp())
        .post('/api/admin/transactions')
        .send({ userId: 10, type: 'invalid', amount: 100, description: 'Test' });

      expect(res.status).toBe(400);
    });

    it('should validate positive amount', async () => {
      const res = await request(createApp())
        .post('/api/admin/transactions')
        .send({ userId: 10, type: 'credit', amount: -5, description: 'Test' });

      expect(res.status).toBe(400);
    });

    it('should validate non-empty description', async () => {
      const res = await request(createApp())
        .post('/api/admin/transactions')
        .send({ userId: 10, type: 'credit', amount: 100, description: '' });

      expect(res.status).toBe(400);
    });

    it('should return 500 on error', async () => {
      mockUserFindById.mockResolvedValue(sampleUser);
      mockBalanceGetLatestBalance.mockResolvedValue({ amount: '500' });
      mockTransactionCreate.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp())
        .post('/api/admin/transactions')
        .send({ userId: 10, type: 'credit', amount: 100, description: 'Test' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error creating transaction' });
    });
  });

  // =========================================================================
  // PUT /api/admin/transactions/:id/void
  // =========================================================================
  describe('PUT /transactions/:id/void', () => {
    it('should void a transaction', async () => {
      mockTransactionFindById.mockResolvedValue({
        id: 100,
        status: 'completed',
        type: 'deposit',
      });
      mockTransactionUpdateById.mockResolvedValue({
        id: 100,
        status: 'voided',
        voidedReason: 'Mistake',
      });

      const res = await request(createApp())
        .put('/api/admin/transactions/100/void')
        .send({ reason: 'Mistake' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        message: 'Transaction voided successfully',
      });
    });

    it('should return 404 when transaction not found', async () => {
      mockTransactionFindById.mockResolvedValue(null);

      const res = await request(createApp())
        .put('/api/admin/transactions/999/void')
        .send({ reason: 'Test' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'Transaction not found' });
    });

    it('should return 400 when transaction is already voided', async () => {
      mockTransactionFindById.mockResolvedValue({
        id: 100,
        status: 'voided',
      });

      const res = await request(createApp())
        .put('/api/admin/transactions/100/void')
        .send({ reason: 'Test' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'Transaction already voided' });
    });

    it('should return 500 on error', async () => {
      mockTransactionFindById.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp())
        .put('/api/admin/transactions/100/void')
        .send({ reason: 'Test' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error voiding transaction' });
    });
  });
});
