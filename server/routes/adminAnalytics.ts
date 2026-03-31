import express, { Request, Response } from 'express';
import { authenticate as auth, adminOnly } from '../middleware/auth.js';
import { db } from '../drizzle/db.js';
import { sql } from 'drizzle-orm';
import LoggingService from '../src/services/loggingService.js';
import {
  analyticsPeriodSchema,
  analyticsGameDetailSchema,
  analyticsPlayerSessionsSchema,
  analyticsTopPlayersSchema,
  analyticsRevenueSchema,
} from '../src/validation/schemas.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_GAME_TYPES = ['crash', 'plinko', 'wheel', 'roulette', 'blackjack', 'landmines'];

function getPeriodCutoff(period: string): Date | null {
  if (period === 'all') return null;
  const now = new Date();
  switch (period) {
    case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

function getDateFormat(granularity: string): string {
  switch (granularity) {
    case 'hour': return '%Y-%m-%d %H:00:00';
    case 'week': return '%Y-%m-%d'; // handled via DATE_SUB for week start
    case 'day':
    default:     return '%Y-%m-%d';
  }
}

function getDateGroupExpr(granularity: string): string {
  switch (granularity) {
    case 'hour': return "DATE_FORMAT(gs.start_time, '%Y-%m-%d %H:00:00')";
    case 'week':  return "DATE(DATE_SUB(gs.start_time, INTERVAL WEEKDAY(gs.start_time) DAY))";
    case 'day':
    default:      return "DATE(gs.start_time)";
  }
}

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// 1. GET /games — All games overview
// ---------------------------------------------------------------------------

router.get('/games', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const parseResult = analyticsPeriodSchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ message: 'Invalid query parameters' });
    }
    const { period } = parseResult.data;
    const cutoff = getPeriodCutoff(period);

    const periodClause = cutoff
      ? sql`AND gs.start_time >= ${cutoff}`
      : sql``;

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

    const rows = (result as any)[0] || [];

    const games = rows.map((row: any) => {
      const totalSessions = Number(row.totalSessions);
      const totalBetsAmount = round2(Number(row.totalBetsAmount));
      const totalPayoutsAmount = round2(Number(row.totalPayoutsAmount));
      const houseProfit = round2(totalBetsAmount - totalPayoutsAmount);
      const houseEdge = round2(safeDivide(houseProfit, totalBetsAmount) * 100);
      const winRate = round2(safeDivide(Number(row.wins), totalSessions) * 100);
      return {
        gameType: row.gameType,
        totalSessions,
        totalBetsAmount,
        totalPayoutsAmount,
        houseProfit,
        houseEdge,
        winRate,
        uniquePlayers: Number(row.uniquePlayers),
      };
    });

    const totals = {
      totalSessions: games.reduce((s: number, g: any) => s + g.totalSessions, 0),
      totalBetsAmount: round2(games.reduce((s: number, g: any) => s + g.totalBetsAmount, 0)),
      totalPayoutsAmount: round2(games.reduce((s: number, g: any) => s + g.totalPayoutsAmount, 0)),
      houseProfit: round2(games.reduce((s: number, g: any) => s + g.houseProfit, 0)),
      overallHouseEdge: 0 as number,
      uniquePlayers: 0 as number,
    };
    totals.overallHouseEdge = round2(safeDivide(totals.houseProfit, totals.totalBetsAmount) * 100);

    // Unique players across all games (a player may play multiple games)
    const uniqueResult = await db.execute(sql`
      SELECT COUNT(DISTINCT gs.user_id) AS uniquePlayers
      FROM game_sessions gs
      WHERE gs.is_completed = 1 ${periodClause}
    `);
    const uniqueRows = (uniqueResult as any)[0] || [];
    totals.uniquePlayers = Number(uniqueRows[0]?.uniquePlayers || 0);

    res.json({ period, games, totals });
  } catch (error) {
    LoggingService.logSystemEvent('analytics_games_overview_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error fetching game analytics' });
  }
});

// ---------------------------------------------------------------------------
// 2. GET /games/:gameType — Single game deep dive
// ---------------------------------------------------------------------------

router.get('/games/:gameType', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const gameType = req.params.gameType as string;
    if (!VALID_GAME_TYPES.includes(gameType)) {
      return res.status(400).json({ message: 'Invalid game type' });
    }

    const parseResult = analyticsGameDetailSchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ message: 'Invalid query parameters' });
    }
    const { period, granularity } = parseResult.data;
    const cutoff = getPeriodCutoff(period);

    const periodClause = cutoff
      ? sql`AND gs.start_time >= ${cutoff}`
      : sql``;

    // Summary
    const summaryResult = await db.execute(sql`
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

    const summaryRow = ((summaryResult as any)[0] || [])[0] || {};
    const totalSessions = Number(summaryRow.totalSessions);
    const totalBetsAmount = round2(Number(summaryRow.totalBetsAmount));
    const totalPayoutsAmount = round2(Number(summaryRow.totalPayoutsAmount));
    const houseProfit = round2(totalBetsAmount - totalPayoutsAmount);

    const summary = {
      totalSessions,
      totalBetsAmount,
      totalPayoutsAmount,
      houseProfit,
      houseEdge: round2(safeDivide(houseProfit, totalBetsAmount) * 100),
      winRate: round2(safeDivide(Number(summaryRow.wins), totalSessions) * 100),
      lossRate: round2(safeDivide(Number(summaryRow.losses), totalSessions) * 100),
      pushRate: round2(safeDivide(Number(summaryRow.pushes), totalSessions) * 100),
      averageBet: round2(Number(summaryRow.averageBet)),
      maxBet: round2(Number(summaryRow.maxBet)),
      averageMultiplier: round2(Number(summaryRow.averageMultiplier)),
      uniquePlayers: Number(summaryRow.uniquePlayers),
      avgSessionDuration: Math.round(Number(summaryRow.avgSessionDuration)),
    };

    // Time series
    const dateGroupExpr = getDateGroupExpr(granularity);
    const timeSeriesResult = await db.execute(sql.raw(`
      SELECT
        ${dateGroupExpr} AS date,
        COUNT(*) AS sessions,
        COALESCE(SUM(gs.total_bet), 0) AS betsAmount,
        COALESCE(SUM(gs.outcome), 0) AS payoutsAmount,
        COUNT(DISTINCT gs.user_id) AS uniquePlayers
      FROM game_sessions gs
      WHERE gs.is_completed = 1 AND gs.game_type = '${gameType}'
        ${cutoff ? `AND gs.start_time >= '${cutoff.toISOString().slice(0, 19).replace('T', ' ')}'` : ''}
      GROUP BY date
      ORDER BY date ASC
    `));

    const timeSeriesRows = (timeSeriesResult as any)[0] || [];
    const timeSeries = timeSeriesRows.map((row: any) => ({
      date: String(row.date),
      sessions: Number(row.sessions),
      betsAmount: round2(Number(row.betsAmount)),
      payoutsAmount: round2(Number(row.payoutsAmount)),
      profit: round2(Number(row.betsAmount) - Number(row.payoutsAmount)),
      uniquePlayers: Number(row.uniquePlayers),
    }));

    // Top players for this game
    const topPlayersResult = await db.execute(sql`
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

    const topPlayersRows = (topPlayersResult as any)[0] || [];
    const topPlayers = topPlayersRows.map((row: any) => {
      const totalWagered = round2(Number(row.totalWagered));
      const totalWon = round2(Number(row.totalWon));
      return {
        userId: Number(row.userId),
        username: row.username,
        sessionsPlayed: Number(row.sessionsPlayed),
        totalWagered,
        totalWon,
        netProfit: round2(totalWon - totalWagered),
      };
    });

    res.json({ gameType, period, summary, timeSeries, topPlayers });
  } catch (error) {
    LoggingService.logSystemEvent('analytics_game_detail_error', { error: (error as Error)?.message, gameType: req.params.gameType }, 'error');
    res.status(500).json({ message: 'Error fetching game detail analytics' });
  }
});

// ---------------------------------------------------------------------------
// 3. GET /players/:userId/profile — Full player analytics profile
// ---------------------------------------------------------------------------

router.get('/players/:userId/profile', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId as string);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Run all queries in parallel
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
      // 1. User info
      db.execute(sql`
        SELECT id, username, balance, is_active AS isActive, last_login AS lastLogin, created_at AS memberSince
        FROM users WHERE id = ${userId}
      `),
      // 2. Overall stats from game_sessions
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
      // 3. Per-game breakdown
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
      // 4. Deposit/withdrawal totals
      db.execute(sql`
        SELECT
          COALESCE(SUM(CASE WHEN t.type = 'deposit' THEN t.amount ELSE 0 END), 0) AS totalDeposits,
          COALESCE(SUM(CASE WHEN t.type = 'withdrawal' THEN t.amount ELSE 0 END), 0) AS totalWithdrawals
        FROM transactions t
        WHERE t.user_id = ${userId} AND t.status = 'completed'
      `),
      // 5. Recent 10 sessions
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
      // 6. Activity timeline (last 30 days)
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
      // 7. Recent completed sessions for loss streak calculation (ordered by start_time DESC)
      db.execute(sql`
        SELECT gs.total_bet, gs.outcome
        FROM game_sessions gs
        WHERE gs.user_id = ${userId} AND gs.is_completed = 1
        ORDER BY gs.start_time DESC
        LIMIT 100
      `),
      // 8. Deposit count in last 7 days (for rapid deposits flag)
      db.execute(sql`
        SELECT COUNT(*) AS cnt
        FROM transactions t
        WHERE t.user_id = ${userId} AND t.type = 'deposit' AND t.status = 'completed'
          AND t.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      `),
    ]);

    // Parse user
    const userRows = (userResult as any)[0] || [];
    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = userRows[0];

    // Parse overall stats
    const statsRow = ((overallStatsResult as any)[0] || [])[0] || {};
    const totalSessions = Number(statsRow.totalSessions);
    const totalWagered = round2(Number(statsRow.totalWagered));
    const totalWon = round2(Number(statsRow.totalWon));
    const wins = Number(statsRow.wins);
    const losses = Number(statsRow.losses);

    // Parse deposit/withdrawal
    const dWRow = ((depositWithdrawalResult as any)[0] || [])[0] || {};
    const totalDeposits = round2(Number(dWRow.totalDeposits));
    const totalWithdrawals = round2(Number(dWRow.totalWithdrawals));

    const overallStats = {
      totalSessions,
      totalWagered,
      totalWon,
      netProfitLoss: round2(totalWon - totalWagered),
      winRate: round2(safeDivide(wins, totalSessions) * 100),
      lossRate: round2(safeDivide(losses, totalSessions) * 100),
      avgBetSize: round2(Number(statsRow.avgBetSize)),
      maxBet: round2(Number(statsRow.maxBet)),
      totalDeposits,
      totalWithdrawals,
    };

    // Per-game breakdown
    const perGameRows = (perGameResult as any)[0] || [];
    const perGameBreakdown = perGameRows.map((row: any) => {
      const sessions = Number(row.sessions);
      const wagered = round2(Number(row.totalWagered));
      const won = round2(Number(row.totalWon));
      return {
        gameType: row.gameType,
        sessionsPlayed: sessions,
        totalWagered: wagered,
        totalWon: won,
        netProfit: round2(won - wagered),
        winRate: round2(safeDivide(Number(row.wins), sessions) * 100),
        avgBet: round2(Number(row.avgBet)),
        percentOfTotal: round2(safeDivide(sessions, totalSessions) * 100),
      };
    });

    // Favorite game
    let favoriteGame = null;
    if (perGameBreakdown.length > 0) {
      const sorted = [...perGameBreakdown].sort((a: any, b: any) => b.sessionsPlayed - a.sessionsPlayed);
      favoriteGame = {
        gameType: sorted[0].gameType,
        sessionsPlayed: sorted[0].sessionsPlayed,
        percentOfTotal: sorted[0].percentOfTotal,
      };
    }

    // Recent activity
    const recentRows = (recentSessionsResult as any)[0] || [];
    const recentActivity = recentRows.map((row: any) => ({
      id: Number(row.id),
      gameType: row.gameType,
      startTime: row.startTime,
      endTime: row.endTime,
      totalBet: round2(Number(row.totalBet)),
      outcome: round2(Number(row.outcome)),
      netResult: round2(Number(row.outcome) - Number(row.totalBet)),
      finalMultiplier: row.finalMultiplier ? round2(Number(row.finalMultiplier)) : null,
      durationSeconds: Number(row.durationSeconds) || 0,
    }));

    // Activity timeline
    const timelineRows = (activityTimelineResult as any)[0] || [];
    const activityTimeline = timelineRows.map((row: any) => ({
      date: String(row.date),
      sessions: Number(row.sessions),
      wagered: round2(Number(row.wagered)),
      netResult: round2(Number(row.netResult)),
    }));

    // Risk indicators
    const streakRows = (recentSessionsForStreakResult as any)[0] || [];
    let lossStreakMax = 0;
    let currentStreak = 0;
    for (const row of streakRows) {
      if (Number(row.outcome) < Number(row.total_bet)) {
        currentStreak++;
        if (currentStreak > lossStreakMax) lossStreakMax = currentStreak;
      } else {
        currentStreak = 0;
      }
    }

    // Average daily wager (from the last 30 days of timeline data)
    const totalDailyWagered = activityTimeline.reduce((s: number, d: any) => s + d.wagered, 0);
    const activeDays = activityTimeline.length || 1;
    const avgDailyWager = round2(totalDailyWagered / activeDays);

    // Longest session from recent activity
    const longestSession = recentActivity.reduce((max: number, s: any) => Math.max(max, s.durationSeconds), 0);

    // Deposit count last 7 days
    const depositsLast7 = Number(((depositsCountResult as any)[0] || [])[0]?.cnt || 0);

    // Determine risk level
    let riskLevel = 'low';
    if (lossStreakMax > 15 || avgDailyWager > 5000) {
      riskLevel = 'critical';
    } else if (lossStreakMax > 10 || avgDailyWager > 2000) {
      riskLevel = 'high';
    } else if (lossStreakMax > 5 || avgDailyWager > 500) {
      riskLevel = 'medium';
    }

    // Risk flags
    const flags: string[] = [];
    if (lossStreakMax > 5) flags.push(`Extended loss streak (${lossStreakMax} games)`);
    if (avgDailyWager > 500) flags.push('High daily wager volume');
    if (depositsLast7 > 5) flags.push('Rapid deposits');
    if (longestSession > 7200) flags.push('Long sessions');

    res.json({
      userId: Number(user.id),
      username: user.username,
      balance: round2(Number(user.balance)),
      isActive: Boolean(user.isActive),
      memberSince: user.memberSince,
      lastLogin: user.lastLogin,
      overallStats,
      favoriteGame,
      perGameBreakdown,
      recentActivity,
      riskIndicators: {
        riskLevel,
        flags,
        avgDailyWager,
        lossStreakMax,
        longestSession,
      },
      activityTimeline,
    });
  } catch (error) {
    LoggingService.logSystemEvent('analytics_player_profile_error', { error: (error as Error)?.message, userId: req.params.userId }, 'error');
    res.status(500).json({ message: 'Error fetching player profile analytics' });
  }
});

// ---------------------------------------------------------------------------
// 4. GET /players/:userId/sessions — Paginated game history
// ---------------------------------------------------------------------------

router.get('/players/:userId/sessions', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId as string);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const parseResult = analyticsPlayerSessionsSchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ message: 'Invalid query parameters' });
    }
    const { gameType, page, limit, sortBy, sortOrder } = parseResult.data;

    // Verify user exists
    const userResult = await db.execute(sql`SELECT id, username FROM users WHERE id = ${userId}`);
    const userRows = (userResult as any)[0] || [];
    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = userRows[0];

    // Map sortBy to column name
    const sortColumnMap: Record<string, string> = {
      startTime: 'gs.start_time',
      totalBet: 'gs.total_bet',
      outcome: 'gs.outcome',
    };
    const sortColumn = sortColumnMap[sortBy] || 'gs.start_time';
    const sortDir = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const offset = (page - 1) * limit;

    const gameTypeClause = gameType ? `AND gs.game_type = '${gameType}'` : '';

    // Count total
    const countResult = await db.execute(sql.raw(`
      SELECT COUNT(*) AS total
      FROM game_sessions gs
      WHERE gs.user_id = ${userId} AND gs.is_completed = 1 ${gameTypeClause}
    `));
    const total = Number(((countResult as any)[0] || [])[0]?.total || 0);

    // Fetch sessions
    const sessionsResult = await db.execute(sql.raw(`
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

    const sessionRows = (sessionsResult as any)[0] || [];
    const sessions = sessionRows.map((row: any) => ({
      id: Number(row.id),
      gameType: row.gameType,
      startTime: row.startTime,
      endTime: row.endTime,
      totalBet: round2(Number(row.totalBet)),
      outcome: round2(Number(row.outcome)),
      netResult: round2(Number(row.outcome) - Number(row.totalBet)),
      finalMultiplier: row.finalMultiplier ? round2(Number(row.finalMultiplier)) : null,
      durationSeconds: Number(row.durationSeconds) || 0,
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({
      userId: Number(user.id),
      username: user.username,
      sessions,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    LoggingService.logSystemEvent('analytics_player_sessions_error', { error: (error as Error)?.message, userId: req.params.userId }, 'error');
    res.status(500).json({ message: 'Error fetching player sessions' });
  }
});

// ---------------------------------------------------------------------------
// 5. GET /top-players — Top players by metric
// ---------------------------------------------------------------------------

router.get('/top-players', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const parseResult = analyticsTopPlayersSchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ message: 'Invalid query parameters' });
    }
    const { metric, period, limit } = parseResult.data;
    const cutoff = getPeriodCutoff(period);

    const periodClause = cutoff
      ? `AND gs.start_time >= '${cutoff.toISOString().slice(0, 19).replace('T', ' ')}'`
      : '';

    let orderColumn: string;
    switch (metric) {
      case 'profit':   orderColumn = 'netProfitLoss'; break;
      case 'sessions': orderColumn = 'sessionsPlayed'; break;
      case 'wagered':
      default:         orderColumn = 'totalWagered'; break;
    }

    // For 'deposits' metric, use the transactions table instead
    if (metric === 'deposits') {
      const depositCutoff = cutoff
        ? `AND t.created_at >= '${cutoff.toISOString().slice(0, 19).replace('T', ' ')}'`
        : '';

      const depositsResult = await db.execute(sql.raw(`
        SELECT
          u.id AS userId,
          u.username,
          u.balance,
          COALESCE(SUM(t.amount), 0) AS totalDeposits,
          u.last_login AS lastActive
        FROM users u
        JOIN transactions t ON t.user_id = u.id AND t.type = 'deposit' AND t.status = 'completed' ${depositCutoff}
        GROUP BY u.id, u.username, u.balance, u.last_login
        ORDER BY totalDeposits DESC
        LIMIT ${limit}
      `));

      const depositRows = (depositsResult as any)[0] || [];

      // For each user with deposits, get their game stats too
      const players = await Promise.all(depositRows.map(async (row: any) => {
        const gsResult = await db.execute(sql`
          SELECT
            COUNT(*) AS sessionsPlayed,
            COALESCE(SUM(gs.total_bet), 0) AS totalWagered,
            COALESCE(SUM(gs.outcome), 0) AS totalWon
          FROM game_sessions gs
          WHERE gs.user_id = ${Number(row.userId)} AND gs.is_completed = 1
        `);
        const gsRow = ((gsResult as any)[0] || [])[0] || {};

        // Get favorite game
        const favResult = await db.execute(sql`
          SELECT gs.game_type AS gameType, COUNT(*) AS cnt
          FROM game_sessions gs
          WHERE gs.user_id = ${Number(row.userId)} AND gs.is_completed = 1
          GROUP BY gs.game_type ORDER BY cnt DESC LIMIT 1
        `);
        const favRow = ((favResult as any)[0] || [])[0];

        const totalWagered = round2(Number(gsRow.totalWagered));
        const totalWon = round2(Number(gsRow.totalWon));

        return {
          userId: Number(row.userId),
          username: row.username,
          balance: round2(Number(row.balance)),
          totalWagered,
          totalWon,
          netProfitLoss: round2(totalWon - totalWagered),
          sessionsPlayed: Number(gsRow.sessionsPlayed),
          favoriteGame: favRow?.gameType || null,
          lastActive: row.lastActive,
        };
      }));

      return res.json({ metric, period, players });
    }

    // For wagered / profit / sessions — use game_sessions
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

    const rows = (result as any)[0] || [];

    // Get favorite game for each player
    const players = await Promise.all(rows.map(async (row: any) => {
      const favResult = await db.execute(sql.raw(`
        SELECT gs.game_type AS gameType, COUNT(*) AS cnt
        FROM game_sessions gs
        WHERE gs.user_id = ${Number(row.userId)} AND gs.is_completed = 1 ${periodClause}
        GROUP BY gs.game_type ORDER BY cnt DESC LIMIT 1
      `));
      const favRow = ((favResult as any)[0] || [])[0];

      return {
        userId: Number(row.userId),
        username: row.username,
        balance: round2(Number(row.balance)),
        totalWagered: round2(Number(row.totalWagered)),
        totalWon: round2(Number(row.totalWon)),
        netProfitLoss: round2(Number(row.netProfitLoss)),
        sessionsPlayed: Number(row.sessionsPlayed),
        favoriteGame: favRow?.gameType || null,
        lastActive: row.lastActive,
      };
    }));

    res.json({ metric, period, players });
  } catch (error) {
    LoggingService.logSystemEvent('analytics_top_players_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error fetching top players analytics' });
  }
});

// ---------------------------------------------------------------------------
// 6. GET /revenue — Revenue dashboard
// ---------------------------------------------------------------------------

router.get('/revenue', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const parseResult = analyticsRevenueSchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ message: 'Invalid query parameters' });
    }
    const { period, granularity } = parseResult.data;
    const cutoff = getPeriodCutoff(period);

    const periodClauseGS = cutoff
      ? sql`AND gs.start_time >= ${cutoff}`
      : sql``;
    const periodClauseTx = cutoff
      ? sql`AND t.created_at >= ${cutoff}`
      : sql``;
    const periodClauseUsers = cutoff
      ? sql`AND created_at >= ${cutoff}`
      : sql``;

    // Run queries in parallel
    const [
      revenueResult,
      depositsResult,
      withdrawalsResult,
      bonusesResult,
      activePlayersResult,
      newPlayersResult,
      revenueByGameResult,
    ] = await Promise.all([
      // Total revenue from game sessions (house profit = bets - payouts)
      db.execute(sql`
        SELECT COALESCE(SUM(gs.total_bet) - SUM(gs.outcome), 0) AS totalRevenue
        FROM game_sessions gs
        WHERE gs.is_completed = 1 ${periodClauseGS}
      `),
      // Total deposits
      db.execute(sql`
        SELECT COALESCE(SUM(t.amount), 0) AS totalDeposits
        FROM transactions t
        WHERE t.type = 'deposit' AND t.status = 'completed' ${periodClauseTx}
      `),
      // Total withdrawals
      db.execute(sql`
        SELECT COALESCE(SUM(t.amount), 0) AS totalWithdrawals
        FROM transactions t
        WHERE t.type = 'withdrawal' AND t.status = 'completed' ${periodClauseTx}
      `),
      // Total bonuses paid
      db.execute(sql`
        SELECT COALESCE(SUM(t.amount), 0) AS totalBonuses
        FROM transactions t
        WHERE t.type IN ('bonus', 'login_reward') AND t.status = 'completed' ${periodClauseTx}
      `),
      // Active player count (players who played at least once in the period)
      db.execute(sql`
        SELECT COUNT(DISTINCT gs.user_id) AS activePlayerCount
        FROM game_sessions gs
        WHERE gs.is_completed = 1 ${periodClauseGS}
      `),
      // New player count
      db.execute(sql`
        SELECT COUNT(*) AS newPlayerCount FROM users WHERE 1=1 ${periodClauseUsers}
      `),
      // Revenue by game
      db.execute(sql`
        SELECT
          gs.game_type AS gameType,
          COALESCE(SUM(gs.total_bet) - SUM(gs.outcome), 0) AS revenue
        FROM game_sessions gs
        WHERE gs.is_completed = 1 ${periodClauseGS}
        GROUP BY gs.game_type
      `),
    ]);

    const totalRevenue = round2(Number(((revenueResult as any)[0] || [])[0]?.totalRevenue || 0));
    const totalDeposits = round2(Number(((depositsResult as any)[0] || [])[0]?.totalDeposits || 0));
    const totalWithdrawals = round2(Number(((withdrawalsResult as any)[0] || [])[0]?.totalWithdrawals || 0));
    const totalBonusesPaid = round2(Number(((bonusesResult as any)[0] || [])[0]?.totalBonuses || 0));
    const activePlayerCount = Number(((activePlayersResult as any)[0] || [])[0]?.activePlayerCount || 0);
    const newPlayerCount = Number(((newPlayersResult as any)[0] || [])[0]?.newPlayerCount || 0);

    const summary = {
      totalRevenue,
      totalDeposits,
      totalWithdrawals,
      netCashflow: round2(totalDeposits - totalWithdrawals),
      totalBonusesPaid,
      grossGamingRevenue: totalRevenue,
      activePlayerCount,
      newPlayerCount,
      arpu: round2(safeDivide(totalRevenue, activePlayerCount)),
    };

    // Revenue by game with percentages
    const revenueByGameRows = (revenueByGameResult as any)[0] || [];
    const revenueByGame = revenueByGameRows.map((row: any) => {
      const revenue = round2(Number(row.revenue));
      return {
        gameType: row.gameType,
        revenue,
        percentOfTotal: round2(safeDivide(revenue, totalRevenue) * 100),
      };
    });

    // Time series
    const dateGroupExpr = getDateGroupExpr(granularity);
    const cutoffStr = cutoff ? cutoff.toISOString().slice(0, 19).replace('T', ' ') : null;

    const timeSeriesResult = await db.execute(sql.raw(`
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
          ${dateGroupExpr.replace(/gs\./g, 't.')} AS date,
          COALESCE(SUM(t.amount), 0) AS deposits
        FROM transactions t
        INNER JOIN game_sessions gs ON 1=0
        WHERE t.type = 'deposit' AND t.status = 'completed'
          ${cutoffStr ? `AND t.created_at >= '${cutoffStr}'` : ''}
        GROUP BY date
      ) dep ON dep.date = sub.date
      LEFT JOIN (
        SELECT
          ${dateGroupExpr.replace(/gs\./g, 't.')} AS date,
          COALESCE(SUM(t.amount), 0) AS withdrawals
        FROM transactions t
        INNER JOIN game_sessions gs ON 1=0
        WHERE t.type = 'withdrawal' AND t.status = 'completed'
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

    // The complex join above might fail in edge cases, so let's use a simpler approach
    // if the result is empty or there's an issue
    let timeSeries: any[] = [];
    const tsRows = (timeSeriesResult as any)[0] || [];

    if (tsRows.length > 0) {
      timeSeries = tsRows.map((row: any) => ({
        date: String(row.date),
        revenue: round2(Number(row.revenue)),
        deposits: round2(Number(row.deposits)),
        withdrawals: round2(Number(row.withdrawals)),
        activePlayers: Number(row.activePlayers),
        newPlayers: Number(row.newPlayers),
        gamesPlayed: Number(row.gamesPlayed),
      }));
    } else {
      // Fallback: simpler time series from game_sessions only
      const simpleTsResult = await db.execute(sql.raw(`
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

      const simpleRows = (simpleTsResult as any)[0] || [];
      timeSeries = simpleRows.map((row: any) => ({
        date: String(row.date),
        revenue: round2(Number(row.revenue)),
        deposits: 0,
        withdrawals: 0,
        activePlayers: Number(row.activePlayers),
        newPlayers: 0,
        gamesPlayed: Number(row.gamesPlayed),
      }));
    }

    res.json({ period, summary, timeSeries, revenueByGame });
  } catch (error) {
    LoggingService.logSystemEvent('analytics_revenue_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error fetching revenue analytics' });
  }
});

export default router;
