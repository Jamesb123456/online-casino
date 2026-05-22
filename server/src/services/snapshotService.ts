import { db } from '../../drizzle/db.js';
import { sql } from 'drizzle-orm';
import HouseService from './houseService.js';
import LoggingService from './loggingService.js';
import type { DailySnapshot, NewDailySnapshot } from '../../drizzle/schema.js';

/**
 * SnapshotService
 * Persists per-UTC-day rollups of casino activity (bets, wins, GGR, NGR,
 * bonuses, active/new players) plus a closing house balance reading.
 *
 * Bets are stored in `transactions` as negative `game_loss` rows
 * (see balanceService.placeBet) so we use ABS(amount) for bet totals.
 * Wins are stored as positive `game_win` rows.
 *
 * For backfill of historical days, houseBalanceClose is best-effort:
 * we write the CURRENT house_account balance, not the actual
 * end-of-that-day balance (which is unrecoverable without
 * per-day reconstruction from house_transactions).
 */
class SnapshotService {
  /**
   * Validate a 'YYYY-MM-DD' string.
   */
  _assertDate(dateUtc: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateUtc)) {
      throw new Error('snapshot_invalid_date_format');
    }
  }

  /**
   * Compute (but do not persist) a snapshot for the given UTC date.
   */
  async computeSnapshot(dateUtc: string): Promise<NewDailySnapshot> {
    this._assertDate(dateUtc);

    const dayStart = `${dateUtc} 00:00:00`;
    const dayEnd = `${dateUtc} 23:59:59`;

    // Bets: game_loss rows are stored negative; use ABS for the total wagered.
    const betsResult = await db.execute(sql`
      SELECT COALESCE(SUM(ABS(amount)), 0) AS total
      FROM transactions
      WHERE transaction_type = 'game_loss'
        AND transaction_status = 'completed'
        AND created_at >= ${dayStart}
        AND created_at <= ${dayEnd}
    `);
    const totalBetsNum = Number(((betsResult as any)[0] || [])[0]?.total || 0);

    // Wins: game_win rows are positive payouts (full payout including stake).
    const winsResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE transaction_type = 'game_win'
        AND transaction_status = 'completed'
        AND created_at >= ${dayStart}
        AND created_at <= ${dayEnd}
    `);
    const totalWinsNum = Number(((winsResult as any)[0] || [])[0]?.total || 0);

    // Bonuses paid: explicit bonus + login_reward credits.
    const bonusesResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM transactions
      WHERE transaction_type IN ('bonus', 'login_reward')
        AND transaction_status = 'completed'
        AND created_at >= ${dayStart}
        AND created_at <= ${dayEnd}
    `);
    const bonusesPaidNum = Number(((bonusesResult as any)[0] || [])[0]?.total || 0);

    // Active players: distinct users with at least one bet or win on the day.
    const activeResult = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id) AS cnt
      FROM transactions
      WHERE transaction_type IN ('game_loss', 'game_win')
        AND transaction_status = 'completed'
        AND created_at >= ${dayStart}
        AND created_at <= ${dayEnd}
    `);
    const activePlayerCount = Number(((activeResult as any)[0] || [])[0]?.cnt || 0);

    // New players: users created on the day.
    const newResult = await db.execute(sql`
      SELECT COUNT(*) AS cnt
      FROM users
      WHERE created_at >= ${dayStart}
        AND created_at <= ${dayEnd}
    `);
    const newPlayerCount = Number(((newResult as any)[0] || [])[0]?.cnt || 0);

    // House balance close: best-effort current reading. For yesterday's
    // snapshot at ~00:05 UTC this is accurate within a few minutes.
    const houseBalanceCloseNum = await HouseService.getHouseBalance();

    const ggrNum = totalBetsNum - totalWinsNum;
    const ngrNum = ggrNum - bonusesPaidNum;

    return {
      snapshotDate: dateUtc,
      houseBalanceClose: houseBalanceCloseNum.toFixed(2),
      totalBets: totalBetsNum.toFixed(2),
      totalWins: totalWinsNum.toFixed(2),
      ggr: ggrNum.toFixed(2),
      bonusesPaid: bonusesPaidNum.toFixed(2),
      ngr: ngrNum.toFixed(2),
      activePlayerCount,
      newPlayerCount,
    } as NewDailySnapshot;
  }

  /**
   * Compute + upsert via INSERT ... ON DUPLICATE KEY UPDATE.
   * Returns the persisted row.
   */
  async saveSnapshot(dateUtc: string): Promise<DailySnapshot> {
    const snap = await this.computeSnapshot(dateUtc);

    await db.execute(sql`
      INSERT INTO daily_snapshots
        (snapshot_date, house_balance_close, total_bets, total_wins, ggr,
         bonuses_paid, ngr, active_player_count, new_player_count, created_at)
      VALUES
        (${snap.snapshotDate}, ${snap.houseBalanceClose}, ${snap.totalBets}, ${snap.totalWins}, ${snap.ggr},
         ${snap.bonusesPaid}, ${snap.ngr}, ${snap.activePlayerCount}, ${snap.newPlayerCount}, NOW())
      ON DUPLICATE KEY UPDATE
        house_balance_close = VALUES(house_balance_close),
        total_bets = VALUES(total_bets),
        total_wins = VALUES(total_wins),
        ggr = VALUES(ggr),
        bonuses_paid = VALUES(bonuses_paid),
        ngr = VALUES(ngr),
        active_player_count = VALUES(active_player_count),
        new_player_count = VALUES(new_player_count)
    `);

    const rowResult = await db.execute(sql`
      SELECT id, snapshot_date AS snapshotDate, house_balance_close AS houseBalanceClose,
             total_bets AS totalBets, total_wins AS totalWins, ggr,
             bonuses_paid AS bonusesPaid, ngr,
             active_player_count AS activePlayerCount,
             new_player_count AS newPlayerCount,
             created_at AS createdAt
      FROM daily_snapshots
      WHERE snapshot_date = ${dateUtc}
      LIMIT 1
    `);
    const row = ((rowResult as any)[0] || [])[0];
    if (!row) {
      throw new Error('snapshot_save_failed');
    }
    return row as DailySnapshot;
  }

  /**
   * Read snapshots within an inclusive date range, ordered ascending.
   */
  async getRange(fromDateUtc: string, toDateUtc: string): Promise<DailySnapshot[]> {
    this._assertDate(fromDateUtc);
    this._assertDate(toDateUtc);

    const result = await db.execute(sql`
      SELECT id, snapshot_date AS snapshotDate, house_balance_close AS houseBalanceClose,
             total_bets AS totalBets, total_wins AS totalWins, ggr,
             bonuses_paid AS bonusesPaid, ngr,
             active_player_count AS activePlayerCount,
             new_player_count AS newPlayerCount,
             created_at AS createdAt
      FROM daily_snapshots
      WHERE snapshot_date >= ${fromDateUtc}
        AND snapshot_date <= ${toDateUtc}
      ORDER BY snapshot_date ASC
    `);
    const rows = (result as any)[0] || [];
    return rows as DailySnapshot[];
  }

  /**
   * Check whether a snapshot for the given date already exists. Used by
   * the scheduled job to avoid double-writing on server restart.
   */
  async exists(dateUtc: string): Promise<boolean> {
    this._assertDate(dateUtc);
    const result = await db.execute(sql`
      SELECT 1 AS ok FROM daily_snapshots WHERE snapshot_date = ${dateUtc} LIMIT 1
    `);
    const rows = (result as any)[0] || [];
    return rows.length > 0;
  }
}

const snapshotService = new SnapshotService();
export default snapshotService;
export { SnapshotService };
