// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestServer, type TestServer } from '../test-server.js';
import { createTestUser, createAuthSocket, connectSocket } from '../auth-helper.js';
import { setBalance, getBalance, getTransactions, getUserIdByUsername, clearGameData } from '../db-helper.js';
import { emitWithAck, sleep } from '../utils.js';
import type { Socket } from 'socket.io-client';

describe('Dice Integration', () => {
  let server: TestServer;
  let cookie: string;
  let username: string;
  let userId: number;

  beforeAll(async () => {
    server = await startTestServer();
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

  async function connectDice(): Promise<Socket> {
    const socket = createAuthSocket(server.baseUrl, '/dice', cookie);
    await connectSocket(socket);
    // Wait for per-connection handler to be initialized via dynamic import
    await sleep(500);
    return socket;
  }

  it('should roll the dice and emit a result with balance and transactions updated', async () => {
    const socket = await connectDice();
    try {
      const result = await emitWithAck<any>(socket, 'dice:roll', {
        betAmount: 100,
        target: 50,
        direction: 'under',
      });

      expect(result.ok).toBe(true);
      expect(result.gameId).toBeDefined();
      expect(typeof result.result).toBe('number');
      expect(result.target).toBe(50);
      expect(result.direction).toBe('under');
      expect(typeof result.win).toBe('boolean');
      expect(result.multiplier).toBeGreaterThanOrEqual(0);
      expect(result.winAmount).toBeGreaterThanOrEqual(0);
      expect(typeof result.newBalance).toBe('number');

      // Wait for DB writes to flush
      await sleep(200);

      // Verify DB balance reflects bet - winnings
      const dbBalance = await getBalance(userId);
      const expected = 1000 - 100 + result.winAmount;
      expect(parseFloat(dbBalance)).toBeCloseTo(expected, 1);

      // Transactions: at minimum a bet row (game_loss). If won, also a game_win row.
      const transactions = await getTransactions(userId);
      const betTx = transactions.find((t: any) => t.type === 'game_loss' && t.gameType === 'dice');
      expect(betTx).toBeDefined();
      expect(parseFloat(betTx.amount)).toBe(-100);

      if (result.win && result.winAmount > 0) {
        const winTx = transactions.find((t: any) => t.type === 'game_win' && t.gameType === 'dice');
        expect(winTx).toBeDefined();
        expect(parseFloat(winTx.amount)).toBeCloseTo(result.winAmount, 1);
      }
    } finally {
      socket.disconnect();
    }
  });

  it('should always win when target=99 under (probability ~0.99) and credit a payout', async () => {
    // With target=99 under, win probability is ~99% — over many rolls a single
    // bet is overwhelmingly likely to be a win. We test the win path by retrying
    // until we land on a winning roll (worst case ~1 in 100).
    const socket = await connectDice();
    try {
      let win = false;
      let lastResult: any = null;
      for (let attempt = 0; attempt < 10 && !win; attempt++) {
        await setBalance(userId, '1000.00');
        lastResult = await emitWithAck<any>(socket, 'dice:roll', {
          betAmount: 10,
          target: 99,
          direction: 'under',
        });
        expect(lastResult.ok).toBe(true);
        win = !!lastResult.win;
      }
      expect(win).toBe(true);
      expect(lastResult.winAmount).toBeGreaterThan(0);
      expect(lastResult.multiplier).toBeGreaterThan(0);
    } finally {
      socket.disconnect();
    }
  });

  it('should reject a bet with insufficient balance', async () => {
    await setBalance(userId, '5.00');
    const socket = await connectDice();
    try {
      const result = await emitWithAck<any>(socket, 'dice:roll', {
        betAmount: 100,
        target: 50,
        direction: 'under',
      });

      expect(result.ok).toBe(false);
      expect(String(result.error || '').toLowerCase()).toMatch(/insufficient|balance/);

      // Balance unchanged
      const dbBalance = await getBalance(userId);
      expect(parseFloat(dbBalance)).toBe(5);
    } finally {
      socket.disconnect();
    }
  });

  it('should reject an out-of-range target', async () => {
    const socket = await connectDice();
    try {
      // target=0 is below MIN_TARGET (1) and should fail validation upstream;
      // schema validation throws before the range check, so error mentions the bound.
      const result = await emitWithAck<any>(socket, 'dice:roll', {
        betAmount: 10,
        target: 0,
        direction: 'under',
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();

      // Balance unchanged on rejection
      const dbBalance = await getBalance(userId);
      expect(parseFloat(dbBalance)).toBe(1000);
    } finally {
      socket.disconnect();
    }
  });

  it('should return current balance on dice:join', async () => {
    const socket = await connectDice();
    try {
      const result = await emitWithAck<any>(socket, 'dice:join', {});
      expect(result.success).toBe(true);
      expect(typeof result.balance).toBe('number');
      expect(result.balance).toBe(1000);
      expect(Array.isArray(result.history)).toBe(true);
    } finally {
      socket.disconnect();
    }
  });

  it('should handle multiple sequential rolls and reflect cumulative balance', async () => {
    const socket = await connectDice();
    try {
      const results: any[] = [];
      for (let i = 0; i < 3; i++) {
        const r = await emitWithAck<any>(socket, 'dice:roll', {
          betAmount: 10,
          target: 50,
          direction: 'under',
        });
        expect(r.ok).toBe(true);
        results.push(r);
      }

      // Each roll has a unique gameId
      const ids = results.map(r => r.gameId);
      expect(new Set(ids).size).toBe(3);

      // Final balance reflects all 3 rolls
      await sleep(200);
      const dbBalance = await getBalance(userId);
      const totalWinnings = results.reduce((s, r) => s + r.winAmount, 0);
      const expected = 1000 - 30 + totalWinnings;
      expect(parseFloat(dbBalance)).toBeCloseTo(expected, 1);
    } finally {
      socket.disconnect();
    }
  });
});
