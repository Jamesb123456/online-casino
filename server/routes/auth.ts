import express, { Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/index.js';
import UserModel from '../drizzle/models/User.js';
import LoggingService from '../src/services/loggingService.js';
import { auth } from '../lib/auth.js';

const router = express.Router();

/**
 * POST /api/auth/sign-up/username
 *
 * Convenience signup endpoint expected by the e2e suite. Better Auth's
 * username plugin only exposes /sign-up/email, so we synthesize an email
 * from the username and forward the call through the Better Auth API. The
 * response shape matches Better Auth's email signup: { user, token }.
 *
 * This is intentionally gated behind the same NODE_ENV check that the
 * /api/auth/sign-up mount uses in server.ts — when production is detected
 * the upstream gate already returns 404 and this handler never runs.
 */
router.post('/sign-up/username', express.json(), async (req: Request, res: Response) => {
  try {
    const { username, password, name } = req.body ?? {};
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ message: 'username is required' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ message: 'password is required' });
    }

    // Synthesize a deterministic local-only email for Better Auth's signup.
    const email = `${String(username).toLowerCase()}@platinum.local`;
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: typeof name === 'string' && name.length > 0 ? name : String(username),
        username,
      } as any,
      headers: req.headers as any,
    });

    res.status(200).json(result);
  } catch (error: any) {
    const status = Number(error?.statusCode || error?.status || 422);
    const message = error?.body?.message || error?.message || 'Sign up failed';
    LoggingService.logSystemEvent('signup_username_error', { error: message }, 'warning');
    return res.status(status).json({ message });
  }
});

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
