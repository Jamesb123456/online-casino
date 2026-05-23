import Decimal from 'decimal.js';
import { sql, eq, and, desc, type SQL } from 'drizzle-orm';
import { db } from '../../drizzle/db.js';
import { alerts } from '../../drizzle/schema.js';
import type { Alert } from '../../drizzle/schema.js';
import LoggingService from './loggingService.js';

// Raw mysql2 result row for the settings key/value lookup.
type SettingRow = { key: string; value: unknown };
type CountRow = { c: number | string };
// mysql2 returns [rows, fields] but the wrapping varies under mocks.
type Mysql2Result<R> = [R[], unknown] | R[] | { insertId?: number; affectedRows?: number };

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Settings keys for alert thresholds.
export const ALERT_KEYS = {
  bigWin: 'alert_big_win',
  houseLow: 'alert_house_low',
  rapidBetsPerMin: 'alert_rapid_bets_per_min',
} as const;

const DEFAULT_THRESHOLDS = {
  bigWin: 50_000,
  houseLow: 100_000,
  rapidBetsPerMin: 30,
};

const THRESHOLD_TTL_MS = 30_000;
const RAPID_WINDOW_MS = 60_000;
const RAPID_COOLDOWN_MS = 5 * 60_000;

export type AlertType = 'big_win' | 'house_low' | 'rapid_bets';
export type AlertSeverity = 'info' | 'warning' | 'critical';

interface Thresholds {
  bigWin: number;
  houseLow: number;
  rapidBetsPerMin: number;
}

interface GetRecentOpts {
  unreadOnly?: boolean;
  type?: AlertType | string | null;
  limit?: number;
  offset?: number;
}

/**
 * Alert Service
 * Emits anomaly notifications to a database table and exposes admin-side
 * queries to read/acknowledge them. Convenience emitters (`checkBigWin`,
 * `checkHouseLow`, `checkRapidBets`) are called fire-and-forget from
 * balance/house services so a broken alert pipeline cannot break play.
 *
 * Rapid-bet detection uses an in-memory ring buffer per user; this is
 * intentionally process-local — multi-instance deployments are a Phase 4
 * concern (would need Redis-backed counters).
 *
 * House-low detection only fires on a *downward* crossing of the threshold
 * so a sustained-low balance does not spam alerts.
 */
class AlertService {
  _thresholdCache: { value: Thresholds; loadedAt: number } | null = null;

  // Per-user state for rapid-bets detection
  _rapidBetTimestamps: Map<number, number[]> = new Map();
  _rapidBetCooldown: Map<number, number> = new Map();

  // Last-known house balance state (relative to current threshold) for
  // crossing-downward detection. Starts as null so the first call seeds it.
  _lastHouseBelowThreshold: boolean | null = null;

  // ---------------------------------------------------------------------
  // Thresholds
  // ---------------------------------------------------------------------

  async getThresholds(): Promise<Thresholds> {
    if (this._thresholdCache && Date.now() - this._thresholdCache.loadedAt < THRESHOLD_TTL_MS) {
      return this._thresholdCache.value;
    }

    const result = await db.execute(
      sql`SELECT \`key\`, \`value\` FROM settings WHERE \`key\` IN (${ALERT_KEYS.bigWin}, ${ALERT_KEYS.houseLow}, ${ALERT_KEYS.rapidBetsPerMin})`,
    );
    const rows: SettingRow[] = (result as unknown as SettingRow[][])[0] || [];

    const lookup: Record<string, unknown> = {};
    for (const r of rows) {
      lookup[r.key] = this._parseSettingValue(r.value);
    }

    const thresholds: Thresholds = {
      bigWin: this._toNumberOrDefault(lookup[ALERT_KEYS.bigWin], DEFAULT_THRESHOLDS.bigWin),
      houseLow: this._toNumberOrDefault(lookup[ALERT_KEYS.houseLow], DEFAULT_THRESHOLDS.houseLow),
      rapidBetsPerMin: this._toNumberOrDefault(
        lookup[ALERT_KEYS.rapidBetsPerMin],
        DEFAULT_THRESHOLDS.rapidBetsPerMin,
      ),
    };

    this._thresholdCache = { value: thresholds, loadedAt: Date.now() };
    return thresholds;
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

  _toNumberOrDefault(value: unknown, fallback: number): number {
    if (value == null) return fallback;
    try {
      const n = new Decimal(String(value)).toNumber();
      return Number.isFinite(n) ? n : fallback;
    } catch {
      return fallback;
    }
  }

  async setThresholds(
    update: { bigWin?: number; houseLow?: number; rapidBetsPerMin?: number },
    adminId: number | null,
  ): Promise<Thresholds> {
    const writes: Array<{ key: string; value: number }> = [];
    if (update.bigWin != null) {
      this._assertNonNegative(update.bigWin, 'bigWin');
      writes.push({ key: ALERT_KEYS.bigWin, value: update.bigWin });
    }
    if (update.houseLow != null) {
      this._assertNonNegative(update.houseLow, 'houseLow');
      writes.push({ key: ALERT_KEYS.houseLow, value: update.houseLow });
    }
    if (update.rapidBetsPerMin != null) {
      this._assertNonNegative(update.rapidBetsPerMin, 'rapidBetsPerMin');
      writes.push({ key: ALERT_KEYS.rapidBetsPerMin, value: update.rapidBetsPerMin });
    }

    for (const w of writes) {
      const json = JSON.stringify(w.value);
      await db.execute(
        sql`INSERT INTO settings (\`key\`, \`value\`, updated_by, updated_at)
            VALUES (${w.key}, ${json}, ${adminId ?? null}, NOW())
            ON DUPLICATE KEY UPDATE \`value\` = ${json}, updated_by = ${adminId ?? null}, updated_at = NOW()`,
      );
    }

    this._thresholdCache = null;
    return this.getThresholds();
  }

  _assertNonNegative(value: unknown, label: string): void {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`invalid_threshold:${label}`);
    }
  }

  // ---------------------------------------------------------------------
  // Core writes
  // ---------------------------------------------------------------------

  async emit(
    type: AlertType,
    severity: AlertSeverity,
    userId: number | null,
    gameType: string | null,
    details: Record<string, unknown>,
  ): Promise<Alert> {
    const detailsJson = JSON.stringify(details ?? {});
    const result = (await db.execute(
      sql`INSERT INTO alerts (type, severity, user_id, game_type, details, acknowledged, created_at)
          VALUES (${type}, ${severity}, ${userId ?? null}, ${gameType ?? null}, ${detailsJson}, false, NOW())`,
    )) as Mysql2Result<never>;

    const r = result as { insertId?: number } & Array<{ insertId?: number }>;
    const insertId = r?.[0]?.insertId ?? r?.insertId ?? null;

    LoggingService.logSystemEvent(
      'alert_emitted',
      { id: insertId, type, severity, userId, gameType, details },
      severity === 'critical' ? 'error' : 'warning',
    );

    if (insertId) {
      const rows = await db
        .select()
        .from(alerts)
        .where(eq(alerts.id, Number(insertId)))
        .limit(1);
      if (rows[0]) return rows[0] as Alert;
    }

    // Fallback shape (e.g. mocked db) — caller mainly needs to know an alert fired.
    return {
      id: Number(insertId ?? 0),
      type,
      severity,
      userId: userId ?? null,
      gameType: gameType ?? null,
      details: details ?? {},
      acknowledged: false,
      acknowledgedAt: null,
      acknowledgedBy: null,
      createdAt: new Date(),
    } as Alert;
  }

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------

  async getRecent(opts: GetRecentOpts = {}): Promise<{ rows: Alert[]; total: number; unreadCount: number }> {
    const unreadOnly = !!opts.unreadOnly;
    const type = opts.type || null;
    const limit = Math.min(Math.max(Number(opts.limit ?? 50) || 50, 1), 200);
    const offset = Math.max(Number(opts.offset ?? 0) || 0, 0);

    const conditions: SQL[] = [];
    if (unreadOnly) conditions.push(eq(alerts.acknowledged, false));
    if (type) conditions.push(eq(alerts.type, String(type)));

    const whereClause = conditions.length ? and(...conditions) : undefined;

    // Drizzle's query builder is chain-narrow; keep `any` here to allow the
    // optional `.where()` insertion without restructuring the chain.
    let rowsQuery: any = db.select().from(alerts);
    if (whereClause) rowsQuery = rowsQuery.where(whereClause);
    const rows: Alert[] = await rowsQuery.orderBy(desc(alerts.createdAt)).limit(limit).offset(offset);

    const totalRes = (await db.execute(
      whereClause
        ? unreadOnly && type
          ? sql`SELECT COUNT(*) AS c FROM alerts WHERE acknowledged = false AND type = ${type}`
          : unreadOnly
            ? sql`SELECT COUNT(*) AS c FROM alerts WHERE acknowledged = false`
            : sql`SELECT COUNT(*) AS c FROM alerts WHERE type = ${type}`
        : sql`SELECT COUNT(*) AS c FROM alerts`,
    )) as unknown as CountRow[][];
    const total = Number(totalRes?.[0]?.[0]?.c ?? 0);

    const unreadRes = (await db.execute(
      sql`SELECT COUNT(*) AS c FROM alerts WHERE acknowledged = false`,
    )) as unknown as CountRow[][];
    const unreadCount = Number(unreadRes?.[0]?.[0]?.c ?? 0);

    return { rows, total, unreadCount };
  }

  async acknowledge(id: number, adminId: number | null): Promise<Alert> {
    await db.execute(
      sql`UPDATE alerts
          SET acknowledged = true,
              acknowledged_at = NOW(),
              acknowledged_by = ${adminId ?? null}
          WHERE id = ${id} AND acknowledged = false`,
    );

    const rows = await db.select().from(alerts).where(eq(alerts.id, id)).limit(1);
    if (!rows[0]) {
      throw new Error('alert_not_found');
    }
    return rows[0] as Alert;
  }

  async acknowledgeAll(adminId: number | null): Promise<number> {
    const result = (await db.execute(
      sql`UPDATE alerts
          SET acknowledged = true,
              acknowledged_at = NOW(),
              acknowledged_by = ${adminId ?? null}
          WHERE acknowledged = false`,
    )) as unknown as { affectedRows?: number } & Array<{ affectedRows?: number }>;
    const affected = result?.[0]?.affectedRows ?? result?.affectedRows ?? 0;
    return Number(affected) || 0;
  }

  // ---------------------------------------------------------------------
  // Convenience emitters
  // ---------------------------------------------------------------------

  async checkBigWin(winAmount: number | string, userId: number, gameType: string | null): Promise<void> {
    const thresholds = await this.getThresholds();
    const amount = new Decimal(winAmount || 0);
    const threshold = new Decimal(thresholds.bigWin);
    if (amount.gt(threshold)) {
      await this.emit('big_win', 'warning', userId, gameType, {
        winAmount: amount.toNumber(),
        threshold: threshold.toNumber(),
        message: `Win of ${amount.toFixed(2)} exceeded big-win threshold of ${threshold.toFixed(2)}`,
      });
    }
  }

  async checkHouseLow(currentBalance: number | string): Promise<void> {
    const thresholds = await this.getThresholds();
    const balance = new Decimal(currentBalance || 0);
    const threshold = new Decimal(thresholds.houseLow);
    const isBelow = balance.lt(threshold);

    // Only fire on downward crossing: previous state was at-or-above, now below.
    // First observation just seeds the cache without alerting.
    if (this._lastHouseBelowThreshold === false && isBelow) {
      await this.emit('house_low', 'critical', null, null, {
        balance: balance.toNumber(),
        threshold: threshold.toNumber(),
        message: `House balance ${balance.toFixed(2)} fell below threshold ${threshold.toFixed(2)}`,
      });
    }
    this._lastHouseBelowThreshold = isBelow;
  }

  async checkRapidBets(userId: number, gameType: string | null): Promise<void> {
    if (!userId) return;
    const now = Date.now();

    // Cooldown gate: don't emit if a recent alert already fired for this user.
    const cooldownUntil = this._rapidBetCooldown.get(userId);
    if (cooldownUntil && cooldownUntil > now) {
      // Still record the timestamp so the buffer reflects real activity, but skip emit.
      this._pushRapidTimestamp(userId, now);
      return;
    }

    const thresholds = await this.getThresholds();
    this._pushRapidTimestamp(userId, now);
    const buf = this._rapidBetTimestamps.get(userId) ?? [];

    if (buf.length >= thresholds.rapidBetsPerMin) {
      this._rapidBetCooldown.set(userId, now + RAPID_COOLDOWN_MS);
      await this.emit('rapid_bets', 'warning', userId, gameType, {
        count: buf.length,
        windowMs: RAPID_WINDOW_MS,
        threshold: thresholds.rapidBetsPerMin,
        message: `${buf.length} bets in the last 60s exceeded threshold ${thresholds.rapidBetsPerMin}`,
      });
    }
  }

  _pushRapidTimestamp(userId: number, now: number): void {
    const cutoff = now - RAPID_WINDOW_MS;
    const buf = this._rapidBetTimestamps.get(userId) ?? [];
    // Drop entries outside the window
    let i = 0;
    while (i < buf.length && buf[i] < cutoff) i++;
    const trimmed = i > 0 ? buf.slice(i) : buf;
    trimmed.push(now);
    this._rapidBetTimestamps.set(userId, trimmed);
  }

  // ---------------------------------------------------------------------
  // Test hooks
  // ---------------------------------------------------------------------

  _resetState(): void {
    this._thresholdCache = null;
    this._rapidBetTimestamps.clear();
    this._rapidBetCooldown.clear();
    this._lastHouseBelowThreshold = null;
  }
}

const alertService = new AlertService();
export default alertService;
export { AlertService, DEFAULT_THRESHOLDS, RAPID_WINDOW_MS, RAPID_COOLDOWN_MS };
