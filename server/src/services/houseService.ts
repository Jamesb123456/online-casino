import Decimal from 'decimal.js';
import { db } from '../../drizzle/db.js';
import { sql, type SQL } from 'drizzle-orm';
import LoggingService from './loggingService.js';
import AlertService from './alertService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Drizzle's transaction handle. The schema generic is unused by this service
 * (we go through raw `tx.execute(sql\`...\`)`) so we keep it as the runtime
 * shape we rely on: an object with `.execute(sql)` and the same shape as `db`.
 */
export type TxLike = Pick<typeof db, 'execute'>;

/**
 * Caps loaded from the `settings` table. `perDay` may be null = unlimited.
 */
export interface PayoutCaps {
  perRound: number;
  perUserPerDay: number;
  perDay: number | null;
}

/**
 * Money input accepted by all house-movement methods. Coerced via
 * Decimal so any of `number | string | Decimal` is safe at runtime.
 */
export type MoneyInput = number | string | Decimal;

/** Audit metadata attached to a house transaction row. */
export type HouseAuditMetadata = Record<string, unknown>;

/**
 * Options accepted by `_applyDelta` and the public credit/debit/topUp
 * wrappers. All fields except `type` are optional; `type` is supplied by
 * the wrapper before delegating to `_applyDelta`.
 */
export interface ApplyDeltaOpts {
  type?: string;
  userId?: number | null;
  gameType?: string | null;
  gameSessionId?: number | null;
  transactionId?: number | null;
  adminId?: number | null;
  reason?: string | null;
  metadata?: HouseAuditMetadata | null;
  assertSolvent?: boolean;
}

/** Public opts passed to `creditHouse` / `debitHouse` (type is added internally). */
export type HouseMovementOpts = Omit<ApplyDeltaOpts, 'type' | 'assertSolvent'>;

export interface ApplyDeltaResult {
  balanceAfter: number;
}

export interface SetHouseBalanceResult {
  balanceBefore: number;
  balanceAfter: number;
}

export interface HouseTransactionParams {
  limit: number;
  offset: number;
  type?: string | null;
  from?: string | null;
  to?: string | null;
}

/**
 * Raw row shape returned by {@link HouseService.getTransactions}. Keys are
 * snake_case because the route layer formats and renames them.
 */
export interface HouseTransactionRawRow {
  id: number;
  type: string;
  amount: string;
  balance_before: string;
  balance_after: string;
  user_id: number | null;
  admin_id: number | null;
  game_type: string | null;
  game_session_id: number | null;
  transaction_id: number | null;
  reason: string | null;
  metadata: unknown;
  created_at: Date | string;
  user_username: string | null;
  admin_username: string | null;
}

export type CanPayoutResult = { ok: true } | { ok: false; reason: string };

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Settings keys for payout caps
export const CAP_KEYS = {
  perRound: 'max_payout_per_round',
  perUserPerDay: 'max_payout_per_user_per_day',
  perDay: 'max_payout_per_day_global',
} as const;

export type CapKey = (typeof CAP_KEYS)[keyof typeof CAP_KEYS];

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
  _capCache: { value: PayoutCaps; loadedAt: number } | null = null;

  _runner(tx: TxLike | null | undefined): TxLike {
    return tx || db;
  }

  /**
   * Get current house balance.
   */
  async getHouseBalance(tx: TxLike | null = null): Promise<number> {
    const runner = this._runner(tx);
    const result = await runner.execute(
      sql`SELECT balance FROM house_account ORDER BY id ASC LIMIT 1`
    );
    const row = (result as unknown as Array<Array<{ balance?: string | number }>>)[0]?.[0];
    if (!row) {
      return 0;
    }
    return new Decimal(String(row.balance || '0')).toNumber();
  }

  /**
   * Internal: load (or create) the singleton house row inside a transaction
   * with a row-level lock. Returns { id, balance: Decimal }.
   */
  async _lockHouseRow(tx: TxLike): Promise<{ id: number; balance: Decimal }> {
    type LockedRow = { id: number; balance?: string | number };
    let res = await tx.execute(
      sql`SELECT id, balance FROM house_account ORDER BY id ASC LIMIT 1 FOR UPDATE`
    );
    let row = (res as unknown as Array<Array<LockedRow>>)[0]?.[0];
    if (!row) {
      await tx.execute(
        sql`INSERT INTO house_account (balance, created_at, updated_at) VALUES ('0', NOW(), NOW())`
      );
      res = await tx.execute(
        sql`SELECT id, balance FROM house_account ORDER BY id ASC LIMIT 1 FOR UPDATE`
      );
      row = (res as unknown as Array<Array<LockedRow>>)[0]?.[0];
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
  async _applyDelta(deltaAmount: MoneyInput, opts: ApplyDeltaOpts, tx: TxLike | null): Promise<ApplyDeltaResult> {
    const exec = async (t: TxLike): Promise<ApplyDeltaResult> => {
      const { id, balance: balanceBefore } = await this._lockHouseRow(t);
      const balanceAfter = balanceBefore.plus(deltaAmount as Decimal.Value);

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
            (${opts.type}, ${new Decimal(deltaAmount as Decimal.Value).toFixed(2)}, ${balanceBefore.toFixed(2)}, ${balanceAfter.toFixed(2)},
             ${opts.userId ?? null}, ${opts.gameType ?? null}, ${opts.gameSessionId ?? null},
             ${opts.transactionId ?? null}, ${opts.adminId ?? null}, ${opts.reason ?? null},
             ${auditMeta}, NOW())`
      );

      return { balanceAfter: balanceAfter.toNumber() };
    };

    const result = tx ? await exec(tx) : await db.transaction(async (t) => exec(t as unknown as TxLike));

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
  async creditHouse(amount: MoneyInput, opts: HouseMovementOpts = {}, tx: TxLike | null = null): Promise<ApplyDeltaResult> {
    const delta = new Decimal(amount as Decimal.Value).abs();
    return this._applyDelta(delta.toNumber(), { type: 'bet_credit', ...opts }, tx);
  }

  /**
   * Debit the house (user won a payout). `amount` is the absolute amount.
   * Aborts the surrounding transaction if the house can't cover the payout —
   * this is the authoritative solvency check.
   */
  async debitHouse(amount: MoneyInput, opts: HouseMovementOpts = {}, tx: TxLike | null = null): Promise<ApplyDeltaResult> {
    const delta = new Decimal(amount as Decimal.Value).abs().neg();
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
  async topUp(amount: MoneyInput, adminId: number | null, reason: string | null = null, tx: TxLike | null = null): Promise<ApplyDeltaResult> {
    const delta = new Decimal(amount as Decimal.Value);
    if (!delta.isFinite() || delta.lte(0)) {
      throw new Error('topup_amount_must_be_positive');
    }
    return this._applyDelta(delta.toNumber(), { type: 'admin_topup', adminId, reason }, tx);
  }

  /**
   * Admin sets the house balance to an explicit value. Writes an audit row
   * of type `admin_topup` (positive delta) or `admin_withdraw` (negative delta).
   */
  async setHouseBalance(newBalance: MoneyInput, adminId: number | null, reason: string | null = null, tx: TxLike | null = null): Promise<SetHouseBalanceResult> {
    const exec = async (t: TxLike): Promise<SetHouseBalanceResult> => {
      const { id, balance: balanceBefore } = await this._lockHouseRow(t);
      const target = new Decimal(newBalance as Decimal.Value);
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
    return db.transaction(async (t) => exec(t as unknown as TxLike));
  }

  /**
   * Read all cap values from the settings table, with a small in-memory TTL cache.
   * Returns numbers (or null for "unlimited").
   */
  async getCaps(): Promise<PayoutCaps> {
    if (this._capCache && Date.now() - this._capCache.loadedAt < CAP_TTL_MS) {
      return this._capCache.value;
    }

    type SettingRow = { key: string; value: unknown };
    const result = await db.execute(
      sql`SELECT \`key\`, \`value\` FROM settings WHERE \`key\` IN (${CAP_KEYS.perRound}, ${CAP_KEYS.perUserPerDay}, ${CAP_KEYS.perDay})`
    );
    const rows: SettingRow[] = (result as unknown as SettingRow[][])[0] || [];

    const lookup: Record<string, unknown> = {};
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

  _parseSettingValue(raw: unknown): unknown {
    if (raw == null) return null;
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(String(raw));
    } catch {
      return raw;
    }
  }

  _toNumberOrDefault(value: unknown, defaultStr: string): number {
    if (value == null) return new Decimal(defaultStr).toNumber();
    return new Decimal(String(value)).toNumber();
  }

  /**
   * Update a single cap setting.
   */
  async setCap(key: string, value: unknown, adminId: number | null): Promise<void> {
    if (!(Object.values(CAP_KEYS) as readonly string[]).includes(key)) {
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
   * Paginated audit log of house transactions with optional filters.
   * Returns raw DB rows (snake_case keys, string decimals) plus the total
   * count of matching rows. The route layer is responsible for mapping
   * raw rows into the public response shape.
   */
  async getTransactions(params: HouseTransactionParams): Promise<{ rawRows: HouseTransactionRawRow[]; total: number }> {
    const { limit, offset, type = null, from = null, to = null } = params;

    const conditions: SQL[] = [sql`1 = 1`];
    if (type) conditions.push(sql`ht.type = ${type}`);
    if (from) conditions.push(sql`ht.created_at >= ${from}`);
    if (to) conditions.push(sql`ht.created_at <= ${to}`);
    const whereClause = sql.join(conditions, sql` AND `);

    const rowsResult = await db.execute(
      sql`SELECT ht.id, ht.type, ht.amount, ht.balance_before, ht.balance_after,
                 ht.user_id, ht.admin_id, ht.game_type, ht.game_session_id,
                 ht.transaction_id, ht.reason, ht.metadata, ht.created_at,
                 u.username AS user_username, a.username AS admin_username
          FROM house_transactions ht
          LEFT JOIN users u ON u.id = ht.user_id
          LEFT JOIN users a ON a.id = ht.admin_id
          WHERE ${whereClause}
          ORDER BY ht.id DESC
          LIMIT ${limit} OFFSET ${offset}`
    );
    const rawRows: HouseTransactionRawRow[] =
      (rowsResult as unknown as HouseTransactionRawRow[][])[0] || [];

    const countResult = await db.execute(
      sql`SELECT COUNT(*) AS total FROM house_transactions ht WHERE ${whereClause}`
    );
    const total = Number(
      (countResult as unknown as Array<Array<{ total: number | string }>>)[0]?.[0]?.total ?? 0,
    );

    return { rawRows, total };
  }

  /**
   * Pre-payout check.
   * Returns { ok: true } or { ok: false, reason: '...' }.
   */
  async canPayout(amount: MoneyInput, userId: number, gameType: string | null): Promise<CanPayoutResult> {
    try {
      const payout = new Decimal(amount as Decimal.Value).abs();
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
      const userSum = new Decimal(String(((userDaily as unknown as Array<Array<{ total: number | string }>>)[0]?.[0]?.total) ?? '0'));
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
        const globalSum = new Decimal(String(((globalDaily as unknown as Array<Array<{ total: number | string }>>)[0]?.[0]?.total) ?? '0'));
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
