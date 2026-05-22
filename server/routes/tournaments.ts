/**
 * Player Tournaments routes
 *
 * Mounted at /api/tournaments. Auth required (no admin gate).
 *   - GET /active — list active tournaments + top-10 leaderboards + current user's entry/rank.
 *   - GET /:id/leaderboard — leaderboard for any tournament.
 */

import express, { Request, Response } from 'express';
import { authenticate as auth } from '../middleware/auth.js';
import tournamentService from '../src/services/tournamentService.js';
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
  };
}

function serializeEntry(e: any) {
  return {
    userId: e.userId,
    score: Number(e.score),
    totalWagered: Number(e.totalWagered),
    totalWon: Number(e.totalWon),
    biggestWin: Number(e.biggestWin),
    rank: e.rank,
  };
}

// ---------------------------------------------------------------------------
// GET /active — list active tournaments with top-10 leaderboards + user entry
// ---------------------------------------------------------------------------
router.get('/active', auth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.userId ?? null;
    const result = await tournamentService.list({ status: 'active', limit: 50 });

    const tournaments = await Promise.all(result.rows.map(async (t: any) => {
      const leaderboard = await tournamentService.getLeaderboard(t.id, 10);
      const myEntry = userId != null ? await tournamentService.getUserEntry(t.id, userId) : null;
      const myRank = userId != null ? await tournamentService.getUserRank(t.id, userId) : null;
      return {
        ...serialize(t),
        leaderboard: leaderboard.map(serializeEntry),
        myEntry: myEntry
          ? { ...serializeEntry(myEntry), rank: myRank }
          : null,
      };
    }));

    res.json({ tournaments });
  } catch (error) {
    LoggingService.logSystemEvent('tournaments_active_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error reading active tournaments' });
  }
});

// ---------------------------------------------------------------------------
// GET /:id/leaderboard
// ---------------------------------------------------------------------------
router.get('/:id/leaderboard', auth, async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (id == null) return res.status(400).json({ message: 'Invalid id' });
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const rows = await tournamentService.getLeaderboard(id, limit);
    res.json({ rows: rows.map(serializeEntry) });
  } catch (error) {
    LoggingService.logSystemEvent('tournaments_leaderboard_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error reading leaderboard' });
  }
});

export default router;
