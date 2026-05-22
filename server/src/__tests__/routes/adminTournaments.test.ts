// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  mockCreate,
  mockUpdate,
  mockCancel,
  mockList,
  mockGetById,
  mockGetLeaderboard,
  mockFinalize,
} = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockCancel: vi.fn(),
  mockList: vi.fn(),
  mockGetById: vi.fn(),
  mockGetLeaderboard: vi.fn(),
  mockFinalize: vi.fn(),
}));

const { mockAuthUser } = vi.hoisted(() => ({
  mockAuthUser: { userId: 1, username: 'admin', role: 'admin' },
}));

vi.mock('../../../middleware/auth.js', () => ({
  authenticate: vi.fn((req, _res, next) => { req.user = mockAuthUser; next(); }),
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
}));

vi.mock('../../../src/services/loggingService.js', () => ({
  default: { logSystemEvent: vi.fn() },
}));

vi.mock('../../../src/services/tournamentService.js', () => ({
  default: {
    create: mockCreate,
    update: mockUpdate,
    cancel: mockCancel,
    list: mockList,
    getById: mockGetById,
    getLeaderboard: mockGetLeaderboard,
    finalize: mockFinalize,
  },
  KNOWN_GAMES: ['crash', 'plinko', 'wheel', 'roulette', 'blackjack', 'landmines'],
  SCORING_RULES: ['biggest_win', 'total_wagered', 'best_roi'],
}));

import router from '../../../routes/adminTournaments.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/tournaments', router);
  return app;
}

function fakeTournament(overrides: any = {}) {
  return {
    id: 1,
    name: 'T',
    gameType: 'crash',
    scoring: 'biggest_win',
    startTime: new Date(),
    endTime: new Date(Date.now() + 3600_000),
    prizePool: '1000.00',
    prizeDistribution: { '1': 0.5, '2': 0.3, '3': 0.2 },
    status: 'scheduled',
    createdBy: 1,
    finalizedAt: null,
    finalizedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function validPayload(overrides: any = {}) {
  return {
    name: 'Weekly Crash Cup',
    gameType: 'crash',
    scoring: 'biggest_win',
    startTime: new Date(Date.now() + 1000).toISOString(),
    endTime: new Date(Date.now() + 60_000).toISOString(),
    prizePool: 1000,
    prizeDistribution: { '1': 0.5, '2': 0.3, '3': 0.2 },
    ...overrides,
  };
}

describe('Admin Tournaments routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.role = 'admin';
    mockAuthUser.userId = 1;
    mockCreate.mockResolvedValue(fakeTournament());
    mockUpdate.mockResolvedValue(fakeTournament());
    mockCancel.mockResolvedValue(undefined);
    mockList.mockResolvedValue({ rows: [fakeTournament()], total: 1 });
    mockGetById.mockResolvedValue(fakeTournament());
    mockGetLeaderboard.mockResolvedValue([]);
    mockFinalize.mockResolvedValue({ prizesAwarded: 3, totalDebited: 1000 });
  });

  // -------------------------------------------------------------------------
  // GET / role tiering
  // -------------------------------------------------------------------------
  describe('GET /', () => {
    it('viewer allowed', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp()).get('/api/admin/tournaments');
      expect(res.status).toBe(200);
      expect(res.body.rows).toHaveLength(1);
    });

    it('plain user rejected', async () => {
      mockAuthUser.role = 'user';
      const res = await request(createApp()).get('/api/admin/tournaments');
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // POST / validation
  // -------------------------------------------------------------------------
  describe('POST /', () => {
    it('admin can create a tournament', async () => {
      const res = await request(createApp()).post('/api/admin/tournaments').send(validPayload());
      expect(res.status).toBe(201);
      expect(mockCreate).toHaveBeenCalled();
      const [arg] = mockCreate.mock.calls[0];
      expect(arg.createdBy).toBe(1);
    });

    it('operator can create', async () => {
      mockAuthUser.role = 'operator';
      const res = await request(createApp()).post('/api/admin/tournaments').send(validPayload());
      expect(res.status).toBe(201);
    });

    it('viewer rejected with 403', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp()).post('/api/admin/tournaments').send(validPayload());
      expect(res.status).toBe(403);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('rejects when distribution sum != 1.0', async () => {
      const res = await request(createApp())
        .post('/api/admin/tournaments')
        .send(validPayload({ prizeDistribution: { '1': 0.5, '2': 0.4 } }));
      expect(res.status).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('rejects when endTime <= startTime', async () => {
      const t = new Date().toISOString();
      const res = await request(createApp())
        .post('/api/admin/tournaments')
        .send(validPayload({ startTime: t, endTime: t }));
      expect(res.status).toBe(400);
    });

    it('rejects unknown gameType', async () => {
      const res = await request(createApp())
        .post('/api/admin/tournaments')
        .send(validPayload({ gameType: 'slots' }));
      expect(res.status).toBe(400);
    });

    it('rejects unknown scoring rule', async () => {
      const res = await request(createApp())
        .post('/api/admin/tournaments')
        .send(validPayload({ scoring: 'most_wins' }));
      expect(res.status).toBe(400);
    });

    it('rejects non-positive prizePool', async () => {
      const res = await request(createApp())
        .post('/api/admin/tournaments')
        .send(validPayload({ prizePool: 0 }));
      expect(res.status).toBe(400);
    });

    it('rejects invalid distribution key (e.g. "0")', async () => {
      const res = await request(createApp())
        .post('/api/admin/tournaments')
        .send(validPayload({ prizeDistribution: { '0': 1.0 } }));
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // GET /:id
  // -------------------------------------------------------------------------
  describe('GET /:id', () => {
    it('returns tournament + leaderboard', async () => {
      const res = await request(createApp()).get('/api/admin/tournaments/1');
      expect(res.status).toBe(200);
      expect(res.body.tournament).toBeDefined();
      expect(res.body.leaderboard).toEqual([]);
    });

    it('returns 404 when not found', async () => {
      mockGetById.mockResolvedValue(null);
      const res = await request(createApp()).get('/api/admin/tournaments/99');
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // PUT /:id
  // -------------------------------------------------------------------------
  describe('PUT /:id', () => {
    it('admin can update name', async () => {
      const res = await request(createApp())
        .put('/api/admin/tournaments/1')
        .send({ name: 'Renamed' });
      expect(res.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith(1, { name: 'Renamed' });
    });

    it('viewer rejected', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp())
        .put('/api/admin/tournaments/1')
        .send({ name: 'Renamed' });
      expect(res.status).toBe(403);
    });

    it('returns 409 when tournament is not editable', async () => {
      mockUpdate.mockRejectedValue(new Error('tournament_not_editable'));
      const res = await request(createApp())
        .put('/api/admin/tournaments/1')
        .send({ name: 'Renamed' });
      expect(res.status).toBe(409);
    });

    it('rejects empty body with 400', async () => {
      const res = await request(createApp())
        .put('/api/admin/tournaments/1')
        .send({});
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // POST /:id/cancel
  // -------------------------------------------------------------------------
  describe('POST /:id/cancel', () => {
    it('admin can cancel', async () => {
      const res = await request(createApp()).post('/api/admin/tournaments/1/cancel');
      expect(res.status).toBe(200);
      expect(mockCancel).toHaveBeenCalledWith(1, 1);
    });

    it('viewer rejected', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp()).post('/api/admin/tournaments/1/cancel');
      expect(res.status).toBe(403);
    });

    it('returns 409 if not cancellable', async () => {
      mockCancel.mockRejectedValue(new Error('tournament_not_cancellable'));
      const res = await request(createApp()).post('/api/admin/tournaments/1/cancel');
      expect(res.status).toBe(409);
    });
  });

  // -------------------------------------------------------------------------
  // POST /:id/finalize
  // -------------------------------------------------------------------------
  describe('POST /:id/finalize', () => {
    it('admin-only: returns prize summary', async () => {
      const res = await request(createApp()).post('/api/admin/tournaments/1/finalize');
      expect(res.status).toBe(200);
      expect(res.body.prizesAwarded).toBe(3);
      expect(res.body.totalDebited).toBe(1000);
    });

    it('operator rejected with 403', async () => {
      mockAuthUser.role = 'operator';
      const res = await request(createApp()).post('/api/admin/tournaments/1/finalize');
      expect(res.status).toBe(403);
    });

    it('finalize idempotency: second call returns 409 not_active', async () => {
      mockFinalize.mockRejectedValueOnce(new Error('tournament_not_active'));
      const res = await request(createApp()).post('/api/admin/tournaments/1/finalize');
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/not active/i);
    });

    it('returns 409 when end time has not passed', async () => {
      mockFinalize.mockRejectedValue(new Error('tournament_not_ended'));
      const res = await request(createApp()).post('/api/admin/tournaments/1/finalize');
      expect(res.status).toBe(409);
    });
  });

  // -------------------------------------------------------------------------
  // GET /:id/leaderboard
  // -------------------------------------------------------------------------
  describe('GET /:id/leaderboard', () => {
    it('viewer allowed', async () => {
      mockAuthUser.role = 'viewer';
      mockGetLeaderboard.mockResolvedValue([
        { id: 1, tournamentId: 1, userId: 100, score: '500', totalWagered: '500', totalWon: '0', biggestWin: '0', rank: null, prizeAmount: null },
      ]);
      const res = await request(createApp()).get('/api/admin/tournaments/1/leaderboard');
      expect(res.status).toBe(200);
      expect(res.body.rows).toHaveLength(1);
    });

    it('rejects invalid id with 400', async () => {
      const res = await request(createApp()).get('/api/admin/tournaments/abc/leaderboard');
      expect(res.status).toBe(400);
    });

    it('returns 500 when service throws', async () => {
      mockGetLeaderboard.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).get('/api/admin/tournaments/1/leaderboard');
      expect(res.status).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  // Additional validation branches
  // -------------------------------------------------------------------------
  describe('POST / validation branches', () => {
    it('rejects empty/non-string name', async () => {
      const res = await request(createApp())
        .post('/api/admin/tournaments')
        .send(validPayload({ name: '' }));
      expect(res.status).toBe(400);
    });

    it('rejects invalid startTime/endTime (non-parsable)', async () => {
      const res = await request(createApp())
        .post('/api/admin/tournaments')
        .send(validPayload({ startTime: 'not a date', endTime: 'also not' }));
      expect(res.status).toBe(400);
    });

    it('rejects non-object prizeDistribution (array)', async () => {
      const res = await request(createApp())
        .post('/api/admin/tournaments')
        .send(validPayload({ prizeDistribution: [0.5, 0.5] as any }));
      expect(res.status).toBe(400);
    });

    it('rejects empty prizeDistribution', async () => {
      const res = await request(createApp())
        .post('/api/admin/tournaments')
        .send(validPayload({ prizeDistribution: {} }));
      expect(res.status).toBe(400);
    });

    it('rejects prizeDistribution value out of [0,1]', async () => {
      const res = await request(createApp())
        .post('/api/admin/tournaments')
        .send(validPayload({ prizeDistribution: { '1': 1.5 } }));
      expect(res.status).toBe(400);
    });

    it('rejects non-body (string)', async () => {
      const res = await request(createApp())
        .post('/api/admin/tournaments')
        .set('Content-Type', 'text/plain')
        .send('not json');
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // 500 paths and PUT/cancel/get error branches
  // -------------------------------------------------------------------------
  describe('500 paths', () => {
    it('GET / returns 500 on service error', async () => {
      mockList.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).get('/api/admin/tournaments');
      expect(res.status).toBe(500);
    });

    it('POST / returns 500 on service error', async () => {
      mockCreate.mockRejectedValue(new Error('boom'));
      const res = await request(createApp())
        .post('/api/admin/tournaments')
        .send(validPayload());
      expect(res.status).toBe(500);
    });

    it('GET /:id returns 400 on invalid id', async () => {
      const res = await request(createApp()).get('/api/admin/tournaments/abc');
      expect(res.status).toBe(400);
    });

    it('GET /:id returns 500 on service error', async () => {
      mockGetById.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).get('/api/admin/tournaments/1');
      expect(res.status).toBe(500);
    });

    it('PUT /:id returns 400 on invalid id', async () => {
      const res = await request(createApp())
        .put('/api/admin/tournaments/abc')
        .send({ name: 'x' });
      expect(res.status).toBe(400);
    });

    it('PUT /:id maps service validation error to 400', async () => {
      mockUpdate.mockRejectedValue(new Error('invalid_game_type'));
      const res = await request(createApp())
        .put('/api/admin/tournaments/1')
        .send({ gameType: 'bogus' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('invalid_game_type');
    });

    it('PUT /:id maps start_must_precede_end to 400', async () => {
      mockUpdate.mockRejectedValue(new Error('start_must_precede_end'));
      const res = await request(createApp())
        .put('/api/admin/tournaments/1')
        .send({ startTime: 'x', endTime: 'y' });
      expect(res.status).toBe(400);
    });

    it('PUT /:id maps tournament_not_found to 404', async () => {
      mockUpdate.mockRejectedValue(new Error('tournament_not_found'));
      const res = await request(createApp())
        .put('/api/admin/tournaments/1')
        .send({ name: 'x' });
      expect(res.status).toBe(404);
    });

    it('PUT /:id returns 500 on unknown error', async () => {
      mockUpdate.mockRejectedValue(new Error('something else'));
      const res = await request(createApp())
        .put('/api/admin/tournaments/1')
        .send({ name: 'x' });
      expect(res.status).toBe(500);
    });

    it('POST /:id/cancel returns 400 on invalid id', async () => {
      const res = await request(createApp()).post('/api/admin/tournaments/abc/cancel');
      expect(res.status).toBe(400);
    });

    it('POST /:id/cancel maps tournament_not_found to 404', async () => {
      mockCancel.mockRejectedValue(new Error('tournament_not_found'));
      const res = await request(createApp()).post('/api/admin/tournaments/1/cancel');
      expect(res.status).toBe(404);
    });

    it('POST /:id/cancel returns 500 on unknown error', async () => {
      mockCancel.mockRejectedValue(new Error('something else'));
      const res = await request(createApp()).post('/api/admin/tournaments/1/cancel');
      expect(res.status).toBe(500);
    });

    it('POST /:id/finalize returns 400 on invalid id', async () => {
      const res = await request(createApp()).post('/api/admin/tournaments/abc/finalize');
      expect(res.status).toBe(400);
    });

    it('POST /:id/finalize maps tournament_not_found to 404', async () => {
      mockFinalize.mockRejectedValue(new Error('tournament_not_found'));
      const res = await request(createApp()).post('/api/admin/tournaments/1/finalize');
      expect(res.status).toBe(404);
    });

    it('POST /:id/finalize returns 500 on unknown error', async () => {
      mockFinalize.mockRejectedValue(new Error('something else'));
      const res = await request(createApp()).post('/api/admin/tournaments/1/finalize');
      expect(res.status).toBe(500);
    });
  });
});
