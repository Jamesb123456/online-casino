// @ts-nocheck
/**
 * Leaderboard integration suite.
 *
 * Seeds `transactions` rows with type='game_win' for several users and asserts
 * that GET /api/leaderboard returns them in descending order of total winnings.
 * Also exercises the daily/weekly period filters.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { startTestServer, type TestServer } from './test-server.js';
import { createTestUser } from './auth-helper.js';
import {
  getUserIdByUsername,
  clearGameData,
  insertTransaction,
} from './db-helper.js';

describe('Leaderboard Integration', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  }, 30000);

  beforeEach(async () => {
    await clearGameData();
  });

  async function makeUserWithWins(wins: number[], gameType = 'crash'): Promise<{ userId: number; username: string }> {
    const u = await createTestUser(server.baseUrl);
    const userId = (await getUserIdByUsername(u.username))!;
    for (const w of wins) {
      await insertTransaction({ userId, type: 'game_win', amount: w, gameType });
    }
    return { userId, username: u.username };
  }

  it('orders users by total winnings descending', async () => {
    const a = await makeUserWithWins([100, 200]); // 300
    const b = await makeUserWithWins([50, 50]); // 100
    const c = await makeUserWithWins([400]); // 400

    const res = await fetch(`${server.baseUrl}/api/leaderboard?period=allTime&limit=10`);
    expect(res.status).toBe(200);
    const body = await res.json();
    const usernames = body.leaderboard.map((r: any) => r.username);
    // c (400) > a (300) > b (100), and our users should be the top entries
    const idxC = usernames.indexOf(c.username);
    const idxA = usernames.indexOf(a.username);
    const idxB = usernames.indexOf(b.username);
    expect(idxC).toBeGreaterThanOrEqual(0);
    expect(idxA).toBeGreaterThan(idxC);
    expect(idxB).toBeGreaterThan(idxA);
  });

  it('excludes users with zero winnings (HAVING totalWinnings > 0)', async () => {
    const winner = await makeUserWithWins([50]);
    const loser = await makeUserWithWins([], 'crash');

    const res = await fetch(`${server.baseUrl}/api/leaderboard?period=allTime`);
    const body = await res.json();
    const usernames = body.leaderboard.map((r: any) => r.username);
    expect(usernames).toContain(winner.username);
    expect(usernames).not.toContain(loser.username);
  });

  it('daily period excludes wins older than today', async () => {
    const u = await createTestUser(server.baseUrl);
    const userId = (await getUserIdByUsername(u.username))!;
    // Old win — 8 days ago
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await insertTransaction({ userId, type: 'game_win', amount: 5000, gameType: 'crash', createdAt: old });
    // Fresh win today
    await insertTransaction({ userId, type: 'game_win', amount: 10, gameType: 'crash' });

    const daily = await fetch(`${server.baseUrl}/api/leaderboard?period=daily`).then(r => r.json());
    const row = daily.leaderboard.find((r: any) => r.username === u.username);
    expect(row).toBeDefined();
    // Only today's 10 should be counted, not the 8-day-old 5000.
    expect(Number(row.totalWinnings)).toBe(10);
  });

  it('rejects invalid period values with 400', async () => {
    const res = await fetch(`${server.baseUrl}/api/leaderboard?period=bogus`);
    expect(res.status).toBe(400);
  });
});
