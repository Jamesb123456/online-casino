// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestServer, stopTestServer, type TestServer } from '../test-server.js';
import { createTestUser, createAuthSocket, connectSocket } from '../auth-helper.js';
import { setBalance, getBalance, getTransactions, getUserIdByUsername, clearGameData } from '../db-helper.js';
import { emitWithAck, sleep } from '../utils.js';
import type { Socket } from 'socket.io-client';

describe('Plinko Integration', () => {
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

  afterAll(async () => {
    
  });

  beforeEach(async () => {
    await setBalance(userId, '1000.00');
    await clearGameData();
  });

  async function connectPlinko(): Promise<Socket> {
    const socket = createAuthSocket(server.baseUrl, '/plinko', cookie);
    await connectSocket(socket);
    // Wait for per-connection handler to be initialized via dynamic import
    await sleep(500);
    return socket;
  }

  it('should drop ball and receive instant result with balance update', async () => {
    const socket = await connectPlinko();
    try {
      const result = await emitWithAck<any>(socket, 'plinko:drop_ball', {
        betAmount: 50,
        risk: 'medium',
        rows: 16,
      });

      expect(result.success).toBe(true);
      expect(result.gameId).toBeDefined();
      expect(result.path).toBeDefined();
      expect(Array.isArray(result.path)).toBe(true);
      expect(result.multiplier).toBeGreaterThanOrEqual(0);
      expect(result.winAmount).toBeGreaterThanOrEqual(0);
      expect(typeof result.profit).toBe('number');
      expect(typeof result.balance).toBe('number');

      // Verify DB balance
      await sleep(100);
      const dbBalance = await getBalance(userId);
      const expected = 1000 - 50 + result.winAmount;
      expect(parseFloat(dbBalance)).toBeCloseTo(expected, 1);
    } finally {
      socket.disconnect();
    }
  });

  it('should work with different risk levels', async () => {
    const socket = await connectPlinko();
    try {
      for (const risk of ['low', 'medium', 'high']) {
        await setBalance(userId, '1000.00');

        const result = await emitWithAck<any>(socket, 'plinko:drop_ball', {
          betAmount: 10,
          risk,
          rows: 12,
        });

        expect(result.success).toBe(true);
        expect(result.multiplier).toBeGreaterThanOrEqual(0);
        expect(result.path.length).toBeGreaterThan(0);
      }
    } finally {
      socket.disconnect();
    }
  });

  it('should reject bet with insufficient balance', async () => {
    await setBalance(userId, '10.00');
    const socket = await connectPlinko();
    try {
      const result = await emitWithAck<any>(socket, 'plinko:drop_ball', {
        betAmount: 50,
        risk: 'low',
        rows: 16,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/insufficient/i);

      // Balance unchanged
      const dbBalance = await getBalance(userId);
      expect(parseFloat(dbBalance)).toBe(10);
    } finally {
      socket.disconnect();
    }
  });

  it('should create transaction records', async () => {
    const socket = await connectPlinko();
    try {
      const result = await emitWithAck<any>(socket, 'plinko:drop_ball', {
        betAmount: 100,
        risk: 'medium',
        rows: 16,
      });

      expect(result.success).toBe(true);
      await sleep(200);

      const transactions = await getTransactions(userId);
      // Should have at least a bet transaction
      expect(transactions.length).toBeGreaterThanOrEqual(1);

      const betTx = transactions.find(t => t.type === 'game_loss');
      expect(betTx).toBeDefined();
    } finally {
      socket.disconnect();
    }
  });

  it('should handle multiple sequential drops', async () => {
    const socket = await connectPlinko();
    try {
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await emitWithAck<any>(socket, 'plinko:drop_ball', {
          betAmount: 10,
          risk: 'low',
          rows: 8,
        });
        expect(result.success).toBe(true);
        results.push(result);
      }

      // Each result should have a unique gameId
      const gameIds = results.map(r => r.gameId);
      expect(new Set(gameIds).size).toBe(3);

      // Final balance should reflect all 3 games
      await sleep(100);
      const dbBalance = await getBalance(userId);
      const totalWinnings = results.reduce((sum, r) => sum + r.winAmount, 0);
      const expected = 1000 - 30 + totalWinnings;
      expect(parseFloat(dbBalance)).toBeCloseTo(expected, 1);
    } finally {
      socket.disconnect();
    }
  });
});
