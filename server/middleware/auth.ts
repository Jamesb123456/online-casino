import type { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../lib/auth.js';
import type { AuthenticatedRequest } from '../types/index.js';
import LoggingService from '../src/services/loggingService.js';

// Middleware to verify Better Auth session
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session || !session.user) {
      return res.status(401).json({ message: 'No valid session, authorization denied' });
    }

    // Check isActive custom field
    if ((session.user as any).isActive === false) {
      return res.status(401).json({ message: 'Account is disabled' });
    }

    // Add user to request in the same shape the rest of the app expects
    (req as AuthenticatedRequest).user = {
      userId: Number(session.user.id),
      username: (session.user as any).username || session.user.name,
      role: (session.user.role as 'user' | 'admin') || 'user',
    };

    next();
  } catch (error) {
    LoggingService.logSystemEvent('auth_middleware_error', { error: (error as Error)?.message }, 'error');
    res.status(401).json({ message: 'Session is not valid' });
  }
};

// Middleware to check if user is admin
export const adminOnly = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admin only.' });
  }
};

// User or admin middleware
export const userOrAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (req.user && (req.user.role === 'user' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied.' });
  }
};
