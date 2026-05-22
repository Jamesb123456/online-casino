// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock('../../drizzle/db.js', () => ({
  db: {
    execute: mockExecute,
  },
}));

vi.mock('drizzle-orm', () => ({
  sql: vi.fn((strings, ...values) => ({ strings, values })),
}));

vi.mock('../services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import behaviourAnalyticsService from '../services/behaviourAnalyticsService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Stub the 3 SELECTs detectPatterns runs in order:
 *   1. chasingLosses rows: [{ amount, transaction_type }]
 *   2. lateNightActivity row: [{ totalBets, lateNightBets }]
 *   3. botLikeCadence rows: [{ sessionId, ts }]
 */
function stubAllQueries(chasingRows, lateNightRow, cadenceRows) {
  // detectPatterns fires all three in Promise.all — order of resolution doesn't
  // matter, but order of calls does. The service calls them in order:
  // _detectChasingLosses, _detectLateNightActivity, _detectBotLikeCadence.
  mockExecute
    .mockResolvedValueOnce([chasingRows])
    .mockResolvedValueOnce([[lateNightRow]])
    .mockResolvedValueOnce([cadenceRows]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BehaviourAnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // chasingLosses
  // -----------------------------------------------------------------------
  describe('chasingLosses', () => {
    it('detects a clear chase pattern when most bets follow losses with >=1.5x amount', async () => {
      // Sequence: loss 10, loss 20 (chase), loss 40 (chase), loss 80 (chase), loss 160 (chase)
      const rows = [
        { amount: '10.00', transaction_type: 'game_loss' },
        { amount: '20.00', transaction_type: 'game_loss' },
        { amount: '40.00', transaction_type: 'game_loss' },
        { amount: '80.00', transaction_type: 'game_loss' },
        { amount: '160.00', transaction_type: 'game_loss' },
      ];
      stubAllQueries(rows, { totalBets: 0, lateNightBets: 0 }, []);

      const result = await behaviourAnalyticsService.detectPatterns(1);

      expect(result.chasingLosses.detected).toBe(true);
      expect(result.chasingLosses.score).toBeGreaterThanOrEqual(0.2);
      expect(result.chasingLosses.details.chaseEvents).toBe(4);
      expect(result.chasingLosses.details.totalBets).toBe(5);
      expect(result.chasingLosses.details.longestChaseStreak).toBe(4);
    });

    it('returns score 0 when there are no losses (only wins)', async () => {
      const rows = [
        { amount: '10.00', transaction_type: 'game_win' },
        { amount: '20.00', transaction_type: 'game_win' },
        { amount: '30.00', transaction_type: 'game_win' },
      ];
      stubAllQueries(rows, { totalBets: 0, lateNightBets: 0 }, []);

      const result = await behaviourAnalyticsService.detectPatterns(1);

      expect(result.chasingLosses.detected).toBe(false);
      expect(result.chasingLosses.score).toBe(0);
      expect(result.chasingLosses.details.chaseEvents).toBe(0);
      expect(result.chasingLosses.details.totalBets).toBe(3);
    });

    it('handles a user with 0 bets without throwing and returns an empty result', async () => {
      stubAllQueries([], { totalBets: 0, lateNightBets: 0 }, []);

      const result = await behaviourAnalyticsService.detectPatterns(1);

      expect(result.chasingLosses).toEqual({
        detected: false,
        score: 0,
        details: { chaseEvents: 0, totalBets: 0, longestChaseStreak: 0 },
      });
    });

    it('does not count a chase when the previous bet was a win', async () => {
      const rows = [
        { amount: '10.00', transaction_type: 'game_win' },
        { amount: '50.00', transaction_type: 'game_loss' }, // prev was win -> no chase
        { amount: '100.00', transaction_type: 'game_loss' }, // prev was loss, 100 >= 75 -> chase
      ];
      stubAllQueries(rows, { totalBets: 0, lateNightBets: 0 }, []);

      const result = await behaviourAnalyticsService.detectPatterns(1);

      expect(result.chasingLosses.details.chaseEvents).toBe(1);
      expect(result.chasingLosses.details.totalBets).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // lateNightActivity
  // -----------------------------------------------------------------------
  describe('lateNightActivity', () => {
    it('detects when > 40% of bets are between 00:00 and 04:59 (with > 20 bets)', async () => {
      stubAllQueries([], { totalBets: 100, lateNightBets: 55 }, []);

      const result = await behaviourAnalyticsService.detectPatterns(1);

      expect(result.lateNightActivity.detected).toBe(true);
      expect(result.lateNightActivity.pctOfBetsAfterMidnight).toBe(0.55);
      expect(result.lateNightActivity.totalBets).toBe(100);
      expect(result.lateNightActivity.lateNightBets).toBe(55);
    });

    it('returns a small pct and detected=false for daytime bets', async () => {
      stubAllQueries([], { totalBets: 100, lateNightBets: 5 }, []);

      const result = await behaviourAnalyticsService.detectPatterns(1);

      expect(result.lateNightActivity.detected).toBe(false);
      expect(result.lateNightActivity.pctOfBetsAfterMidnight).toBe(0.05);
    });

    it('returns detected=false when total bets is at or below the minimum (20)', async () => {
      // > 40% late-night but <= 20 total bets -> should NOT trigger detection
      stubAllQueries([], { totalBets: 10, lateNightBets: 9 }, []);

      const result = await behaviourAnalyticsService.detectPatterns(1);

      expect(result.lateNightActivity.detected).toBe(false);
      expect(result.lateNightActivity.pctOfBetsAfterMidnight).toBe(0.9);
    });
  });

  // -----------------------------------------------------------------------
  // botLikeCadence
  // -----------------------------------------------------------------------
  describe('botLikeCadence', () => {
    it('detects low CV across many bets (robot-like timing)', async () => {
      // Build one big session with ~60 evenly-spaced bets (delta = 5s exactly)
      const rows = [];
      let ts = 1_700_000_000;
      for (let i = 0; i < 60; i++) {
        rows.push({ sessionId: 1, ts });
        ts += 5;
      }
      stubAllQueries([], { totalBets: 0, lateNightBets: 0 }, rows);

      const result = await behaviourAnalyticsService.detectPatterns(1);

      expect(result.botLikeCadence.detected).toBe(true);
      expect(result.botLikeCadence.interArrivalCv).not.toBeNull();
      expect(result.botLikeCadence.interArrivalCv).toBeLessThan(0.15);
      expect(result.botLikeCadence.sampleSize).toBe(59);
    });

    it('returns detected:false and interArrivalCv:null when sample size < 50', async () => {
      const rows = [];
      let ts = 1_700_000_000;
      for (let i = 0; i < 10; i++) {
        rows.push({ sessionId: 1, ts });
        ts += 5;
      }
      stubAllQueries([], { totalBets: 0, lateNightBets: 0 }, rows);

      const result = await behaviourAnalyticsService.detectPatterns(1);

      expect(result.botLikeCadence.detected).toBe(false);
      expect(result.botLikeCadence.interArrivalCv).toBeNull();
      expect(result.botLikeCadence.sampleSize).toBe(9);
    });

    it('returns detected:false when CV is high (jittery, human-like timing) at large sample size', async () => {
      // 60 bets in one session with wildly varying intervals
      const rows = [];
      let ts = 1_700_000_000;
      for (let i = 0; i < 60; i++) {
        rows.push({ sessionId: 1, ts });
        // alternate big and small deltas -> high variance
        ts += i % 2 === 0 ? 2 : 200;
      }
      stubAllQueries([], { totalBets: 0, lateNightBets: 0 }, rows);

      const result = await behaviourAnalyticsService.detectPatterns(1);

      expect(result.botLikeCadence.detected).toBe(false);
      expect(result.botLikeCadence.interArrivalCv).toBeGreaterThan(0.15);
      expect(result.botLikeCadence.sampleSize).toBe(59);
    });

    it('skips sessions with fewer than 5 bets when computing CV', async () => {
      // Two tiny sessions (3 bets each) -> no intervals collected -> sampleSize 0
      const rows = [
        { sessionId: 1, ts: 100 },
        { sessionId: 1, ts: 105 },
        { sessionId: 1, ts: 110 },
        { sessionId: 2, ts: 200 },
        { sessionId: 2, ts: 210 },
        { sessionId: 2, ts: 220 },
      ];
      stubAllQueries([], { totalBets: 0, lateNightBets: 0 }, rows);

      const result = await behaviourAnalyticsService.detectPatterns(1);

      expect(result.botLikeCadence.sampleSize).toBe(0);
      expect(result.botLikeCadence.detected).toBe(false);
      expect(result.botLikeCadence.interArrivalCv).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // detectPatterns shape
  // -----------------------------------------------------------------------
  describe('detectPatterns shape', () => {
    it('returns all three sections in the result regardless of detection', async () => {
      stubAllQueries([], { totalBets: 0, lateNightBets: 0 }, []);

      const result = await behaviourAnalyticsService.detectPatterns(1);

      expect(result).toHaveProperty('chasingLosses');
      expect(result).toHaveProperty('lateNightActivity');
      expect(result).toHaveProperty('botLikeCadence');
      expect(result.chasingLosses).toHaveProperty('detected');
      expect(result.chasingLosses).toHaveProperty('score');
      expect(result.chasingLosses).toHaveProperty('details');
      expect(result.lateNightActivity).toHaveProperty('detected');
      expect(result.lateNightActivity).toHaveProperty('pctOfBetsAfterMidnight');
      expect(result.botLikeCadence).toHaveProperty('detected');
      expect(result.botLikeCadence).toHaveProperty('interArrivalCv');
      expect(result.botLikeCadence).toHaveProperty('sampleSize');
    });

    it('returns the empty fallback (no throw) when an underlying query rejects', async () => {
      mockExecute.mockRejectedValueOnce(new Error('db down'));
      mockExecute.mockRejectedValueOnce(new Error('db down'));
      mockExecute.mockRejectedValueOnce(new Error('db down'));

      const result = await behaviourAnalyticsService.detectPatterns(1);

      expect(result.chasingLosses.detected).toBe(false);
      expect(result.lateNightActivity.detected).toBe(false);
      expect(result.botLikeCadence.detected).toBe(false);
      expect(result.botLikeCadence.interArrivalCv).toBeNull();
    });

    it('returns the empty fallback for an invalid userId without hitting the db', async () => {
      const result = await behaviourAnalyticsService.detectPatterns(0);

      expect(result.chasingLosses.detected).toBe(false);
      expect(result.lateNightActivity.detected).toBe(false);
      expect(result.botLikeCadence.detected).toBe(false);
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });
});
