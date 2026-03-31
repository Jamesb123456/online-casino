// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestServer, stopTestServer, type TestServer } from '../test-server.js';
import { createTestUser, createAuthSocket, connectSocket } from '../auth-helper.js';
import { setBalance, getBalance, getTransactions, getUserIdByUsername, clearGameData } from '../db-helper.js';
import { waitForEvent, emitWithAck, sleep } from '../utils.js';
import type { Socket } from 'socket.io-client';

describe('Roulette Integration', () => {
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

  async function connectRoulette(): Promise<Socket> {
    const socket = createAuthSocket(server.baseUrl, '/roulette', cookie);
    await connectSocket(socket);
    return socket;
  }

  /**
   * Wait for the betting phase to start. The roulette game loops automatically.
   */
  async function waitForBettingPhase(socket: Socket): Promise<void> {
    // We may connect mid-round. Wait for bettingStart event.
    await waitForEvent(socket, 'bettingStart', 20000);
  }

  it('should place bet on RED and receive result', async () => {
    const socket = await connectRoulette();
    try {
      await waitForBettingPhase(socket);

      // Place bet on RED
      const betResult = await emitWithAck<any>(socket, 'roulette:place_bet', {
        type: 'RED',
        amount: 50,
      });
      expect(betResult.success).toBe(true);

      // Wait for personal result (includes payout info)
      const personalResult = await waitForEvent<any>(socket, 'roulette:personal_result', 30000);
      expect(personalResult).toBeDefined();
      expect(personalResult.bets).toBeDefined();
      expect(typeof personalResult.totalWinnings).toBe('number');
      expect(typeof personalResult.totalProfit).toBe('number');

      // Verify DB balance
      await sleep(200);
      const dbBalance = await getBalance(userId);
      const bal = parseFloat(dbBalance);

      if (personalResult.totalWinnings > 0) {
        // Won: balance = 1000 - 50 + totalWinnings
        expect(bal).toBeCloseTo(950 + personalResult.totalWinnings, 1);
      } else {
        // Lost: balance = 1000 - 50
        expect(bal).toBe(950);
      }
    } finally {
      socket.disconnect();
    }
  });

  it('should place multiple bets in the same round', async () => {
    const socket = await connectRoulette();
    try {
      await waitForBettingPhase(socket);

      // Bet on RED
      const bet1 = await emitWithAck<any>(socket, 'roulette:place_bet', {
        type: 'RED',
        amount: 25,
      });
      expect(bet1.success).toBe(true);

      // Bet on ODD
      const bet2 = await emitWithAck<any>(socket, 'roulette:place_bet', {
        type: 'ODD',
        amount: 25,
      });
      expect(bet2.success).toBe(true);

      // Wait for personal result
      const personalResult = await waitForEvent<any>(socket, 'roulette:personal_result', 30000);
      expect(personalResult.bets.length).toBeGreaterThanOrEqual(2);

      // Verify balance is consistent
      await sleep(200);
      const dbBalance = await getBalance(userId);
      const bal = parseFloat(dbBalance);
      const expected = 1000 - 50 + personalResult.totalWinnings;
      expect(bal).toBeCloseTo(expected, 1);
    } finally {
      socket.disconnect();
    }
  });

  it('should reject bet when betting is closed', async () => {
    const socket = await connectRoulette();
    try {
      await waitForBettingPhase(socket);

      // Wait for betting to end
      await waitForEvent(socket, 'bettingEnd', 15000);

      // Try to bet during spin phase
      const result = await emitWithAck<any>(socket, 'roulette:place_bet', {
        type: 'RED',
        amount: 50,
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/closed/i);
    } finally {
      socket.disconnect();
    }
  });

  it('should reject bet with insufficient balance', async () => {
    await setBalance(userId, '10.00');
    const socket = await connectRoulette();
    try {
      await waitForBettingPhase(socket);

      const result = await emitWithAck<any>(socket, 'roulette:place_bet', {
        type: 'RED',
        amount: 50,
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/insufficient|balance/i);
    } finally {
      socket.disconnect();
    }
  });

  it('should emit spin result with winning number', async () => {
    const socket = await connectRoulette();
    try {
      await waitForBettingPhase(socket);

      // Place a bet to participate
      await emitWithAck<any>(socket, 'roulette:place_bet', {
        type: 'RED',
        amount: 10,
      });

      // Wait for spin result
      const spinResult = await waitForEvent<any>(socket, 'roulette:spin_result', 30000);
      expect(spinResult).toBeDefined();
      expect(typeof spinResult.winningNumber).toBe('number');
      expect(spinResult.winningNumber).toBeGreaterThanOrEqual(0);
      expect(spinResult.winningNumber).toBeLessThanOrEqual(36);
      expect(spinResult.winningColor).toBeDefined();
    } finally {
      socket.disconnect();
    }
  });

  it('should create transaction records', async () => {
    const socket = await connectRoulette();
    try {
      await waitForBettingPhase(socket);

      await emitWithAck<any>(socket, 'roulette:place_bet', {
        type: 'RED',
        amount: 100,
      });

      // Wait for full round to complete
      await waitForEvent<any>(socket, 'roulette:personal_result', 30000);

      await sleep(300);
      const transactions = await getTransactions(userId);
      expect(transactions.length).toBeGreaterThanOrEqual(1);

      // Verify at least one transaction recorded
      expect(transactions.length).toBeGreaterThanOrEqual(1);
    } finally {
      socket.disconnect();
    }
  });
});
