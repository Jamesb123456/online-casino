// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestServer, type TestServer } from '../test-server.js';
import { createTestUser, createAuthSocket, connectSocket } from '../auth-helper.js';
import { setBalance, getBalance, getTransactions, getUserIdByUsername, clearGameData } from '../db-helper.js';
import { waitForEvent, emitWithAck, sleep } from '../utils.js';
import type { Socket } from 'socket.io-client';

describe('Crash Integration', () => {
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

  async function connectCrash(): Promise<Socket> {
    const socket = createAuthSocket(server.baseUrl, '/crash', cookie);
    await connectSocket(socket);
    return socket;
  }

  /**
   * Wait for a betting window. With fast timers (500ms countdown + 500ms next game),
   * the full cycle is about 1-2 seconds plus flight time.
   */
  async function placeBetWhenReady(socket: Socket, amount: number): Promise<any> {
    // Try to place a bet. If the game is running, wait for crash then try again.
    for (let attempt = 0; attempt < 10; attempt++) {
      const result = await emitWithAck<any>(socket, 'placeBet', { amount }, 3000).catch(() => null);
      if (result?.success) return result;
      if (result?.error?.match(/insufficient|balance/i)) return result;
      // Wait for next gameStarting
      await waitForEvent(socket, 'gameStarting', 10000).catch(() => null);
      await sleep(50);
    }
    throw new Error('Could not place bet after 10 attempts');
  }

  it('should place bet and receive balance deduction', async () => {
    const socket = await connectCrash();
    try {
      const result = await placeBetWhenReady(socket, 100);
      expect(result.success).toBe(true);

      // Verify balance was deducted
      await sleep(200);
      const dbBalance = await getBalance(userId);
      expect(parseFloat(dbBalance)).toBe(900);
    } finally {
      socket.disconnect();
    }
  });

  it('should reject bet with insufficient balance', async () => {
    await setBalance(userId, '10.00');
    const socket = await connectCrash();
    try {
      const result = await placeBetWhenReady(socket, 100);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/insufficient|balance/i);
    } finally {
      socket.disconnect();
    }
  });

  it('should reject duplicate bet in same round', async () => {
    const socket = await connectCrash();
    try {
      await placeBetWhenReady(socket, 100);

      // Try immediate second bet (still same round)
      const second = await emitWithAck<any>(socket, 'placeBet', { amount: 100 });
      expect(second.success).toBe(false);
      expect(second.error).toMatch(/already/i);
    } finally {
      socket.disconnect();
    }
  });

  it('should emit game lifecycle events', async () => {
    const socket = await connectCrash();
    try {
      // The crash game auto-loops. We should receive gameCrashed at some point.
      // If we missed the current gameStarting, wait for the next crash then gameStarting.
      const crashed = await waitForEvent<any>(socket, 'gameCrashed', 30000);
      expect(crashed).toBeDefined();
      expect(crashed.crashPoint).toBeGreaterThanOrEqual(1);

      // After crash, a new game starts
      const starting = await waitForEvent<any>(socket, 'gameStarting', 10000);
      expect(starting).toBeDefined();
      expect(starting.gameId).toBeDefined();

      const started = await waitForEvent<any>(socket, 'gameStarted', 10000);
      expect(started).toBeDefined();
    } finally {
      socket.disconnect();
    }
  });
});
