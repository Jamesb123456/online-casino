import { db } from '../../drizzle/db.js';
import { sql } from 'drizzle-orm';
import { unwrapRows } from './_dbHelpers.js';

// ---------------------------------------------------------------------------
// Result row types
// ---------------------------------------------------------------------------
//
// MySQL/Drizzle returns numerics from DECIMAL/SUM as strings and INT/COUNT
// as numbers; mocks may return either. Keep the union permissive so route
// callers (which coerce with Number(...)) stay happy.
//
// Each interface mirrors the SELECT-clause aliases of the query that
// produces it. Extra defensive properties are not declared — if a query
// later grows a column, update the matching interface.

type Numeric = number | string;

// Every field is optional below — the route layer routinely falls back to
// `rows[0] || {}` and reads named columns with `Number(...)`. Optional
// fields let `{}` be assignable while still naming the shape callers
// expect from each query.

export interface GamesOverviewRow {
  gameType?: string;
  totalSessions?: Numeric;
  totalBetsAmount?: Numeric;
  totalPayoutsAmount?: Numeric;
  uniquePlayers?: Numeric;
  wins?: Numeric;
}

export interface UniquePlayersRow {
  uniquePlayers?: Numeric;
}

export interface GameDetailSummaryRow {
  totalSessions?: Numeric;
  totalBetsAmount?: Numeric;
  totalPayoutsAmount?: Numeric;
  uniquePlayers?: Numeric;
  averageBet?: Numeric;
  maxBet?: Numeric;
  averageMultiplier?: Numeric;
  wins?: Numeric;
  losses?: Numeric;
  pushes?: Numeric;
  avgSessionDuration?: Numeric;
}

export interface GameDetailTimeSeriesRow {
  date?: string;
  sessions?: Numeric;
  betsAmount?: Numeric;
  payoutsAmount?: Numeric;
  uniquePlayers?: Numeric;
}

export interface GameDetailTopPlayerRow {
  userId?: number;
  username?: string;
  sessionsPlayed?: Numeric;
  totalWagered?: Numeric;
  totalWon?: Numeric;
}

export interface PlayerProfileUserRow {
  id?: number;
  username?: string;
  balance?: Numeric;
  isActive?: number | boolean;
  lastLogin?: Date | string | null;
  memberSince?: Date | string;
}

export interface PlayerOverallStatsRow {
  totalSessions?: Numeric;
  totalWagered?: Numeric;
  totalWon?: Numeric;
  avgBetSize?: Numeric;
  maxBet?: Numeric;
  wins?: Numeric;
  losses?: Numeric;
}

export interface PlayerPerGameRow {
  gameType?: string;
  sessions?: Numeric;
  totalWagered?: Numeric;
  totalWon?: Numeric;
  avgBet?: Numeric;
  wins?: Numeric;
}

export interface DepositWithdrawalRow {
  totalDeposits?: Numeric;
  totalWithdrawals?: Numeric;
}

export interface RecentSessionRow {
  id?: number;
  gameType?: string;
  startTime?: Date | string;
  endTime?: Date | string | null;
  totalBet?: Numeric;
  outcome?: Numeric;
  finalMultiplier?: Numeric | null;
  durationSeconds?: Numeric | null;
}

export interface ActivityTimelineRow {
  date?: Date | string;
  sessions?: Numeric;
  wagered?: Numeric;
  netResult?: Numeric;
}

export interface SessionStreakRow {
  total_bet?: Numeric;
  outcome?: Numeric;
}

export interface CountRow {
  cnt?: Numeric;
}

export interface UserLookupRow {
  id?: number;
  username?: string;
}

export interface SessionsCountRow {
  total?: Numeric;
}

export interface TopDepositorRow {
  userId?: number;
  username?: string;
  balance?: Numeric;
  totalDeposits?: Numeric;
  lastActive?: Date | string | null;
}

export interface UserLifetimeGameStatsRow {
  sessionsPlayed?: Numeric;
  totalWagered?: Numeric;
  totalWon?: Numeric;
}

export interface FavoriteGameRow {
  gameType?: string;
  cnt?: Numeric;
}

export interface TopPlayerByGameSessionsRow {
  userId?: number;
  username?: string;
  balance?: Numeric;
  sessionsPlayed?: Numeric;
  totalWagered?: Numeric;
  totalWon?: Numeric;
  netProfitLoss?: Numeric;
  lastActive?: Date | string | null;
}

export interface RevenueSummaryRow {
  totalRevenue?: Numeric;
}

export interface SimpleDepositsRow {
  totalDeposits?: Numeric;
}

export interface SimpleWithdrawalsRow {
  totalWithdrawals?: Numeric;
}

export interface SimpleBonusesRow {
  totalBonuses?: Numeric;
}

export interface ActivePlayerCountRow {
  activePlayerCount?: Numeric;
}

export interface NewPlayerCountRow {
  newPlayerCount?: Numeric;
}

export interface RevenueByGameRow {
  gameType?: string;
  revenue?: Numeric;
}

export interface RevenueTimeSeriesRow {
  date?: string;
  revenue?: Numeric;
  deposits?: Numeric;
  withdrawals?: Numeric;
  activePlayers?: Numeric;
  newPlayers?: Numeric;
  gamesPlayed?: Numeric;
}

/**
 * Analytics Service
 *
 * Centralizes raw SQL access for the admin analytics dashboard. Methods
 * return ROWS (plain objects) exactly as MySQL/Drizzle returns them — the
 * route layer is responsible for numeric formatting (rounding, percent
 * computation) and final JSON shaping. This keeps the wire contract
 * byte-identical with the pre-refactor inline-SQL route while moving
 * data-access concerns into a single module.
 *
 * Grouped by domain:
 *   - Revenue / monetary
 *   - User cohorts / players
 *   - Game performance
 */

// ---------------------------------------------------------------------------
// Helpers (shared with the route)
// ---------------------------------------------------------------------------

function getDateGroupExpr(granularity: string): string {
  switch (granularity) {
    case 'hour': return "DATE_FORMAT(gs.start_time, '%Y-%m-%d %H:00:00')";
    case 'week': return "DATE(DATE_SUB(gs.start_time, INTERVAL WEEKDAY(gs.start_time) DAY))";
    case 'day':
    default:     return "DATE(gs.start_time)";
  }
}

function cutoffToMysqlString(cutoff: Date | null): string | null {
  return cutoff ? cutoff.toISOString().slice(0, 19).replace('T', ' ') : null;
}

// ===========================================================================
// Game performance
// ===========================================================================

/**
 * Per-game aggregates for the games-overview endpoint.
 */
async function getGamesOverview(cutoff: Date | null): Promise<GamesOverviewRow[]> {
  const periodClause = cutoff ? sql`AND gs.start_time >= ${cutoff}` : sql``;
  const result = await db.execute(sql`
    SELECT
      gs.game_type AS gameType,
      COUNT(*) AS totalSessions,
      COALESCE(SUM(gs.total_bet), 0) AS totalBetsAmount,
      COALESCE(SUM(gs.outcome), 0) AS totalPayoutsAmount,
      COUNT(DISTINCT gs.user_id) AS uniquePlayers,
      SUM(CASE WHEN gs.outcome > gs.total_bet THEN 1 ELSE 0 END) AS wins
    FROM game_sessions gs
    WHERE gs.is_completed = 1 ${periodClause}
    GROUP BY gs.game_type
  `);
  return unwrapRows<GamesOverviewRow>(result);
}

/**
 * Unique-player count across all games for the same period.
 */
async function getUniquePlayersAllGames(cutoff: Date | null): Promise<UniquePlayersRow[]> {
  const periodClause = cutoff ? sql`AND gs.start_time >= ${cutoff}` : sql``;
  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT gs.user_id) AS uniquePlayers
    FROM game_sessions gs
    WHERE gs.is_completed = 1 ${periodClause}
  `);
  return unwrapRows<UniquePlayersRow>(result);
}

/**
 * Summary stats for a single game type.
 */
async function getGameDetailSummary(gameType: string, cutoff: Date | null): Promise<GameDetailSummaryRow[]> {
  const periodClause = cutoff ? sql`AND gs.start_time >= ${cutoff}` : sql``;
  const result = await db.execute(sql`
    SELECT
      COUNT(*) AS totalSessions,
      COALESCE(SUM(gs.total_bet), 0) AS totalBetsAmount,
      COALESCE(SUM(gs.outcome), 0) AS totalPayoutsAmount,
      COUNT(DISTINCT gs.user_id) AS uniquePlayers,
      COALESCE(AVG(gs.total_bet), 0) AS averageBet,
      COALESCE(MAX(gs.total_bet), 0) AS maxBet,
      COALESCE(AVG(gs.final_multiplier), 0) AS averageMultiplier,
      SUM(CASE WHEN gs.outcome > gs.total_bet THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN gs.outcome < gs.total_bet THEN 1 ELSE 0 END) AS losses,
      SUM(CASE WHEN gs.outcome = gs.total_bet THEN 1 ELSE 0 END) AS pushes,
      COALESCE(AVG(TIMESTAMPDIFF(SECOND, gs.start_time, gs.end_time)), 0) AS avgSessionDuration
    FROM game_sessions gs
    WHERE gs.is_completed = 1 AND gs.game_type = ${gameType} ${periodClause}
  `);
  return unwrapRows<GameDetailSummaryRow>(result);
}

/**
 * Time-series rows for a single game type.
 * Uses sql.raw because the date-group expression is a static SQL fragment
 * picked from a whitelist and the cutoff is a server-formatted string.
 */
async function getGameDetailTimeSeries(
  gameType: string,
  cutoff: Date | null,
  granularity: string,
): Promise<GameDetailTimeSeriesRow[]> {
  const dateGroupExpr = getDateGroupExpr(granularity);
  const cutoffStr = cutoffToMysqlString(cutoff);
  const result = await db.execute(sql.raw(`
    SELECT
      ${dateGroupExpr} AS date,
      COUNT(*) AS sessions,
      COALESCE(SUM(gs.total_bet), 0) AS betsAmount,
      COALESCE(SUM(gs.outcome), 0) AS payoutsAmount,
      COUNT(DISTINCT gs.user_id) AS uniquePlayers
    FROM game_sessions gs
    WHERE gs.is_completed = 1 AND gs.game_type = '${gameType}'
      ${cutoffStr ? `AND gs.start_time >= '${cutoffStr}'` : ''}
    GROUP BY date
    ORDER BY date ASC
  `));
  return unwrapRows<GameDetailTimeSeriesRow>(result);
}

/**
 * Top wagering players for a single game type.
 */
async function getGameDetailTopPlayers(gameType: string, cutoff: Date | null): Promise<GameDetailTopPlayerRow[]> {
  const periodClause = cutoff ? sql`AND gs.start_time >= ${cutoff}` : sql``;
  const result = await db.execute(sql`
    SELECT
      gs.user_id AS userId,
      u.username,
      COUNT(*) AS sessionsPlayed,
      COALESCE(SUM(gs.total_bet), 0) AS totalWagered,
      COALESCE(SUM(gs.outcome), 0) AS totalWon
    FROM game_sessions gs
    JOIN users u ON u.id = gs.user_id
    WHERE gs.is_completed = 1 AND gs.game_type = ${gameType} ${periodClause}
    GROUP BY gs.user_id, u.username
    ORDER BY totalWagered DESC
    LIMIT 10
  `);
  return unwrapRows<GameDetailTopPlayerRow>(result);
}

// ===========================================================================
// User cohorts / players
// ===========================================================================

/**
 * Run all eight player-profile queries in parallel and return the unwrapped
 * row arrays in the exact order the route consumes them.
 */
async function getPlayerProfileBundle(userId: number): Promise<{
  user: PlayerProfileUserRow[];
  overallStats: PlayerOverallStatsRow[];
  perGame: PlayerPerGameRow[];
  depositWithdrawal: DepositWithdrawalRow[];
  recentSessions: RecentSessionRow[];
  activityTimeline: ActivityTimelineRow[];
  recentSessionsForStreak: SessionStreakRow[];
  depositsCount: CountRow[];
}> {
  const [
    userResult,
    overallStatsResult,
    perGameResult,
    depositWithdrawalResult,
    recentSessionsResult,
    activityTimelineResult,
    recentSessionsForStreakResult,
    depositsCountResult,
  ] = await Promise.all([
    db.execute(sql`
      SELECT id, username, balance, is_active AS isActive, last_login AS lastLogin, created_at AS memberSince
      FROM users WHERE id = ${userId}
    `),
    db.execute(sql`
      SELECT
        COUNT(*) AS totalSessions,
        COALESCE(SUM(gs.total_bet), 0) AS totalWagered,
        COALESCE(SUM(gs.outcome), 0) AS totalWon,
        COALESCE(AVG(gs.total_bet), 0) AS avgBetSize,
        COALESCE(MAX(gs.total_bet), 0) AS maxBet,
        SUM(CASE WHEN gs.outcome > gs.total_bet THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN gs.outcome < gs.total_bet THEN 1 ELSE 0 END) AS losses
      FROM game_sessions gs
      WHERE gs.user_id = ${userId} AND gs.is_completed = 1
    `),
    db.execute(sql`
      SELECT
        gs.game_type AS gameType,
        COUNT(*) AS sessions,
        COALESCE(SUM(gs.total_bet), 0) AS totalWagered,
        COALESCE(SUM(gs.outcome), 0) AS totalWon,
        COALESCE(AVG(gs.total_bet), 0) AS avgBet,
        SUM(CASE WHEN gs.outcome > gs.total_bet THEN 1 ELSE 0 END) AS wins
      FROM game_sessions gs
      WHERE gs.user_id = ${userId} AND gs.is_completed = 1
      GROUP BY gs.game_type
    `),
    db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN t.transaction_type = 'deposit' THEN t.amount ELSE 0 END), 0) AS totalDeposits,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'withdrawal' THEN t.amount ELSE 0 END), 0) AS totalWithdrawals
      FROM transactions t
      WHERE t.user_id = ${userId} AND t.transaction_status = 'completed'
    `),
    db.execute(sql`
      SELECT
        gs.id,
        gs.game_type AS gameType,
        gs.start_time AS startTime,
        gs.end_time AS endTime,
        gs.total_bet AS totalBet,
        gs.outcome,
        gs.final_multiplier AS finalMultiplier,
        TIMESTAMPDIFF(SECOND, gs.start_time, gs.end_time) AS durationSeconds
      FROM game_sessions gs
      WHERE gs.user_id = ${userId} AND gs.is_completed = 1
      ORDER BY gs.start_time DESC
      LIMIT 10
    `),
    db.execute(sql`
      SELECT
        DATE(gs.start_time) AS date,
        COUNT(*) AS sessions,
        COALESCE(SUM(gs.total_bet), 0) AS wagered,
        COALESCE(SUM(gs.outcome) - SUM(gs.total_bet), 0) AS netResult
      FROM game_sessions gs
      WHERE gs.user_id = ${userId} AND gs.is_completed = 1
        AND gs.start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(gs.start_time)
      ORDER BY date ASC
    `),
    db.execute(sql`
      SELECT gs.total_bet, gs.outcome
      FROM game_sessions gs
      WHERE gs.user_id = ${userId} AND gs.is_completed = 1
      ORDER BY gs.start_time DESC
      LIMIT 100
    `),
    db.execute(sql`
      SELECT COUNT(*) AS cnt
      FROM transactions t
      WHERE t.user_id = ${userId} AND t.transaction_type = 'deposit' AND t.transaction_status = 'completed'
        AND t.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `),
  ]);

  return {
    user: unwrapRows<PlayerProfileUserRow>(userResult),
    overallStats: unwrapRows<PlayerOverallStatsRow>(overallStatsResult),
    perGame: unwrapRows<PlayerPerGameRow>(perGameResult),
    depositWithdrawal: unwrapRows<DepositWithdrawalRow>(depositWithdrawalResult),
    recentSessions: unwrapRows<RecentSessionRow>(recentSessionsResult),
    activityTimeline: unwrapRows<ActivityTimelineRow>(activityTimelineResult),
    recentSessionsForStreak: unwrapRows<SessionStreakRow>(recentSessionsForStreakResult),
    depositsCount: unwrapRows<CountRow>(depositsCountResult),
  };
}

/**
 * Lightweight user lookup for the sessions endpoint.
 */
async function getUserById(userId: number): Promise<UserLookupRow[]> {
  const result = await db.execute(sql`SELECT id, username FROM users WHERE id = ${userId}`);
  return unwrapRows<UserLookupRow>(result);
}

/**
 * Count of completed sessions for a player (optionally filtered by gameType).
 * Uses sql.raw because gameType is a whitelisted string injected directly.
 */
async function getPlayerSessionsCount(
  userId: number,
  gameTypeClause: string,
): Promise<SessionsCountRow[]> {
  const result = await db.execute(sql.raw(`
    SELECT COUNT(*) AS total
    FROM game_sessions gs
    WHERE gs.user_id = ${userId} AND gs.is_completed = 1 ${gameTypeClause}
  `));
  return unwrapRows<SessionsCountRow>(result);
}

/**
 * Paginated sessions list. sortColumn/sortDir/limit/offset are validated by
 * the caller from a whitelist (sortColumnMap + Zod schema).
 */
async function getPlayerSessionsPage(
  userId: number,
  gameTypeClause: string,
  sortColumn: string,
  sortDir: string,
  limit: number,
  offset: number,
): Promise<RecentSessionRow[]> {
  const result = await db.execute(sql.raw(`
    SELECT
      gs.id,
      gs.game_type AS gameType,
      gs.start_time AS startTime,
      gs.end_time AS endTime,
      gs.total_bet AS totalBet,
      gs.outcome,
      gs.final_multiplier AS finalMultiplier,
      TIMESTAMPDIFF(SECOND, gs.start_time, gs.end_time) AS durationSeconds
    FROM game_sessions gs
    WHERE gs.user_id = ${userId} AND gs.is_completed = 1 ${gameTypeClause}
    ORDER BY ${sortColumn} ${sortDir}
    LIMIT ${limit} OFFSET ${offset}
  `));
  return unwrapRows<RecentSessionRow>(result);
}

/**
 * Top depositors over the period (transactions branch of /top-players).
 */
async function getTopDepositors(cutoff: Date | null, limit: number): Promise<TopDepositorRow[]> {
  const cutoffStr = cutoffToMysqlString(cutoff);
  const depositCutoff = cutoffStr ? `AND t.created_at >= '${cutoffStr}'` : '';
  const result = await db.execute(sql.raw(`
    SELECT
      u.id AS userId,
      u.username,
      u.balance,
      COALESCE(SUM(t.amount), 0) AS totalDeposits,
      u.last_login AS lastActive
    FROM users u
    JOIN transactions t ON t.user_id = u.id AND t.transaction_type = 'deposit' AND t.transaction_status = 'completed' ${depositCutoff}
    GROUP BY u.id, u.username, u.balance, u.last_login
    ORDER BY totalDeposits DESC
    LIMIT ${limit}
  `));
  return unwrapRows<TopDepositorRow>(result);
}

/**
 * Lifetime game stats for a single user (used by deposits branch).
 */
async function getUserLifetimeGameStats(userId: number): Promise<UserLifetimeGameStatsRow[]> {
  const result = await db.execute(sql`
    SELECT
      COUNT(*) AS sessionsPlayed,
      COALESCE(SUM(gs.total_bet), 0) AS totalWagered,
      COALESCE(SUM(gs.outcome), 0) AS totalWon
    FROM game_sessions gs
    WHERE gs.user_id = ${userId} AND gs.is_completed = 1
  `);
  return unwrapRows<UserLifetimeGameStatsRow>(result);
}

/**
 * Lifetime favorite game (no period filter) for a single user.
 */
async function getUserFavoriteGameLifetime(userId: number): Promise<FavoriteGameRow[]> {
  const result = await db.execute(sql`
    SELECT gs.game_type AS gameType, COUNT(*) AS cnt
    FROM game_sessions gs
    WHERE gs.user_id = ${userId} AND gs.is_completed = 1
    GROUP BY gs.game_type ORDER BY cnt DESC LIMIT 1
  `);
  return unwrapRows<FavoriteGameRow>(result);
}

/**
 * Period-scoped favorite game for a single user (wagered/profit/sessions branch).
 * Uses sql.raw because the periodClause is composed as a string upstream.
 */
async function getUserFavoriteGamePeriod(userId: number, periodClause: string): Promise<FavoriteGameRow[]> {
  const result = await db.execute(sql.raw(`
    SELECT gs.game_type AS gameType, COUNT(*) AS cnt
    FROM game_sessions gs
    WHERE gs.user_id = ${userId} AND gs.is_completed = 1 ${periodClause}
    GROUP BY gs.game_type ORDER BY cnt DESC LIMIT 1
  `));
  return unwrapRows<FavoriteGameRow>(result);
}

/**
 * Top players ordered by a whitelisted column (totalWagered / netProfitLoss /
 * sessionsPlayed). Uses sql.raw because orderColumn and periodClause are
 * strings selected from whitelists upstream.
 */
async function getTopPlayersByGameSessions(
  periodClause: string,
  orderColumn: string,
  limit: number,
): Promise<TopPlayerByGameSessionsRow[]> {
  const result = await db.execute(sql.raw(`
    SELECT
      gs.user_id AS userId,
      u.username,
      u.balance,
      COUNT(*) AS sessionsPlayed,
      COALESCE(SUM(gs.total_bet), 0) AS totalWagered,
      COALESCE(SUM(gs.outcome), 0) AS totalWon,
      COALESCE(SUM(gs.outcome) - SUM(gs.total_bet), 0) AS netProfitLoss,
      MAX(gs.start_time) AS lastActive
    FROM game_sessions gs
    JOIN users u ON u.id = gs.user_id
    WHERE gs.is_completed = 1 ${periodClause}
    GROUP BY gs.user_id, u.username, u.balance
    ORDER BY ${orderColumn} DESC
    LIMIT ${limit}
  `));
  return unwrapRows<TopPlayerByGameSessionsRow>(result);
}

// ===========================================================================
// Revenue / monetary
// ===========================================================================

/**
 * Parallel-fan-out for the revenue summary block.
 */
async function getRevenueSummaryBundle(cutoff: Date | null): Promise<{
  revenue: RevenueSummaryRow[];
  deposits: SimpleDepositsRow[];
  withdrawals: SimpleWithdrawalsRow[];
  bonuses: SimpleBonusesRow[];
  activePlayers: ActivePlayerCountRow[];
  newPlayers: NewPlayerCountRow[];
  revenueByGame: RevenueByGameRow[];
}> {
  const periodClauseGS = cutoff ? sql`AND gs.start_time >= ${cutoff}` : sql``;
  const periodClauseTx = cutoff ? sql`AND t.created_at >= ${cutoff}` : sql``;
  const periodClauseUsers = cutoff ? sql`AND created_at >= ${cutoff}` : sql``;

  const [
    revenueResult,
    depositsResult,
    withdrawalsResult,
    bonusesResult,
    activePlayersResult,
    newPlayersResult,
    revenueByGameResult,
  ] = await Promise.all([
    db.execute(sql`
      SELECT COALESCE(SUM(gs.total_bet) - SUM(gs.outcome), 0) AS totalRevenue
      FROM game_sessions gs
      WHERE gs.is_completed = 1 ${periodClauseGS}
    `),
    db.execute(sql`
      SELECT COALESCE(SUM(t.amount), 0) AS totalDeposits
      FROM transactions t
      WHERE t.transaction_type = 'deposit' AND t.transaction_status = 'completed' ${periodClauseTx}
    `),
    db.execute(sql`
      SELECT COALESCE(SUM(t.amount), 0) AS totalWithdrawals
      FROM transactions t
      WHERE t.transaction_type = 'withdrawal' AND t.transaction_status = 'completed' ${periodClauseTx}
    `),
    db.execute(sql`
      SELECT COALESCE(SUM(t.amount), 0) AS totalBonuses
      FROM transactions t
      WHERE t.transaction_type IN ('bonus', 'login_reward') AND t.transaction_status = 'completed' ${periodClauseTx}
    `),
    db.execute(sql`
      SELECT COUNT(DISTINCT gs.user_id) AS activePlayerCount
      FROM game_sessions gs
      WHERE gs.is_completed = 1 ${periodClauseGS}
    `),
    db.execute(sql`
      SELECT COUNT(*) AS newPlayerCount FROM users WHERE 1=1 ${periodClauseUsers}
    `),
    db.execute(sql`
      SELECT
        gs.game_type AS gameType,
        COALESCE(SUM(gs.total_bet) - SUM(gs.outcome), 0) AS revenue
      FROM game_sessions gs
      WHERE gs.is_completed = 1 ${periodClauseGS}
      GROUP BY gs.game_type
    `),
  ]);

  return {
    revenue: unwrapRows<RevenueSummaryRow>(revenueResult),
    deposits: unwrapRows<SimpleDepositsRow>(depositsResult),
    withdrawals: unwrapRows<SimpleWithdrawalsRow>(withdrawalsResult),
    bonuses: unwrapRows<SimpleBonusesRow>(bonusesResult),
    activePlayers: unwrapRows<ActivePlayerCountRow>(activePlayersResult),
    newPlayers: unwrapRows<NewPlayerCountRow>(newPlayersResult),
    revenueByGame: unwrapRows<RevenueByGameRow>(revenueByGameResult),
  };
}

/**
 * Joined revenue/deposits/withdrawals/new-players time series.
 */
async function getRevenueTimeSeriesJoined(
  cutoff: Date | null,
  granularity: string,
): Promise<RevenueTimeSeriesRow[]> {
  const dateGroupExpr = getDateGroupExpr(granularity);
  const cutoffStr = cutoffToMysqlString(cutoff);
  const result = await db.execute(sql.raw(`
    SELECT
      sub.date,
      sub.revenue,
      COALESCE(dep.deposits, 0) AS deposits,
      COALESCE(wd.withdrawals, 0) AS withdrawals,
      COALESCE(sub.activePlayers, 0) AS activePlayers,
      COALESCE(np.newPlayers, 0) AS newPlayers,
      sub.gamesPlayed
    FROM (
      SELECT
        ${dateGroupExpr} AS date,
        COALESCE(SUM(gs.total_bet) - SUM(gs.outcome), 0) AS revenue,
        COUNT(DISTINCT gs.user_id) AS activePlayers,
        COUNT(*) AS gamesPlayed
      FROM game_sessions gs
      WHERE gs.is_completed = 1
        ${cutoffStr ? `AND gs.start_time >= '${cutoffStr}'` : ''}
      GROUP BY date
    ) sub
    LEFT JOIN (
      SELECT
        ${dateGroupExpr.replace(/gs\.start_time/g, 't.created_at')} AS date,
        COALESCE(SUM(t.amount), 0) AS deposits
      FROM transactions t
      WHERE t.transaction_type = 'deposit' AND t.transaction_status = 'completed'
        ${cutoffStr ? `AND t.created_at >= '${cutoffStr}'` : ''}
      GROUP BY date
    ) dep ON dep.date = sub.date
    LEFT JOIN (
      SELECT
        ${dateGroupExpr.replace(/gs\.start_time/g, 't.created_at')} AS date,
        COALESCE(SUM(t.amount), 0) AS withdrawals
      FROM transactions t
      WHERE t.transaction_type = 'withdrawal' AND t.transaction_status = 'completed'
        ${cutoffStr ? `AND t.created_at >= '${cutoffStr}'` : ''}
      GROUP BY date
    ) wd ON wd.date = sub.date
    LEFT JOIN (
      SELECT
        DATE(created_at) AS date,
        COUNT(*) AS newPlayers
      FROM users
      WHERE 1=1
        ${cutoffStr ? `AND created_at >= '${cutoffStr}'` : ''}
      GROUP BY DATE(created_at)
    ) np ON np.date = sub.date
    ORDER BY sub.date ASC
  `));
  return unwrapRows<RevenueTimeSeriesRow>(result);
}

/**
 * Fallback time series from game_sessions only, used when the joined query
 * returns no rows (edge cases / empty datasets).
 */
async function getRevenueTimeSeriesFallback(
  cutoff: Date | null,
  granularity: string,
): Promise<RevenueTimeSeriesRow[]> {
  const dateGroupExpr = getDateGroupExpr(granularity);
  const cutoffStr = cutoffToMysqlString(cutoff);
  const result = await db.execute(sql.raw(`
    SELECT
      ${dateGroupExpr} AS date,
      COALESCE(SUM(gs.total_bet) - SUM(gs.outcome), 0) AS revenue,
      COUNT(DISTINCT gs.user_id) AS activePlayers,
      COUNT(*) AS gamesPlayed
    FROM game_sessions gs
    WHERE gs.is_completed = 1
      ${cutoffStr ? `AND gs.start_time >= '${cutoffStr}'` : ''}
    GROUP BY date
    ORDER BY date ASC
  `));
  return unwrapRows<RevenueTimeSeriesRow>(result);
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

const analyticsService = {
  // game performance
  getGamesOverview,
  getUniquePlayersAllGames,
  getGameDetailSummary,
  getGameDetailTimeSeries,
  getGameDetailTopPlayers,
  // user cohorts / players
  getPlayerProfileBundle,
  getUserById,
  getPlayerSessionsCount,
  getPlayerSessionsPage,
  getTopDepositors,
  getUserLifetimeGameStats,
  getUserFavoriteGameLifetime,
  getUserFavoriteGamePeriod,
  getTopPlayersByGameSessions,
  // revenue / monetary
  getRevenueSummaryBundle,
  getRevenueTimeSeriesJoined,
  getRevenueTimeSeriesFallback,
};

export default analyticsService;
