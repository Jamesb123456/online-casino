import express, { Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/index.js';
import UserModel from '../drizzle/models/User.js';
import LoggingService from '../src/services/loggingService.js';

const router = express.Router();

/**
 * GET /api/auth/refresh-session
 * Validates the current session and returns fresh user data.
 * Better Auth's session.updateAge handles the actual token refresh
 * automatically when the session is accessed via the authenticate middleware.
 */
router.get('/refresh-session', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      balance: user.balance,
      isActive: user.isActive,
    });
  } catch (error) {
    LoggingService.logSystemEvent('session_refresh_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Session refresh failed' });
  }
});

export default router;
