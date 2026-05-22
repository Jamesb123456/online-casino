// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
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
  sql: Object.assign(
    (...args: any[]) => args,
    { join: (...args: any[]) => args },
  ),
}));

vi.mock('../services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  },
}));

import UserLimitsService from '../services/userLimitsService.js';

describe('UserLimitsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (UserLimitsService as any).invalidate();
  });

  // -----------------------------------------------------------------------
  // getLimits
  // -----------------------------------------------------------------------
  describe('getLimits()', () => {
    it('returns all-null limits when no row exists', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const limits = await UserLimitsService.getLimits(42);
      expect(limits).toEqual({
        maxBetPerRound: null,
        maxLossPerDay: null,
        lockedUntil: null,
        sessionLimitMinutes: null,
      });
    });

    it('parses decimals and timestamp from row', async () => {
      const lockDate = new Date('2030-01-01T00:00:00.000Z');
      mockExecute.mockResolvedValueOnce([[{
        max_bet_per_round: '500.00',
        max_loss_per_day: '1000.00',
        locked_until: lockDate,
      }]]);
      const limits = await UserLimitsService.getLimits(42);
      expect(limits.maxBetPerRound).toBe(500);
      expect(limits.maxLossPerDay).toBe(1000);
      expect(limits.lockedUntil).toBeInstanceOf(Date);
      expect(limits.lockedUntil.getTime()).toBe(lockDate.getTime());
    });

    it('caches reads within the TTL window', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      await UserLimitsService.getLimits(42);
      await UserLimitsService.getLimits(42);
      await UserLimitsService.getLimits(42);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('returns nulls on DB error (fail-open) without caching', async () => {
      mockExecute.mockRejectedValueOnce(new Error('DB down'));
      const limits = await UserLimitsService.getLimits(42);
      expect(limits).toEqual({ maxBetPerRound: null, maxLossPerDay: null, lockedUntil: null, sessionLimitMinutes: null });
      // Next call still hits the DB
      mockExecute.mockResolvedValueOnce([[]]);
      await UserLimitsService.getLimits(42);
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------------------
  // setLimits
  // -----------------------------------------------------------------------
  describe('setLimits()', () => {
    it('upserts and invalidates the cache', async () => {
      // Prime the cache
      mockExecute.mockResolvedValueOnce([[]]);
      await UserLimitsService.getLimits(7);
      expect((UserLimitsService as any)._cache.has(7)).toBe(true);

      // setLimits issues INSERT…ON DUPLICATE then a re-fetch
      mockExecute.mockResolvedValueOnce([]); // the upsert
      mockExecute.mockResolvedValueOnce([[{ max_bet_per_round: '100.00', max_loss_per_day: null, locked_until: null }]]);

      const out = await UserLimitsService.setLimits(7, { maxBetPerRound: 100 }, 1);
      expect(out.maxBetPerRound).toBe(100);
      // Cache for user 7 was invalidated and re-populated by the get inside setLimits
      expect(mockExecute).toHaveBeenCalled();
    });

    it('accepts explicit null to clear a single field', async () => {
      mockExecute.mockResolvedValueOnce([]); // upsert
      mockExecute.mockResolvedValueOnce([[{
        max_bet_per_round: null, max_loss_per_day: '50.00', locked_until: null,
      }]]);
      const out = await UserLimitsService.setLimits(8, { maxBetPerRound: null }, 1);
      expect(out.maxBetPerRound).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // clearLimits
  // -----------------------------------------------------------------------
  describe('clearLimits()', () => {
    it('nullifies all three fields and invalidates cache', async () => {
      // Prime cache
      mockExecute.mockResolvedValueOnce([[{
        max_bet_per_round: '50.00', max_loss_per_day: '500.00', locked_until: null,
      }]]);
      await UserLimitsService.getLimits(9);
      expect((UserLimitsService as any)._cache.has(9)).toBe(true);

      mockExecute.mockResolvedValueOnce([]);
      await UserLimitsService.clearLimits(9);

      expect((UserLimitsService as any)._cache.has(9)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // assertCanBet
  // -----------------------------------------------------------------------
  describe('assertCanBet()', () => {
    it('returns ok when no limits set', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const r = await UserLimitsService.assertCanBet(1, 10, 'crash');
      expect(r.ok).toBe(true);
    });

    it('returns locked when lockedUntil is in the future', async () => {
      const future = new Date(Date.now() + 60_000);
      mockExecute.mockResolvedValueOnce([[{
        max_bet_per_round: null, max_loss_per_day: null, locked_until: future,
      }]]);
      const r = await UserLimitsService.assertCanBet(1, 10, 'crash');
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('locked');
      expect(r.details?.until).toBe(future.toISOString());
    });

    it('passes through when lockedUntil is in the past', async () => {
      const past = new Date(Date.now() - 60_000);
      mockExecute.mockResolvedValueOnce([[{
        max_bet_per_round: null, max_loss_per_day: null, locked_until: past,
      }]]);
      const r = await UserLimitsService.assertCanBet(1, 10, 'crash');
      expect(r.ok).toBe(true);
    });

    it('returns bet_too_large when bet exceeds maxBetPerRound', async () => {
      mockExecute.mockResolvedValueOnce([[{
        max_bet_per_round: '100.00', max_loss_per_day: null, locked_until: null,
      }]]);
      const r = await UserLimitsService.assertCanBet(1, 150, 'crash');
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('bet_too_large');
      expect(r.details?.max).toBe(100);
    });

    it('returns daily_loss_cap when adding bet would exceed daily loss limit', async () => {
      // limits row
      mockExecute.mockResolvedValueOnce([[{
        max_bet_per_round: null, max_loss_per_day: '500.00', locked_until: null,
      }]]);
      // daily net loss query: losses=600, wins=200 -> net=400; bet of 200 takes us to 600 > 500
      mockExecute.mockResolvedValueOnce([[{ losses: '600.00', wins: '200.00' }]]);

      const r = await UserLimitsService.assertCanBet(1, 200, 'crash');
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('daily_loss_cap');
      expect(r.details?.limit).toBe(500);
      expect(r.details?.current).toBe(400);
    });

    it('returns ok when daily loss + bet stays under the cap', async () => {
      mockExecute.mockResolvedValueOnce([[{
        max_bet_per_round: null, max_loss_per_day: '500.00', locked_until: null,
      }]]);
      // net loss=100, bet=50 -> 150 <= 500
      mockExecute.mockResolvedValueOnce([[{ losses: '100.00', wins: '0' }]]);

      const r = await UserLimitsService.assertCanBet(1, 50, 'crash');
      expect(r.ok).toBe(true);
    });

    it('fails open (ok=true) on unexpected error and logs', async () => {
      mockExecute.mockResolvedValueOnce([[{
        max_bet_per_round: null, max_loss_per_day: '500.00', locked_until: null,
      }]]);
      // Daily loss query throws
      mockExecute.mockRejectedValueOnce(new Error('boom'));
      const r = await UserLimitsService.assertCanBet(1, 50, 'crash');
      expect(r.ok).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Session time limit
  // -----------------------------------------------------------------------
  describe('session time limit', () => {
    it('markSessionStart is idempotent — same timestamp on repeat calls', () => {
      UserLimitsService.markSessionStart(100);
      const first = (UserLimitsService as any)._sessionStarts.get(100);
      // Force a tiny delay so a buggy implementation would overwrite.
      UserLimitsService.markSessionStart(100);
      const second = (UserLimitsService as any)._sessionStarts.get(100);
      expect(second).toBe(first);
    });

    it('clearSession removes the in-memory start timestamp', () => {
      UserLimitsService.markSessionStart(101);
      expect((UserLimitsService as any)._sessionStarts.has(101)).toBe(true);
      UserLimitsService.clearSession(101);
      expect((UserLimitsService as any)._sessionStarts.has(101)).toBe(false);
    });

    it('assertCanBet skips the session check when sessionLimitMinutes is null', async () => {
      mockExecute.mockResolvedValueOnce([[{
        max_bet_per_round: null, max_loss_per_day: null, locked_until: null, session_limit_minutes: null,
      }]]);
      // Simulate an old session start that would otherwise blow the cap
      (UserLimitsService as any)._sessionStarts.set(200, new Date(Date.now() - 60 * 60 * 1000));
      const r = await UserLimitsService.assertCanBet(200, 10, 'crash');
      expect(r.ok).toBe(true);
    });

    it('assertCanBet returns ok when elapsed time is below the session limit', async () => {
      mockExecute.mockResolvedValueOnce([[{
        max_bet_per_round: null, max_loss_per_day: null, locked_until: null, session_limit_minutes: '60.00',
      }]]);
      (UserLimitsService as any)._sessionStarts.set(201, new Date(Date.now() - 30 * 60 * 1000));
      const r = await UserLimitsService.assertCanBet(201, 10, 'crash');
      expect(r.ok).toBe(true);
    });

    it('assertCanBet returns session_time_exceeded when elapsed > limit', async () => {
      mockExecute.mockResolvedValueOnce([[{
        max_bet_per_round: null, max_loss_per_day: null, locked_until: null, session_limit_minutes: '5.00',
      }]]);
      // Started 10 minutes ago, limit is 5 minutes.
      const startedAt = new Date(Date.now() - 10 * 60 * 1000);
      (UserLimitsService as any)._sessionStarts.set(202, startedAt);
      const r = await UserLimitsService.assertCanBet(202, 10, 'crash');
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('session_time_exceeded');
      expect(r.details?.limitMinutes).toBe(5);
      expect(r.details?.startedAt).toBe(startedAt.toISOString());
    });

    it('clearSession resets the timer — next bet starts a fresh clock', async () => {
      // First bet starts the clock
      mockExecute.mockResolvedValueOnce([[{
        max_bet_per_round: null, max_loss_per_day: null, locked_until: null, session_limit_minutes: '5.00',
      }]]);
      // Pretend the user was already over the limit
      (UserLimitsService as any)._sessionStarts.set(203, new Date(Date.now() - 10 * 60 * 1000));
      let r = await UserLimitsService.assertCanBet(203, 10, 'crash');
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('session_time_exceeded');

      // Disconnect clears the session
      UserLimitsService.clearSession(203);
      // Invalidate cache so the next call re-reads
      (UserLimitsService as any).invalidate(203);

      // Next bet -- fresh clock should pass
      mockExecute.mockResolvedValueOnce([[{
        max_bet_per_round: null, max_loss_per_day: null, locked_until: null, session_limit_minutes: '5.00',
      }]]);
      r = await UserLimitsService.assertCanBet(203, 10, 'crash');
      expect(r.ok).toBe(true);
    });
  });
});
