// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestServer, type TestServer } from '../test-server.js';
import { createTestUser, createAuthSocket, connectSocket } from '../auth-helper.js';
import { setBalance, getBalance, getTransactions, getUserIdByUsername, clearGameData } from '../db-helper.js';
import { emitWithAck, sleep } from '../utils.js';
import type { Socket } from 'socket.io-client';

/**
 * Default slots payout table copied from migration 0013_slots_game.sql.
 * The slots handler rejects spins with `payout_table_invalid` if the
 * configured `payoutTable` is missing `reels`, `lines`, or `payouts` — so
 * the test must ensure this row exists before any spin.
 */
const SLOTS_PAYOUT_TABLE = {
  symbols: ['CHERRY', 'LEMON', 'ORANGE', 'PLUM', 'BELL', 'BAR', 'SEVEN'],
  reels: [
    ['CHERRY','CHERRY','LEMON','ORANGE','PLUM','BELL','CHERRY','LEMON','BAR','ORANGE','CHERRY','LEMON','SEVEN','PLUM','BELL','ORANGE','LEMON','CHERRY','BAR','PLUM'],
    ['LEMON','ORANGE','PLUM','BELL','CHERRY','LEMON','BAR','ORANGE','CHERRY','PLUM','BELL','ORANGE','LEMON','CHERRY','SEVEN','PLUM','BELL','CHERRY','LEMON','BAR'],
    ['ORANGE','PLUM','BELL','CHERRY','LEMON','BAR','ORANGE','CHERRY','PLUM','BELL','CHERRY','LEMON','SEVEN','PLUM','ORANGE','LEMON','CHERRY','BAR','BELL','CHERRY'],
    ['PLUM','BELL','CHERRY','LEMON','ORANGE','CHERRY','BAR','PLUM','BELL','ORANGE','LEMON','CHERRY','SEVEN','BAR','ORANGE','CHERRY','LEMON','BELL','PLUM','CHERRY'],
    ['BELL','CHERRY','LEMON','BAR','ORANGE','PLUM','CHERRY','BELL','ORANGE','LEMON','BAR','CHERRY','SEVEN','PLUM','ORANGE','LEMON','CHERRY','BELL','BAR','PLUM'],
  ],
  lines: [[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2]],
  payouts: {
    CHERRY: { '3': 14, '4': 45, '5': 140 },
    LEMON:  { '3': 14, '4': 45, '5': 140 },
    ORANGE: { '3': 22, '4': 70, '5': 210 },
    PLUM:   { '3': 22, '4': 70, '5': 210 },
    BELL:   { '3': 42, '4': 140, '5': 560 },
    BAR:    { '3': 70, '4': 280, '5': 1400 },
    SEVEN:  { '3': 140, '4': 700, '5': 4200 },
  },
};

/**
 * Seed the slots game_config row if missing. The test MySQL container is
 * created via `db:push` (schema only) so seed data from migration files
 * isn't applied automatically.
 */
async function ensureSlotsConfig(): Promise<void> {
  const { db } = await import('../../../drizzle/db.js');
  const { sql } = await import('drizzle-orm');
  await db.execute(
    sql`INSERT INTO game_config (game_type, house_edge, payout_table, max_bet, enabled, created_at, updated_at)
        VALUES ('slots', 0.0500, ${JSON.stringify(SLOTS_PAYOUT_TABLE)}, '0', 1, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          payout_table = VALUES(payout_table),
          house_edge = VALUES(house_edge),
          enabled = VALUES(enabled),
          updated_at = NOW()`
  );
  // Invalidate the in-memory cache so the next getConfig() reads the row.
  const cfgMod = await import('../../../services/gameConfigService.js');
  const cfg: any = cfgMod.default ?? cfgMod;
  if (cfg?._cache?.delete) cfg._cache.delete('slots');
}

describe('Slots Integration', () => {
  let server: TestServer;
  let cookie: string;
  let username: string;
  let userId: number;

  beforeAll(async () => {
    server = await startTestServer();
    await ensureSlotsConfig();
    const user = await createTestUser(server.baseUrl);
    cookie = user.cookie;
    username = user.username;
    userId = (await getUserIdByUsername(user.username))!;
  }, 30000);

  afterAll(async () => {});

  beforeEach(async () => {
    await setBalance(userId, '1000.00');
    await clearGameData();
  });

  async function connectSlots(): Promise<Socket> {
    const socket = createAuthSocket(server.baseUrl, '/slots', cookie);
    await connectSocket(socket);
    // Wait for per-connection handler to be initialized via dynamic import
    await sleep(500);
    return socket;
  }

  it('should spin reels and return a valid 5x3 result with balance updated', async () => {
    const socket = await connectSlots();
    try {
      const result = await emitWithAck<any>(socket, 'slots:spin', {
        betPerLine: 10,
        lines: 5,
      });

      expect(result.ok).toBe(true);
      expect(result.gameId).toBeDefined();
      expect(Array.isArray(result.reels)).toBe(true);
      expect(result.reels.length).toBe(5);
      for (const reel of result.reels) {
        expect(Array.isArray(reel)).toBe(true);
        expect(reel.length).toBe(3);
        for (const sym of reel) {
          expect(typeof sym).toBe('string');
        }
      }
      expect(Array.isArray(result.hits)).toBe(true);
      expect(result.totalPayout).toBeGreaterThanOrEqual(0);
      expect(typeof result.multiplier).toBe('number');
      expect(typeof result.newBalance).toBe('number');

      // Wait for DB writes to flush
      await sleep(200);

      // Total bet = betPerLine * lines = 50
      const dbBalance = await getBalance(userId);
      const expected = 1000 - 50 + result.totalPayout;
      expect(parseFloat(dbBalance)).toBeCloseTo(expected, 1);

      // Transactions: bet row (game_loss). If payout > 0, also a game_win row.
      const transactions = await getTransactions(userId);
      const betTx = transactions.find((t: any) => t.type === 'game_loss' && t.gameType === 'slots');
      expect(betTx).toBeDefined();
      expect(parseFloat(betTx.amount)).toBe(-50);

      if (result.totalPayout > 0) {
        const winTx = transactions.find((t: any) => t.type === 'game_win' && t.gameType === 'slots');
        expect(winTx).toBeDefined();
        expect(parseFloat(winTx.amount)).toBeCloseTo(result.totalPayout, 1);
      }
    } finally {
      socket.disconnect();
    }
  });

  it('should reject a spin with insufficient balance', async () => {
    await setBalance(userId, '5.00');
    const socket = await connectSlots();
    try {
      const result = await emitWithAck<any>(socket, 'slots:spin', {
        betPerLine: 10,
        lines: 5,
      });

      expect(result.ok).toBe(false);
      expect(String(result.error || '').toLowerCase()).toMatch(/insufficient|balance/);

      // Balance unchanged on rejection
      const dbBalance = await getBalance(userId);
      expect(parseFloat(dbBalance)).toBe(5);
    } finally {
      socket.disconnect();
    }
  });

  it('should reject a spin with lines out of range', async () => {
    const socket = await connectSlots();
    try {
      // 0 lines fails zod min(1); zod throws before custom range check.
      const result = await emitWithAck<any>(socket, 'slots:spin', {
        betPerLine: 10,
        lines: 0,
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();

      // Balance unchanged
      const dbBalance = await getBalance(userId);
      expect(parseFloat(dbBalance)).toBe(1000);
    } finally {
      socket.disconnect();
    }
  });

  it('should return current balance on slots:join', async () => {
    const socket = await connectSlots();
    try {
      const result = await emitWithAck<any>(socket, 'slots:join', {});
      expect(result.success).toBe(true);
      expect(typeof result.balance).toBe('number');
      expect(result.balance).toBe(1000);
    } finally {
      socket.disconnect();
    }
  });

  it('should work across all valid lines values (1..5)', async () => {
    const socket = await connectSlots();
    try {
      for (const lines of [1, 2, 3, 4, 5]) {
        await setBalance(userId, '1000.00');
        const result = await emitWithAck<any>(socket, 'slots:spin', {
          betPerLine: 5,
          lines,
        });
        expect(result.ok).toBe(true);
        expect(result.reels.length).toBe(5);
      }
    } finally {
      socket.disconnect();
    }
  });

  it('should handle multiple sequential spins and reflect cumulative balance', async () => {
    const socket = await connectSlots();
    try {
      const results: any[] = [];
      for (let i = 0; i < 3; i++) {
        const r = await emitWithAck<any>(socket, 'slots:spin', {
          betPerLine: 2,
          lines: 5,
        });
        expect(r.ok).toBe(true);
        results.push(r);
      }

      // Each spin has a unique gameId
      const ids = results.map(r => r.gameId);
      expect(new Set(ids).size).toBe(3);

      // Final balance = 1000 - (3 * 10 bet) + sum(payouts)
      await sleep(200);
      const dbBalance = await getBalance(userId);
      const totalWinnings = results.reduce((s, r) => s + r.totalPayout, 0);
      const expected = 1000 - 30 + totalWinnings;
      expect(parseFloat(dbBalance)).toBeCloseTo(expected, 1);
    } finally {
      socket.disconnect();
    }
  });
});
