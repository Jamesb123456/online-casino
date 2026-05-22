/**
 * Admin Tournaments routes
 *
 * Mounted at /api/admin/tournaments. CRUD + finalize for admin-defined
 * time-boxed leaderboards. Role tiers:
 *   - GET (list, detail, leaderboard): admin/operator/viewer
 *   - POST (create), PUT (update), POST /:id/cancel: admin/operator
 *   - POST /:id/finalize: admin-only
 */

import express, { Request, Response } from 'express';
import {
  authenticate as auth,
  adminOnly,
  adminOrOperator,
  adminOrOperatorOrViewer,
} from '../middleware/auth.js';
import tournamentService, { KNOWN_GAMES, SCORING_RULES } from '../src/services/tournamentService.js';
import LoggingService from '../src/services/loggingService.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = express.Router();

function parseId(raw: any): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

function serialize(t: any) {
  return {
    id: Number(t.id),
    name: t.name,
    gameType: t.gameType,
    scoring: t.scoring,
    startTime: t.startTime instanceof Date ? t.startTime.toISOString() : t.startTime,
    endTime: t.endTime instanceof Date ? t.endTime.toISOString() : t.endTime,
    prizePool: Number(t.prizePool),
    prizeDistribution: t.prizeDistribution,
    status: t.status,
    createdBy: t.createdBy,
    finalizedAt: t.finalizedAt instanceof Date ? t.finalizedAt.toISOString() : t.finalizedAt,
    finalizedBy: t.finalizedBy,
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
    updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : t.updatedAt,
  };
}

function serializeEntry(e: any) {
  return {
    id: Number(e.id),
    tournamentId: e.tournamentId,
    userId: e.userId,
    score: Number(e.score),
    totalWagered: Number(e.totalWagered),
    totalWon: Number(e.totalWon),
    biggestWin: Number(e.biggestWin),
    rank: e.rank,
    prizeAmount: e.prizeAmount == null ? null : Number(e.prizeAmount),
  };
}

function validatePayload(body: any): { ok: true; value: any } | { ok: false; message: string } {
  if (!body || typeof body !== 'object') return { ok: false, message: 'Invalid body' };
  const { name, gameType, scoring, startTime, endTime, prizePool, prizeDistribution } = body;

  if (typeof name !== 'string' || name.trim().length < 1 || name.length > 120) {
    return { ok: false, message: 'name must be 1-120 chars' };
  }
  if (!KNOWN_GAMES.includes(gameType)) {
    return { ok: false, message: `gameType must be one of ${KNOWN_GAMES.join(', ')}` };
  }
  if (!SCORING_RULES.includes(scoring)) {
    return { ok: false, message: `scoring must be one of ${SCORING_RULES.join(', ')}` };
  }
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, message: 'startTime/endTime must be valid timestamps' };
  }
  if (start.getTime() >= end.getTime()) {
    return { ok: false, message: 'startTime must be before endTime' };
  }
  const pool = Number(prizePool);
  if (!Number.isFinite(pool) || pool <= 0) {
    return { ok: false, message: 'prizePool must be positive' };
  }
  if (!prizeDistribution || typeof prizeDistribution !== 'object' || Array.isArray(prizeDistribution)) {
    return { ok: false, message: 'prizeDistribution must be an object' };
  }
  const keys = Object.keys(prizeDistribution);
  if (keys.length === 0) {
    return { ok: false, message: 'prizeDistribution must have at least one rank' };
  }
  let sum = 0;
  for (const k of keys) {
    if (!/^[1-9]\d*$/.test(k)) {
      return { ok: false, message: `prizeDistribution key ${k} must be a positive integer string` };
    }
    const v = Number((prizeDistribution as any)[k]);
    if (!Number.isFinite(v) || v <= 0 || v > 1) {
      return { ok: false, message: `prizeDistribution[${k}] must be between 0 and 1` };
    }
    sum += v;
  }
  if (Math.abs(sum - 1) > 0.001) {
    return { ok: false, message: 'prizeDistribution values must sum to 1.0 (±0.001)' };
  }

  return {
    ok: true,
    value: { name: name.trim(), gameType, scoring, startTime: start, endTime: end, prizePool: pool, prizeDistribution },
  };
}

// ---------------------------------------------------------------------------
// GET / — viewer+
// ---------------------------------------------------------------------------
router.get('/', auth, adminOrOperatorOrViewer, async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const gameType = typeof req.query.gameType === 'string' ? req.query.gameType : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const result = await tournamentService.list({ status, gameType, limit, offset });
    res.json({
      rows: result.rows.map(serialize),
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    LoggingService.logSystemEvent('admin_tournaments_list_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error listing tournaments' });
  }
});

// ---------------------------------------------------------------------------
// POST / — admin or operator
// ---------------------------------------------------------------------------
router.post('/', auth, adminOrOperator, async (req: Request, res: Response) => {
  try {
    const validation = validatePayload(req.body);
    if (!validation.ok) {
      return res.status(400).json({ message: (validation as any).message });
    }
    const createdBy = (req as AuthenticatedRequest).user?.userId ?? null;
    const tournament = await tournamentService.create({ ...(validation as any).value, createdBy });
    LoggingService.logSystemEvent('admin_tournament_created', { id: tournament.id, createdBy });
    res.status(201).json(serialize(tournament));
  } catch (error) {
    LoggingService.logSystemEvent('admin_tournaments_create_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error creating tournament' });
  }
});

// ---------------------------------------------------------------------------
// GET /:id — viewer+. Returns tournament + leaderboard top 50.
// ---------------------------------------------------------------------------
router.get('/:id', auth, adminOrOperatorOrViewer, async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (id == null) return res.status(400).json({ message: 'Invalid id' });
    const t = await tournamentService.getById(id);
    if (!t) return res.status(404).json({ message: 'Tournament not found' });
    const leaderboard = await tournamentService.getLeaderboard(id, 50);
    res.json({
      tournament: serialize(t),
      leaderboard: leaderboard.map(serializeEntry),
    });
  } catch (error) {
    LoggingService.logSystemEvent('admin_tournaments_get_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error reading tournament' });
  }
});

// ---------------------------------------------------------------------------
// PUT /:id — admin or operator. Only while scheduled.
// ---------------------------------------------------------------------------
router.put('/:id', auth, adminOrOperator, async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (id == null) return res.status(400).json({ message: 'Invalid id' });

    const body = req.body || {};
    const patch: any = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.gameType !== undefined) patch.gameType = body.gameType;
    if (body.scoring !== undefined) patch.scoring = body.scoring;
    if (body.startTime !== undefined) patch.startTime = body.startTime;
    if (body.endTime !== undefined) patch.endTime = body.endTime;
    if (body.prizePool !== undefined) patch.prizePool = body.prizePool;
    if (body.prizeDistribution !== undefined) patch.prizeDistribution = body.prizeDistribution;

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const updated = await tournamentService.update(id, patch);
    res.json(serialize(updated));
  } catch (error) {
    const msg = (error as Error)?.message || '';
    LoggingService.logSystemEvent('admin_tournaments_update_error', { error: msg }, 'warning');
    if (msg === 'tournament_not_found') return res.status(404).json({ message: 'Tournament not found' });
    if (msg === 'tournament_not_editable') return res.status(409).json({ message: 'Tournament can only be edited while scheduled' });
    if (msg.startsWith('invalid_') || msg === 'start_must_precede_end' || msg === 'prize_pool_must_be_positive' || msg.startsWith('prize_distribution_')) {
      return res.status(400).json({ message: msg });
    }
    res.status(500).json({ message: 'Error updating tournament' });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/cancel — admin or operator
// ---------------------------------------------------------------------------
router.post('/:id/cancel', auth, adminOrOperator, async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (id == null) return res.status(400).json({ message: 'Invalid id' });
    const adminId = (req as AuthenticatedRequest).user?.userId ?? null;
    await tournamentService.cancel(id, adminId);
    res.json({ ok: true });
  } catch (error) {
    const msg = (error as Error)?.message || '';
    LoggingService.logSystemEvent('admin_tournaments_cancel_error', { error: msg }, 'warning');
    if (msg === 'tournament_not_found') return res.status(404).json({ message: 'Tournament not found' });
    if (msg === 'tournament_not_cancellable') return res.status(409).json({ message: 'Only scheduled or active tournaments can be cancelled' });
    res.status(500).json({ message: 'Error cancelling tournament' });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/finalize — admin only
// ---------------------------------------------------------------------------
router.post('/:id/finalize', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (id == null) return res.status(400).json({ message: 'Invalid id' });
    const adminId = (req as AuthenticatedRequest).user?.userId ?? null;
    const result = await tournamentService.finalize(id, adminId);
    res.json(result);
  } catch (error) {
    const msg = (error as Error)?.message || '';
    LoggingService.logSystemEvent('admin_tournaments_finalize_error', { error: msg }, 'warning');
    if (msg === 'tournament_not_found') return res.status(404).json({ message: 'Tournament not found' });
    if (msg === 'tournament_not_active') return res.status(409).json({ message: 'Tournament is not active (already finalized or cancelled)' });
    if (msg === 'tournament_not_ended') return res.status(409).json({ message: 'Tournament end time has not passed yet' });
    res.status(500).json({ message: 'Error finalizing tournament' });
  }
});

// ---------------------------------------------------------------------------
// GET /:id/leaderboard — viewer+
// ---------------------------------------------------------------------------
router.get('/:id/leaderboard', auth, adminOrOperatorOrViewer, async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (id == null) return res.status(400).json({ message: 'Invalid id' });
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const rows = await tournamentService.getLeaderboard(id, limit);
    res.json({ rows: rows.map(serializeEntry) });
  } catch (error) {
    LoggingService.logSystemEvent('admin_tournaments_leaderboard_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error reading leaderboard' });
  }
});

export default router;
