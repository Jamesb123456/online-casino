import express, { Request, Response } from 'express';
import { authenticate as auth, adminOnly, adminOrOperatorOrViewer } from '../middleware/auth.js';
import snapshotService from '../src/services/snapshotService.js';
import LoggingService from '../src/services/loggingService.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = express.Router();

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toUtcDateString(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const yesterday = new Date(today.getTime() - DAY_MS);
  const start = new Date(yesterday.getTime() - 29 * DAY_MS);
  return { from: toUtcDateString(start), to: toUtcDateString(yesterday) };
}

function serialize(row: any) {
  return {
    id: Number(row.id),
    snapshotDate: row.snapshotDate,
    houseBalanceClose: Number(row.houseBalanceClose),
    totalBets: Number(row.totalBets),
    totalWins: Number(row.totalWins),
    ggr: Number(row.ggr),
    bonusesPaid: Number(row.bonusesPaid),
    ngr: Number(row.ngr),
    activePlayerCount: Number(row.activePlayerCount),
    newPlayerCount: Number(row.newPlayerCount),
    createdAt: row.createdAt,
  };
}

// GET /api/admin/snapshots?from=YYYY-MM-DD&to=YYYY-MM-DD (defaults: last 30 days)
router.get('/', auth, adminOrOperatorOrViewer, async (req: Request, res: Response) => {
  try {
    const fallback = defaultRange();
    const from = typeof req.query.from === 'string' && DATE_RE.test(req.query.from)
      ? req.query.from : fallback.from;
    const to = typeof req.query.to === 'string' && DATE_RE.test(req.query.to)
      ? req.query.to : fallback.to;

    if (from > to) {
      return res.status(400).json({ message: 'from must be on or before to' });
    }

    const rows = await snapshotService.getRange(from, to);
    res.json({ from, to, snapshots: rows.map(serialize) });
  } catch (error) {
    LoggingService.logSystemEvent('admin_snapshots_read_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error reading snapshots' });
  }
});

// POST /api/admin/snapshots/recompute — admin-only, body: { date: 'YYYY-MM-DD' }
router.post('/recompute', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const adminId = (req as AuthenticatedRequest).user?.userId ?? null;
    const date = req.body?.date;
    if (typeof date !== 'string' || !DATE_RE.test(date)) {
      return res.status(400).json({ message: 'date must be a YYYY-MM-DD string' });
    }

    const row = await snapshotService.saveSnapshot(date);
    LoggingService.logSystemEvent('admin_snapshot_recomputed', { adminId, date });
    res.json({ snapshot: serialize(row) });
  } catch (error) {
    LoggingService.logSystemEvent('admin_snapshot_recompute_error', {
      error: (error as Error)?.message,
      date: req.body?.date,
    }, 'error');
    res.status(500).json({ message: 'Error recomputing snapshot' });
  }
});

export default router;
