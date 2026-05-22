// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecute, mockManualAdjustment } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockManualAdjustment: vi.fn(),
}));

vi.mock('../../drizzle/db.js', () => ({
  db: { execute: mockExecute, transaction: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  sql: Object.assign(
    vi.fn((...args) => args),
    { join: vi.fn((arr, _sep) => arr) },
  ),
  eq: vi.fn((...args) => args),
  and: vi.fn((...args) => args),
  desc: vi.fn((...args) => args),
  relations: vi.fn(() => ({})),
  InferSelectModel: undefined,
  InferInsertModel: undefined,
}));

vi.mock('../services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  },
}));

vi.mock('../services/balanceService.js', () => ({
  default: { manualAdjustment: mockManualAdjustment },
}));

import tournamentService from '../services/tournamentService.js';

function queueExecutes(...resolves: any[]) {
  for (const r of resolves) mockExecute.mockResolvedValueOnce(r);
}

function rowTournament(overrides: any = {}) {
  return {
    id: 1,
    name: 'Test Tournament',
    game_type: 'crash',
    scoring: 'biggest_win',
    start_time: new Date(Date.now() - 60_000),
    end_time: new Date(Date.now() + 60 * 60_000),
    prize_pool: '1000.00',
    prize_distribution: JSON.stringify({ '1': 0.5, '2': 0.3, '3': 0.2 }),
    status: 'scheduled',
    created_by: 1,
    finalized_at: null,
    finalized_by: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function rowEntry(overrides: any = {}) {
  return {
    id: 10,
    tournament_id: 1,
    user_id: 100,
    score: '0',
    total_wagered: '0',
    total_won: '0',
    biggest_win: '0',
    rank: null,
    prize_amount: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('TournamentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockReset();
    mockManualAdjustment.mockReset();
    tournamentService._resetCache();
  });

  // -------------------------------------------------------------------------
  // create + validation
  // -------------------------------------------------------------------------
  describe('create()', () => {
    it('creates a valid tournament', async () => {
      queueExecutes(
        [{ insertId: 1 }],                      // INSERT
        [[rowTournament()]],                    // getById after insert
      );
      const t = await tournamentService.create({
        name: 'T1',
        gameType: 'crash',
        scoring: 'biggest_win',
        startTime: new Date(Date.now() + 1000),
        endTime: new Date(Date.now() + 60_000),
        prizePool: 1000,
        prizeDistribution: { '1': 0.5, '2': 0.3, '3': 0.2 },
        createdBy: 1,
      });
      expect(t.id).toBe(1);
      expect(t.scoring).toBe('biggest_win');
    });

    it('rejects empty name', async () => {
      await expect(tournamentService.create({
        name: '',
        gameType: 'crash',
        scoring: 'biggest_win',
        startTime: new Date(Date.now() + 1000),
        endTime: new Date(Date.now() + 60_000),
        prizePool: 1000,
        prizeDistribution: { '1': 1.0 },
      })).rejects.toThrow('invalid_name');
    });

    it('rejects unknown gameType', async () => {
      await expect(tournamentService.create({
        name: 'T',
        gameType: 'keno',
        scoring: 'biggest_win',
        startTime: new Date(Date.now() + 1000),
        endTime: new Date(Date.now() + 60_000),
        prizePool: 1000,
        prizeDistribution: { '1': 1.0 },
      })).rejects.toThrow('invalid_game_type');
    });

    it('rejects unknown scoring rule', async () => {
      await expect(tournamentService.create({
        name: 'T',
        gameType: 'crash',
        scoring: 'most_hands' as any,
        startTime: new Date(Date.now() + 1000),
        endTime: new Date(Date.now() + 60_000),
        prizePool: 1000,
        prizeDistribution: { '1': 1.0 },
      })).rejects.toThrow('invalid_scoring');
    });

    it('rejects endTime not after startTime', async () => {
      const t = new Date();
      await expect(tournamentService.create({
        name: 'T',
        gameType: 'crash',
        scoring: 'biggest_win',
        startTime: t,
        endTime: t,
        prizePool: 1000,
        prizeDistribution: { '1': 1.0 },
      })).rejects.toThrow('start_must_precede_end');
    });

    it('rejects non-positive prize pool', async () => {
      await expect(tournamentService.create({
        name: 'T',
        gameType: 'crash',
        scoring: 'biggest_win',
        startTime: new Date(Date.now() + 1000),
        endTime: new Date(Date.now() + 60_000),
        prizePool: 0,
        prizeDistribution: { '1': 1.0 },
      })).rejects.toThrow('prize_pool_must_be_positive');
    });

    it('rejects distribution that does not sum to 1', async () => {
      await expect(tournamentService.create({
        name: 'T',
        gameType: 'crash',
        scoring: 'biggest_win',
        startTime: new Date(Date.now() + 1000),
        endTime: new Date(Date.now() + 60_000),
        prizePool: 1000,
        prizeDistribution: { '1': 0.5, '2': 0.4 },
      })).rejects.toThrow('prize_distribution_must_sum_to_one');
    });

    it('rejects non-positive-integer keys in distribution', async () => {
      await expect(tournamentService.create({
        name: 'T',
        gameType: 'crash',
        scoring: 'biggest_win',
        startTime: new Date(Date.now() + 1000),
        endTime: new Date(Date.now() + 60_000),
        prizePool: 1000,
        prizeDistribution: { '0': 1.0 },
      })).rejects.toThrow('invalid_prize_distribution_key');
    });
  });

  // -------------------------------------------------------------------------
  // Scoring math
  // -------------------------------------------------------------------------
  describe('_computeScore()', () => {
    it('biggest_win returns biggestWin', () => {
      const Decimal = require('decimal.js').default;
      const s = tournamentService._computeScore('biggest_win', new Decimal(100), new Decimal(200), new Decimal(50));
      expect(s.toNumber()).toBe(50);
    });

    it('total_wagered returns totalWagered', () => {
      const Decimal = require('decimal.js').default;
      const s = tournamentService._computeScore('total_wagered', new Decimal(150), new Decimal(200), new Decimal(50));
      expect(s.toNumber()).toBe(150);
    });

    it('best_roi returns (won - wagered) / max(wagered, 1)', () => {
      const Decimal = require('decimal.js').default;
      const s = tournamentService._computeScore('best_roi', new Decimal(100), new Decimal(150), new Decimal(50));
      expect(s.toNumber()).toBeCloseTo(0.5, 4);
    });

    it('best_roi divide-by-zero guard: zero wagered uses denom 1', () => {
      const Decimal = require('decimal.js').default;
      const s = tournamentService._computeScore('best_roi', new Decimal(0), new Decimal(5), new Decimal(5));
      expect(s.toNumber()).toBe(5); // (5 - 0) / max(0, 1) = 5
    });
  });

  // -------------------------------------------------------------------------
  // recordBet / recordWin (upsert behaviour)
  // -------------------------------------------------------------------------
  describe('recordBet()', () => {
    it('creates an entry on first bet and updates totalWagered + score', async () => {
      queueExecutes(
        [[rowTournament({ scoring: 'total_wagered' })]], // getById
        undefined,                                        // INSERT IGNORE
        [[rowEntry()]],                                   // select entry
        undefined,                                        // UPDATE
      );
      await tournamentService.recordBet(1, 100, 50);
      expect(mockExecute).toHaveBeenCalledTimes(4);
    });

    it('skips zero bets', async () => {
      await tournamentService.recordBet(1, 100, 0);
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  describe('recordWin()', () => {
    it('updates totalWon + biggestWin when win > current biggest', async () => {
      queueExecutes(
        [[rowTournament({ scoring: 'biggest_win' })]],
        undefined,
        [[rowEntry({ biggest_win: '20.00' })]],
        undefined,
      );
      await tournamentService.recordWin(1, 100, 100);
      // The UPDATE call should set biggest_win = 100 (since 100 > 20)
      const updateCall = mockExecute.mock.calls[3][0];
      const stringified = JSON.stringify(updateCall);
      expect(stringified).toContain('100.00');
    });
  });

  // -------------------------------------------------------------------------
  // getLeaderboard
  // -------------------------------------------------------------------------
  describe('getLeaderboard()', () => {
    it('returns entries ordered by score desc', async () => {
      queueExecutes([[
        rowEntry({ id: 1, score: '500.0000', user_id: 1 }),
        rowEntry({ id: 2, score: '300.0000', user_id: 2 }),
        rowEntry({ id: 3, score: '100.0000', user_id: 3 }),
      ]]);
      const rows = await tournamentService.getLeaderboard(1, 10);
      expect(rows).toHaveLength(3);
      expect(rows[0].userId).toBe(1);
      expect(Number(rows[0].score)).toBe(500);
      expect(rows[2].userId).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // finalize
  // -------------------------------------------------------------------------
  describe('finalize()', () => {
    it('awards prizes from house to top entries and marks finalized', async () => {
      const endedAt = new Date(Date.now() - 1000);
      queueExecutes(
        [[rowTournament({
          status: 'active',
          end_time: endedAt,
          prize_pool: '1000.00',
          prize_distribution: JSON.stringify({ '1': 0.5, '2': 0.3, '3': 0.2 }),
        })]],
        [[{ ended: 1 }]],                       // TZ-safe end_time check (SQL NOW())
        [[
          rowEntry({ id: 10, user_id: 100, score: '500.0000' }),
          rowEntry({ id: 11, user_id: 200, score: '300.0000' }),
          rowEntry({ id: 12, user_id: 300, score: '100.0000' }),
        ]],
        undefined,  // UPDATE entry 10 rank/prize
        undefined,  // UPDATE entry 11 rank/prize
        undefined,  // UPDATE entry 12 rank/prize
        undefined,  // UPDATE tournament finalized
      );
      mockManualAdjustment.mockResolvedValue({});
      const result = await tournamentService.finalize(1, 999);
      expect(result.prizesAwarded).toBe(3);
      expect(result.prizesFailed).toBe(0);
      expect(result.totalDebited).toBeCloseTo(1000, 2);
      expect(mockManualAdjustment).toHaveBeenCalledTimes(3);
      // First place should get 500
      expect(mockManualAdjustment.mock.calls[0][1]).toBeCloseTo(500, 2);
      // gameType 'tournament_prize' is passed so the balances/transactions
      // rows can be inserted (game_type column is NOT NULL on balances).
      expect(mockManualAdjustment.mock.calls[0][4]).toBe('tournament_prize');
    });

    it('rejects when tournament is not active', async () => {
      queueExecutes([[rowTournament({ status: 'scheduled' })]]);
      await expect(tournamentService.finalize(1, 999)).rejects.toThrow('tournament_not_active');
    });

    it('rejects when end time has not passed (SQL-side TZ-safe comparison)', async () => {
      const future = new Date(Date.now() + 60_000);
      queueExecutes(
        [[rowTournament({ status: 'active', end_time: future })]],
        [[{ ended: 0 }]], // SQL: end_time > NOW()
      );
      await expect(tournamentService.finalize(1, 999)).rejects.toThrow('tournament_not_ended');
    });

    it('continues if one prize transfer fails (partial distribution) and counts the failure', async () => {
      const endedAt = new Date(Date.now() - 1000);
      queueExecutes(
        [[rowTournament({
          status: 'active',
          end_time: endedAt,
          prize_pool: '1000.00',
          prize_distribution: JSON.stringify({ '1': 0.5, '2': 0.5 }),
        })]],
        [[{ ended: 1 }]],
        [[
          rowEntry({ id: 10, user_id: 100, score: '500.0000' }),
          rowEntry({ id: 11, user_id: 200, score: '300.0000' }),
        ]],
        undefined,
        undefined,
      );
      mockManualAdjustment
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('house_insufficient'));
      const result = await tournamentService.finalize(1, 999);
      expect(result.prizesAwarded).toBe(1);
      expect(result.prizesFailed).toBe(1);
      expect(result.totalDebited).toBeCloseTo(500, 2);
    });
  });

  // -------------------------------------------------------------------------
  // cancel
  // -------------------------------------------------------------------------
  describe('cancel()', () => {
    it('cancels a scheduled tournament', async () => {
      queueExecutes([[rowTournament({ status: 'scheduled' })]], undefined);
      await tournamentService.cancel(1, 999);
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it('rejects cancelling a finalized tournament', async () => {
      queueExecutes([[rowTournament({ status: 'finalized' })]]);
      await expect(tournamentService.cancel(1, 999)).rejects.toThrow('tournament_not_cancellable');
    });
  });

  // -------------------------------------------------------------------------
  // sweepStatusTransitions
  // -------------------------------------------------------------------------
  describe('sweepStatusTransitions()', () => {
    it('moves scheduled tournaments past start_time to active', async () => {
      queueExecutes(
        [[{ id: 1, game_type: 'crash' }, { id: 2, game_type: 'wheel' }]], // SELECT due rows
        undefined,                                                          // UPDATE
      );
      await tournamentService.sweepStatusTransitions();
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it('no-ops when no due rows', async () => {
      queueExecutes([[]]);
      await tournamentService.sweepStatusTransitions();
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // getActiveForGame caching
  // -------------------------------------------------------------------------
  describe('getActiveForGame()', () => {
    it('caches results within TTL', async () => {
      queueExecutes([[rowTournament({ status: 'active' })]]);
      await tournamentService.getActiveForGame('crash');
      await tournamentService.getActiveForGame('crash');
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('caches null results too', async () => {
      queueExecutes([[]]);
      const t = await tournamentService.getActiveForGame('crash');
      expect(t).toBeNull();
      await tournamentService.getActiveForGame('crash');
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Coverage extensions
  // -------------------------------------------------------------------------
  describe('validation edge cases', () => {
    it('rejects invalid_date strings', () => {
      expect(() => tournamentService.validateCreateInput({
        name: 'T',
        gameType: 'crash',
        scoring: 'biggest_win',
        startTime: 'not-a-date' as any,
        endTime: new Date(),
        prizePool: 100,
        prizeDistribution: { '1': 1.0 },
      } as any)).toThrow('invalid_date');
    });

    it('rejects null/non-object prize distribution', () => {
      expect(() => tournamentService.validatePrizeDistribution(null as any)).toThrow('invalid_prize_distribution');
      expect(() => tournamentService.validatePrizeDistribution([] as any)).toThrow('invalid_prize_distribution');
      expect(() => tournamentService.validatePrizeDistribution({} as any)).toThrow('invalid_prize_distribution');
    });

    it('rejects negative / over-1 prize fractions', () => {
      expect(() => tournamentService.validatePrizeDistribution({ '1': 1.5 } as any)).toThrow('invalid_prize_distribution_value');
      expect(() => tournamentService.validatePrizeDistribution({ '1': 0 } as any)).toThrow('invalid_prize_distribution_value');
    });

    it('create throws when DB INSERT returns no insertId', async () => {
      queueExecutes([{ /* no insertId */ }]);
      await expect(tournamentService.create({
        name: 'T',
        gameType: 'crash',
        scoring: 'biggest_win',
        startTime: new Date(Date.now() + 1000),
        endTime: new Date(Date.now() + 60_000),
        prizePool: 1000,
        prizeDistribution: { '1': 1.0 },
      })).rejects.toThrow('tournament_create_failed');
    });

    it('create throws when getById returns null right after insert', async () => {
      queueExecutes(
        [{ insertId: 99 }],
        [[]], // getById -> no row
      );
      await expect(tournamentService.create({
        name: 'T',
        gameType: 'crash',
        scoring: 'biggest_win',
        startTime: new Date(Date.now() + 1000),
        endTime: new Date(Date.now() + 60_000),
        prizePool: 1000,
        prizeDistribution: { '1': 1.0 },
      })).rejects.toThrow('tournament_create_failed');
    });
  });

  describe('update()', () => {
    it('rejects when tournament not found', async () => {
      queueExecutes([[]]);
      await expect(tournamentService.update(99, { name: 'New' })).rejects.toThrow('tournament_not_found');
    });

    it('rejects when tournament is not scheduled', async () => {
      queueExecutes([[rowTournament({ status: 'active' })]]);
      await expect(tournamentService.update(1, { name: 'New' })).rejects.toThrow('tournament_not_editable');
    });

    it('returns existing when no patch fields are supplied', async () => {
      queueExecutes([[rowTournament({ status: 'scheduled' })]]);
      const out = await tournamentService.update(1, {});
      expect(out.id).toBe(1);
      // No UPDATE execute beyond the initial getById.
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('updates name and runs UPDATE', async () => {
      queueExecutes(
        [[rowTournament({ status: 'scheduled' })]], // initial getById
        undefined,                                   // UPDATE
        [[rowTournament({ name: 'Renamed' })]],     // re-getById
      );
      const out = await tournamentService.update(1, { name: 'Renamed' });
      expect(out.name).toBe('Renamed');
    });

    it('rejects update with invalid name length', async () => {
      queueExecutes([[rowTournament({ status: 'scheduled' })]]);
      await expect(tournamentService.update(1, { name: '' })).rejects.toThrow('invalid_name');
    });

    it('rejects update with invalid gameType', async () => {
      queueExecutes([[rowTournament({ status: 'scheduled' })]]);
      await expect(tournamentService.update(1, { gameType: 'keno' as any })).rejects.toThrow('invalid_game_type');
    });

    it('rejects update with invalid scoring rule', async () => {
      queueExecutes([[rowTournament({ status: 'scheduled' })]]);
      await expect(tournamentService.update(1, { scoring: 'bogus' as any })).rejects.toThrow('invalid_scoring');
    });

    it('rejects update where new start >= new end', async () => {
      const past = new Date(Date.now() - 1000);
      queueExecutes([[rowTournament({ status: 'scheduled', start_time: past, end_time: past })]]);
      const newStart = new Date(Date.now() + 60_000);
      const newEnd = new Date(Date.now() + 30_000);
      await expect(tournamentService.update(1, { startTime: newStart, endTime: newEnd })).rejects.toThrow('start_must_precede_end');
    });

    it('rejects update with non-positive prize pool', async () => {
      queueExecutes([[rowTournament({ status: 'scheduled' })]]);
      await expect(tournamentService.update(1, { prizePool: 0 })).rejects.toThrow('prize_pool_must_be_positive');
    });

    it('updates all fields including gameType, scoring, prize fields', async () => {
      queueExecutes(
        [[rowTournament({ status: 'scheduled' })]], // initial getById
        undefined,                                   // UPDATE
        [[rowTournament({ name: 'X' })]],           // re-getById
      );
      const out = await tournamentService.update(1, {
        name: 'X',
        gameType: 'wheel',
        scoring: 'total_wagered',
        startTime: new Date(Date.now() + 1000),
        endTime: new Date(Date.now() + 60_000),
        prizePool: 500,
        prizeDistribution: { '1': 0.6, '2': 0.4 },
      });
      expect(out.id).toBe(1);
    });

    it('throws if re-getById returns null after UPDATE', async () => {
      queueExecutes(
        [[rowTournament({ status: 'scheduled' })]],
        undefined,
        [[]], // re-getById -> not found
      );
      await expect(tournamentService.update(1, { name: 'X' })).rejects.toThrow('tournament_not_found');
    });
  });

  describe('cancel()', () => {
    it('rejects cancelling non-existent tournament', async () => {
      queueExecutes([[]]);
      await expect(tournamentService.cancel(99, 1)).rejects.toThrow('tournament_not_found');
    });

    it('cancels an active tournament', async () => {
      queueExecutes([[rowTournament({ status: 'active' })]], undefined);
      await tournamentService.cancel(1, 999);
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });
  });

  describe('list()', () => {
    it('lists all tournaments with default options', async () => {
      queueExecutes(
        [[rowTournament(), rowTournament({ id: 2 })]],
        [[{ c: 2 }]],
      );
      const out = await tournamentService.list();
      expect(out.rows).toHaveLength(2);
      expect(out.total).toBe(2);
    });

    it('filters by status only', async () => {
      queueExecutes(
        [[rowTournament()]],
        [[{ c: 1 }]],
      );
      const out = await tournamentService.list({ status: 'scheduled', limit: 10, offset: 0 });
      expect(out.rows).toHaveLength(1);
      expect(out.total).toBe(1);
    });

    it('filters by gameType only', async () => {
      queueExecutes(
        [[rowTournament()]],
        [[{ c: 1 }]],
      );
      const out = await tournamentService.list({ gameType: 'crash' });
      expect(out.rows).toHaveLength(1);
    });

    it('filters by both status and gameType', async () => {
      queueExecutes(
        [[rowTournament()]],
        [[{ c: 1 }]],
      );
      const out = await tournamentService.list({ status: 'active', gameType: 'crash' });
      expect(out.rows).toHaveLength(1);
    });

    it('clamps limit to a sane range', async () => {
      queueExecutes(
        [[]],
        [[{ c: 0 }]],
      );
      const out = await tournamentService.list({ limit: 99999 });
      expect(out.total).toBe(0);
    });
  });

  describe('getById()', () => {
    it('returns null when no row matches', async () => {
      queueExecutes([[]]);
      const out = await tournamentService.getById(404);
      expect(out).toBeNull();
    });

    it('returns hydrated row when found', async () => {
      queueExecutes([[rowTournament({ id: 5 })]]);
      const out = await tournamentService.getById(5);
      expect(out?.id).toBe(5);
    });
  });

  describe('getUserEntry/getUserRank()', () => {
    it('getUserEntry returns null when no row', async () => {
      queueExecutes([[]]);
      const out = await tournamentService.getUserEntry(1, 100);
      expect(out).toBeNull();
    });

    it('getUserEntry returns hydrated entry', async () => {
      queueExecutes([[rowEntry()]]);
      const out = await tournamentService.getUserEntry(1, 100);
      expect(out?.userId).toBe(100);
    });

    it('getUserRank returns null when no entry exists', async () => {
      queueExecutes([[]]);
      const rank = await tournamentService.getUserRank(1, 100);
      expect(rank).toBeNull();
    });

    it('getUserRank returns 1-indexed rank when entry exists', async () => {
      queueExecutes(
        [[rowEntry({ score: '500.0000' })]],
        [[{ c: 2 }]], // 2 users have higher score
      );
      const rank = await tournamentService.getUserRank(1, 100);
      expect(rank).toBe(3);
    });
  });

  describe('recordBet/recordWin no-op paths', () => {
    it('recordBet returns early when tournament does not exist', async () => {
      queueExecutes([[]]); // getById -> not found
      await tournamentService.recordBet(404, 100, 50);
      // Only the getById call happens; no insert/update.
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('recordWin returns early when win is zero', async () => {
      await tournamentService.recordWin(1, 100, 0);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('recordWin returns early when tournament does not exist', async () => {
      queueExecutes([[]]);
      await tournamentService.recordWin(404, 100, 50);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('recordWin does not bump biggestWin when win <= current biggest', async () => {
      queueExecutes(
        [[rowTournament({ scoring: 'biggest_win' })]],
        undefined,
        [[rowEntry({ biggest_win: '500.00' })]],
        undefined,
      );
      await tournamentService.recordWin(1, 100, 50);
      const updateCall = mockExecute.mock.calls[3][0];
      const stringified = JSON.stringify(updateCall);
      // biggest_win should remain 500.00.
      expect(stringified).toContain('500.00');
    });
  });

  describe('_ensureEntry edge cases', () => {
    it('returns null when re-SELECT finds no row', async () => {
      queueExecutes(
        [[rowTournament()]],
        undefined,
        [[]], // SELECT after INSERT returns nothing
      );
      const out = await tournamentService._ensureEntry(1, 100);
      expect(out).toBeNull();
    });
  });

  describe('finalize() additional paths', () => {
    it('throws tournament_not_found when getById returns null', async () => {
      queueExecutes([[]]);
      await expect(tournamentService.finalize(99, 1)).rejects.toThrow('tournament_not_found');
    });

    it('throws tournament_not_found when end-time check returns no row', async () => {
      queueExecutes(
        [[rowTournament({ status: 'active' })]],
        [[]], // end-time check empty
      );
      await expect(tournamentService.finalize(1, 1)).rejects.toThrow('tournament_not_found');
    });

    it('skips dist entries when leaderboard slot is empty', async () => {
      const endedAt = new Date(Date.now() - 1000);
      queueExecutes(
        [[rowTournament({
          status: 'active',
          end_time: endedAt,
          prize_pool: '1000.00',
          prize_distribution: JSON.stringify({ '1': 0.5, '2': 0.25, '3': 0.25 }),
        })]],
        [[{ ended: true }]], // boolean true variant
        [[rowEntry({ id: 10, user_id: 100, score: '500.0000' })]], // only 1 entry
        undefined, // UPDATE entry 10 prize/rank
        undefined, // UPDATE tournament finalized
      );
      mockManualAdjustment.mockResolvedValue({});
      const result = await tournamentService.finalize(1, 999);
      expect(result.prizesAwarded).toBe(1);
    });

    it('skips dist entries where computed prize is <= 0', async () => {
      const endedAt = new Date(Date.now() - 1000);
      queueExecutes(
        [[rowTournament({
          status: 'active',
          end_time: endedAt,
          prize_pool: '0.001', // tiny pool
          prize_distribution: JSON.stringify({ '1': 0.001 }), // tiny fraction => 0.000001
        })]],
        [[{ ended: '1' }]], // string '1' variant
        [[rowEntry({ id: 10, user_id: 100, score: '500.0000' })]],
        undefined,
      );
      const result = await tournamentService.finalize(1, 1);
      expect(result.prizesAwarded).toBe(0);
    });

    it('stamps remaining leaderboard ranks for non-prize entries', async () => {
      const endedAt = new Date(Date.now() - 1000);
      queueExecutes(
        [[rowTournament({
          status: 'active',
          end_time: endedAt,
          prize_pool: '1000.00',
          prize_distribution: JSON.stringify({ '1': 1.0 }), // only rank 1
        })]],
        [[{ ended: 1 }]],
        [[
          rowEntry({ id: 10, user_id: 100, score: '500.0000' }),
          rowEntry({ id: 11, user_id: 200, score: '300.0000' }),
          rowEntry({ id: 12, user_id: 300, score: '100.0000' }),
        ]],
        undefined, // UPDATE rank 1 (prize)
        undefined, // UPDATE rank 2 (no prize)
        undefined, // UPDATE rank 3 (no prize)
        undefined, // UPDATE tournament finalized
      );
      mockManualAdjustment.mockResolvedValue({});
      const result = await tournamentService.finalize(1, 1);
      expect(result.prizesAwarded).toBe(1);
    });
  });

  describe('sweepStatusTransitions error path', () => {
    it('swallows db errors and logs a warning', async () => {
      mockExecute.mockRejectedValueOnce(new Error('db_down'));
      await expect(tournamentService.sweepStatusTransitions()).resolves.toBeUndefined();
    });
  });
});
