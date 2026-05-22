// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecute, mockGetHouseBalance } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockGetHouseBalance: vi.fn(),
}));

vi.mock('../../drizzle/db.js', () => ({
  db: { execute: mockExecute, transaction: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  sql: vi.fn((...args) => args),
}));

vi.mock('../services/houseService.js', () => ({
  default: { getHouseBalance: mockGetHouseBalance },
}));

vi.mock('../services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  },
}));

import snapshotService from '../services/snapshotService.js';

// Helper that queues mockExecute resolves in order.
function queueExecutes(...resolves: any[]) {
  for (const r of resolves) {
    mockExecute.mockResolvedValueOnce(r);
  }
}

describe('SnapshotService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetHouseBalance.mockResolvedValue(500000);
  });

  describe('computeSnapshot()', () => {
    it('rejects malformed date strings', async () => {
      await expect(snapshotService.computeSnapshot('05-19-2026')).rejects.toThrow('snapshot_invalid_date_format');
      await expect(snapshotService.computeSnapshot('not-a-date')).rejects.toThrow('snapshot_invalid_date_format');
    });

    it('aggregates bets, wins, bonuses, active and new players, then computes GGR/NGR', async () => {
      // Queue 5 execute calls: bets, wins, bonuses, active, new
      queueExecutes(
        [[{ total: '1500.00' }]], // bets (already abs in SQL)
        [[{ total: '900.00' }]],  // wins
        [[{ total: '50.00' }]],   // bonuses
        [[{ cnt: '12' }]],        // active players
        [[{ cnt: '3' }]],         // new players
      );

      const snap = await snapshotService.computeSnapshot('2026-05-19');

      expect(snap.snapshotDate).toBe('2026-05-19');
      expect(snap.totalBets).toBe('1500.00');
      expect(snap.totalWins).toBe('900.00');
      expect(snap.bonusesPaid).toBe('50.00');
      expect(snap.ggr).toBe('600.00');           // 1500 - 900
      expect(snap.ngr).toBe('550.00');           // 600 - 50
      expect(snap.activePlayerCount).toBe(12);
      expect(snap.newPlayerCount).toBe(3);
      expect(snap.houseBalanceClose).toBe('500000.00');
      expect(mockGetHouseBalance).toHaveBeenCalled();
    });

    it('defaults missing totals to zero', async () => {
      queueExecutes(
        [[]],          // bets — empty
        [[{}]],        // wins — null total
        [[{ total: null }]], // bonuses
        [[{ cnt: 0 }]],
        [[{ cnt: 0 }]],
      );
      const snap = await snapshotService.computeSnapshot('2026-05-19');
      expect(snap.totalBets).toBe('0.00');
      expect(snap.totalWins).toBe('0.00');
      expect(snap.bonusesPaid).toBe('0.00');
      expect(snap.ggr).toBe('0.00');
      expect(snap.ngr).toBe('0.00');
    });
  });

  describe('saveSnapshot()', () => {
    it('upserts and returns the persisted row', async () => {
      // 5 compute queries, 1 upsert (no rows returned), 1 select-back
      queueExecutes(
        [[{ total: '2000.00' }]],
        [[{ total: '800.00' }]],
        [[{ total: '100.00' }]],
        [[{ cnt: 5 }]],
        [[{ cnt: 1 }]],
        undefined, // upsert
        [[{
          id: 7,
          snapshotDate: '2026-05-19',
          houseBalanceClose: '500000.00',
          totalBets: '2000.00',
          totalWins: '800.00',
          ggr: '1200.00',
          bonusesPaid: '100.00',
          ngr: '1100.00',
          activePlayerCount: 5,
          newPlayerCount: 1,
          createdAt: '2026-05-19T00:05:00Z',
        }]],
      );

      const row = await snapshotService.saveSnapshot('2026-05-19');
      expect(row.id).toBe(7);
      expect(row.ggr).toBe('1200.00');
      expect(row.ngr).toBe('1100.00');
      expect(mockExecute).toHaveBeenCalledTimes(7);
    });

    it('throws if the select-back returns nothing', async () => {
      queueExecutes(
        [[{ total: 0 }]],
        [[{ total: 0 }]],
        [[{ total: 0 }]],
        [[{ cnt: 0 }]],
        [[{ cnt: 0 }]],
        undefined,
        [[]], // empty select-back
      );

      await expect(snapshotService.saveSnapshot('2026-05-19')).rejects.toThrow('snapshot_save_failed');
    });
  });

  describe('getRange()', () => {
    it('returns rows ordered ascending', async () => {
      queueExecutes([[
        { id: 1, snapshotDate: '2026-05-17', ggr: '100.00' },
        { id: 2, snapshotDate: '2026-05-18', ggr: '200.00' },
        { id: 3, snapshotDate: '2026-05-19', ggr: '300.00' },
      ]]);
      const rows = await snapshotService.getRange('2026-05-17', '2026-05-19');
      expect(rows).toHaveLength(3);
      expect(rows[0].snapshotDate).toBe('2026-05-17');
      expect(rows[2].snapshotDate).toBe('2026-05-19');
    });

    it('validates both date params', async () => {
      await expect(snapshotService.getRange('bad', '2026-05-19')).rejects.toThrow('snapshot_invalid_date_format');
      await expect(snapshotService.getRange('2026-05-19', 'bad')).rejects.toThrow('snapshot_invalid_date_format');
    });
  });

  describe('exists()', () => {
    it('returns true when a row is found', async () => {
      queueExecutes([[{ ok: 1 }]]);
      expect(await snapshotService.exists('2026-05-19')).toBe(true);
    });

    it('returns false when no row found', async () => {
      queueExecutes([[]]);
      expect(await snapshotService.exists('2026-05-19')).toBe(false);
    });
  });
});
