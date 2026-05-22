// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockDbExecute, mockDetectPatterns, mockLogSystemEvent } = vi.hoisted(() => ({
  mockDbExecute: vi.fn(),
  mockDetectPatterns: vi.fn(),
  mockLogSystemEvent: vi.fn(),
}));

const { mockAuthUser } = vi.hoisted(() => ({
  mockAuthUser: { userId: 1, username: 'admin', role: 'admin' },
}));

vi.mock('../../../middleware/auth.js', () => ({
  authenticate: vi.fn((req, res, next) => {
    if (!mockAuthUser) return res.status(401).json({ message: 'Unauthorized' });
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

vi.mock('../../../src/services/loggingService.js', () => ({
  default: {
    logSystemEvent: mockLogSystemEvent,
  },
}));

vi.mock('../../../src/services/behaviourAnalyticsService.js', () => ({
  default: {
    detectPatterns: mockDetectPatterns,
  },
}));

vi.mock('../../../drizzle/db.js', () => ({
  db: {
    execute: mockDbExecute,
  },
}));

import router from '../../../routes/adminAnalytics.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/analytics', router);
  return app;
}

const STUB_PATTERNS = {
  chasingLosses: {
    detected: true,
    score: 0.42,
    details: { chaseEvents: 8, totalBets: 19, longestChaseStreak: 3 },
  },
  lateNightActivity: {
    detected: false,
    pctOfBetsAfterMidnight: 0.18,
    totalBets: 50,
    lateNightBets: 9,
  },
  botLikeCadence: {
    detected: false,
    interArrivalCv: null,
    sampleSize: 0,
  },
};

// Helper: drizzle execute returns [rows, fields]. Tests just push rows.
const rows = (r: any[]) => [r];

// ---------------------------------------------------------------------------
// GET /games
// ---------------------------------------------------------------------------
describe('GET /api/admin/analytics/games', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.role = 'admin';
  });

  it('returns 403 when user lacks an analytics role', async () => {
    mockAuthUser.role = 'player';
    const res = await request(createApp()).get('/api/admin/analytics/games');
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid period', async () => {
    const res = await request(createApp()).get('/api/admin/analytics/games?period=bogus');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid query/);
  });

  it('aggregates per-game stats and totals for the default period', async () => {
    mockDbExecute
      // games overview
      .mockResolvedValueOnce(rows([
        {
          gameType: 'crash',
          totalSessions: 100,
          totalBetsAmount: '5000.00',
          totalPayoutsAmount: '4500.00',
          uniquePlayers: 20,
          wins: 40,
        },
        {
          gameType: 'roulette',
          totalSessions: 50,
          totalBetsAmount: '2500.00',
          totalPayoutsAmount: '2400.00',
          uniquePlayers: 15,
          wins: 22,
        },
      ]))
      // unique players across all
      .mockResolvedValueOnce(rows([{ uniquePlayers: 30 }]));

    const res = await request(createApp()).get('/api/admin/analytics/games?period=7d');

    expect(res.status).toBe(200);
    expect(res.body.period).toBe('7d');
    expect(res.body.games).toHaveLength(2);
    expect(res.body.games[0].gameType).toBe('crash');
    expect(res.body.games[0].houseProfit).toBe(500);
    expect(res.body.games[0].houseEdge).toBe(10);
    expect(res.body.totals.uniquePlayers).toBe(30);
    expect(res.body.totals.totalSessions).toBe(150);
  });

  it('handles the "all" period with no cutoff', async () => {
    mockDbExecute
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([{ uniquePlayers: 0 }]));

    const res = await request(createApp()).get('/api/admin/analytics/games?period=all');

    expect(res.status).toBe(200);
    expect(res.body.games).toEqual([]);
    expect(res.body.totals.overallHouseEdge).toBe(0); // safeDivide on 0
  });

  it('returns 500 when db.execute throws', async () => {
    mockDbExecute.mockRejectedValueOnce(new Error('db down'));

    const res = await request(createApp()).get('/api/admin/analytics/games');

    expect(res.status).toBe(500);
    expect(mockLogSystemEvent).toHaveBeenCalledWith(
      'analytics_games_overview_error',
      expect.any(Object),
      'error',
    );
  });
});

// ---------------------------------------------------------------------------
// GET /games/:gameType
// ---------------------------------------------------------------------------
describe('GET /api/admin/analytics/games/:gameType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.role = 'admin';
  });

  it('returns 403 for non-analytics roles', async () => {
    mockAuthUser.role = 'player';
    const res = await request(createApp()).get('/api/admin/analytics/games/crash');
    expect(res.status).toBe(403);
  });

  it('returns 400 for an unknown game type', async () => {
    const res = await request(createApp()).get('/api/admin/analytics/games/poker');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid game type');
  });

  it('returns 400 for invalid granularity', async () => {
    const res = await request(createApp()).get('/api/admin/analytics/games/crash?granularity=year');
    expect(res.status).toBe(400);
  });

  it('returns summary, time series and top players for a valid game type', async () => {
    mockDbExecute
      // summary
      .mockResolvedValueOnce(rows([
        {
          totalSessions: 50,
          totalBetsAmount: '2500.00',
          totalPayoutsAmount: '2200.00',
          uniquePlayers: 12,
          averageBet: '50.00',
          maxBet: '500.00',
          averageMultiplier: '2.30',
          wins: 18,
          losses: 30,
          pushes: 2,
          avgSessionDuration: 90,
        },
      ]))
      // time series
      .mockResolvedValueOnce(rows([
        { date: '2026-05-19', sessions: 10, betsAmount: '500.00', payoutsAmount: '450.00', uniquePlayers: 5 },
      ]))
      // top players
      .mockResolvedValueOnce(rows([
        { userId: 7, username: 'alice', sessionsPlayed: 5, totalWagered: '250.00', totalWon: '300.00' },
      ]));

    const res = await request(createApp()).get('/api/admin/analytics/games/crash?period=7d&granularity=day');

    expect(res.status).toBe(200);
    expect(res.body.gameType).toBe('crash');
    expect(res.body.summary.totalSessions).toBe(50);
    expect(res.body.summary.houseProfit).toBe(300);
    expect(res.body.timeSeries).toHaveLength(1);
    expect(res.body.topPlayers).toHaveLength(1);
    expect(res.body.topPlayers[0].netProfit).toBe(50);
  });

  it('handles hour granularity (covers DATE_FORMAT branch)', async () => {
    mockDbExecute
      .mockResolvedValueOnce(rows([{ totalSessions: 0, totalBetsAmount: '0', totalPayoutsAmount: '0', uniquePlayers: 0, averageBet: '0', maxBet: '0', averageMultiplier: '0', wins: 0, losses: 0, pushes: 0, avgSessionDuration: 0 }]))
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([]));

    const res = await request(createApp()).get('/api/admin/analytics/games/crash?granularity=hour&period=24h');
    expect(res.status).toBe(200);
  });

  it('handles week granularity (covers DATE_SUB branch)', async () => {
    mockDbExecute
      .mockResolvedValueOnce(rows([{ totalSessions: 0, totalBetsAmount: '0', totalPayoutsAmount: '0', uniquePlayers: 0, averageBet: '0', maxBet: '0', averageMultiplier: '0', wins: 0, losses: 0, pushes: 0, avgSessionDuration: 0 }]))
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([]));

    const res = await request(createApp()).get('/api/admin/analytics/games/crash?granularity=week&period=all');
    expect(res.status).toBe(200);
  });

  it('returns 500 when the summary query throws', async () => {
    mockDbExecute.mockRejectedValueOnce(new Error('crashed'));

    const res = await request(createApp()).get('/api/admin/analytics/games/crash');
    expect(res.status).toBe(500);
    expect(mockLogSystemEvent).toHaveBeenCalledWith(
      'analytics_game_detail_error',
      expect.objectContaining({ gameType: 'crash' }),
      'error',
    );
  });
});

// ---------------------------------------------------------------------------
// GET /players/:userId/profile
// ---------------------------------------------------------------------------
describe('GET /api/admin/analytics/players/:userId/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.role = 'admin';
    mockDetectPatterns.mockResolvedValue(STUB_PATTERNS);
  });

  function queueProfileSuccess(overrides: any = {}) {
    mockDbExecute
      // 1. user lookup
      .mockResolvedValueOnce(rows([
        overrides.user || {
          id: 42,
          username: 'player42',
          balance: '100.00',
          isActive: 1,
          lastLogin: null,
          memberSince: new Date('2025-01-01'),
        },
      ]))
      // 2. overall stats
      .mockResolvedValueOnce(rows([
        overrides.stats || {
          totalSessions: 10,
          totalWagered: '500.00',
          totalWon: '450.00',
          avgBetSize: '50.00',
          maxBet: '100.00',
          wins: 4,
          losses: 6,
        },
      ]))
      // 3. per-game breakdown
      .mockResolvedValueOnce(overrides.perGame ?? rows([]))
      // 4. deposit/withdrawal totals
      .mockResolvedValueOnce(rows([
        overrides.dw || { totalDeposits: '1000.00', totalWithdrawals: '0' },
      ]))
      // 5. recent sessions
      .mockResolvedValueOnce(overrides.recent ?? rows([]))
      // 6. activity timeline
      .mockResolvedValueOnce(overrides.timeline ?? rows([]))
      // 7. recent sessions for streak
      .mockResolvedValueOnce(overrides.streak ?? rows([]))
      // 8. deposits last 7 days
      .mockResolvedValueOnce(rows([overrides.deposits7 || { cnt: 1 }]));
  }

  it('returns 403 for non-analytics roles', async () => {
    mockAuthUser.role = 'player';
    const res = await request(createApp()).get('/api/admin/analytics/players/1/profile');
    expect(res.status).toBe(403);
  });

  it('returns 400 for an invalid user ID', async () => {
    const res = await request(createApp()).get('/api/admin/analytics/players/abc/profile');
    expect(res.status).toBe(400);
  });

  it('returns 400 for a non-positive user ID', async () => {
    const res = await request(createApp()).get('/api/admin/analytics/players/0/profile');
    expect(res.status).toBe(400);
  });

  it('returns 404 when the user does not exist', async () => {
    mockDbExecute
      .mockResolvedValueOnce(rows([])) // user not found
      .mockResolvedValueOnce(rows([{ totalSessions: 0, totalWagered: '0', totalWon: '0', avgBetSize: '0', maxBet: '0', wins: 0, losses: 0 }]))
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([{ totalDeposits: '0', totalWithdrawals: '0' }]))
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([]))
      .mockResolvedValueOnce(rows([{ cnt: 0 }]));

    const res = await request(createApp()).get('/api/admin/analytics/players/9999/profile');
    expect(res.status).toBe(404);
  });

  it('includes behaviourPatterns and risk indicators', async () => {
    queueProfileSuccess();

    const res = await request(createApp()).get('/api/admin/analytics/players/42/profile');

    expect(res.status).toBe(200);
    expect(mockDetectPatterns).toHaveBeenCalledWith(42);
    expect(res.body.riskIndicators).toHaveProperty('behaviourPatterns');
    expect(res.body.riskIndicators.behaviourPatterns).toEqual(STUB_PATTERNS);
    expect(res.body.riskIndicators).toHaveProperty('riskLevel');
  });

  it('computes favorite game and per-game breakdown when sessions exist', async () => {
    queueProfileSuccess({
      perGame: rows([
        { gameType: 'crash', sessions: 6, totalWagered: '300.00', totalWon: '350.00', avgBet: '50.00', wins: 3 },
        { gameType: 'wheel', sessions: 4, totalWagered: '200.00', totalWon: '100.00', avgBet: '50.00', wins: 1 },
      ]),
    });

    const res = await request(createApp()).get('/api/admin/analytics/players/42/profile');

    expect(res.status).toBe(200);
    expect(res.body.favoriteGame).toEqual(expect.objectContaining({ gameType: 'crash' }));
    expect(res.body.perGameBreakdown).toHaveLength(2);
  });

  it('flags long loss streaks and high wager volumes', async () => {
    const lossSessions = Array.from({ length: 12 }, () => ({ total_bet: '50.00', outcome: '0.00' }));
    queueProfileSuccess({
      streak: rows(lossSessions),
      timeline: rows([{ date: '2026-05-19', sessions: 5, wagered: '6000.00', netResult: '-500.00' }]),
      deposits7: { cnt: 8 },
      recent: rows([
        // long session (> 7200s)
        { id: 1, gameType: 'crash', startTime: new Date(), endTime: new Date(), totalBet: '50', outcome: '0', finalMultiplier: null, durationSeconds: 9000 },
      ]),
    });

    const res = await request(createApp()).get('/api/admin/analytics/players/42/profile');

    expect(res.status).toBe(200);
    expect(res.body.riskIndicators.riskLevel).toBe('critical');
    expect(res.body.riskIndicators.flags).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Extended loss streak/),
        'High daily wager volume',
        'Rapid deposits',
        'Long sessions',
      ]),
    );
  });

  it('returns medium risk for moderate streaks', async () => {
    const moderate = Array.from({ length: 6 }, () => ({ total_bet: '50.00', outcome: '0.00' }));
    queueProfileSuccess({
      streak: rows(moderate),
      timeline: rows([]),
      deposits7: { cnt: 0 },
    });

    const res = await request(createApp()).get('/api/admin/analytics/players/42/profile');

    expect(res.status).toBe(200);
    expect(res.body.riskIndicators.riskLevel).toBe('medium');
  });

  it('returns 500 when one of the parallel queries throws', async () => {
    mockDbExecute.mockRejectedValue(new Error('parallel broke'));

    const res = await request(createApp()).get('/api/admin/analytics/players/42/profile');
    expect(res.status).toBe(500);
    expect(mockLogSystemEvent).toHaveBeenCalledWith(
      'analytics_player_profile_error',
      expect.objectContaining({ userId: '42' }),
      'error',
    );
  });
});

// ---------------------------------------------------------------------------
// GET /players/:userId/sessions
// ---------------------------------------------------------------------------
describe('GET /api/admin/analytics/players/:userId/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.role = 'admin';
  });

  it('returns 403 for non-analytics roles', async () => {
    mockAuthUser.role = 'player';
    const res = await request(createApp()).get('/api/admin/analytics/players/1/sessions');
    expect(res.status).toBe(403);
  });

  it('returns 400 for an invalid user ID', async () => {
    const res = await request(createApp()).get('/api/admin/analytics/players/abc/sessions');
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid query params (bad sortBy)', async () => {
    const res = await request(createApp()).get('/api/admin/analytics/players/1/sessions?sortBy=bogus');
    expect(res.status).toBe(400);
  });

  it('returns 404 when the user is not found', async () => {
    mockDbExecute.mockResolvedValueOnce(rows([])); // user lookup empty

    const res = await request(createApp()).get('/api/admin/analytics/players/9999/sessions');
    expect(res.status).toBe(404);
  });

  it('returns paginated sessions with default sort', async () => {
    mockDbExecute
      .mockResolvedValueOnce(rows([{ id: 42, username: 'player42' }])) // user
      .mockResolvedValueOnce(rows([{ total: 3 }])) // count
      .mockResolvedValueOnce(rows([
        { id: 1, gameType: 'crash', startTime: new Date(), endTime: new Date(), totalBet: '50.00', outcome: '70.00', finalMultiplier: '1.4', durationSeconds: 60 },
      ]));

    const res = await request(createApp()).get('/api/admin/analytics/players/42/sessions');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.sessions).toHaveLength(1);
    expect(res.body.sessions[0].netResult).toBe(20);
  });

  it('honors gameType filter and custom sort', async () => {
    mockDbExecute
      .mockResolvedValueOnce(rows([{ id: 42, username: 'player42' }]))
      .mockResolvedValueOnce(rows([{ total: 0 }]))
      .mockResolvedValueOnce(rows([]));

    const res = await request(createApp())
      .get('/api/admin/analytics/players/42/sessions?gameType=crash&sortBy=totalBet&sortOrder=asc&page=2&limit=5');
    expect(res.status).toBe(200);
  });

  it('returns 500 when the query throws', async () => {
    mockDbExecute.mockRejectedValueOnce(new Error('boom'));
    const res = await request(createApp()).get('/api/admin/analytics/players/42/sessions');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /top-players
// ---------------------------------------------------------------------------
describe('GET /api/admin/analytics/top-players', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.role = 'admin';
  });

  it('returns 403 for non-analytics roles', async () => {
    mockAuthUser.role = 'player';
    const res = await request(createApp()).get('/api/admin/analytics/top-players');
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid metric', async () => {
    const res = await request(createApp()).get('/api/admin/analytics/top-players?metric=junk');
    expect(res.status).toBe(400);
  });

  it('returns top players by wagered (default metric)', async () => {
    mockDbExecute
      // main top-players query
      .mockResolvedValueOnce(rows([
        { userId: 1, username: 'alice', balance: '100', sessionsPlayed: 10, totalWagered: '500.00', totalWon: '400.00', netProfitLoss: '-100', lastActive: new Date() },
      ]))
      // favorite game per player
      .mockResolvedValueOnce(rows([{ gameType: 'crash', cnt: 5 }]));

    const res = await request(createApp()).get('/api/admin/analytics/top-players?period=24h');

    expect(res.status).toBe(200);
    expect(res.body.metric).toBe('wagered');
    expect(res.body.players).toHaveLength(1);
    expect(res.body.players[0].favoriteGame).toBe('crash');
  });

  it('returns top players by profit', async () => {
    mockDbExecute
      .mockResolvedValueOnce(rows([
        { userId: 1, username: 'alice', balance: '100', sessionsPlayed: 5, totalWagered: '100', totalWon: '300', netProfitLoss: '200', lastActive: new Date() },
      ]))
      .mockResolvedValueOnce(rows([{ gameType: 'plinko', cnt: 5 }]));

    const res = await request(createApp()).get('/api/admin/analytics/top-players?metric=profit');
    expect(res.status).toBe(200);
  });

  it('returns top players by sessions', async () => {
    mockDbExecute
      .mockResolvedValueOnce(rows([
        { userId: 1, username: 'alice', balance: '100', sessionsPlayed: 5, totalWagered: '100', totalWon: '50', netProfitLoss: '-50', lastActive: new Date() },
      ]))
      .mockResolvedValueOnce(rows([{ gameType: 'wheel', cnt: 5 }]));

    const res = await request(createApp()).get('/api/admin/analytics/top-players?metric=sessions');
    expect(res.status).toBe(200);
  });

  it('returns top players by deposits with merged game stats', async () => {
    mockDbExecute
      // top depositors
      .mockResolvedValueOnce(rows([
        { userId: 1, username: 'alice', balance: '100', totalDeposits: '500.00', lastActive: new Date() },
      ]))
      // game stats for user 1
      .mockResolvedValueOnce(rows([{ sessionsPlayed: 8, totalWagered: '300.00', totalWon: '250.00' }]))
      // favorite game for user 1
      .mockResolvedValueOnce(rows([{ gameType: 'roulette', cnt: 4 }]));

    const res = await request(createApp()).get('/api/admin/analytics/top-players?metric=deposits&period=all');

    expect(res.status).toBe(200);
    expect(res.body.metric).toBe('deposits');
    expect(res.body.players[0].favoriteGame).toBe('roulette');
    expect(res.body.players[0].sessionsPlayed).toBe(8);
  });

  it('returns 500 when the query throws', async () => {
    mockDbExecute.mockRejectedValueOnce(new Error('boom'));
    const res = await request(createApp()).get('/api/admin/analytics/top-players');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /revenue
// ---------------------------------------------------------------------------
describe('GET /api/admin/analytics/revenue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.role = 'admin';
  });

  it('returns 403 for non-analytics roles', async () => {
    mockAuthUser.role = 'player';
    const res = await request(createApp()).get('/api/admin/analytics/revenue');
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid period', async () => {
    const res = await request(createApp()).get('/api/admin/analytics/revenue?period=bogus');
    expect(res.status).toBe(400);
  });

  it('returns aggregated revenue, summary and time series', async () => {
    mockDbExecute
      .mockResolvedValueOnce(rows([{ totalRevenue: '5000.00' }])) // revenue
      .mockResolvedValueOnce(rows([{ totalDeposits: '10000.00' }])) // deposits
      .mockResolvedValueOnce(rows([{ totalWithdrawals: '4000.00' }])) // withdrawals
      .mockResolvedValueOnce(rows([{ totalBonuses: '200.00' }])) // bonuses
      .mockResolvedValueOnce(rows([{ activePlayerCount: 50 }])) // active players
      .mockResolvedValueOnce(rows([{ newPlayerCount: 5 }])) // new players
      .mockResolvedValueOnce(rows([{ gameType: 'crash', revenue: '3000.00' }])) // revenue by game
      .mockResolvedValueOnce(rows([
        { date: '2026-05-19', revenue: '500', deposits: '1000', withdrawals: '300', activePlayers: 10, newPlayers: 1, gamesPlayed: 25 },
      ])); // time series (joined)

    const res = await request(createApp()).get('/api/admin/analytics/revenue?period=7d');

    expect(res.status).toBe(200);
    expect(res.body.summary.totalRevenue).toBe(5000);
    expect(res.body.summary.netCashflow).toBe(6000);
    expect(res.body.summary.arpu).toBe(100);
    expect(res.body.timeSeries).toHaveLength(1);
    expect(res.body.revenueByGame[0].percentOfTotal).toBe(60);
  });

  it('falls back to a simpler time series when the joined query returns no rows', async () => {
    mockDbExecute
      .mockResolvedValueOnce(rows([{ totalRevenue: '0' }]))
      .mockResolvedValueOnce(rows([{ totalDeposits: '0' }]))
      .mockResolvedValueOnce(rows([{ totalWithdrawals: '0' }]))
      .mockResolvedValueOnce(rows([{ totalBonuses: '0' }]))
      .mockResolvedValueOnce(rows([{ activePlayerCount: 0 }]))
      .mockResolvedValueOnce(rows([{ newPlayerCount: 0 }]))
      .mockResolvedValueOnce(rows([])) // revenue by game empty
      .mockResolvedValueOnce(rows([])) // joined time series empty -> triggers fallback
      .mockResolvedValueOnce(rows([
        { date: '2026-05-19', revenue: '100', activePlayers: 2, gamesPlayed: 5 },
      ])); // simple fallback

    const res = await request(createApp()).get('/api/admin/analytics/revenue?period=all&granularity=hour');

    expect(res.status).toBe(200);
    expect(res.body.timeSeries).toHaveLength(1);
    expect(res.body.timeSeries[0].deposits).toBe(0);
    expect(res.body.timeSeries[0].newPlayers).toBe(0);
  });

  it('returns 500 when the query throws', async () => {
    mockDbExecute.mockRejectedValue(new Error('boom'));
    const res = await request(createApp()).get('/api/admin/analytics/revenue');
    expect(res.status).toBe(500);
    expect(mockLogSystemEvent).toHaveBeenCalledWith(
      'analytics_revenue_error',
      expect.any(Object),
      'error',
    );
  });
});
