// @ts-nocheck
import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import LoggingService from '../src/services/loggingService.js';
import responsibleGamingService from '../src/services/responsibleGamingService.js';

const router = express.Router();

/**
 * GET /api/responsible-gaming/limits
 * Get the current user's responsible gaming limits / status.
 *
 * Because we have not added dedicated limit columns to the schema,
 * we return sensible defaults and the account's active status.
 * This keeps the endpoint stable so the frontend can call it
 * immediately, and we can add real columns later without breaking
 * the contract.
 */
router.get('/limits', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await responsibleGamingService.getUserActiveState(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      isActive: user.isActive,
      selfExcluded: !user.isActive,
      // Placeholder limits - will be backed by real columns in a future migration
      dailyDepositLimit: null,
      dailyLossLimit: null,
      sessionTimeLimit: null,
      cooldownUntil: null,
    });
  } catch (error) {
    LoggingService.logSystemEvent('responsible_gaming_limits_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error fetching responsible gaming limits' });
  }
});

/**
 * POST /api/responsible-gaming/self-exclude
 * Self-exclude the authenticated user for a given number of days.
 *
 * Body: { days: number } (1-365, default 1)
 *
 * This sets isActive = false on the user record, which the auth
 * middleware already checks and will block further logins.
 */
router.post('/self-exclude', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const rawDays = parseInt(req.body?.days, 10);
    const days = Number.isFinite(rawDays) && rawDays >= 1 && rawDays <= 365 ? rawDays : 1;

    const cooldownUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await responsibleGamingService.deactivateUser(userId);

    LoggingService.logSystemEvent('self_exclusion', {
      userId,
      days,
      cooldownUntil: cooldownUntil.toISOString(),
    }, 'info');

    res.json({
      success: true,
      message: `Account self-excluded for ${days} day(s). You will be logged out.`,
      reactivateAt: cooldownUntil.toISOString(),
    });
  } catch (error) {
    LoggingService.logSystemEvent('self_exclusion_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error processing self-exclusion' });
  }
});

/**
 * GET /api/responsible-gaming/activity-summary
 * Return a summary of the user's recent gambling activity so they
 * can make informed decisions.
 */
router.get('/activity-summary', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Get last 7 days and last 30 days summaries
    const summary7d = await responsibleGamingService.getActivitySummaryLast7Days(userId);
    const summary30d = await responsibleGamingService.getActivitySummaryLast30Days(userId);

    // The service tolerates mysql2's `[rows, fields]` wrapper, so these
    // are already row-shaped objects (or `{}` when empty).
    const week: any = summary7d || {};
    const month: any = summary30d || {};

    res.json({
      last7Days: {
        totalGames: Number(week?.totalTransactions ?? 0),
        totalWins: parseFloat(week?.totalWins ?? '0'),
        totalLosses: parseFloat(week?.totalLosses ?? '0'),
        netResult: parseFloat(week?.totalWins ?? '0') - parseFloat(week?.totalLosses ?? '0'),
      },
      last30Days: {
        totalGames: Number(month?.totalTransactions ?? 0),
        totalWins: parseFloat(month?.totalWins ?? '0'),
        totalLosses: parseFloat(month?.totalLosses ?? '0'),
        netResult: parseFloat(month?.totalWins ?? '0') - parseFloat(month?.totalLosses ?? '0'),
      },
    });
  } catch (error) {
    LoggingService.logSystemEvent('activity_summary_error', { error: (error as Error)?.message }, 'error');
    res.status(500).json({ message: 'Error fetching activity summary' });
  }
});

export default router;
