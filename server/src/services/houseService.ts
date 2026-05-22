import Decimal from 'decimal.js';
import { db } from '../../drizzle/db.js';
import { sql } from 'drizzle-orm';
import LoggingService from './loggingService.js';
import AlertService from './alertService.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Settings keys for payout caps
export const CAP_KEYS = {
  perRound: 'max_payout_per_round',
  perUserPerDay: 'max_payout_per_user_per_day',
  perDay: 'max_payout_per_day_global',
} as const;

const DEFAULT_CAPS = {
  perRound: '1000000',
  perUserPerDay: '10000000',
  perDay: null as string | null,
};

const CAP_TTL_MS = 30_000;

/**
 * House Service
 * Manages the centralized house treasury, audit log of house movements,
 * and payout caps. All money math uses Decimal.js.
 *
 * Every method may optionally accept a Drizzle transaction handle (`tx`)
 * so it can participate in an existing DB transaction. When no `tx` is
 * passed, the operation opens its own transaction.
 */
class HouseService {
  _capCache: { value: any; loadedAt: number } | null = null;

  _runner(tx) {
    return tx || db;
  }

  /**
   * Get current house balance.
   */
  async getHouseBalance(tx = null): Promise<number> {
    const runner = this._runner(tx);
    const result = await runner.execute(
      sql`SELECT balance FROM house_account ORDER BY id ASC LIMIT 1`
    );
    const row = (result as any)[0]?.[0];
    if (!row) {
      return 0;
    }
    return new Decimal(String(row.balance || '0')).toNumber();
  }

  /**
   * Internal: load (or create) the singleton house row inside a transaction
   * with a row-level lock. Returns { id, balance: Decimal }.
   */
  async _lockHouseRow(tx) {
    let res = await tx.execute(
      sql`SELECT id, balance FROM house_account ORDER BY id ASC LIMIT 1 FOR UPDATE`
    );
    let row = (res as any)[0]?.[0];
    if (!row) {
      await tx.execute(
        sql`INSERT INTO house_account (balance, created_at, updated_at) VALUES ('0', NOW(), NOW())`
      );
      res = await tx.execute(
        sql`SELECT id, balance FROM house_account ORDER BY id ASC LIMIT 1 FOR UPDATE`
      );
      row = (res as any)[0]?.[0];
    }
    return {
      id: row.id,
      balance: new Decimal(String(row.balance || '0')),
    };
  }

  /**
   * Internal: apply a signed delta to the house balance and write an audit row.
   * Returns { balanceAfter: number }.
   *
   * When `opts.assertSolvent` is true, the operation aborts (rolling back the
   * surrounding transaction) if the resulting balance would be negative. This
   * is the authoritative solvency check — `canPayout()` is only a preflight.
   */
  async _applyDelta(deltaAmount, opts, tx) {
    const exec = async (t) => {
      const { id, balance: balanceBefore } = await this._lockHouseRow(t);
      const balanceAfter = balanceBefore.plus(deltaAmount);

      if (opts.assertSolvent && balanceAfter.isNegative()) {
        throw new Error('payout_blocked:house_insufficient');
      }

      await t.execute(
        sql`UPDATE house_account SET balance = ${balanceAfter.toFixed(2)}, updated_at = NOW() WHERE id = ${id}`
      );

      const auditMeta = opts.metadata ? JSON.stringify(opts.metadata) : null;
      await t.execute(
        sql`INSERT INTO house_transactions
            (type, amount, balance_before, balance_after, user_id, game_type, game_session_id, transaction_id, admin_id, reason, metadata, created_at)
            VALUES
            (${opts.type}, ${new Decimal(deltaAmount).toFixed(2)}, ${balanceBefore.toFixed(2)}, ${balanceAfter.toFixed(2)},
             ${opts.userId ?? null}, ${opts.gameType ?? null}, ${opts.gameSessionId ?? null},
             ${opts.transactionId ?? null}, ${opts.adminId ?? null}, ${opts.reason ?? null},
             ${auditMeta}, NOW())`
      );

      return { balanceAfter: balanceAfter.toNumber() };
    };

    const result = tx ? await exec(tx) : await db.transaction(async (t) => exec(t));

    // Fire-and-forget house-low anomaly check. Never block the house movement.
    AlertService.checkHouseLow(result.balanceAfter).catch((err) => {
      LoggingService.logSystemEvent('alert_emit_failed', {
        check: 'house_low',
        balanceAfter: result.balanceAfter,
        error: err instanceof Error ? err.message : String(err),
      }, 'warning');
    });

    return result;
  }

  /**
   * Credit the house (user lost a bet). `amount` is the absolute amount.
   */
  async creditHouse(amount, opts: any = {}, tx = null) {
    const delta = new Decimal(amount).abs();
    return this._applyDelta(delta.toNumber(), { type: 'bet_credit', ...opts }, tx);
  }

  /**
   * Debit the house (user won a payout). `amount` is the absolute amount.
   * Aborts the surrounding transaction if the house can't cover the payout —
   * this is the authoritative solvency check.
   */
  async debitHouse(amount, opts: any = {}, tx = null) {
    const delta = new Decimal(amount).abs().neg();
    return this._applyDelta(
      delta.toNumber(),
      { type: 'payout_debit', assertSolvent: true, ...opts },
      tx
    );
  }

  /**
   * Admin top-up: add a positive `amount` to the house balance. Writes an
   * audit row of type `admin_topup`. Cleaner than computing
   * `setHouseBalance(current + amount)` from the caller because it's a single
   * locked operation — no TOCTOU race between read and write.
   */
  async topUp(amount, adminId, reason = null, tx = null) {
    const delta = new Decimal(amount);
    if (!delta.isFinite() || delta.lte(0)) {
      throw new Error('topup_amount_must_be_positive');
    }
    return this._applyDelta(delta.toNumber(), { type: 'admin_topup', adminId, reason }, tx);
  }

  /**
   * Admin sets the house balance to an explicit value. Writes an audit row
   * of type `admin_topup` (positive delta) or `admin_withdraw` (negative delta).
   */
  async setHouseBalance(newBalance, adminId, reason = null, tx = null) {
    const exec = async (t) => {
      const { id, balance: balanceBefore } = await this._lockHouseRow(t);
      const target = new Decimal(newBalance);
      const delta = target.minus(balanceBefore);
      const type = delta.isNegative() ? 'admin_withdraw' : 'admin_topup';

      await t.execute(
        sql`UPDATE house_account SET balance = ${target.toFixed(2)}, updated_at = NOW() WHERE id = ${id}`
      );

      await t.execute(
        sql`INSERT INTO house_transactions
            (type, amount, balance_before, balance_after, user_id, game_type, game_session_id, transaction_id, admin_id, reason, metadata, created_at)
            VALUES
            (${type}, ${delta.toFixed(2)}, ${balanceBefore.toFixed(2)}, ${target.toFixed(2)},
             NULL, NULL, NULL, NULL, ${adminId ?? null}, ${reason ?? null}, NULL, NOW())`
      );

      return { balanceBefore: balanceBefore.toNumber(), balanceAfter: target.toNumber() };
    };

    if (tx) {
      return exec(tx);
    }
    return db.transaction(async (t) => exec(t));
  }

  /**
   * Read all cap values from the settings table, with a small in-memory TTL cache.
   * Returns numbers (or null for "unlimited").
   */
  async getCaps(): Promise<{ perRound: number; perUserPerDay: number; perDay: number | null }> {
    if (this._capCache && Date.now() - this._capCache.loadedAt < CAP_TTL_MS) {
      return this._capCache.value;
    }

    const result = await db.execute(
      sql`SELECT \`key\`, \`value\` FROM settings WHERE \`key\` IN (${CAP_KEYS.perRound}, ${CAP_KEYS.perUserPerDay}, ${CAP_KEYS.perDay})`
    );
    const rows = (result as any)[0] || [];

    const lookup: Record<string, any> = {};
    for (const r of rows) {
      lookup[r.key] = this._parseSettingValue(r.value);
    }

    const caps = {
      perRound: this._toNumberOrDefault(lookup[CAP_KEYS.perRound], DEFAULT_CAPS.perRound),
      perUserPerDay: this._toNumberOrDefault(lookup[CAP_KEYS.perUserPerDay], DEFAULT_CAPS.perUserPerDay),
      perDay: lookup[CAP_KEYS.perDay] == null
        ? (DEFAULT_CAPS.perDay == null ? null : new Decimal(DEFAULT_CAPS.perDay).toNumber())
        : new Decimal(String(lookup[CAP_KEYS.perDay])).toNumber(),
    };

    this._capCache = { value: caps, loadedAt: Date.now() };
    return caps;
  }

  _parseSettingValue(raw) {
    if (raw == null) return null;
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  _toNumberOrDefault(value, defaultStr) {
    if (value == null) return new Decimal(defaultStr).toNumber();
    return new Decimal(String(value)).toNumber();
  }

  /**
   * Update a single cap setting.
   */
  async setCap(key, value, adminId) {
    if (!Object.values(CAP_KEYS).includes(key)) {
      throw new Error('invalid_cap_key');
    }
    const json = JSON.stringify(value);
    await db.execute(
      sql`INSERT INTO settings (\`key\`, \`value\`, updated_by, updated_at)
          VALUES (${key}, ${json}, ${adminId ?? null}, NOW())
          ON DUPLICATE KEY UPDATE \`value\` = ${json}, updated_by = ${adminId ?? null}, updated_at = NOW()`
    );
    this._capCache = null;
  }

  /**
   * Pre-payout check.
   * Returns { ok: true } or { ok: false, reason: '...' }.
   */
  async canPayout(amount, userId, gameType): Promise<{ ok: boolean; reason?: string }> {
    try {
      const payout = new Decimal(amount).abs();
      const caps = await this.getCaps();

      // 1. Per-round cap
      if (payout.gt(new Decimal(caps.perRound))) {
        return { ok: false, reason: 'cap_round' };
      }

      // 2. Per-user, per-day cap (sum of completed game_win transactions in last 24h)
      const userDaily = await db.execute(
        sql`SELECT COALESCE(SUM(amount), 0) AS total
            FROM transactions
            WHERE user_id = ${userId}
              AND transaction_type = 'game_win'
              AND transaction_status = 'completed'
              AND created_at >= (NOW() - INTERVAL 1 DAY)`
      );
      const userSum = new Decimal(String(((userDaily as any)[0]?.[0]?.total) ?? '0'));
      if (userSum.plus(payout).gt(new Decimal(caps.perUserPerDay))) {
        return { ok: false, reason: 'cap_user_day' };
      }

      // 3. Global per-day cap (if set)
      if (caps.perDay != null) {
        const globalDaily = await db.execute(
          sql`SELECT COALESCE(SUM(amount), 0) AS total
              FROM transactions
              WHERE transaction_type = 'game_win'
                AND transaction_status = 'completed'
                AND created_at >= (NOW() - INTERVAL 1 DAY)`
        );
        const globalSum = new Decimal(String(((globalDaily as any)[0]?.[0]?.total) ?? '0'));
        if (globalSum.plus(payout).gt(new Decimal(caps.perDay))) {
          return { ok: false, reason: 'cap_day' };
        }
      }

      // 4. House solvency
      const houseBalance = new Decimal(await this.getHouseBalance());
      if (houseBalance.lt(payout)) {
        return { ok: false, reason: 'house_insufficient' };
      }

      return { ok: true };
    } catch (error) {
      LoggingService.logSystemEvent('house_canPayout_error', {
        userId,
        gameType,
        amount,
        error: error instanceof Error ? error.message : String(error),
      }, 'error');
      throw error;
    }
  }
}

export default new HouseService();
