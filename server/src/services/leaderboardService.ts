import { db } from '../../drizzle/db.js';
import { sql } from 'drizzle-orm';

/**
 * Row shape produced by both leaderboard queries. Numeric columns can be
 * either string (DECIMAL from mysql2) or number (COUNT), so keep them as a
 * union for callers that coerce with Number(...).
 */
export interface LeaderboardRow {
  id: number;
  username: string;
  totalWinnings: number | string;
  totalGames: number | string;
}

/**
 * mysql2 returns `[rows, fields]` but Drizzle's `.execute()` typing leaks
 * through depending on the driver. The route consumer normalises the tuple
 * shape itself, so we declare the wider union here.
 */
export type LeaderboardQueryResult = LeaderboardRow[] | [LeaderboardRow[], unknown] | unknown;

/**
 * Leaderboard Service
 *
 * Encapsulates the raw SQL queries that back the public `/api/leaderboard`
 * endpoint. Two query variants exist:
 *   - period-filtered (`daily`, `weekly`): includes a `t.created_at >= ?` join
 *     condition so users still appear in the result set even when they have no
 *     transactions in the window (HAVING totalWinnings > 0 then filters them out)
 *   - unfiltered (`allTime`): no date constraint
 *
 * Both queries return the same row shape:
 *   { id, username, totalWinnings, totalGames }
 *
 * The route layer remains responsible for assembling the `{ period, leaderboard }`
 * JSON envelope and unwrapping the mysql2 `[rows, fields]` tuple — callers get
 * the raw `db.execute()` result back so the wire contract is preserved exactly.
 */
class LeaderboardService {
  /**
   * Top-winners query, optionally restricted to transactions created after
   * `since`. When `since` is null the query returns all-time totals.
   *
   * Returns the raw `db.execute()` result so the route can normalise the
   * mysql2 `[rows, fields]` tuple as it does today.
   */
  async getTopWinners(since: Date | null, limit: number): Promise<LeaderboardQueryResult> {
    if (since) {
      const dateStr = since.toISOString().slice(0, 19).replace('T', ' ');
      return db.execute(sql`
        SELECT
          u.id,
          u.username,
          COALESCE(SUM(CASE WHEN t.transaction_type = 'game_win' THEN CAST(t.amount AS DECIMAL(15,2)) ELSE 0 END), 0) as totalWinnings,
          COUNT(CASE WHEN t.transaction_type IN ('game_win', 'game_loss') THEN 1 END) as totalGames
        FROM users u
        LEFT JOIN transactions t ON u.id = t.user_id AND t.created_at >= ${dateStr}
        WHERE u.is_active = 1
        GROUP BY u.id, u.username
        HAVING totalWinnings > 0
        ORDER BY totalWinnings DESC
        LIMIT ${limit}
      `);
    }

    return db.execute(sql`
      SELECT
        u.id,
        u.username,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'game_win' THEN CAST(t.amount AS DECIMAL(15,2)) ELSE 0 END), 0) as totalWinnings,
        COUNT(CASE WHEN t.transaction_type IN ('game_win', 'game_loss') THEN 1 END) as totalGames
      FROM users u
      LEFT JOIN transactions t ON u.id = t.user_id
      WHERE u.is_active = 1
      GROUP BY u.id, u.username
      HAVING totalWinnings > 0
      ORDER BY totalWinnings DESC
      LIMIT ${limit}
    `);
  }
}

export default new LeaderboardService();
