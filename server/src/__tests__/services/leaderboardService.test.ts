// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockDbExecute } = vi.hoisted(() => ({
  mockDbExecute: vi.fn(),
}));

vi.mock('../../../drizzle/db.js', () => ({
  db: {
    execute: mockDbExecute,
  },
}));

vi.mock('drizzle-orm', () => ({
  // Tagged-template stub that captures the literal segments and the
  // interpolated values so tests can assert on the embedded SQL & params.
  sql: (strings, ...values) => ({ strings, values }),
}));

// ---------------------------------------------------------------------------
// Import service under test (after mocks)
// ---------------------------------------------------------------------------

import LeaderboardService from '../../services/leaderboardService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lastCallSql(): { strings: string[]; values: any[] } {
  const args = mockDbExecute.mock.calls[mockDbExecute.mock.calls.length - 1];
  return args[0];
}

function joinedSql(): string {
  const { strings } = lastCallSql();
  return strings.join(' ');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LeaderboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTopWinners()', () => {
    it('runs the unfiltered all-time query when `since` is null', async () => {
      const rows = [
        { id: 1, username: 'p1', totalWinnings: 100, totalGames: 5 },
      ];
      mockDbExecute.mockResolvedValueOnce(rows);

      const result = await LeaderboardService.getTopWinners(null, 10);

      expect(result).toBe(rows);
      expect(mockDbExecute).toHaveBeenCalledTimes(1);
      const text = joinedSql();
      // Unfiltered branch should NOT include a created_at constraint in the
      // join clause.
      expect(text).not.toContain('t.created_at >=');
      expect(text).toContain('FROM users u');
      expect(text).toContain('ORDER BY totalWinnings DESC');
    });

    it('runs the date-filtered query when `since` is provided', async () => {
      mockDbExecute.mockResolvedValueOnce([]);

      const since = new Date('2025-01-15T10:30:00.000Z');
      await LeaderboardService.getTopWinners(since, 25);

      expect(mockDbExecute).toHaveBeenCalledTimes(1);
      const { strings, values } = lastCallSql();
      const text = strings.join(' ');
      expect(text).toContain('t.created_at >=');
      // First interpolated value is the formatted "YYYY-MM-DD HH:MM:SS" date
      expect(values[0]).toBe('2025-01-15 10:30:00');
      // Second interpolated value is the limit
      expect(values[1]).toBe(25);
    });

    it('returns the raw db.execute() result so the route can unwrap mysql2 tuples', async () => {
      // mysql2 driver returns [rows, fields]. The service must NOT unwrap.
      const rows = [{ id: 9, username: 'whale', totalWinnings: 9999, totalGames: 7 }];
      mockDbExecute.mockResolvedValueOnce([rows, []]);

      const result = await LeaderboardService.getTopWinners(null, 10);

      expect(result).toEqual([rows, []]);
    });

    it('propagates db errors', async () => {
      mockDbExecute.mockRejectedValueOnce(new Error('boom'));
      await expect(LeaderboardService.getTopWinners(null, 10)).rejects.toThrow('boom');
    });

    it('respects the provided limit value (filtered branch)', async () => {
      mockDbExecute.mockResolvedValueOnce([]);
      await LeaderboardService.getTopWinners(new Date('2025-02-01T00:00:00.000Z'), 50);
      const { values } = lastCallSql();
      expect(values[values.length - 1]).toBe(50);
    });

    it('respects the provided limit value (all-time branch)', async () => {
      mockDbExecute.mockResolvedValueOnce([]);
      await LeaderboardService.getTopWinners(null, 1);
      const { values } = lastCallSql();
      expect(values[values.length - 1]).toBe(1);
    });
  });
});
