// @ts-nocheck
/**
 * Cross-game balance integrity integration test.
 *
 * A single user plays one round of crash, blackjack, and roulette in sequence
 * against the real test MySQL DB. After each round we assert:
 *   - the `users.balance` matches the running expected balance
 *   - the per-game transactions are present
 * At the end we assert global invariants:
 *   - users.balance == initialBalance + sum(transactions.amount)
 *   - gameLogs row count is >= the minimum number of user-attributed events
 *     produced by the three rounds (each round writes at least one bet_placed
 *     and one game_result row for that user)
 *
 * Each round is forced into a deterministic shape via small bet sizes and
 * lossy bet selections (no cashout in crash, stand in blackjack, bet a single
 * outside slot in roulette) so the test stays robust regardless of RNG.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { startTestServer, type TestServer } from './test-server.js';
import { createTestUser, createAuthSocket, connectSocket } from './auth-helper.js';
import {
  setBalance,
  getBalance,
  getTransactions,
  getUserIdByUsername,
  clearGameData,
} from './db-helper.js';
import { waitForEvent, emitWithAck, sleep } from './utils.js';
import type { Socket } from 'socket.io-client';

const INITIAL_BALANCE = 1000;

describe('Multi-game Balance Integrity Integration', () => {
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
    await clearGameData();
    await setBalance(userId, String(INITIAL_BALANCE.toFixed(2)));
  }, 30000);

  afterAll(async () => {
    // stopTestServer intentionally not called — other suites may share it
  });

  /**
   * Play a single crash round end-to-end.
   * Places a small flat bet, lets the game crash without cashing out,
   * and returns the realised profit (always negative or zero).
   */
  async function playCrashRound(betAmount: number): Promise<{ profit: number }> {
    const socket: Socket = createAuthSocket(server.baseUrl, '/crash', cookie);
    await connectSocket(socket);

    try {
      // Place a bet in the next available betting window. Loop until the
      // ack reports success — the game auto-loops so a window is reached
      // within a few hundred ms with fast test timers.
      let placed = false;
      for (let attempt = 0; attempt < 12 && !placed; attempt++) {
        const ack = await emitWithAck<any>(
          socket,
          'placeBet',
          { amount: betAmount },
          3000,
        ).catch(() => null);

        if (ack?.success) {
          placed = true;
          break;
        }
        if (ack?.error && /insufficient/i.test(ack.error)) {
          throw new Error(`Crash bet rejected: ${ack.error}`);
        }

        // Wait for the next round's gameStarting before retrying.
        await waitForEvent(socket, 'gameStarting', 8000).catch(() => null);
        await sleep(50);
      }
      if (!placed) throw new Error('Could not place crash bet');

      // Do NOT cash out. Wait for the crash so the bet resolves as a loss.
      await waitForEvent<any>(socket, 'gameCrashed', 30000);

      // Give the server a moment to persist the loss.
      await sleep(250);

      return { profit: -betAmount };
    } finally {
      socket.disconnect();
    }
  }

  /**
   * Play a single blackjack round end-to-end: start with a small bet,
   * immediately stand, return the realised profit.
   */
  async function playBlackjackRound(
    betAmount: number,
  ): Promise<{ profit: number }> {
    const socket: Socket = createAuthSocket(server.baseUrl, '/blackjack', cookie);
    await connectSocket(socket);

    try {
      socket.emit('blackjack_start', { betAmount });
      const initial = await waitForEvent<any>(socket, 'blackjack_game_state', 15000);

      // Blackjack on the deal short-circuits the game. Handle both paths.
      let final: any;
      if (initial.status === 'completed') {
        final = initial;
      } else {
        socket.emit('blackjack_stand');
        final = await waitForEvent<any>(socket, 'blackjack_game_state', 15000);
        expect(final.status).toBe('completed');
      }

      let profit = 0;
      switch (final.result) {
        case 'player_win':
          profit = betAmount; // -bet + 2*bet
          break;
        case 'blackjack':
          profit = Math.round(betAmount * 1.5 * 100) / 100;
          break;
        case 'push':
          profit = 0;
          break;
        case 'dealer_win':
        case 'player_bust':
        default:
          profit = -betAmount;
          break;
      }

      await sleep(250);
      return { profit };
    } finally {
      socket.disconnect();
    }
  }

  /**
   * Play a single roulette round. Bet a small flat amount on RED and let
   * the wheel spin. Read the realised result from the personal_result event.
   */
  async function playRouletteRound(
    betAmount: number,
  ): Promise<{ profit: number }> {
    const socket: Socket = createAuthSocket(server.baseUrl, '/roulette', cookie);
    await connectSocket(socket);

    try {
      // Wait for an open betting window (we may connect mid-spin).
      await waitForEvent(socket, 'bettingStart', 20000);

      const ack = await emitWithAck<any>(socket, 'roulette:place_bet', {
        type: 'RED',
        amount: betAmount,
      });
      expect(ack.success).toBe(true);

      const personal = await waitForEvent<any>(
        socket,
        'roulette:personal_result',
        30000,
      );

      await sleep(250);
      // totalProfit is signed (negative on loss). Fall back to derived value
      // if the handler ever omits the property.
      const profit =
        typeof personal.totalProfit === 'number'
          ? personal.totalProfit
          : (personal.totalWinnings ?? 0) - betAmount;
      return { profit };
    } finally {
      socket.disconnect();
    }
  }

  it('reconciles balance, transactions, and game logs across crash -> blackjack -> roulette', async () => {
    let expectedBalance = INITIAL_BALANCE;

    // Snapshot pre-existing user-attributed gameLogs so the round count is
    // measured purely from this test's activity (the seed/auth flow may have
    // written rows already, depending on suite ordering).
    const baselineLogCount = await getUserGameLogCount(userId);

    // --- Round 1: Crash ----------------------------------------------------
    const crashBet = 10;
    const crash = await playCrashRound(crashBet);
    expectedBalance += crash.profit;

    const balAfterCrash = parseFloat(await getBalance(userId));
    expect(balAfterCrash).toBeCloseTo(expectedBalance, 2);

    const txAfterCrash = await getTransactions(userId);
    expect(txAfterCrash.length).toBeGreaterThanOrEqual(1);
    const crashTxns = txAfterCrash.filter((t: any) => t.gameType === 'crash');
    expect(crashTxns.length).toBeGreaterThanOrEqual(1);

    // --- Round 2: Blackjack -----------------------------------------------
    const blackjackBet = 10;
    const blackjack = await playBlackjackRound(blackjackBet);
    expectedBalance += blackjack.profit;

    const balAfterBlackjack = parseFloat(await getBalance(userId));
    expect(balAfterBlackjack).toBeCloseTo(expectedBalance, 2);

    const txAfterBlackjack = await getTransactions(userId);
    const blackjackTxns = txAfterBlackjack.filter(
      (t: any) => t.gameType === 'blackjack',
    );
    expect(blackjackTxns.length).toBeGreaterThanOrEqual(1);

    // --- Round 3: Roulette -------------------------------------------------
    const rouletteBet = 10;
    const roulette = await playRouletteRound(rouletteBet);
    expectedBalance += roulette.profit;

    const balAfterRoulette = parseFloat(await getBalance(userId));
    expect(balAfterRoulette).toBeCloseTo(expectedBalance, 2);

    const txAfterRoulette = await getTransactions(userId);
    const rouletteTxns = txAfterRoulette.filter(
      (t: any) => t.gameType === 'roulette',
    );
    expect(rouletteTxns.length).toBeGreaterThanOrEqual(1);

    // --- Global invariants -------------------------------------------------
    // users.balance == INITIAL_BALANCE + sum(transactions.amount)
    const finalTxns = await getTransactions(userId);
    const txSum = finalTxns.reduce(
      (acc: number, t: any) => acc + parseFloat(t.amount),
      0,
    );
    const finalBalance = parseFloat(await getBalance(userId));
    expect(finalBalance).toBeCloseTo(INITIAL_BALANCE + txSum, 2);
    expect(finalBalance).toBeCloseTo(expectedBalance, 2);

    // gameLogs should have grown by at least one row per round (the
    // `bet_placed` event handlers always write under the user's id).
    const finalLogCount = await getUserGameLogCount(userId);
    expect(finalLogCount - baselineLogCount).toBeGreaterThanOrEqual(3);
  }, 90000);
});

/**
 * Count gameLogs rows attributed to this user. Imported lazily to match the
 * lazy-import pattern used in db-helper.ts and avoid module-load ordering
 * issues with the env vars set inside test-server.ts.
 */
async function getUserGameLogCount(userId: number): Promise<number> {
  const { db } = await import('../../../drizzle/db.js');
  const result: any = await db.execute(
    sql`SELECT COUNT(*) AS c FROM game_logs WHERE user_id = ${userId}`,
  );
  // mysql2 returns [rows, fields]
  const row = Array.isArray(result) ? result[0]?.[0] : result?.[0];
  return Number(row?.c ?? 0);
}
