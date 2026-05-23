// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock('../../../drizzle/db.js', () => ({
  db: {
    execute: mockExecute,
  },
}));

import analyticsService from '../../services/analyticsService.js';

// Drizzle execute returns [rows, fields]. Service helpers unwrap to rows[].
const rows = (r: any[]) => [r];

describe('analyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Game performance
  // ---------------------------------------------------------------------------

  describe('getGamesOverview', () => {
    it('returns unwrapped per-game rows', async () => {
      mockExecute.mockResolvedValueOnce(rows([
        { gameType: 'crash', totalSessions: 10, totalBetsAmount: '500.00', totalPayoutsAmount: '450.00', uniquePlayers: 5, wins: 4 },
      ]));

      const result = await analyticsService.getGamesOverview(new Date());

      expect(result).toHaveLength(1);
      expect(result[0].gameType).toBe('crash');
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('handles null cutoff (period=all)', async () => {
      mockExecute.mockResolvedValueOnce(rows([]));
      const result = await analyticsService.getGamesOverview(null);
      expect(result).toEqual([]);
    });

    it('returns [] when result envelope is empty', async () => {
      mockExecute.mockResolvedValueOnce([]);
      const result = await analyticsService.getGamesOverview(null);
      expect(result).toEqual([]);
    });

    it('propagates db errors', async () => {
      mockExecute.mockRejectedValueOnce(new Error('db down'));
      await expect(analyticsService.getGamesOverview(null)).rejects.toThrow('db down');
    });
  });

  describe('getUniquePlayersAllGames', () => {
    it('returns the unique-player row', async () => {
      mockExecute.mockResolvedValueOnce(rows([{ uniquePlayers: 42 }]));
      const result = await analyticsService.getUniquePlayersAllGames(new Date());
      expect(result[0].uniquePlayers).toBe(42);
    });

    it('propagates db errors', async () => {
      mockExecute.mockRejectedValueOnce(new Error('boom'));
      await expect(analyticsService.getUniquePlayersAllGames(null)).rejects.toThrow('boom');
    });
  });

  describe('getGameDetailSummary', () => {
    it('returns the summary row for a game type', async () => {
      mockExecute.mockResolvedValueOnce(rows([
        { totalSessions: 50, totalBetsAmount: '2500.00', wins: 18, losses: 30, pushes: 2 },
      ]));
      const result = await analyticsService.getGameDetailSummary('crash', new Date());
      expect(result[0].totalSessions).toBe(50);
    });

    it('propagates db errors', async () => {
      mockExecute.mockRejectedValueOnce(new Error('crashed'));
      await expect(analyticsService.getGameDetailSummary('crash', null)).rejects.toThrow('crashed');
    });
  });

  describe('getGameDetailTimeSeries', () => {
    it('returns time-series rows for day granularity', async () => {
      mockExecute.mockResolvedValueOnce(rows([
        { date: '2026-05-19', sessions: 10, betsAmount: '500.00', payoutsAmount: '450.00', uniquePlayers: 5 },
      ]));
      const result = await analyticsService.getGameDetailTimeSeries('crash', new Date(), 'day');
      expect(result).toHaveLength(1);
    });

    it('supports hour granularity (no cutoff)', async () => {
      mockExecute.mockResolvedValueOnce(rows([]));
      const result = await analyticsService.getGameDetailTimeSeries('crash', null, 'hour');
      expect(result).toEqual([]);
    });

    it('supports week granularity', async () => {
      mockExecute.mockResolvedValueOnce(rows([]));
      const result = await analyticsService.getGameDetailTimeSeries('crash', new Date(), 'week');
      expect(result).toEqual([]);
    });

    it('propagates db errors', async () => {
      mockExecute.mockRejectedValueOnce(new Error('ts failed'));
      await expect(analyticsService.getGameDetailTimeSeries('crash', null, 'day')).rejects.toThrow('ts failed');
    });
  });

  describe('getGameDetailTopPlayers', () => {
    it('returns top-player rows joined with username', async () => {
      mockExecute.mockResolvedValueOnce(rows([
        { userId: 7, username: 'alice', sessionsPlayed: 5, totalWagered: '250.00', totalWon: '300.00' },
      ]));
      const result = await analyticsService.getGameDetailTopPlayers('crash', new Date());
      expect(result[0].username).toBe('alice');
    });

    it('propagates db errors', async () => {
      mockExecute.mockRejectedValueOnce(new Error('boom'));
      await expect(analyticsService.getGameDetailTopPlayers('crash', null)).rejects.toThrow('boom');
    });
  });

  // ---------------------------------------------------------------------------
  // User cohorts / players
  // ---------------------------------------------------------------------------

  describe('getPlayerProfileBundle', () => {
    it('runs eight queries in parallel and returns them in order', async () => {
      mockExecute
        .mockResolvedValueOnce(rows([{ id: 1, username: 'p1' }]))                                 // user
        .mockResolvedValueOnce(rows([{ totalSessions: 5 }]))                                       // overallStats
        .mockResolvedValueOnce(rows([{ gameType: 'crash', sessions: 2 }]))                         // perGame
        .mockResolvedValueOnce(rows([{ totalDeposits: '100', totalWithdrawals: '0' }]))            // depositWithdrawal
        .mockResolvedValueOnce(rows([{ id: 9, gameType: 'crash' }]))                               // recentSessions
        .mockResolvedValueOnce(rows([{ date: '2026-05-19', sessions: 1, wagered: '50', netResult: '5' }])) // activityTimeline
        .mockResolvedValueOnce(rows([{ total_bet: '10', outcome: '0' }]))                          // streak
        .mockResolvedValueOnce(rows([{ cnt: 3 }]));                                                 // depositsCount

      const bundle = await analyticsService.getPlayerProfileBundle(42);

      expect(mockExecute).toHaveBeenCalledTimes(8);
      expect(bundle.user[0].username).toBe('p1');
      expect(bundle.overallStats[0].totalSessions).toBe(5);
      expect(bundle.perGame[0].gameType).toBe('crash');
      expect(bundle.depositWithdrawal[0].totalDeposits).toBe('100');
      expect(bundle.recentSessions[0].id).toBe(9);
      expect(bundle.activityTimeline[0].date).toBe('2026-05-19');
      expect(bundle.recentSessionsForStreak[0].outcome).toBe('0');
      expect(bundle.depositsCount[0].cnt).toBe(3);
    });

    it('propagates an error from any parallel query', async () => {
      mockExecute.mockRejectedValue(new Error('parallel broke'));
      await expect(analyticsService.getPlayerProfileBundle(42)).rejects.toThrow('parallel broke');
    });
  });

  describe('getUserById', () => {
    it('returns user rows', async () => {
      mockExecute.mockResolvedValueOnce(rows([{ id: 42, username: 'player42' }]));
      const result = await analyticsService.getUserById(42);
      expect(result[0].id).toBe(42);
    });

    it('returns empty when user not found', async () => {
      mockExecute.mockResolvedValueOnce(rows([]));
      const result = await analyticsService.getUserById(9999);
      expect(result).toEqual([]);
    });

    it('propagates db errors', async () => {
      mockExecute.mockRejectedValueOnce(new Error('boom'));
      await expect(analyticsService.getUserById(1)).rejects.toThrow('boom');
    });
  });

  describe('getPlayerSessionsCount', () => {
    it('returns the count row', async () => {
      mockExecute.mockResolvedValueOnce(rows([{ total: 17 }]));
      const result = await analyticsService.getPlayerSessionsCount(42, "AND gs.game_type = 'crash'");
      expect(result[0].total).toBe(17);
    });

    it('propagates db errors', async () => {
      mockExecute.mockRejectedValueOnce(new Error('count failed'));
      await expect(analyticsService.getPlayerSessionsCount(42, '')).rejects.toThrow('count failed');
    });
  });

  describe('getPlayerSessionsPage', () => {
    it('returns session rows for a page', async () => {
      mockExecute.mockResolvedValueOnce(rows([
        { id: 1, gameType: 'crash', totalBet: '50', outcome: '70', finalMultiplier: '1.4', durationSeconds: 60 },
      ]));
      const result = await analyticsService.getPlayerSessionsPage(42, '', 'gs.start_time', 'DESC', 25, 0);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('propagates db errors', async () => {
      mockExecute.mockRejectedValueOnce(new Error('paginate failed'));
      await expect(
        analyticsService.getPlayerSessionsPage(42, '', 'gs.start_time', 'DESC', 25, 0),
      ).rejects.toThrow('paginate failed');
    });
  });

  describe('getTopDepositors', () => {
    it('returns top-depositor rows', async () => {
      mockExecute.mockResolvedValueOnce(rows([
        { userId: 1, username: 'alice', balance: '100', totalDeposits: '500.00', lastActive: new Date() },
      ]));
      const result = await analyticsService.getTopDepositors(new Date(), 10);
      expect(result[0].username).toBe('alice');
    });

    it('handles null cutoff', async () => {
      mockExecute.mockResolvedValueOnce(rows([]));
      const result = await analyticsService.getTopDepositors(null, 10);
      expect(result).toEqual([]);
    });

    it('propagates db errors', async () => {
      mockExecute.mockRejectedValueOnce(new Error('boom'));
      await expect(analyticsService.getTopDepositors(null, 10)).rejects.toThrow('boom');
    });
  });

  describe('getUserLifetimeGameStats', () => {
    it('returns the lifetime stats row', async () => {
      mockExecute.mockResolvedValueOnce(rows([
        { sessionsPlayed: 8, totalWagered: '300.00', totalWon: '250.00' },
      ]));
      const result = await analyticsService.getUserLifetimeGameStats(1);
      expect(result[0].sessionsPlayed).toBe(8);
    });

    it('propagates db errors', async () => {
      mockExecute.mockRejectedValueOnce(new Error('boom'));
      await expect(analyticsService.getUserLifetimeGameStats(1)).rejects.toThrow('boom');
    });
  });

  describe('getUserFavoriteGameLifetime', () => {
    it('returns the favorite-game row', async () => {
      mockExecute.mockResolvedValueOnce(rows([{ gameType: 'roulette', cnt: 5 }]));
      const result = await analyticsService.getUserFavoriteGameLifetime(1);
      expect(result[0].gameType).toBe('roulette');
    });

    it('returns empty when player has no sessions', async () => {
      mockExecute.mockResolvedValueOnce(rows([]));
      const result = await analyticsService.getUserFavoriteGameLifetime(1);
      expect(result).toEqual([]);
    });

    it('propagates db errors', async () => {
      mockExecute.mockRejectedValueOnce(new Error('boom'));
      await expect(analyticsService.getUserFavoriteGameLifetime(1)).rejects.toThrow('boom');
    });
  });

  describe('getUserFavoriteGamePeriod', () => {
    it('returns the period-scoped favorite-game row', async () => {
      mockExecute.mockResolvedValueOnce(rows([{ gameType: 'crash', cnt: 7 }]));
      const result = await analyticsService.getUserFavoriteGamePeriod(1, "AND gs.start_time >= '2026-05-01 00:00:00'");
      expect(result[0].gameType).toBe('crash');
    });

    it('propagates db errors', async () => {
      mockExecute.mockRejectedValueOnce(new Error('boom'));
      await expect(analyticsService.getUserFavoriteGamePeriod(1, '')).rejects.toThrow('boom');
    });
  });

  describe('getTopPlayersByGameSessions', () => {
    it('returns top-player rows', async () => {
      mockExecute.mockResolvedValueOnce(rows([
        { userId: 1, username: 'alice', balance: '100', sessionsPlayed: 10, totalWagered: '500.00', totalWon: '400.00', netProfitLoss: '-100', lastActive: new Date() },
      ]));
      const result = await analyticsService.getTopPlayersByGameSessions('', 'totalWagered', 10);
      expect(result[0].username).toBe('alice');
    });

    it('propagates db errors', async () => {
      mockExecute.mockRejectedValueOnce(new Error('boom'));
      await expect(analyticsService.getTopPlayersByGameSessions('', 'totalWagered', 10)).rejects.toThrow('boom');
    });
  });

  // ---------------------------------------------------------------------------
  // Revenue / monetary
  // ---------------------------------------------------------------------------

  describe('getRevenueSummaryBundle', () => {
    it('runs seven parallel queries and returns them in named keys', async () => {
      mockExecute
        .mockResolvedValueOnce(rows([{ totalRevenue: '5000.00' }]))
        .mockResolvedValueOnce(rows([{ totalDeposits: '10000.00' }]))
        .mockResolvedValueOnce(rows([{ totalWithdrawals: '4000.00' }]))
        .mockResolvedValueOnce(rows([{ totalBonuses: '200.00' }]))
        .mockResolvedValueOnce(rows([{ activePlayerCount: 50 }]))
        .mockResolvedValueOnce(rows([{ newPlayerCount: 5 }]))
        .mockResolvedValueOnce(rows([{ gameType: 'crash', revenue: '3000.00' }]));

      const bundle = await analyticsService.getRevenueSummaryBundle(new Date());

      expect(mockExecute).toHaveBeenCalledTimes(7);
      expect(bundle.revenue[0].totalRevenue).toBe('5000.00');
      expect(bundle.deposits[0].totalDeposits).toBe('10000.00');
      expect(bundle.withdrawals[0].totalWithdrawals).toBe('4000.00');
      expect(bundle.bonuses[0].totalBonuses).toBe('200.00');
      expect(bundle.activePlayers[0].activePlayerCount).toBe(50);
      expect(bundle.newPlayers[0].newPlayerCount).toBe(5);
      expect(bundle.revenueByGame[0].gameType).toBe('crash');
    });

    it('handles null cutoff', async () => {
      mockExecute.mockResolvedValue(rows([{}]));
      const bundle = await analyticsService.getRevenueSummaryBundle(null);
      expect(bundle).toHaveProperty('revenue');
      expect(bundle).toHaveProperty('revenueByGame');
    });

    it('propagates an error from any parallel query', async () => {
      mockExecute.mockRejectedValue(new Error('boom'));
      await expect(analyticsService.getRevenueSummaryBundle(null)).rejects.toThrow('boom');
    });
  });

  describe('getRevenueTimeSeriesJoined', () => {
    it('returns joined time-series rows', async () => {
      mockExecute.mockResolvedValueOnce(rows([
        { date: '2026-05-19', revenue: '500', deposits: '1000', withdrawals: '300', activePlayers: 10, newPlayers: 1, gamesPlayed: 25 },
      ]));
      const result = await analyticsService.getRevenueTimeSeriesJoined(new Date(), 'day');
      expect(result).toHaveLength(1);
      expect(result[0].deposits).toBe('1000');
    });

    it('supports hour granularity', async () => {
      mockExecute.mockResolvedValueOnce(rows([]));
      const result = await analyticsService.getRevenueTimeSeriesJoined(null, 'hour');
      expect(result).toEqual([]);
    });

    it('propagates db errors', async () => {
      mockExecute.mockRejectedValueOnce(new Error('join broke'));
      await expect(analyticsService.getRevenueTimeSeriesJoined(null, 'day')).rejects.toThrow('join broke');
    });
  });

  describe('getRevenueTimeSeriesFallback', () => {
    it('returns simple time-series rows', async () => {
      mockExecute.mockResolvedValueOnce(rows([
        { date: '2026-05-19', revenue: '100', activePlayers: 2, gamesPlayed: 5 },
      ]));
      const result = await analyticsService.getRevenueTimeSeriesFallback(new Date(), 'day');
      expect(result[0].revenue).toBe('100');
    });

    it('propagates db errors', async () => {
      mockExecute.mockRejectedValueOnce(new Error('boom'));
      await expect(analyticsService.getRevenueTimeSeriesFallback(null, 'day')).rejects.toThrow('boom');
    });
  });
});
