import express, { Request, Response } from 'express';
import { authenticate as auth, adminOnly, adminOrOperatorOrViewer } from '../middleware/auth.js';
import LoggingService from '../src/services/loggingService.js';
import loginRewardConfigService from '../src/services/loginRewardConfigService.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = express.Router();

function validateConfigPatch(body: any):
  | { ok: true; clean: { min?: number; max?: number; streakBonus?: number; capPerDay?: number | null }; effective: { min: number; max: number } }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'invalid_payload' };
  }

  const clean: { min?: number; max?: number; streakBonus?: number; capPerDay?: number | null } = {};
  let provided = 0;

  if (body.min !== undefined) {
    const n = Number(body.min);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: 'min must be a non-negative number' };
    }
    clean.min = n;
    provided++;
  }
  if (body.max !== undefined) {
    const n = Number(body.max);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: 'max must be a non-negative number' };
    }
    clean.max = n;
    provided++;
  }
  if (body.streakBonus !== undefined) {
    const n = Number(body.streakBonus);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: 'streakBonus must be a non-negative number' };
    }
    clean.streakBonus = n;
    provided++;
  }
  if (body.capPerDay !== undefined) {
    if (body.capPerDay === null) {
      clean.capPerDay = null;
    } else {
      const n = Number(body.capPerDay);
      if (!Number.isFinite(n) || n < 0) {
        return { ok: false, error: 'capPerDay must be null or a non-negative number' };
      }
      clean.capPerDay = n;
    }
    provided++;
  }

  if (provided === 0) {
    return { ok: false, error: 'no_fields_provided' };
  }

  // We can't validate min <= max in isolation when only one is provided —
  // that check needs the merged config. Caller does the cross-check.
  return { ok: true, clean, effective: { min: clean.min ?? -Infinity, max: clean.max ?? Infinity } };
}

// GET /api/admin/login-rewards/config
router.get('/config', auth, adminOrOperatorOrViewer, async (_req: Request, res: Response) => {
  try {
    const config = await loginRewardConfigService.getLoginRewardConfig();
    res.json(config);
  } catch (error) {
    LoggingService.logSystemEvent('admin_login_reward_config_read_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error reading login reward config' });
  }
});

// PUT /api/admin/login-rewards/config
router.put('/config', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const adminId = (req as AuthenticatedRequest).user?.userId ?? null;
    const validation: any = validateConfigPatch(req.body);
    if (!validation.ok) {
      return res.status(400).json({ message: validation.error });
    }

    // Merge against current config so we can enforce max >= min across the
    // result of the patch (not just within the patch itself).
    const current = await loginRewardConfigService.getLoginRewardConfig();
    const merged = {
      min: validation.clean.min ?? current.min,
      max: validation.clean.max ?? current.max,
      streakBonus: validation.clean.streakBonus ?? current.streakBonus,
      capPerDay: validation.clean.capPerDay !== undefined ? validation.clean.capPerDay : current.capPerDay,
    };

    if (merged.max < merged.min) {
      return res.status(400).json({ message: 'max must be greater than or equal to min' });
    }

    await loginRewardConfigService.setLoginRewardConfig(validation.clean, adminId);

    LoggingService.logSystemEvent('admin_login_reward_config_updated', {
      adminId,
      patch: validation.clean,
    });

    const fresh = await loginRewardConfigService.getLoginRewardConfig();
    res.json(fresh);
  } catch (error) {
    LoggingService.logSystemEvent('admin_login_reward_config_update_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error updating login reward config' });
  }
});

export default router;
