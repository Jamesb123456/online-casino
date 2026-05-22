// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { mockExecute, mockSelect } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockSelect: vi.fn(),
}));

vi.mock('../../drizzle/db.js', () => ({
  db: {
    execute: mockExecute,
    select: mockSelect,
  },
}));

vi.mock('drizzle-orm', () => ({
  sql: vi.fn((...args) => args),
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

import AlertService from '../services/alertService.js';

// Helper to build a chainable select query. The chain itself is thenable so
// callers that `await` it (with or without a trailing `.offset()`) both work.
function selectChain(rows: any[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    then: (resolve: any) => resolve(rows),
  };
  return chain;
}

describe('AlertService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockReset();
    mockSelect.mockReset();
    AlertService._resetState();
  });

  // -------------------------------------------------------------------------
  // getThresholds
  // -------------------------------------------------------------------------
  describe('getThresholds()', () => {
    it('returns defaults when no settings rows exist', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const thresholds = await AlertService.getThresholds();
      expect(thresholds).toEqual({ bigWin: 50_000, houseLow: 100_000, rapidBetsPerMin: 30 });
    });

    it('returns settings values when present', async () => {
      mockExecute.mockResolvedValueOnce([[
        { key: 'alert_big_win', value: '75000' },
        { key: 'alert_house_low', value: '200000' },
        { key: 'alert_rapid_bets_per_min', value: '50' },
      ]]);
      const thresholds = await AlertService.getThresholds();
      expect(thresholds).toEqual({ bigWin: 75_000, houseLow: 200_000, rapidBetsPerMin: 50 });
    });

    it('caches results within the TTL window', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      await AlertService.getThresholds();
      await AlertService.getThresholds();
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // setThresholds
  // -------------------------------------------------------------------------
  describe('setThresholds()', () => {
    it('writes only the provided keys and invalidates cache', async () => {
      // Seed initial defaults
      mockExecute.mockResolvedValueOnce([[]]);
      await AlertService.getThresholds();

      // setThresholds: one INSERT for bigWin, plus the post-write getThresholds re-read
      mockExecute.mockResolvedValueOnce(undefined);
      mockExecute.mockResolvedValueOnce([[{ key: 'alert_big_win', value: '99' }]]);

      const updated = await AlertService.setThresholds({ bigWin: 99 }, 1);
      expect(updated.bigWin).toBe(99);
    });

    it('rejects negative values', async () => {
      await expect(AlertService.setThresholds({ houseLow: -1 }, 1)).rejects.toThrow(
        /invalid_threshold/,
      );
    });
  });

  // -------------------------------------------------------------------------
  // emit + getRecent + acknowledge
  // -------------------------------------------------------------------------
  describe('emit()', () => {
    it('inserts a row and returns the inserted alert', async () => {
      mockExecute.mockResolvedValueOnce([{ insertId: 42 }]);
      mockSelect.mockReturnValueOnce(selectChain([{
        id: 42, type: 'big_win', severity: 'warning', userId: 7,
        gameType: 'crash', details: { winAmount: 60000 }, acknowledged: false,
        acknowledgedAt: null, acknowledgedBy: null, createdAt: new Date(),
      }]));

      const alert = await AlertService.emit('big_win', 'warning', 7, 'crash', { winAmount: 60_000 });
      expect(alert.id).toBe(42);
      expect(alert.type).toBe('big_win');
    });
  });

  describe('getRecent()', () => {
    it('returns rows + total + unreadCount', async () => {
      // The service issues: select chain (for rows), then 2 execute calls (total, unread)
      mockSelect.mockReturnValueOnce(selectChain([
        { id: 1, type: 'big_win', acknowledged: false },
        { id: 2, type: 'house_low', acknowledged: true },
      ]));
      mockExecute.mockResolvedValueOnce([[{ c: 5 }]]);
      mockExecute.mockResolvedValueOnce([[{ c: 3 }]]);

      const result = await AlertService.getRecent({});
      expect(result.rows.length).toBe(2);
      expect(result.total).toBe(5);
      expect(result.unreadCount).toBe(3);
    });
  });

  describe('acknowledge()', () => {
    it('marks an alert acknowledged and returns the row', async () => {
      mockExecute.mockResolvedValueOnce(undefined);
      mockSelect.mockReturnValueOnce(selectChain([{
        id: 1, type: 'big_win', acknowledged: true, acknowledgedBy: 99,
      }]));
      const alert = await AlertService.acknowledge(1, 99);
      expect(alert.acknowledged).toBe(true);
    });

    it('throws alert_not_found when no row exists', async () => {
      mockExecute.mockResolvedValueOnce(undefined);
      mockSelect.mockReturnValueOnce(selectChain([]));
      await expect(AlertService.acknowledge(999, 1)).rejects.toThrow('alert_not_found');
    });
  });

  describe('acknowledgeAll()', () => {
    it('returns affected row count', async () => {
      mockExecute.mockResolvedValueOnce([{ affectedRows: 4 }]);
      const count = await AlertService.acknowledgeAll(1);
      expect(count).toBe(4);
    });
  });

  // -------------------------------------------------------------------------
  // checkBigWin
  // -------------------------------------------------------------------------
  describe('checkBigWin()', () => {
    it('emits when winAmount exceeds the threshold', async () => {
      // getThresholds settings lookup
      mockExecute.mockResolvedValueOnce([[]]);
      // emit INSERT
      mockExecute.mockResolvedValueOnce([{ insertId: 1 }]);
      // emit select-after-insert
      mockSelect.mockReturnValueOnce(selectChain([{ id: 1, type: 'big_win' }]));

      await AlertService.checkBigWin(60_000, 7, 'crash');
      // Two execute calls: settings + insert
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it('does not emit when winAmount is below the threshold', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      await AlertService.checkBigWin(100, 7, 'crash');
      expect(mockExecute).toHaveBeenCalledTimes(1); // only settings lookup
    });
  });

  // -------------------------------------------------------------------------
  // checkHouseLow — downward crossing only
  // -------------------------------------------------------------------------
  describe('checkHouseLow()', () => {
    it('does not emit on the first observation (seeding)', async () => {
      mockExecute.mockResolvedValueOnce([[]]); // thresholds
      await AlertService.checkHouseLow(50);   // below default 100k, but first observation
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('emits when crossing downward (was above, now below)', async () => {
      // First call: above threshold -> seeds as "not below"
      mockExecute.mockResolvedValueOnce([[]]); // thresholds
      await AlertService.checkHouseLow(150_000);

      // Second call: below threshold -> crossing downward -> emit
      mockExecute.mockResolvedValueOnce([{ insertId: 1 }]); // insert
      mockSelect.mockReturnValueOnce(selectChain([{ id: 1, type: 'house_low' }]));
      await AlertService.checkHouseLow(50_000);

      // 3 execute calls: thresholds, insert (thresholds is cached from first call)
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it('does not emit on sustained-low state (no crossing)', async () => {
      mockExecute.mockResolvedValueOnce([[]]); // thresholds
      await AlertService.checkHouseLow(150_000); // seed as "not below"

      // Cross down -> emit
      mockExecute.mockResolvedValueOnce([{ insertId: 1 }]);
      mockSelect.mockReturnValueOnce(selectChain([{ id: 1, type: 'house_low' }]));
      await AlertService.checkHouseLow(50_000);

      // Stay below -> no new emit
      await AlertService.checkHouseLow(40_000);

      expect(mockExecute).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // checkRapidBets — cooldown semantics
  // -------------------------------------------------------------------------
  describe('checkRapidBets()', () => {
    it('emits when bet count in the window meets threshold, then enters cooldown', async () => {
      // First call triggers getThresholds (defaults = 30).
      // 29 calls: no emit (each triggers getThresholds the first time, then cached)
      mockExecute.mockResolvedValueOnce([[]]); // thresholds lookup (cached after)
      for (let i = 0; i < 29; i++) {
        await AlertService.checkRapidBets(7, 'crash');
      }
      // No alert yet — only the cached threshold lookup
      expect(mockExecute).toHaveBeenCalledTimes(1);

      // 30th call: count >= 30 -> emit
      mockExecute.mockResolvedValueOnce([{ insertId: 1 }]);
      mockSelect.mockReturnValueOnce(selectChain([{ id: 1, type: 'rapid_bets' }]));
      await AlertService.checkRapidBets(7, 'crash');
      expect(mockExecute).toHaveBeenCalledTimes(2);

      // Subsequent calls during cooldown should NOT re-emit
      await AlertService.checkRapidBets(7, 'crash');
      await AlertService.checkRapidBets(7, 'crash');
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });
  });
});
