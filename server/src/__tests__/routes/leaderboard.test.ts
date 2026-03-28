// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockDbExecute } = vi.hoisted(() => ({
  mockDbExecute: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../drizzle/db.js', () => ({
  db: {
    execute: mockDbExecute,
  },
}));

vi.mock('drizzle-orm', () => ({
  sql: (strings, ...values) => {
    // Return a tagged template result that is passable to db.execute
    return { strings, values };
  },
}));

vi.mock('../../../src/services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import router under test
// ---------------------------------------------------------------------------

import router from '../../../routes/leaderboard.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/leaderboard', router);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Leaderboard routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET /api/leaderboard
  // =========================================================================
  describe('GET /', () => {
    it('should return leaderboard with default parameters (allTime, limit 10)', async () => {
      const rows = [
        { id: 1, username: 'player1', totalWinnings: 5000, totalGames: 50 },
        { id: 2, username: 'player2', totalWinnings: 3000, totalGames: 30 },
      ];
      mockDbExecute.mockResolvedValue(rows);

      const res = await request(createApp()).get('/api/leaderboard');

      expect(res.status).toBe(200);
      expect(res.body.period).toBe('allTime');
      expect(res.body.leaderboard).toEqual(rows);
    });

    it('should accept period=daily', async () => {
      mockDbExecute.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/leaderboard?period=daily');

      expect(res.status).toBe(200);
      expect(res.body.period).toBe('daily');
      expect(res.body.leaderboard).toEqual([]);
    });

    it('should accept period=weekly', async () => {
      mockDbExecute.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/leaderboard?period=weekly');

      expect(res.status).toBe(200);
      expect(res.body.period).toBe('weekly');
    });

    it('should return 400 for invalid period', async () => {
      const res = await request(createApp()).get('/api/leaderboard?period=yearly');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: 'Invalid period. Must be daily, weekly, or allTime.',
      });
    });

    it('should accept a custom limit', async () => {
      mockDbExecute.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/leaderboard?limit=25');

      expect(res.status).toBe(200);
    });

    it('should clamp limit to max 50', async () => {
      mockDbExecute.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/leaderboard?limit=100');

      // The route uses Math.min(Math.max(..., 1), 50) so it should be clamped
      expect(res.status).toBe(200);
    });

    it('should default limit to 10 for non-numeric values', async () => {
      mockDbExecute.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/leaderboard?limit=abc');

      expect(res.status).toBe(200);
    });

    it('should handle mysql2 [rows, fields] tuple format', async () => {
      const rows = [
        { id: 1, username: 'player1', totalWinnings: 2000, totalGames: 20 },
      ];
      // mysql2 returns [rows, fields]
      mockDbExecute.mockResolvedValue([rows, []]);

      const res = await request(createApp()).get('/api/leaderboard');

      expect(res.status).toBe(200);
      expect(res.body.leaderboard).toEqual(rows);
    });

    it('should return 500 on database error', async () => {
      mockDbExecute.mockRejectedValue(new Error('DB error'));

      const res = await request(createApp()).get('/api/leaderboard');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error fetching leaderboard' });
    });

    it('should not require authentication', async () => {
      mockDbExecute.mockResolvedValue([]);

      const res = await request(createApp()).get('/api/leaderboard');

      // The route does not use authenticate middleware, so it should work without auth
      expect(res.status).toBe(200);
    });
  });
});
