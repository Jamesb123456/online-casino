// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestServer } from '../test-server.js';
import { createTestUser, createAuthSocket, connectSocket } from '../auth-helper.js';
import { setBalance, getBalance, getTransactions, getUserIdByUsername } from '../db-helper.js';
import { waitForEvent, sleep } from '../utils.js';
import type { Socket } from 'socket.io-client';

describe('Blackjack Integration', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  }, 30000);

  afterAll(async () => {});

  // Create a fresh user per test to avoid in-memory game state conflicts
  async function createFreshUser() {
    const user = await createTestUser(server.baseUrl);
    const userId = (await getUserIdByUsername(user.username))!;
    await setBalance(userId, '1000.00');
    return { cookie: user.cookie, username: user.username, userId };
  }

  async function connectBlackjack(cookie: string): Promise<Socket> {
    const socket = createAuthSocket(server.baseUrl, '/blackjack', cookie);
    await connectSocket(socket);
    return socket;
  }

  it('should complete a full game: start -> stand -> verify balance', async () => {
    const { cookie, userId } = await createFreshUser();
    const socket = await connectBlackjack(cookie);
    try {
      // Place bet
      socket.emit('blackjack_start', { betAmount: 100 });

      // Wait for initial game state (deal)
      const state = await waitForEvent<any>(socket, 'blackjack_game_state');
      expect(state.status).toBe('active');
      expect(state.playerHand.length).toBe(2);
      expect(state.dealerHand.length).toBeGreaterThanOrEqual(1);
      expect(state.betAmount).toBe(100);

      // Stand -- triggers dealer play and game end
      socket.emit('blackjack_stand');

      // Wait for completed game state
      const result = await waitForEvent<any>(socket, 'blackjack_game_state');
      expect(result.status).toBe('completed');
      expect(['player_win', 'dealer_win', 'push', 'blackjack', 'player_bust']).toContain(result.result);

      // Verify DB balance matches expected outcome
      await sleep(200);
      const dbBalance = await getBalance(userId);
      const bal = parseFloat(dbBalance);

      if (result.result === 'player_win') {
        expect(bal).toBe(1100); // 1000 - 100 + 200
      } else if (result.result === 'blackjack') {
        expect(bal).toBe(1150); // 1000 - 100 + 250
      } else if (result.result === 'push') {
        expect(bal).toBe(1000); // 1000 - 100 + 100
      } else {
        // dealer_win or player_bust
        expect(bal).toBe(900); // 1000 - 100
      }
    } finally {
      socket.disconnect();
    }
  });

  it('should reject bet with insufficient balance', async () => {
    const { cookie, userId } = await createFreshUser();
    await setBalance(userId, '50.00');
    const socket = await connectBlackjack(cookie);
    try {
      socket.emit('blackjack_start', { betAmount: 100 });

      const error = await waitForEvent<any>(socket, 'blackjack_error');
      expect(error.message).toMatch(/insufficient/i);

      // Balance should be unchanged
      const dbBalance = await getBalance(userId);
      expect(parseFloat(dbBalance)).toBe(50);
    } finally {
      socket.disconnect();
    }
  });

  it('should not allow starting a second game while one is active', async () => {
    const { cookie } = await createFreshUser();
    const socket = await connectBlackjack(cookie);
    try {
      socket.emit('blackjack_start', { betAmount: 100 });
      await waitForEvent<any>(socket, 'blackjack_game_state');

      // Try to start another game
      socket.emit('blackjack_start', { betAmount: 100 });
      const error = await waitForEvent<any>(socket, 'blackjack_error');
      expect(error.message).toMatch(/active/i);
    } finally {
      socket.disconnect();
    }
  });

  it('should handle hit action', async () => {
    const { cookie } = await createFreshUser();
    const socket = await connectBlackjack(cookie);
    try {
      socket.emit('blackjack_start', { betAmount: 100 });
      const initialState = await waitForEvent<any>(socket, 'blackjack_game_state');
      expect(initialState.status).toBe('active');

      // Hit once
      socket.emit('blackjack_hit');
      const afterHit = await waitForEvent<any>(socket, 'blackjack_game_state');

      if (afterHit.status === 'completed') {
        // Player busted or got 21
        expect(['player_bust', 'player_win', 'blackjack', 'dealer_win', 'push']).toContain(afterHit.result);
      } else {
        // Still active, player didn't bust
        expect(afterHit.playerHand.length).toBe(3);
        expect(afterHit.status).toBe('active');
      }
    } finally {
      socket.disconnect();
    }
  });

  it('should handle double down', async () => {
    const { cookie, userId } = await createFreshUser();
    await setBalance(userId, '500.00');
    const socket = await connectBlackjack(cookie);
    try {
      socket.emit('blackjack_start', { betAmount: 100 });
      const initialState = await waitForEvent<any>(socket, 'blackjack_game_state');
      expect(initialState.status).toBe('active');
      expect(initialState.canDouble).toBe(true);

      // Double down
      socket.emit('blackjack_double');
      const result = await waitForEvent<any>(socket, 'blackjack_game_state');

      // After double, game should complete
      expect(result.status).toBe('completed');
    } finally {
      socket.disconnect();
    }
  });

  it('should create transaction records', async () => {
    const { cookie, userId } = await createFreshUser();
    const socket = await connectBlackjack(cookie);
    try {
      socket.emit('blackjack_start', { betAmount: 100 });
      await waitForEvent<any>(socket, 'blackjack_game_state');

      socket.emit('blackjack_stand');
      const result = await waitForEvent<any>(socket, 'blackjack_game_state');
      expect(result.status).toBe('completed');

      await sleep(300);
      const transactions = await getTransactions(userId);
      expect(transactions.length).toBeGreaterThanOrEqual(1);
    } finally {
      socket.disconnect();
    }
  });
});
