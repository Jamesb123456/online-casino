import Decimal from 'decimal.js';
import { db } from '../../drizzle/db.js';
import { sql } from 'drizzle-orm';
import LoggingService from './loggingService.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * User Limits Service
 *
 * Per-user betting/loss caps and admin-set timeouts. One row per user
 * (upsert pattern). Used by the 6 game handlers as a pre-bet gate on top
 * of the existing global per-round / per-user-per-day payout caps. Stricter wins.
 *
 * Caches per-user limits with a short TTL so the per-bet check stays cheap.
 *
 * Session time limits (`sessionLimitMinutes`):
 *   - Tracked in-memory via `_sessionStarts` (Map<userId, Date>).
 *   - Timer begins on the first bet of a session via `markSessionStart`.
 *   - Cleared on socket disconnect via `clearSession`.
 *   - Server restart wipes all session timers — players get a fresh
 *     clock, which is acceptable because they can never gain MORE
 *     time than the configured limit allows; only ever LESS.
 */

export interface UserLimits {
  /** Maximum stake allowed per single bet/round (monetary, in credits). */
  maxBetPerRound: number | null;
  /** Maximum net loss allowed within a rolling 24-hour window (monetary, in credits). */
  maxLossPerDay: number | null;
  /** Absolute point-in-time after which the user may not bet. */
  lockedUntil: Date | null;
  /** Maximum continuous session length in minutes. Enforced in-memory; resets on socket disconnect. */
  sessionLimitMinutes: number | null;
}

export interface AssertCanBetResult {
  ok: boolean;
  reason?: 'locked' | 'bet_too_large' | 'daily_loss_cap' | 'session_time_exceeded';
  details?: Record<string, any>;
}

const CACHE_TTL_MS = 10_000;

const EMPTY_LIMITS: UserLimits = {
  maxBetPerRound: null,
  maxLossPerDay: null,
  lockedUntil: null,
  sessionLimitMinutes: null,
};

class UserLimitsService {
  _cache: Map<number, { value: UserLimits; expiresAt: number }>;
  _sessionStarts: Map<number, Date>;

  constructor() {
    this._cache = new Map();
    this._sessionStarts = new Map();
  }

  /**
   * Read the current limits for a user. Returns all-nulls when no row exists.
   * Cached for CACHE_TTL_MS.
   */
  async getLimits(userId: number): Promise<UserLimits> {
    const key = Number(userId);
    const cached = this._cache.get(key);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    try {
      const result = await db.execute(
        sql`SELECT max_bet_per_round, max_loss_per_day, locked_until, session_limit_minutes
            FROM user_limits WHERE user_id = ${key} LIMIT 1`
      );
      const row = (result as any)[0]?.[0];
      const value: UserLimits = row
        ? {
            maxBetPerRound: row.max_bet_per_round == null
              ? null
              : new Decimal(String(row.max_bet_per_round)).toNumber(),
            maxLossPerDay: row.max_loss_per_day == null
              ? null
              : new Decimal(String(row.max_loss_per_day)).toNumber(),
            lockedUntil: row.locked_until ? new Date(row.locked_until) : null,
            sessionLimitMinutes: row.session_limit_minutes == null
              ? null
              : new Decimal(String(row.session_limit_minutes)).toNumber(),
          }
        : { ...EMPTY_LIMITS };

      this._cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
      return value;
    } catch (error) {
      LoggingService.logSystemEvent('user_limits_read_error', {
        userId: key,
        error: error instanceof Error ? error.message : String(error),
      }, 'warning');
      return { ...EMPTY_LIMITS };
    }
  }

  /**
   * Upsert a user's limits. Each field can be a non-negative number, a Date
   * (for lockedUntil), or null to clear that one specifically. Fields not
   * present in the patch are left unchanged on existing rows; on insert
   * missing fields default to NULL.
   */
  async setLimits(
    userId: number,
    patch: Partial<{
      maxBetPerRound: number | null;
      maxLossPerDay: number | null;
      lockedUntil: Date | string | null;
      sessionLimitMinutes: number | null;
    }>,
    updatedBy: number | null,
  ): Promise<UserLimits> {
    const key = Number(userId);

    const hasMaxBet = Object.prototype.hasOwnProperty.call(patch, 'maxBetPerRound');
    const hasMaxLoss = Object.prototype.hasOwnProperty.call(patch, 'maxLossPerDay');
    const hasLockedUntil = Object.prototype.hasOwnProperty.call(patch, 'lockedUntil');
    const hasSessionLimit = Object.prototype.hasOwnProperty.call(patch, 'sessionLimitMinutes');

    const maxBetVal = hasMaxBet && patch.maxBetPerRound != null
      ? new Decimal(patch.maxBetPerRound).toFixed(2)
      : null;
    const maxLossVal = hasMaxLoss && patch.maxLossPerDay != null
      ? new Decimal(patch.maxLossPerDay).toFixed(2)
      : null;
    const lockedUntilVal = hasLockedUntil && patch.lockedUntil != null
      ? (patch.lockedUntil instanceof Date ? patch.lockedUntil : new Date(patch.lockedUntil as string))
      : null;
    const lockedUntilSql = lockedUntilVal ? lockedUntilVal.toISOString().slice(0, 19).replace('T', ' ') : null;
    const sessionLimitVal = hasSessionLimit && patch.sessionLimitMinutes != null
      ? new Decimal(patch.sessionLimitMinutes).toFixed(2)
      : null;

    // For INSERT, all fields take their patched (or null) values.
    // For UPDATE, only patched fields are overwritten; others keep their existing value.
    const updateSets: any[] = [];
    if (hasMaxBet) updateSets.push(sql`max_bet_per_round = ${maxBetVal}`);
    if (hasMaxLoss) updateSets.push(sql`max_loss_per_day = ${maxLossVal}`);
    if (hasLockedUntil) updateSets.push(sql`locked_until = ${lockedUntilSql}`);
    if (hasSessionLimit) updateSets.push(sql`session_limit_minutes = ${sessionLimitVal}`);
    updateSets.push(sql`updated_by = ${updatedBy ?? null}`);
    updateSets.push(sql`updated_at = NOW()`);
    const updateClause = sql.join(updateSets, sql`, `);

    await db.execute(
      sql`INSERT INTO user_limits (user_id, max_bet_per_round, max_loss_per_day, locked_until, session_limit_minutes, updated_by, created_at, updated_at)
          VALUES (${key}, ${maxBetVal}, ${maxLossVal}, ${lockedUntilSql}, ${sessionLimitVal}, ${updatedBy ?? null}, NOW(), NOW())
          ON DUPLICATE KEY UPDATE ${updateClause}`
    );

    this._cache.delete(key);
    return this.getLimits(key);
  }

  /**
   * Clear all limits for a user (set every field to null).
   */
  async clearLimits(userId: number): Promise<void> {
    const key = Number(userId);
    await db.execute(
      sql`UPDATE user_limits
          SET max_bet_per_round = NULL, max_loss_per_day = NULL, locked_until = NULL, session_limit_minutes = NULL, updated_at = NOW()
          WHERE user_id = ${key}`
    );
    this._cache.delete(key);
  }

  /**
   * Set the session start time for a user IF not already set. Idempotent.
   * Called from `assertCanBet` so the clock starts on the first bet.
   */
  markSessionStart(userId: number): void {
    const key = Number(userId);
    if (!this._sessionStarts.has(key)) {
      this._sessionStarts.set(key, new Date());
    }
  }

  /**
   * Remove the in-memory session start for a user. Called from socket
   * disconnect handlers so a fresh connection gets a fresh clock.
   */
  clearSession(userId: number): void {
    if (userId == null) return;
    this._sessionStarts.delete(Number(userId));
  }

  /**
   * Pre-bet check. Order: locked → bet_too_large → daily_loss_cap → session_time_exceeded → ok.
   * On any internal error, returns { ok: true } (fail-open) and logs a
   * system event — limits enforcement must not break gameplay if the
   * limits table itself is unreachable.
   */
  async assertCanBet(userId: number, betAmount: number, gameType: string): Promise<AssertCanBetResult> {
    try {
      // Start the session timer on the first bet (idempotent).
      this.markSessionStart(userId);

      const limits = await this.getLimits(userId);

      // 1. Locked until
      if (limits.lockedUntil && limits.lockedUntil.getTime() > Date.now()) {
        return { ok: false, reason: 'locked', details: { until: limits.lockedUntil.toISOString() } };
      }

      const bet = new Decimal(betAmount).abs();

      // 2. Max bet per round
      if (limits.maxBetPerRound != null && bet.gt(new Decimal(limits.maxBetPerRound))) {
        return { ok: false, reason: 'bet_too_large', details: { max: limits.maxBetPerRound } };
      }

      // 3. Daily loss cap
      if (limits.maxLossPerDay != null) {
        const result = await db.execute(
          sql`SELECT
                COALESCE(SUM(CASE WHEN transaction_type = 'game_loss' THEN ABS(amount) ELSE 0 END), 0) AS losses,
                COALESCE(SUM(CASE WHEN transaction_type = 'game_win'  THEN amount       ELSE 0 END), 0) AS wins
              FROM transactions
              WHERE user_id = ${Number(userId)}
                AND transaction_type IN ('game_loss', 'game_win')
                AND transaction_status = 'completed'
                AND created_at >= (NOW() - INTERVAL 1 DAY)`
        );
        const row = (result as any)[0]?.[0] || {};
        const losses = new Decimal(String(row.losses ?? '0'));
        const wins = new Decimal(String(row.wins ?? '0'));
        const netLoss = Decimal.max(new Decimal(0), losses.minus(wins));
        const limit = new Decimal(limits.maxLossPerDay);
        if (netLoss.plus(bet).gt(limit)) {
          return {
            ok: false,
            reason: 'daily_loss_cap',
            details: { limit: limit.toNumber(), current: netLoss.toNumber() },
          };
        }
      }

      // 4. Session time limit
      if (limits.sessionLimitMinutes != null) {
        const start = this._sessionStarts.get(Number(userId));
        if (start) {
          const elapsedMinutes = (Date.now() - start.getTime()) / 60_000;
          if (elapsedMinutes > limits.sessionLimitMinutes) {
            return {
              ok: false,
              reason: 'session_time_exceeded',
              details: {
                startedAt: start.toISOString(),
                limitMinutes: limits.sessionLimitMinutes,
              },
            };
          }
        }
      }

      return { ok: true };
    } catch (error) {
      LoggingService.logSystemEvent('user_limits_assert_error', {
        userId,
        gameType,
        betAmount,
        error: error instanceof Error ? error.message : String(error),
      }, 'warning');
      return { ok: true };
    }
  }

  /**
   * Drop cached limits for one user (or all). Mostly for tests.
   * Also clears in-memory session-start state.
   */
  invalidate(userId?: number): void {
    if (userId != null) {
      const key = Number(userId);
      this._cache.delete(key);
      this._sessionStarts.delete(key);
    } else {
      this._cache.clear();
      this._sessionStarts.clear();
    }
  }
}

export default new UserLimitsService();
export { UserLimitsService };
