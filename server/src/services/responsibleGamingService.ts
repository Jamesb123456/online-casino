/**
 * Responsible Gaming Service
 *
 * Centralises raw DB access for the responsible-gaming domain
 * (user account active flag, self-exclusion, recent activity summary)
 * and the generic admin settings table, extracted from the
 * `responsible-gaming.ts` and `adminSettings.ts` route files as part of
 * the A5c service-extraction pass.
 *
 * Each method intentionally returns the shape the calling route needs
 * (mostly row objects or simple primitives) so the route layer keeps
 * responsibility for HTTP concerns: response shaping, status codes,
 * authorization, validation, and logging. The wire contracts for the
 * affected routes are locked by tests in
 *   - server/src/__tests__/routes/responsibleGaming.test.ts
 *   - server/src/__tests__/routes/adminSettings.test.ts
 * If you change any return shape here, those tests will flag the drift.
 *
 * NOTE: This service uses `db.execute` / `db.select` / `db.update` from
 * the shared `drizzle/db.js` module so existing route-level mocks
 * (which mock the db module, not this service) continue to work
 * transparently across the extraction.
 */

import { db } from '../../drizzle/db.js';
import { users } from '../../drizzle/schema.js';
import { eq, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivitySummaryRow {
  totalTransactions?: number | string | null;
  totalLosses?: number | string | null;
  totalWins?: number | string | null;
}

export interface UserActiveRow {
  isActive: boolean;
}

export interface SettingsRow {
  key: string;
  // settings.value is a JSON column; mysql2 may return it as the parsed
  // object or as a JSON string depending on driver options.
  value: unknown;
  updated_at: Date | string | null;
  updated_by: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * mysql2 returns `[rows, fields]`. The activity-summary code historically
 * tolerated both shapes (driver-quirk safety). Preserve that here.
 */
function unwrapFirstRow<T = unknown>(result: unknown): T | undefined {
  if (Array.isArray(result)) {
    const head = result[0];
    if (Array.isArray(head)) return head[0] as T | undefined;
    return head as T | undefined;
  }
  return result as T | undefined;
}

/** Returns the rows array regardless of driver wrapping. */
function unwrapRows<T = unknown>(result: unknown): T[] {
  return (((result as unknown) as T[][])[0] || []) as T[];
}

// ---------------------------------------------------------------------------
// Responsible Gaming — user state
// ---------------------------------------------------------------------------

/**
 * Read the `isActive` flag for a user (used by the
 * GET /api/responsible-gaming/limits endpoint).
 * Returns the matched row or undefined if no such user.
 */
export async function getUserActiveState(userId: number): Promise<UserActiveRow | undefined> {
  const [row] = await db
    .select({ isActive: users.isActive })
    .from(users)
    .where(eq(users.id, userId));
  return row as UserActiveRow | undefined;
}

/**
 * Deactivate a user (used by POST /api/responsible-gaming/self-exclude
 * to enforce self-exclusion). The auth middleware blocks login for
 * `isActive = false` accounts.
 */
export async function deactivateUser(userId: number): Promise<void> {
  await db
    .update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

// ---------------------------------------------------------------------------
// Responsible Gaming — activity summary
// ---------------------------------------------------------------------------

/**
 * Aggregate game win/loss activity for a user over the last 7 days.
 * Returns the raw aggregate row exactly as the SQL produces it. The
 * caller is responsible for coercing strings → numbers and computing
 * any derived fields (e.g. netResult).
 *
 * Used by GET /api/responsible-gaming/activity-summary.
 */
export async function getActivitySummaryLast7Days(userId: number): Promise<ActivitySummaryRow> {
  const result = await db.execute(sql`
      SELECT
        COUNT(*) as totalTransactions,
        COALESCE(SUM(CASE WHEN transaction_type = 'game_loss' THEN CAST(amount AS DECIMAL(15,2)) ELSE 0 END), 0) as totalLosses,
        COALESCE(SUM(CASE WHEN transaction_type = 'game_win' THEN CAST(amount AS DECIMAL(15,2)) ELSE 0 END), 0) as totalWins
      FROM transactions
      WHERE user_id = ${userId}
        AND transaction_type IN ('game_win', 'game_loss')
        AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);
  return (unwrapFirstRow<ActivitySummaryRow>(result) || {}) as ActivitySummaryRow;
}

/**
 * Aggregate game win/loss activity for a user over the last 30 days.
 * See {@link getActivitySummaryLast7Days} for shape semantics.
 */
export async function getActivitySummaryLast30Days(userId: number): Promise<ActivitySummaryRow> {
  const result = await db.execute(sql`
      SELECT
        COUNT(*) as totalTransactions,
        COALESCE(SUM(CASE WHEN transaction_type = 'game_loss' THEN CAST(amount AS DECIMAL(15,2)) ELSE 0 END), 0) as totalLosses,
        COALESCE(SUM(CASE WHEN transaction_type = 'game_win' THEN CAST(amount AS DECIMAL(15,2)) ELSE 0 END), 0) as totalWins
      FROM transactions
      WHERE user_id = ${userId}
        AND transaction_type IN ('game_win', 'game_loss')
        AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);
  return (unwrapFirstRow<ActivitySummaryRow>(result) || {}) as ActivitySummaryRow;
}

// ---------------------------------------------------------------------------
// Admin Settings (generic key/value store)
//
// These methods are not strictly "responsible gaming" but were extracted
// as part of the same A5c batch. They live here to avoid spawning a
// micro-service file for three CRUD calls; the wire contract in
// adminSettings.test.ts locks the shape returned by the route.
// ---------------------------------------------------------------------------

/**
 * List every row in the `settings` table, ordered by key ascending.
 * Returns the raw row objects (snake_case columns intact); the caller
 * shapes them into the route response.
 */
export async function listSettings(): Promise<SettingsRow[]> {
  const result = await db.execute(
    sql`SELECT \`key\`, \`value\`, updated_at, updated_by
        FROM settings
        ORDER BY \`key\` ASC`
  );
  return unwrapRows<SettingsRow>(result);
}

/**
 * Read a single settings row by key. Returns undefined when missing.
 */
export async function getSetting(key: string): Promise<SettingsRow | undefined> {
  const result = await db.execute(
    sql`SELECT \`key\`, \`value\`, updated_at, updated_by
        FROM settings
        WHERE \`key\` = ${key}
        LIMIT 1`
  );
  const rows = unwrapRows<SettingsRow>(result);
  return rows[0];
}

/**
 * Upsert a settings row. `valueJson` MUST be a pre-serialised JSON
 * string (the column is `json NOT NULL`); the route layer owns the
 * JSON.stringify call and value validation.
 */
export async function upsertSetting(
  key: string,
  valueJson: string,
  adminId: number | null,
): Promise<void> {
  await db.execute(
    sql`INSERT INTO settings (\`key\`, \`value\`, updated_by, updated_at)
        VALUES (${key}, ${valueJson}, ${adminId ?? null}, NOW())
        ON DUPLICATE KEY UPDATE \`value\` = ${valueJson}, updated_by = ${adminId ?? null}, updated_at = NOW()`
  );
}

// ---------------------------------------------------------------------------
// Default export — bundles methods into a single namespace object for
// callers that prefer the service-instance import style used elsewhere
// in the codebase (e.g. balanceService, userLimitsService).
// ---------------------------------------------------------------------------

const responsibleGamingService = {
  getUserActiveState,
  deactivateUser,
  getActivitySummaryLast7Days,
  getActivitySummaryLast30Days,
  listSettings,
  getSetting,
  upsertSetting,
};

export default responsibleGamingService;
