import express, { Request, Response } from 'express';
import { authenticate as auth, adminOnly } from '../middleware/auth.js';
import LoggingService from '../src/services/loggingService.js';
import behaviourAnalyticsService from '../src/services/behaviourAnalyticsService.js';
import analyticsService from '../src/services/analyticsService.js';
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

    const rows = await analyticsService.getGamesOverview(cutoff);

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
    const uniqueRows = await analyticsService.getUniquePlayersAllGames(cutoff);
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

    // Summary
    const summaryRows = await analyticsService.getGameDetailSummary(gameType, cutoff);
    const summaryRow = summaryRows[0] || {};
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
    const timeSeriesRows = await analyticsService.getGameDetailTimeSeries(gameType, cutoff, granularity);
    const timeSeries = timeSeriesRows.map((row: any) => ({
      date: String(row.date),
      sessions: Number(row.sessions),
      betsAmount: round2(Number(row.betsAmount)),
      payoutsAmount: round2(Number(row.payoutsAmount)),
      profit: round2(Number(row.betsAmount) - Number(row.payoutsAmount)),
      uniquePlayers: Number(row.uniquePlayers),
    }));

    // Top players for this game
    const topPlayersRows = await analyticsService.getGameDetailTopPlayers(gameType, cutoff);
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

    const bundle = await analyticsService.getPlayerProfileBundle(userId);

    // Parse user
    if (bundle.user.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = bundle.user[0];

    // Parse overall stats
    const statsRow = bundle.overallStats[0] || {};
    const totalSessions = Number(statsRow.totalSessions);
    const totalWagered = round2(Number(statsRow.totalWagered));
    const totalWon = round2(Number(statsRow.totalWon));
    const wins = Number(statsRow.wins);
    const losses = Number(statsRow.losses);

    // Parse deposit/withdrawal
    const dWRow = bundle.depositWithdrawal[0] || {};
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
    const perGameBreakdown = bundle.perGame.map((row: any) => {
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
    const recentActivity = bundle.recentSessions.map((row: any) => ({
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
    const activityTimeline = bundle.activityTimeline.map((row: any) => ({
      date: String(row.date),
      sessions: Number(row.sessions),
      wagered: round2(Number(row.wagered)),
      netResult: round2(Number(row.netResult)),
    }));

    // Risk indicators
    let lossStreakMax = 0;
    let currentStreak = 0;
    for (const row of bundle.recentSessionsForStreak) {
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
    const depositsLast7 = Number(bundle.depositsCount[0]?.cnt || 0);

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
        behaviourPatterns: await behaviourAnalyticsService
          .detectPatterns(Number(user.id))
          .catch(() => null),
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
    const userRows = await analyticsService.getUserById(userId);
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
    const countRows = await analyticsService.getPlayerSessionsCount(userId, gameTypeClause);
    const total = Number(countRows[0]?.total || 0);

    // Fetch sessions
    const sessionRows = await analyticsService.getPlayerSessionsPage(
      userId,
      gameTypeClause,
      sortColumn,
      sortDir,
      limit,
      offset,
    );
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
      const depositRows = await analyticsService.getTopDepositors(cutoff, limit);

      // For each user with deposits, get their game stats too
      const players = await Promise.all(depositRows.map(async (row: any) => {
        const gsRows = await analyticsService.getUserLifetimeGameStats(Number(row.userId));
        const gsRow = gsRows[0] || {};

        // Get favorite game
        const favRows = await analyticsService.getUserFavoriteGameLifetime(Number(row.userId));
        const favRow = favRows[0];

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
    const rows = await analyticsService.getTopPlayersByGameSessions(periodClause, orderColumn, limit);

    // Get favorite game for each player
    const players = await Promise.all(rows.map(async (row: any) => {
      const favRows = await analyticsService.getUserFavoriteGamePeriod(Number(row.userId), periodClause);
      const favRow = favRows[0];

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

    const bundle = await analyticsService.getRevenueSummaryBundle(cutoff);

    const totalRevenue = round2(Number(bundle.revenue[0]?.totalRevenue || 0));
    const totalDeposits = round2(Number(bundle.deposits[0]?.totalDeposits || 0));
    const totalWithdrawals = round2(Number(bundle.withdrawals[0]?.totalWithdrawals || 0));
    const totalBonusesPaid = round2(Number(bundle.bonuses[0]?.totalBonuses || 0));
    const activePlayerCount = Number(bundle.activePlayers[0]?.activePlayerCount || 0);
    const newPlayerCount = Number(bundle.newPlayers[0]?.newPlayerCount || 0);

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
    const revenueByGame = bundle.revenueByGame.map((row: any) => {
      const revenue = round2(Number(row.revenue));
      return {
        gameType: row.gameType,
        revenue,
        percentOfTotal: round2(safeDivide(revenue, totalRevenue) * 100),
      };
    });

    // Time series — joined first, fallback if empty
    const tsRows = await analyticsService.getRevenueTimeSeriesJoined(cutoff, granularity);

    let timeSeries: any[] = [];
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
      const simpleRows = await analyticsService.getRevenueTimeSeriesFallback(cutoff, granularity);
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
