// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  mockList,
  mockGetLeaderboard,
  mockGetUserEntry,
  mockGetUserRank,
} = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockGetLeaderboard: vi.fn(),
  mockGetUserEntry: vi.fn(),
  mockGetUserRank: vi.fn(),
}));

const { mockAuthUser, mockAuthState } = vi.hoisted(() => ({
  mockAuthUser: { userId: 100, username: 'player', role: 'user' },
  mockAuthState: { authenticated: true },
}));

vi.mock('../../../middleware/auth.js', () => ({
  authenticate: vi.fn((req, res, next) => {
    if (!mockAuthState.authenticated) return res.status(401).json({ message: 'No session' });
    req.user = mockAuthUser;
    next();
  }),
}));

vi.mock('../../../src/services/loggingService.js', () => ({
  default: { logSystemEvent: vi.fn() },
}));

vi.mock('../../../src/services/tournamentService.js', () => ({
  default: {
    list: mockList,
    getLeaderboard: mockGetLeaderboard,
    getUserEntry: mockGetUserEntry,
    getUserRank: mockGetUserRank,
  },
}));

import router from '../../../routes/tournaments.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/tournaments', router);
  return app;
}

function fakeT(overrides: any = {}) {
  return {
    id: 1,
    name: 'Active T',
    gameType: 'crash',
    scoring: 'biggest_win',
    startTime: new Date(),
    endTime: new Date(Date.now() + 3600_000),
    prizePool: '1000.00',
    prizeDistribution: { '1': 1.0 },
    status: 'active',
    ...overrides,
  };
}

describe('Public tournaments routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.authenticated = true;
    mockAuthUser.userId = 100;
    mockList.mockResolvedValue({ rows: [fakeT()], total: 1 });
    mockGetLeaderboard.mockResolvedValue([
      { id: 1, tournamentId: 1, userId: 200, score: '500', totalWagered: '500', totalWon: '0', biggestWin: '0', rank: null, prizeAmount: null },
      { id: 2, tournamentId: 1, userId: 100, score: '300', totalWagered: '300', totalWon: '0', biggestWin: '0', rank: null, prizeAmount: null },
    ]);
    mockGetUserEntry.mockResolvedValue({
      id: 2, tournamentId: 1, userId: 100, score: '300', totalWagered: '300', totalWon: '0', biggestWin: '0', rank: null, prizeAmount: null,
    });
    mockGetUserRank.mockResolvedValue(2);
  });

  // -------------------------------------------------------------------------
  // GET /active
  // -------------------------------------------------------------------------
  describe('GET /active', () => {
    it('requires auth', async () => {
      mockAuthState.authenticated = false;
      const res = await request(createApp()).get('/api/tournaments/active');
      expect(res.status).toBe(401);
    });

    it('returns active tournaments with leaderboard + myEntry', async () => {
      const res = await request(createApp()).get('/api/tournaments/active');
      expect(res.status).toBe(200);
      expect(res.body.tournaments).toHaveLength(1);
      const t = res.body.tournaments[0];
      expect(t.leaderboard).toHaveLength(2);
      expect(t.myEntry).toBeDefined();
      expect(t.myEntry.userId).toBe(100);
      expect(t.myEntry.rank).toBe(2);
    });

    it('includes top-10 leaderboard slice', async () => {
      const res = await request(createApp()).get('/api/tournaments/active');
      expect(mockGetLeaderboard).toHaveBeenCalledWith(1, 10);
      expect(res.status).toBe(200);
    });

    it('myEntry is null when user has no entry', async () => {
      mockGetUserEntry.mockResolvedValue(null);
      mockGetUserRank.mockResolvedValue(null);
      const res = await request(createApp()).get('/api/tournaments/active');
      expect(res.status).toBe(200);
      expect(res.body.tournaments[0].myEntry).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // GET /:id/leaderboard
  // -------------------------------------------------------------------------
  describe('GET /:id/leaderboard', () => {
    it('requires auth', async () => {
      mockAuthState.authenticated = false;
      const res = await request(createApp()).get('/api/tournaments/1/leaderboard');
      expect(res.status).toBe(401);
    });

    it('returns leaderboard rows', async () => {
      const res = await request(createApp()).get('/api/tournaments/1/leaderboard');
      expect(res.status).toBe(200);
      expect(res.body.rows).toHaveLength(2);
      expect(res.body.rows[0].score).toBe(500);
    });

    it('rejects invalid id', async () => {
      const res = await request(createApp()).get('/api/tournaments/abc/leaderboard');
      expect(res.status).toBe(400);
    });

    it('returns 500 when service throws', async () => {
      mockGetLeaderboard.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).get('/api/tournaments/1/leaderboard');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error reading leaderboard' });
    });
  });

  // -------------------------------------------------------------------------
  // GET /active 500 path
  // -------------------------------------------------------------------------
  describe('GET /active error', () => {
    it('returns 500 when service throws', async () => {
      mockList.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).get('/api/tournaments/active');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error reading active tournaments' });
    });
  });
});
