// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockGetHouseBalance,
  mockGetCaps,
  mockTopUp,
  mockSetHouseBalance,
  mockSetCap,
  mockGetTransactions,
  mockDbExecute,
} = vi.hoisted(() => ({
  mockGetHouseBalance: vi.fn(),
  mockGetCaps: vi.fn(),
  mockTopUp: vi.fn(),
  mockSetHouseBalance: vi.fn(),
  mockSetCap: vi.fn(),
  mockGetTransactions: vi.fn(),
  mockDbExecute: vi.fn(),
}));

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
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    next();
  }),
  adminOrOperator: vi.fn((req, res, next) => {
    if (!['admin', 'operator'].includes(req.user?.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  }),
  adminOrOperatorOrViewer: vi.fn((req, res, next) => {
    if (!['admin', 'operator', 'viewer'].includes(req.user?.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  }),
  userOrAdmin: vi.fn((req, res, next) => next()),
}));

vi.mock('../../../src/services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
  },
}));

vi.mock('../../../src/services/houseService.js', () => ({
  default: {
    getHouseBalance: mockGetHouseBalance,
    getCaps: mockGetCaps,
    topUp: mockTopUp,
    setHouseBalance: mockSetHouseBalance,
    setCap: mockSetCap,
    getTransactions: mockGetTransactions,
  },
  CAP_KEYS: {
    perRound: 'max_payout_per_round',
    perUserPerDay: 'max_payout_per_user_per_day',
    perDay: 'max_payout_per_day_global',
  },
}));

vi.mock('../../../drizzle/db.js', () => ({
  db: {
    execute: mockDbExecute,
  },
}));

import router from '../../../routes/adminHouse.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/house', router);
  return app;
}

const sampleCaps = { perRound: 1000000, perUserPerDay: 10000000, perDay: null };

describe('Admin House routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.role = 'admin';
    mockAuthUser.userId = 1;
    mockGetHouseBalance.mockResolvedValue(500000);
    mockGetCaps.mockResolvedValue(sampleCaps);
  });

  // ---------------------------------------------------------------------------
  // Auth / admin gating
  // ---------------------------------------------------------------------------
  describe('Authorization', () => {
    it('rejects plain user (role=user) on GET /', async () => {
      mockAuthUser.role = 'user';
      const res = await request(createApp()).get('/api/admin/house');
      expect(res.status).toBe(403);
    });

    it('allows viewer on GET / (read-only)', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp()).get('/api/admin/house');
      expect(res.status).toBe(200);
    });

    it('allows operator on GET /', async () => {
      mockAuthUser.role = 'operator';
      const res = await request(createApp()).get('/api/admin/house');
      expect(res.status).toBe(200);
    });

    it('allows viewer on GET /transactions', async () => {
      mockAuthUser.role = 'viewer';
      mockGetTransactions.mockResolvedValue({ rawRows: [], total: 0 });
      const res = await request(createApp()).get('/api/admin/house/transactions');
      expect(res.status).toBe(200);
    });

    it('rejects non-admin on POST /topup', async () => {
      mockAuthUser.role = 'user';
      const res = await request(createApp())
        .post('/api/admin/house/topup')
        .send({ amount: 1000 });
      expect(res.status).toBe(403);
    });

    it('rejects operator on POST /topup (treasury is admin-only)', async () => {
      mockAuthUser.role = 'operator';
      const res = await request(createApp())
        .post('/api/admin/house/topup')
        .send({ amount: 1000 });
      expect(res.status).toBe(403);
      expect(mockTopUp).not.toHaveBeenCalled();
    });

    it('rejects viewer on POST /topup', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp())
        .post('/api/admin/house/topup')
        .send({ amount: 1000 });
      expect(res.status).toBe(403);
    });

    it('rejects operator on POST /set-balance', async () => {
      mockAuthUser.role = 'operator';
      const res = await request(createApp())
        .post('/api/admin/house/set-balance')
        .send({ balance: 1000 });
      expect(res.status).toBe(403);
    });

    it('rejects viewer on POST /set-balance', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp())
        .post('/api/admin/house/set-balance')
        .send({ balance: 1000 });
      expect(res.status).toBe(403);
    });

    it('rejects non-admin on PUT /caps', async () => {
      mockAuthUser.role = 'user';
      const res = await request(createApp())
        .put('/api/admin/house/caps')
        .send({ perRound: 5000 });
      expect(res.status).toBe(403);
    });

    it('rejects operator on PUT /caps (caps are admin-only)', async () => {
      mockAuthUser.role = 'operator';
      const res = await request(createApp())
        .put('/api/admin/house/caps')
        .send({ perRound: 5000 });
      expect(res.status).toBe(403);
      expect(mockSetCap).not.toHaveBeenCalled();
    });

    it('rejects viewer on PUT /caps', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp())
        .put('/api/admin/house/caps')
        .send({ perRound: 5000 });
      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /
  // ---------------------------------------------------------------------------
  describe('GET /', () => {
    it('returns balance and caps', async () => {
      const res = await request(createApp()).get('/api/admin/house');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ balance: 500000, caps: sampleCaps });
      expect(mockGetHouseBalance).toHaveBeenCalled();
      expect(mockGetCaps).toHaveBeenCalled();
    });

    it('returns 500 on service failure', async () => {
      mockGetHouseBalance.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).get('/api/admin/house');
      expect(res.status).toBe(500);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /topup
  // ---------------------------------------------------------------------------
  describe('POST /topup', () => {
    it('increments balance and returns new balance', async () => {
      mockTopUp.mockResolvedValue({ balanceAfter: 600000 });
      const res = await request(createApp())
        .post('/api/admin/house/topup')
        .send({ amount: 100000, reason: 'Treasury inject' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ balance: 600000 });
      expect(mockTopUp).toHaveBeenCalledWith(100000, 1, 'Treasury inject');
    });

    it('rejects non-positive amounts', async () => {
      const res = await request(createApp())
        .post('/api/admin/house/topup')
        .send({ amount: 0 });
      expect(res.status).toBe(400);
      expect(mockTopUp).not.toHaveBeenCalled();
    });

    it('rejects non-numeric amounts', async () => {
      const res = await request(createApp())
        .post('/api/admin/house/topup')
        .send({ amount: 'abc' });
      expect(res.status).toBe(400);
    });

    it('returns 500 on service error', async () => {
      mockTopUp.mockRejectedValue(new Error('db boom'));
      const res = await request(createApp())
        .post('/api/admin/house/topup')
        .send({ amount: 100 });
      expect(res.status).toBe(500);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /set-balance
  // ---------------------------------------------------------------------------
  describe('POST /set-balance', () => {
    it('overrides house balance to provided value', async () => {
      mockSetHouseBalance.mockResolvedValue({ balanceBefore: 500000, balanceAfter: 250000 });
      const res = await request(createApp())
        .post('/api/admin/house/set-balance')
        .send({ balance: 250000, reason: 'Manual reset' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ balance: 250000 });
      expect(mockSetHouseBalance).toHaveBeenCalledWith(250000, 1, 'Manual reset');
    });

    it('rejects negative balance', async () => {
      const res = await request(createApp())
        .post('/api/admin/house/set-balance')
        .send({ balance: -1 });
      expect(res.status).toBe(400);
      expect(mockSetHouseBalance).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // GET /caps
  // ---------------------------------------------------------------------------
  describe('GET /caps', () => {
    it('returns current caps', async () => {
      const res = await request(createApp()).get('/api/admin/house/caps');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ caps: sampleCaps });
    });
  });

  // ---------------------------------------------------------------------------
  // PUT /caps
  // ---------------------------------------------------------------------------
  describe('PUT /caps', () => {
    it('updates only provided caps and returns full updated caps', async () => {
      mockSetCap.mockResolvedValue(undefined);
      mockGetCaps.mockResolvedValue({ perRound: 2000000, perUserPerDay: 10000000, perDay: null });
      const res = await request(createApp())
        .put('/api/admin/house/caps')
        .send({ perRound: 2000000 });
      expect(res.status).toBe(200);
      expect(res.body.caps.perRound).toBe(2000000);
      expect(mockSetCap).toHaveBeenCalledTimes(1);
      expect(mockSetCap).toHaveBeenCalledWith('max_payout_per_round', 2000000, 1);
    });

    it('accepts null to clear a cap', async () => {
      mockSetCap.mockResolvedValue(undefined);
      const res = await request(createApp())
        .put('/api/admin/house/caps')
        .send({ perDay: null });
      expect(res.status).toBe(200);
      expect(mockSetCap).toHaveBeenCalledWith('max_payout_per_day_global', null, 1);
    });

    it('rejects negative values', async () => {
      const res = await request(createApp())
        .put('/api/admin/house/caps')
        .send({ perRound: -10 });
      expect(res.status).toBe(400);
      expect(mockSetCap).not.toHaveBeenCalled();
    });

    it('rejects empty body', async () => {
      const res = await request(createApp())
        .put('/api/admin/house/caps')
        .send({});
      expect(res.status).toBe(400);
    });

    it('updates all three caps when all provided', async () => {
      mockSetCap.mockResolvedValue(undefined);
      const res = await request(createApp())
        .put('/api/admin/house/caps')
        .send({ perRound: 5000, perUserPerDay: 100000, perDay: 1000000 });
      expect(res.status).toBe(200);
      expect(mockSetCap).toHaveBeenCalledTimes(3);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /transactions
  // ---------------------------------------------------------------------------
  describe('GET /transactions', () => {
    it('returns paginated rows', async () => {
      mockGetTransactions.mockResolvedValue({
        rawRows: [
          {
            id: 1,
            type: 'admin_topup',
            amount: '500000.00',
            balance_before: '0.00',
            balance_after: '500000.00',
            user_id: null,
            user_username: null,
            admin_id: 1,
            admin_username: 'admin',
            game_type: null,
            game_session_id: null,
            transaction_id: null,
            reason: 'Initial',
            metadata: null,
            created_at: '2026-05-19T00:00:00.000Z',
          },
        ],
        total: 1,
      });

      const res = await request(createApp())
        .get('/api/admin/house/transactions?limit=10&offset=0');

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.rows).toHaveLength(1);
      expect(res.body.rows[0]).toMatchObject({
        id: 1,
        type: 'admin_topup',
        amount: 500000,
        balanceAfter: 500000,
        adminUsername: 'admin',
      });
    });

    it('clamps limit', async () => {
      mockGetTransactions.mockResolvedValue({ rawRows: [], total: 0 });
      const res = await request(createApp())
        .get('/api/admin/house/transactions?limit=999');
      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(200);
    });

    it('returns 500 on db error', async () => {
      mockGetTransactions.mockRejectedValue(new Error('db boom'));
      const res = await request(createApp())
        .get('/api/admin/house/transactions');
      expect(res.status).toBe(500);
    });
  });

  // ---------------------------------------------------------------------------
  // 500 paths and array-body validation
  // ---------------------------------------------------------------------------
  describe('500 paths and edge validation', () => {
    it('POST /set-balance returns 500 on service error', async () => {
      mockSetHouseBalance.mockRejectedValue(new Error('db boom'));
      const res = await request(createApp())
        .post('/api/admin/house/set-balance')
        .send({ balance: 250000 });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error setting house balance' });
    });

    it('GET /caps returns 500 on service error', async () => {
      mockGetCaps.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).get('/api/admin/house/caps');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error reading payout caps' });
    });

    it('PUT /caps returns 500 when service throws', async () => {
      mockSetCap.mockRejectedValue(new Error('boom'));
      const res = await request(createApp())
        .put('/api/admin/house/caps')
        .send({ perRound: 1000 });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error updating payout caps' });
    });

    it('PUT /caps rejects array body via validateCapsPatch', async () => {
      const res = await request(createApp())
        .put('/api/admin/house/caps')
        .send([1, 2, 3] as any);
      expect(res.status).toBe(400);
      expect(mockSetCap).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// Wire contract — locked response shapes
// Regression gate for the upcoming A5 refactor. The routes must remain
// byte-identical when raw SQL is moved into a service; any drift in keys
// or response shape will fail here.
// ---------------------------------------------------------------------------

function expectIs2dp(value: any) {
  expect(typeof value).toBe('number');
  expect(Number.isFinite(value)).toBe(true);
  expect(Math.round(value * 100) / 100).toBe(value);
}

describe('Wire contract — Admin House', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.role = 'admin';
    mockAuthUser.userId = 1;
    mockGetHouseBalance.mockResolvedValue(500000);
    mockGetCaps.mockResolvedValue({ perRound: 1000000, perUserPerDay: 10000000, perDay: null });
  });

  // -------------------------------------------------------------------------
  // GET /
  // -------------------------------------------------------------------------
  describe('GET /', () => {
    it('locks { balance, caps } shape with caps sub-keys', async () => {
      const res = await request(createApp()).get('/api/admin/house');
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(['balance', 'caps']);
      expect(typeof res.body.balance).toBe('number');
      expect(Number.isFinite(res.body.balance)).toBe(true);
      expect(Object.keys(res.body.caps).sort()).toEqual(['perDay', 'perRound', 'perUserPerDay']);
    });

    it('500 yields { message }', async () => {
      mockGetHouseBalance.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).get('/api/admin/house');
      expect(res.status).toBe(500);
      expect(Object.keys(res.body)).toEqual(['message']);
    });

    it('403 yields { message }', async () => {
      mockAuthUser.role = 'user';
      const res = await request(createApp()).get('/api/admin/house');
      expect(res.status).toBe(403);
      expect(Object.keys(res.body)).toEqual(['message']);
    });
  });

  // -------------------------------------------------------------------------
  // POST /topup
  // -------------------------------------------------------------------------
  describe('POST /topup', () => {
    it('locks { balance } shape on success', async () => {
      mockTopUp.mockResolvedValue({ balanceAfter: 600000 });
      const res = await request(createApp())
        .post('/api/admin/house/topup')
        .send({ amount: 100000 });
      expect(res.status).toBe(200);
      expect(Object.keys(res.body)).toEqual(['balance']);
      expect(typeof res.body.balance).toBe('number');
    });

    it('400 yields { message }', async () => {
      const res = await request(createApp())
        .post('/api/admin/house/topup')
        .send({ amount: 0 });
      expect(res.status).toBe(400);
      expect(Object.keys(res.body)).toEqual(['message']);
    });

    it('403 yields { message }', async () => {
      mockAuthUser.role = 'operator';
      const res = await request(createApp())
        .post('/api/admin/house/topup')
        .send({ amount: 100 });
      expect(res.status).toBe(403);
      expect(Object.keys(res.body)).toEqual(['message']);
    });

    it('500 yields { message }', async () => {
      mockTopUp.mockRejectedValue(new Error('boom'));
      const res = await request(createApp())
        .post('/api/admin/house/topup')
        .send({ amount: 100 });
      expect(res.status).toBe(500);
      expect(Object.keys(res.body)).toEqual(['message']);
    });
  });

  // -------------------------------------------------------------------------
  // POST /set-balance
  // -------------------------------------------------------------------------
  describe('POST /set-balance', () => {
    it('locks { balance } shape on success', async () => {
      mockSetHouseBalance.mockResolvedValue({ balanceBefore: 500000, balanceAfter: 250000 });
      const res = await request(createApp())
        .post('/api/admin/house/set-balance')
        .send({ balance: 250000 });
      expect(res.status).toBe(200);
      expect(Object.keys(res.body)).toEqual(['balance']);
      expect(typeof res.body.balance).toBe('number');
    });

    it('400 yields { message }', async () => {
      const res = await request(createApp())
        .post('/api/admin/house/set-balance')
        .send({ balance: -1 });
      expect(res.status).toBe(400);
      expect(Object.keys(res.body)).toEqual(['message']);
    });

    it('500 yields { message }', async () => {
      mockSetHouseBalance.mockRejectedValue(new Error('boom'));
      const res = await request(createApp())
        .post('/api/admin/house/set-balance')
        .send({ balance: 1 });
      expect(res.status).toBe(500);
      expect(Object.keys(res.body)).toEqual(['message']);
    });
  });

  // -------------------------------------------------------------------------
  // GET /caps
  // -------------------------------------------------------------------------
  describe('GET /caps', () => {
    it('locks { caps } shape with three sub-keys', async () => {
      const res = await request(createApp()).get('/api/admin/house/caps');
      expect(res.status).toBe(200);
      expect(Object.keys(res.body)).toEqual(['caps']);
      expect(Object.keys(res.body.caps).sort()).toEqual(['perDay', 'perRound', 'perUserPerDay']);
    });

    it('500 yields { message }', async () => {
      mockGetCaps.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).get('/api/admin/house/caps');
      expect(res.status).toBe(500);
      expect(Object.keys(res.body)).toEqual(['message']);
    });
  });

  // -------------------------------------------------------------------------
  // PUT /caps
  // -------------------------------------------------------------------------
  describe('PUT /caps', () => {
    it('locks { caps } shape on success', async () => {
      mockSetCap.mockResolvedValue(undefined);
      mockGetCaps.mockResolvedValue({ perRound: 2000000, perUserPerDay: 10000000, perDay: null });
      const res = await request(createApp())
        .put('/api/admin/house/caps')
        .send({ perRound: 2000000 });
      expect(res.status).toBe(200);
      expect(Object.keys(res.body)).toEqual(['caps']);
      expect(Object.keys(res.body.caps).sort()).toEqual(['perDay', 'perRound', 'perUserPerDay']);
    });

    it('400 yields { message }', async () => {
      const res = await request(createApp())
        .put('/api/admin/house/caps')
        .send({ perRound: -10 });
      expect(res.status).toBe(400);
      expect(Object.keys(res.body)).toEqual(['message']);
    });

    it('500 yields { message }', async () => {
      mockSetCap.mockRejectedValue(new Error('boom'));
      const res = await request(createApp())
        .put('/api/admin/house/caps')
        .send({ perRound: 1000 });
      expect(res.status).toBe(500);
      expect(Object.keys(res.body)).toEqual(['message']);
    });
  });

  // -------------------------------------------------------------------------
  // GET /transactions
  // -------------------------------------------------------------------------
  describe('GET /transactions', () => {
    it('locks paginated wrapper and row shape with numeric 2dp fields', async () => {
      mockGetTransactions.mockResolvedValue({
        rawRows: [
          {
            id: 1,
            type: 'admin_topup',
            amount: '500000.00',
            balance_before: '0.00',
            balance_after: '500000.00',
            user_id: null,
            user_username: null,
            admin_id: 1,
            admin_username: 'admin',
            game_type: null,
            game_session_id: null,
            transaction_id: null,
            reason: 'Initial',
            metadata: null,
            created_at: '2026-05-19T00:00:00.000Z',
          },
        ],
        total: 1,
      });

      const res = await request(createApp())
        .get('/api/admin/house/transactions?limit=10&offset=0');
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(['limit', 'offset', 'rows', 'total']);
      expect(Number.isInteger(res.body.total)).toBe(true);
      expect(Number.isInteger(res.body.limit)).toBe(true);
      expect(Number.isInteger(res.body.offset)).toBe(true);

      const row = res.body.rows[0];
      expect(Object.keys(row).sort()).toEqual([
        'adminId',
        'adminUsername',
        'amount',
        'balanceAfter',
        'balanceBefore',
        'createdAt',
        'gameSessionId',
        'gameType',
        'id',
        'metadata',
        'reason',
        'transactionId',
        'type',
        'userId',
        'userUsername',
      ]);
      expectIs2dp(row.amount);
      expectIs2dp(row.balanceBefore);
      expectIs2dp(row.balanceAfter);
    });

    it('500 yields { message }', async () => {
      mockGetTransactions.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).get('/api/admin/house/transactions');
      expect(res.status).toBe(500);
      expect(Object.keys(res.body)).toEqual(['message']);
    });
  });
});
