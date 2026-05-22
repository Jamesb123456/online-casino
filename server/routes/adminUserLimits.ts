/**
 * Admin User Limits routes
 *
 * Mounted at /api/admin/user-limits. Exposes per-user betting/loss caps and
 * admin-set lock timeouts (used by the 6 game handlers as a pre-bet gate).
 */

import express, { Request, Response } from 'express';
import {
  authenticate as auth,
  adminOrOperator,
  adminOrOperatorOrViewer,
} from '../middleware/auth.js';
import userLimitsService from '../src/services/userLimitsService.js';
import LoggingService from '../src/services/loggingService.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = express.Router();

function parseUserId(raw: any): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

// ---------------------------------------------------------------------------
// GET /api/admin/user-limits/:userId — viewer+
// ---------------------------------------------------------------------------
router.get('/:userId', auth, adminOrOperatorOrViewer, async (req: Request, res: Response) => {
  try {
    const userId = parseUserId(req.params.userId);
    if (userId == null) {
      return res.status(400).json({ message: 'Invalid userId' });
    }
    const limits = await userLimitsService.getLimits(userId);
    res.json(limits);
  } catch (error) {
    LoggingService.logSystemEvent('admin_user_limits_get_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error reading user limits' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/user-limits/:userId — admin or operator
// ---------------------------------------------------------------------------
router.put('/:userId', auth, adminOrOperator, async (req: Request, res: Response) => {
  try {
    const userId = parseUserId(req.params.userId);
    if (userId == null) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const body = req.body || {};
    const patch: { maxBetPerRound?: number | null; maxLossPerDay?: number | null; lockedUntil?: Date | null; sessionLimitMinutes?: number | null } = {};
    let provided = 0;

    for (const key of ['maxBetPerRound', 'maxLossPerDay'] as const) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
      provided++;
      const v = body[key];
      if (v === null) {
        patch[key] = null;
        continue;
      }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({ message: `Invalid ${key}: must be a non-negative number or null` });
      }
      patch[key] = n;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'sessionLimitMinutes')) {
      provided++;
      const v = body.sessionLimitMinutes;
      if (v === null) {
        patch.sessionLimitMinutes = null;
      } else {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) {
          return res.status(400).json({ message: 'Invalid sessionLimitMinutes: must be a non-negative number or null' });
        }
        if (n > 1440) {
          return res.status(400).json({ message: 'Invalid sessionLimitMinutes: must be <= 1440 (24 hours)' });
        }
        patch.sessionLimitMinutes = n;
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'lockedUntil')) {
      provided++;
      const v = body.lockedUntil;
      if (v === null) {
        patch.lockedUntil = null;
      } else {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ message: 'Invalid lockedUntil: must be an ISO timestamp or null' });
        }
        if (d.getTime() <= Date.now()) {
          return res.status(400).json({ message: 'Invalid lockedUntil: must be a future timestamp' });
        }
        patch.lockedUntil = d;
      }
    }

    if (provided === 0) {
      return res.status(400).json({ message: 'No limit fields provided' });
    }

    const updatedBy = (req as AuthenticatedRequest).user?.userId ?? null;
    const limits = await userLimitsService.setLimits(userId, patch, updatedBy);

    LoggingService.logSystemEvent('admin_user_limits_updated', { userId, updatedBy, patch });

    res.json(limits);
  } catch (error) {
    LoggingService.logSystemEvent('admin_user_limits_put_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error updating user limits' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/user-limits/:userId — admin or operator
// ---------------------------------------------------------------------------
router.delete('/:userId', auth, adminOrOperator, async (req: Request, res: Response) => {
  try {
    const userId = parseUserId(req.params.userId);
    if (userId == null) {
      return res.status(400).json({ message: 'Invalid userId' });
    }
    await userLimitsService.clearLimits(userId);
    const updatedBy = (req as AuthenticatedRequest).user?.userId ?? null;
    LoggingService.logSystemEvent('admin_user_limits_cleared', { userId, updatedBy });
    res.json({ ok: true });
  } catch (error) {
    LoggingService.logSystemEvent('admin_user_limits_delete_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error clearing user limits' });
  }
});

export default router;
