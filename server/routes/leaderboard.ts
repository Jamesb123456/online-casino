import express, { Request, Response } from 'express';
import LoggingService from '../src/services/loggingService.js';
import LeaderboardService from '../src/services/leaderboardService.js';

const router = express.Router();

/**
 * GET /api/leaderboard
 * Get leaderboard data by period (daily, weekly, allTime)
 *
 * Query params:
 *  - period: 'daily' | 'weekly' | 'allTime' (default: 'allTime')
 *  - limit: number 1-50 (default: 10)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { period = 'allTime', limit = '10' } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit as string) || 10, 1), 50);

    // Validate period parameter
    const validPeriods = ['daily', 'weekly', 'allTime'];
    if (!validPeriods.includes(period as string)) {
      return res.status(400).json({ message: 'Invalid period. Must be daily, weekly, or allTime.' });
    }

    let dateFilter: Date | null = null;
    const now = new Date();

    if (period === 'daily') {
      dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'weekly') {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Query top winners by total winnings from transactions
    // Uses game_win transaction type to calculate total winnings
    const results = await LeaderboardService.getTopWinners(dateFilter, limitNum);

    // mysql2 returns [rows, fields] tuple
    const rows = Array.isArray(results) && Array.isArray(results[0]) ? results[0] : results;

    res.json({
      period,
      leaderboard: rows,
    });
  } catch (error) {
    LoggingService.logSystemEvent('leaderboard_fetch_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error fetching leaderboard' });
  }
});

export default router;
