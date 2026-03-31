// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestServer, stopTestServer, type TestServer } from '../test-server.js';
import { createTestUser, createAuthSocket, connectSocket } from '../auth-helper.js';
import { setBalance, getBalance, getTransactions, getUserIdByUsername, clearGameData } from '../db-helper.js';
import { waitForEvent, emitWithAck, sleep } from '../utils.js';
import type { Socket } from 'socket.io-client';

describe('Wheel Integration', () => {
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

  async function connectWheel(): Promise<Socket> {
    const socket = createAuthSocket(server.baseUrl, '/wheel', cookie);
    await connectSocket(socket);
    return socket;
  }

  /**
   * Wait for the betting phase to start.
   */
  async function waitForBettingPhase(socket: Socket): Promise<void> {
    await waitForEvent(socket, 'gameStarting', 20000);
  }

  it('should place bet and receive result with multiplier', async () => {
    const socket = await connectWheel();
    try {
      await waitForBettingPhase(socket);

      const betResult = await emitWithAck<any>(socket, 'wheel:place_bet', {
        betAmount: 100,
      });
      expect(betResult.success).toBe(true);

      // Wait for personal result
      const personalResult = await waitForEvent<any>(socket, 'wheel:personal_result', 20000);
      expect(personalResult).toBeDefined();
      expect(personalResult.betAmount).toBe(100);
      expect(typeof personalResult.multiplier).toBe('number');
      expect(personalResult.multiplier).toBeGreaterThanOrEqual(0);
      expect(typeof personalResult.winAmount).toBe('number');
      expect(typeof personalResult.profit).toBe('number');

      // Verify DB balance
      await sleep(200);
      const dbBalance = await getBalance(userId);
      const bal = parseFloat(dbBalance);
      const expected = 900 + personalResult.winAmount;
      expect(bal).toBeCloseTo(expected, 1);
    } finally {
      socket.disconnect();
    }
  });

  it('should not allow betting twice in the same round', async () => {
    const socket = await connectWheel();
    try {
      await waitForBettingPhase(socket);

      const first = await emitWithAck<any>(socket, 'wheel:place_bet', {
        betAmount: 50,
      });
      expect(first.success).toBe(true);

      const second = await emitWithAck<any>(socket, 'wheel:place_bet', {
        betAmount: 50,
      });
      expect(second.success).toBe(false);
      expect(second.error).toMatch(/already/i);
    } finally {
      socket.disconnect();
    }
  });

  it('should reject bet when betting is closed', async () => {
    const socket = await connectWheel();
    try {
      await waitForBettingPhase(socket);

      // Wait for the spin to start (betting phase ends)
      await waitForEvent(socket, 'wheelSpinning', 15000);

      const result = await emitWithAck<any>(socket, 'wheel:place_bet', {
        betAmount: 50,
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/closed/i);
    } finally {
      socket.disconnect();
    }
  });

  it('should reject bet with insufficient balance', async () => {
    await setBalance(userId, '10.00');
    const socket = await connectWheel();
    try {
      await waitForBettingPhase(socket);

      const result = await emitWithAck<any>(socket, 'wheel:place_bet', {
        betAmount: 100,
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/insufficient|balance/i);
    } finally {
      socket.disconnect();
    }
  });

  it('should emit game result with segment info', async () => {
    const socket = await connectWheel();
    try {
      await waitForBettingPhase(socket);

      await emitWithAck<any>(socket, 'wheel:place_bet', {
        betAmount: 10,
      });

      const gameResult = await waitForEvent<any>(socket, 'wheel:game_result', 20000);
      expect(gameResult).toBeDefined();
      expect(typeof gameResult.segmentIndex).toBe('number');
      expect(typeof gameResult.multiplier).toBe('number');
      expect(gameResult.color).toBeDefined();
    } finally {
      socket.disconnect();
    }
  });

  it('should create transaction records', async () => {
    const socket = await connectWheel();
    try {
      await waitForBettingPhase(socket);

      await emitWithAck<any>(socket, 'wheel:place_bet', {
        betAmount: 100,
      });

      // Wait for round to complete
      await waitForEvent<any>(socket, 'wheel:personal_result', 20000);

      await sleep(300);
      const transactions = await getTransactions(userId);
      expect(transactions.length).toBeGreaterThanOrEqual(1);

      // Verify at least one transaction exists for this user
      expect(transactions.length).toBeGreaterThanOrEqual(1);
    } finally {
      socket.disconnect();
    }
  });

  it('should handle multiple rounds', async () => {
    const socket = await connectWheel();
    try {
      // Play round 1
      await waitForBettingPhase(socket);
      await emitWithAck<any>(socket, 'wheel:place_bet', { betAmount: 50 });
      const result1 = await waitForEvent<any>(socket, 'wheel:personal_result', 20000);

      // Play round 2
      await waitForBettingPhase(socket);
      await emitWithAck<any>(socket, 'wheel:place_bet', { betAmount: 50 });
      const result2 = await waitForEvent<any>(socket, 'wheel:personal_result', 20000);

      // Verify final balance reflects both rounds
      await sleep(200);
      const dbBalance = await getBalance(userId);
      const bal = parseFloat(dbBalance);
      const expected = 1000 - 100 + result1.winAmount + result2.winAmount;
      expect(bal).toBeCloseTo(expected, 1);
    } finally {
      socket.disconnect();
    }
  });
});
