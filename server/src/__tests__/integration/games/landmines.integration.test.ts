// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopTestServer, type TestServer } from '../test-server.js';
import { createTestUser, createAuthSocket, connectSocket } from '../auth-helper.js';
import { setBalance, getBalance, getTransactions, getUserIdByUsername } from '../db-helper.js';
import { emitWithAck, sleep } from '../utils.js';
import type { Socket } from 'socket.io-client';

describe('Landmines Integration', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  }, 30000);

  afterAll(async () => {
    
  });

  // Create a fresh user per test to avoid in-memory session conflicts
  async function createFreshUser() {
    const user = await createTestUser(server.baseUrl);
    const userId = (await getUserIdByUsername(user.username))!;
    await setBalance(userId, '1000.00');
    return { cookie: user.cookie, username: user.username, userId };
  }

  async function connectLandmines(cookie: string): Promise<Socket> {
    const socket = createAuthSocket(server.baseUrl, '/landmines', cookie);
    await connectSocket(socket);
    // Wait for per-connection handler initialization via dynamic import
    await sleep(500);
    return socket;
  }

  it('should start a game and deduct bet from balance', async () => {
    const { cookie, userId } = await createFreshUser();
    const socket = await connectLandmines(cookie);
    try {
      const result = await emitWithAck<any>(socket, 'landmines:start', {
        betAmount: 100,
        mines: 3,
      });

      expect(result.success).toBe(true);
      expect(result.gameId).toBeDefined();
      expect(result.mines).toBe(3);
      expect(result.gridSize).toBe(5);

      // Balance should be deducted
      await sleep(200);
      const dbBalance = await getBalance(userId);
      expect(parseFloat(dbBalance)).toBe(900);
    } finally {
      socket.disconnect();
    }
  });

  it('should pick a cell and get result (safe or mine)', async () => {
    const { cookie, userId } = await createFreshUser();
    const socket = await connectLandmines(cookie);
    try {
      const startResult = await emitWithAck<any>(socket, 'landmines:start', {
        betAmount: 100,
        mines: 3,
      });
      expect(startResult.success).toBe(true);

      // Pick cell (0,0)
      const pickResult = await emitWithAck<any>(socket, 'landmines:pick', {
        row: 0,
        col: 0,
      });

      expect(pickResult.success).toBe(true);

      if (pickResult.hit) {
        // Hit a mine - game over
        expect(pickResult.gameOver).toBe(true);
        expect(pickResult.fullGrid).toBeDefined();
        expect(pickResult.winAmount).toBe(0);
      } else {
        // Safe cell - game continues
        expect(pickResult.gameOver).toBe(false);
        expect(pickResult.multiplier).toBeGreaterThan(0);
        expect(pickResult.potentialWin).toBeGreaterThan(0);
        expect(pickResult.remainingSafeCells).toBeDefined();
      }
    } finally {
      socket.disconnect();
    }
  });

  it('should cash out and credit winnings', async () => {
    const { cookie, userId } = await createFreshUser();
    const socket = await connectLandmines(cookie);
    try {
      await emitWithAck<any>(socket, 'landmines:start', {
        betAmount: 100,
        mines: 1, // Few mines = easier to find safe cells
      });

      // Pick a cell - with only 1 mine, very likely to be safe
      const pickResult = await emitWithAck<any>(socket, 'landmines:pick', {
        row: 0,
        col: 0,
      });

      if (!pickResult.hit) {
        // Safe - cash out
        const cashoutResult = await emitWithAck<any>(socket, 'landmines:cashout', {});
        expect(cashoutResult.success).toBe(true);
        expect(cashoutResult.multiplier).toBeGreaterThan(0);
        expect(cashoutResult.winAmount).toBeGreaterThan(0);
        expect(cashoutResult.cashedOut).toBe(true);

        // Verify DB balance increased
        await sleep(300);
        const dbBalance = await getBalance(userId);
        const bal = parseFloat(dbBalance);
        // Balance should be more than just the deduction (we won)
        expect(bal).toBeGreaterThan(900);
      }
      // If hit mine, that's still a valid test outcome
    } finally {
      socket.disconnect();
    }
  });

  it('should reject starting a second game while one is active', async () => {
    const { cookie } = await createFreshUser();
    const socket = await connectLandmines(cookie);
    try {
      await emitWithAck<any>(socket, 'landmines:start', {
        betAmount: 100,
        mines: 3,
      });

      const second = await emitWithAck<any>(socket, 'landmines:start', {
        betAmount: 100,
        mines: 3,
      });

      expect(second.success).toBe(false);
      expect(second.error).toMatch(/active/i);
    } finally {
      socket.disconnect();
    }
  });

  it('should reject picking an already revealed cell', async () => {
    const { cookie } = await createFreshUser();
    const socket = await connectLandmines(cookie);
    try {
      await emitWithAck<any>(socket, 'landmines:start', {
        betAmount: 100,
        mines: 1,
      });

      const first = await emitWithAck<any>(socket, 'landmines:pick', {
        row: 0,
        col: 0,
      });

      if (!first.hit) {
        // Try to pick the same cell again
        const second = await emitWithAck<any>(socket, 'landmines:pick', {
          row: 0,
          col: 0,
        });

        expect(second.success).toBe(false);
        expect(second.error).toMatch(/already|revealed/i);
      }
    } finally {
      socket.disconnect();
    }
  });

  it('should increase multiplier with each safe reveal', async () => {
    const { cookie } = await createFreshUser();
    const socket = await connectLandmines(cookie);
    try {
      await emitWithAck<any>(socket, 'landmines:start', {
        betAmount: 100,
        mines: 1, // Low mines for easier safe reveals
      });

      const multipliers: number[] = [];
      let row = 0;
      let col = 0;

      // Try picking multiple cells
      for (let i = 0; i < 5; i++) {
        const pick = await emitWithAck<any>(socket, 'landmines:pick', {
          row,
          col,
        });

        if (pick.hit || !pick.success) break; // Hit a mine or error, stop
        if (pick.multiplier !== undefined) {
          multipliers.push(pick.multiplier);
        }

        // Move to next cell
        col++;
        if (col >= 5) {
          col = 0;
          row++;
        }
      }

      // Multipliers should be strictly increasing (if we got more than 1)
      if (multipliers.length >= 2) {
        for (let i = 1; i < multipliers.length; i++) {
          expect(multipliers[i]).toBeGreaterThan(multipliers[i - 1]);
        }
      }
    } finally {
      socket.disconnect();
    }
  });

  it('should reject bet with insufficient balance', async () => {
    const { cookie, userId } = await createFreshUser();
    await setBalance(userId, '10.00');
    const socket = await connectLandmines(cookie);
    try {
      const result = await emitWithAck<any>(socket, 'landmines:start', {
        betAmount: 100,
        mines: 3,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/insufficient|balance/i);
    } finally {
      socket.disconnect();
    }
  });

  it('should create transaction records after cashout', async () => {
    const { cookie, userId } = await createFreshUser();
    const socket = await connectLandmines(cookie);
    try {
      await emitWithAck<any>(socket, 'landmines:start', {
        betAmount: 100,
        mines: 1,
      });

      const pick = await emitWithAck<any>(socket, 'landmines:pick', {
        row: 0,
        col: 0,
      });

      if (!pick.hit) {
        await emitWithAck<any>(socket, 'landmines:cashout', {});
      }

      await sleep(500);
      const transactions = await getTransactions(userId);
      // At minimum: the bet transaction
      expect(transactions.length).toBeGreaterThanOrEqual(1);
    } finally {
      socket.disconnect();
    }
  });
});
