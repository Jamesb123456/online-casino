// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockBalanceServiceManualAdjustment,
  mockDbExecute,
} = vi.hoisted(() => ({
  mockBalanceServiceManualAdjustment: vi.fn(),
  mockDbExecute: vi.fn(),
}));

const { mockAuthUser } = vi.hoisted(() => ({
  mockAuthUser: { userId: 1, username: 'admin', role: 'admin' },
}));

// Toggle to simulate an unauthenticated request
const { authToggles } = vi.hoisted(() => ({
  authToggles: { unauth: false },
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../middleware/auth.js', () => ({
  authenticate: vi.fn((req, res, next) => {
    if (authToggles.unauth) {
      return res.status(401).json({ message: 'No valid session' });
    }
    req.user = mockAuthUser;
    next();
  }),
  adminOnly: vi.fn((req, res, next) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    next();
  }),
  adminOrOperator: vi.fn((req, res, next) => {
    if (!['admin', 'operator'].includes(req.user?.role)) return res.status(403).json({ message: 'Forbidden' });
    next();
  }),
  adminOrOperatorOrViewer: vi.fn((req, res, next) => {
    if (!['admin', 'operator', 'viewer'].includes(req.user?.role)) return res.status(403).json({ message: 'Forbidden' });
    next();
  }),
  userOrAdmin: vi.fn((req, res, next) => next()),
}));

vi.mock('../../../drizzle/models/User.js', () => ({
  default: {
    find: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    updateById: vi.fn(),
  },
}));

vi.mock('../../../drizzle/models/Transaction.js', () => ({
  default: {
    find: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    updateById: vi.fn(),
  },
}));

vi.mock('../../../drizzle/models/GameStat.js', () => ({
  default: { findAll: vi.fn() },
}));

vi.mock('../../../drizzle/models/Balance.js', () => ({
  default: { getLatestBalance: vi.fn(), create: vi.fn() },
}));

vi.mock('../../../src/services/loggingService.js', () => ({
  default: { logSystemEvent: vi.fn() },
}));

vi.mock('../../../src/services/balanceService.js', () => ({
  default: { manualAdjustment: mockBalanceServiceManualAdjustment },
}));

vi.mock('../../../drizzle/db.js', () => ({
  db: { execute: mockDbExecute },
}));

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn(), compare: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Import router under test
// ---------------------------------------------------------------------------

import router from '../../../routes/admin.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', router);
  return app;
}

describe('POST /api/admin/users/bulk-credit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authToggles.unauth = false;
    mockAuthUser.role = 'admin';
    mockAuthUser.userId = 1;
    mockAuthUser.username = 'admin';
    mockBalanceServiceManualAdjustment.mockReset();
    mockDbExecute.mockReset();
  });

  it('returns 401 when unauthenticated', async () => {
    authToggles.unauth = true;
    const res = await request(createApp())
      .post('/api/admin/users/bulk-credit')
      .send({ amount: 100, reason: 'Test', filter: {} });
    expect(res.status).toBe(401);
  });

  it('returns 403 when viewer attempts bulk credit', async () => {
    mockAuthUser.role = 'viewer';
    const res = await request(createApp())
      .post('/api/admin/users/bulk-credit')
      .send({ amount: 100, reason: 'Test', filter: {} });
    expect(res.status).toBe(403);
  });

  it('returns 400 when amount is missing or invalid', async () => {
    const res = await request(createApp())
      .post('/api/admin/users/bulk-credit')
      .send({ amount: 0, reason: 'Test', filter: {} });
    expect(res.status).toBe(400);
  });

  it('returns 400 when reason is missing', async () => {
    const res = await request(createApp())
      .post('/api/admin/users/bulk-credit')
      .send({ amount: 100, reason: '', filter: {} });
    expect(res.status).toBe(400);
  });

  it('credits non-staff users when operator runs with empty filter', async () => {
    mockAuthUser.role = 'operator';
    // db.execute returns [rows, fields] tuple
    mockDbExecute.mockResolvedValueOnce([
      [
        { id: 10, username: 'alice' },
        { id: 11, username: 'bob' },
      ],
    ]);
    mockBalanceServiceManualAdjustment.mockResolvedValue({
      user: { id: 10, balance: '200.00' },
      transaction: { id: 1 },
    });

    const res = await request(createApp())
      .post('/api/admin/users/bulk-credit')
      .send({ amount: 50, reason: 'Friday bonus', filter: {} });

    expect(res.status).toBe(200);
    expect(res.body.credited).toBe(2);
    expect(res.body.failed).toBe(0);
    expect(res.body.totalDebited).toBe(100);
    expect(mockBalanceServiceManualAdjustment).toHaveBeenCalledTimes(2);
    expect(mockBalanceServiceManualAdjustment).toHaveBeenCalledWith(10, 50, 'Friday bonus', mockAuthUser.userId);
    expect(mockBalanceServiceManualAdjustment).toHaveBeenCalledWith(11, 50, 'Friday bonus', mockAuthUser.userId);
  });

  it('dryRun returns count + sample without calling manualAdjustment', async () => {
    mockDbExecute.mockResolvedValueOnce([
      [
        { id: 1, username: 'u1' },
        { id: 2, username: 'u2' },
        { id: 3, username: 'u3' },
        { id: 4, username: 'u4' },
        { id: 5, username: 'u5' },
        { id: 6, username: 'u6' },
        { id: 7, username: 'u7' },
      ],
    ]);

    const res = await request(createApp())
      .post('/api/admin/users/bulk-credit')
      .send({ amount: 10, reason: 'Preview', filter: {}, dryRun: true });

    expect(res.status).toBe(200);
    expect(res.body.wouldCredit).toBe(7);
    expect(res.body.sampleUsernames).toEqual(['u1', 'u2', 'u3', 'u4', 'u5']);
    expect(mockBalanceServiceManualAdjustment).not.toHaveBeenCalled();
  });

  it('idList limits the credit to exactly those users', async () => {
    mockDbExecute.mockResolvedValueOnce([
      [
        { id: 1, username: 'alice' },
        { id: 2, username: 'bob' },
      ],
    ]);
    mockBalanceServiceManualAdjustment.mockResolvedValue({ user: {}, transaction: {} });

    const res = await request(createApp())
      .post('/api/admin/users/bulk-credit')
      .send({ amount: 25, reason: 'Targeted', filter: { idList: [1, 2] } });

    expect(res.status).toBe(200);
    expect(res.body.credited).toBe(2);
    expect(res.body.totalDebited).toBe(50);
    const calledUserIds = mockBalanceServiceManualAdjustment.mock.calls.map(c => c[0]).sort();
    expect(calledUserIds).toEqual([1, 2]);
  });

  it('reports partial failure when one user throws', async () => {
    mockDbExecute.mockResolvedValueOnce([
      [
        { id: 100, username: 'good1' },
        { id: 101, username: 'bad' },
        { id: 102, username: 'good2' },
      ],
    ]);
    mockBalanceServiceManualAdjustment
      .mockResolvedValueOnce({ user: {}, transaction: {} })
      .mockRejectedValueOnce(new Error('User not found'))
      .mockResolvedValueOnce({ user: {}, transaction: {} });

    const res = await request(createApp())
      .post('/api/admin/users/bulk-credit')
      .send({ amount: 75, reason: 'Apology', filter: {} });

    expect(res.status).toBe(200);
    expect(res.body.credited).toBe(2);
    expect(res.body.failed).toBe(1);
    expect(res.body.totalDebited).toBe(150);
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0]).toEqual({ userId: 101, reason: 'User not found' });
  });
});
