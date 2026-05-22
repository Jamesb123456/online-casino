/**
 * Admin Alerts routes
 *
 * Mounted at /api/admin/alerts. Exposes:
 *  - list of recent alerts with unread count
 *  - acknowledge single / acknowledge all
 *  - read / write the three threshold settings
 */

import express, { Request, Response } from 'express';
import {
  authenticate as auth,
  adminOnly,
  adminOrOperator,
  adminOrOperatorOrViewer,
} from '../middleware/auth.js';
import alertService from '../src/services/alertService.js';
import LoggingService from '../src/services/loggingService.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/admin/alerts
// ---------------------------------------------------------------------------
router.get('/', auth, adminOrOperatorOrViewer, async (req: Request, res: Response) => {
  try {
    const unreadOnly = String(req.query.unreadOnly ?? 'false') === 'true';
    const typeRaw = typeof req.query.type === 'string' ? req.query.type.trim() : '';
    const type = typeRaw ? typeRaw : null;
    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 200);
    const offsetRaw = Number(req.query.offset ?? 0);
    const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);

    const result = await alertService.getRecent({ unreadOnly, type, limit, offset });
    res.json(result);
  } catch (error) {
    LoggingService.logSystemEvent('admin_alerts_list_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error reading alerts' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/alerts/settings
// ---------------------------------------------------------------------------
router.get('/settings', auth, adminOrOperatorOrViewer, async (_req: Request, res: Response) => {
  try {
    const thresholds = await alertService.getThresholds();
    res.json(thresholds);
  } catch (error) {
    LoggingService.logSystemEvent('admin_alerts_settings_read_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error reading alert settings' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/alerts/settings — admin-only
// ---------------------------------------------------------------------------
router.put('/settings', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const update: { bigWin?: number; houseLow?: number; rapidBetsPerMin?: number } = {};

    for (const key of ['bigWin', 'houseLow', 'rapidBetsPerMin'] as const) {
      if (body[key] === undefined || body[key] === null) continue;
      const n = Number(body[key]);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({ message: `Invalid ${key}: must be a non-negative number` });
      }
      update[key] = n;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'No threshold fields provided' });
    }

    const adminId = (req as AuthenticatedRequest).user?.userId ?? null;
    const thresholds = await alertService.setThresholds(update, adminId);

    LoggingService.logSystemEvent('admin_alerts_settings_updated', { adminId, update });

    res.json(thresholds);
  } catch (error) {
    LoggingService.logSystemEvent('admin_alerts_settings_write_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error updating alert settings' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/alerts/acknowledge-all — admin or operator
// ---------------------------------------------------------------------------
router.post('/acknowledge-all', auth, adminOrOperator, async (req: Request, res: Response) => {
  try {
    const adminId = (req as AuthenticatedRequest).user?.userId ?? null;
    const count = await alertService.acknowledgeAll(adminId);
    LoggingService.logSystemEvent('admin_alerts_acknowledged_all', { adminId, count });
    res.json({ ok: true, count });
  } catch (error) {
    LoggingService.logSystemEvent('admin_alerts_acknowledge_all_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error acknowledging alerts' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/alerts/:id/acknowledge — admin or operator
// ---------------------------------------------------------------------------
router.post('/:id/acknowledge', auth, adminOrOperator, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid alert id' });
    }
    const adminId = (req as AuthenticatedRequest).user?.userId ?? null;
    const alert = await alertService.acknowledge(id, adminId);
    LoggingService.logSystemEvent('admin_alert_acknowledged', { adminId, id });
    res.json({ ok: true, alert });
  } catch (error) {
    const message = (error as Error)?.message;
    if (message === 'alert_not_found') {
      return res.status(404).json({ message: 'Alert not found' });
    }
    LoggingService.logSystemEvent('admin_alert_acknowledge_error', { error: message }, 'error');
    res.status(500).json({ message: 'Error acknowledging alert' });
  }
});

export default router;
