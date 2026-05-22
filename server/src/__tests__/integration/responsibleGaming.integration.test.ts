// @ts-nocheck
/**
 * Responsible Gaming integration suite.
 *
 * Covers:
 *   - admin PUT /api/admin/user-limits/:userId persists limits and they
 *     round-trip through GET
 *   - userLimitsService.assertCanBet rejects oversized bets, plus a
 *     /landmines socket bet exceeding the per-round limit is rejected
 *   - GET /api/responsible-gaming/activity-summary reflects seeded play
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { startTestServer, type TestServer } from './test-server.js';
import {
  createTestUser,
  createAdminUser,
  createAuthSocket,
  connectSocket,
} from './auth-helper.js';
import {
  getUserIdByUsername,
  setBalance,
  clearGameData,
  clearUserLimits,
  insertTransaction,
} from './db-helper.js';
import { emitWithAck, sleep } from './utils.js';
import userLimitsService from '../../services/userLimitsService.js';

describe('Responsible Gaming Integration', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  }, 30000);

  beforeEach(async () => {
    userLimitsService.invalidate();
    await clearGameData();
    await clearUserLimits();
  });

  it('admin sets per-user limits and they round-trip via GET', async () => {
    const admin = await createAdminUser(server.baseUrl);
    const player = await createTestUser(server.baseUrl);
    const playerId = (await getUserIdByUsername(player.username))!;

    const putRes = await fetch(`${server.baseUrl}/api/admin/user-limits/${playerId}`, {
      method: 'PUT',
      headers: { cookie: admin.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxBetPerRound: 50, maxLossPerDay: 200 }),
    });
    expect(putRes.status).toBe(200);

    const getRes = await fetch(`${server.baseUrl}/api/admin/user-limits/${playerId}`, {
      headers: { cookie: admin.cookie },
    });
    expect(getRes.status).toBe(200);
    const body = await getRes.json();
    expect(Number(body.maxBetPerRound)).toBe(50);
    expect(Number(body.maxLossPerDay)).toBe(200);
  });

  it('userLimitsService.assertCanBet rejects an over-limit single bet', async () => {
    const player = await createTestUser(server.baseUrl);
    const playerId = (await getUserIdByUsername(player.username))!;

    await userLimitsService.setLimits(playerId, { maxBetPerRound: 25 }, null);
    userLimitsService.invalidate(playerId);

    const ok = await userLimitsService.assertCanBet(playerId, 10, 'crash');
    expect(ok.ok).toBe(true);

    const blocked = await userLimitsService.assertCanBet(playerId, 100, 'crash');
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe('bet_too_large');
  });

  it('a /landmines socket bet that exceeds the per-round limit is rejected at the socket layer', async () => {
    const player = await createTestUser(server.baseUrl);
    const playerId = (await getUserIdByUsername(player.username))!;
    await setBalance(playerId, '1000');

    // Per-round limit of 50 — any bet > 50 must be blocked before the game starts.
    await userLimitsService.setLimits(playerId, { maxBetPerRound: 50 }, null);
    userLimitsService.invalidate(playerId);

    const socket = createAuthSocket(server.baseUrl, '/landmines', player.cookie);
    await connectSocket(socket);
    await sleep(500); // landmines handler is initialised per-connection via dynamic import.
    try {
      const result = await emitWithAck<any>(socket, 'landmines:start', {
        betAmount: 500, // > 50
        mines: 3,
      });
      expect(result.success).toBe(false);
      expect(String(result.error || '')).toMatch(/blocked|limit|bet_too_large/i);
    } finally {
      socket.disconnect();
    }
  });

  it('activity-summary endpoint returns aggregated win/loss totals for the authed user', async () => {
    const player = await createTestUser(server.baseUrl);
    const playerId = (await getUserIdByUsername(player.username))!;

    // Seed two recent game transactions so the aggregate query has something
    // to sum within the 7-day / 30-day windows.
    await insertTransaction({ userId: playerId, type: 'game_win', amount: 100, gameType: 'crash' });
    await insertTransaction({ userId: playerId, type: 'game_loss', amount: 30, gameType: 'crash' });

    const res = await fetch(`${server.baseUrl}/api/responsible-gaming/activity-summary`, {
      headers: { cookie: player.cookie },
    });
    expect(res.status).toBe(200);

    const body = await res.json();

    // Shape: two windows, each with totalGames / totalWins / totalLosses / netResult.
    expect(body).toHaveProperty('last7Days');
    expect(body).toHaveProperty('last30Days');
    for (const key of ['last7Days', 'last30Days'] as const) {
      expect(body[key]).toHaveProperty('totalGames');
      expect(body[key]).toHaveProperty('totalWins');
      expect(body[key]).toHaveProperty('totalLosses');
      expect(body[key]).toHaveProperty('netResult');
      expect(typeof body[key].totalGames).toBe('number');
      expect(typeof body[key].totalWins).toBe('number');
      expect(typeof body[key].totalLosses).toBe('number');
      expect(typeof body[key].netResult).toBe('number');
    }

    // Values: 2 transactions seeded, 100 win + 30 loss, net = 70.
    expect(body.last7Days.totalGames).toBe(2);
    expect(body.last7Days.totalWins).toBe(100);
    expect(body.last7Days.totalLosses).toBe(30);
    expect(body.last7Days.netResult).toBe(70);

    expect(body.last30Days.totalGames).toBe(2);
    expect(body.last30Days.totalWins).toBe(100);
    expect(body.last30Days.totalLosses).toBe(30);
    expect(body.last30Days.netResult).toBe(70);
  });

  it('activity-summary requires authentication (401 without cookie)', async () => {
    const res = await fetch(`${server.baseUrl}/api/responsible-gaming/activity-summary`);
    expect(res.status).toBe(401);
  });
});
