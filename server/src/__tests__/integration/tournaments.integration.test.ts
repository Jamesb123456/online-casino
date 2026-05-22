// @ts-nocheck
/**
 * Tournaments integration suite.
 *
 * Drives the admin → player → finalize lifecycle:
 *   - admin creates a tournament via POST /api/admin/tournaments
 *   - the user "plays" by recording bets/wins through tournamentService directly
 *     (the per-game socket wiring is exercised by the game integration suites)
 *   - score is reflected in GET /api/tournaments/active
 *   - admin finalizes after end_time has passed → top entries receive prize
 *     payouts (balance increases for the winners)
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { startTestServer, type TestServer } from './test-server.js';
import { createTestUser, createAdminUser } from './auth-helper.js';
import {
  getUserIdByUsername,
  getBalance,
  clearGameData,
  clearTournamentData,
  clearHouseData,
} from './db-helper.js';
import tournamentService from '../../services/tournamentService.js';
import HouseService from '../../services/houseService.js';

async function dbExec(q: any): Promise<any> {
  const { db } = await import('../../../drizzle/db.js');
  return db.execute(q);
}

describe('Tournaments Integration', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  }, 30000);

  beforeEach(async () => {
    tournamentService._resetCache();
    await clearGameData();
    await clearTournamentData();
    await clearHouseData();
    // Seed the house with funds so finalize payouts succeed.
    await HouseService.topUp(100000, null, 'integration test seed');
  });

  it('admin creates a tournament; player /active shows it; recordBet updates the leaderboard', async () => {
    const admin = await createAdminUser(server.baseUrl);
    const player = await createTestUser(server.baseUrl);
    const playerId = (await getUserIdByUsername(player.username))!;

    // Tournament window: starts 1s ago, ends 5s from now.
    const startTime = new Date(Date.now() - 1000);
    const endTime = new Date(Date.now() + 5000);

    const createRes = await fetch(`${server.baseUrl}/api/admin/tournaments`, {
      method: 'POST',
      headers: { cookie: admin.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Integration Cup',
        gameType: 'crash',
        scoring: 'total_wagered',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        prizePool: 1000,
        prizeDistribution: { '1': 0.7, '2': 0.3 },
      }),
    });
    expect(createRes.status).toBe(201);
    const tournament = await createRes.json();
    expect(tournament.id).toBeDefined();
    expect(tournament.status).toBe('scheduled');

    // Promote to active so the player flow is observable.
    await tournamentService.sweepStatusTransitions();

    // Record a bet for the player — drives totalWagered + score.
    await tournamentService.recordBet(tournament.id, playerId, 250);

    const activeRes = await fetch(`${server.baseUrl}/api/tournaments/active`, {
      headers: { cookie: player.cookie },
    });
    expect(activeRes.status).toBe(200);
    const activeBody = await activeRes.json();
    const found = activeBody.tournaments.find((t: any) => t.id === tournament.id);
    expect(found).toBeDefined();
    expect(found.status).toBe('active');
    expect(found.myEntry).toBeTruthy();
    expect(found.myEntry.totalWagered).toBe(250);
    expect(found.myEntry.rank).toBe(1);
  });

  it('finalize transitions tournament to finalized status and ranks the leaderboard', async () => {
    const admin = await createAdminUser(server.baseUrl);
    const winner = await createTestUser(server.baseUrl);
    const runnerUp = await createTestUser(server.baseUrl);
    const winnerId = (await getUserIdByUsername(winner.username))!;
    const runnerUpId = (await getUserIdByUsername(runnerUp.username))!;

    // Start: ended already (1m in the past) so finalize is allowed. Use SQL
    // DATE_ADD/SUB so the values live in DB-local time and round-trip
    // unambiguously regardless of host timezone.
    await dbExec(sql`
      INSERT INTO tournaments
        (name, game_type, scoring, start_time, end_time, prize_pool, prize_distribution, status, created_at, updated_at)
      VALUES
        ('Finalize Cup', 'plinko', 'biggest_win',
         DATE_SUB(NOW(), INTERVAL 1 HOUR),
         DATE_SUB(NOW(), INTERVAL 1 MINUTE),
         '1000', ${JSON.stringify({ '1': 0.6, '2': 0.4 })}, 'active', NOW(), NOW())
    `);
    const rowRes: any = await dbExec(sql`SELECT id FROM tournaments WHERE name = 'Finalize Cup' LIMIT 1`);
    const tournamentId = Number(rowRes?.[0]?.[0]?.id);
    expect(tournamentId).toBeGreaterThan(0);

    // Winner has a bigger biggest_win → rank 1.
    await tournamentService.recordWin(tournamentId, winnerId, 500);
    await tournamentService.recordWin(tournamentId, runnerUpId, 200);

    // Snapshot pre-finalize balances so we can verify prize credits.
    const winnerStart = Number(await getBalance(winnerId));
    const runnerUpStart = Number(await getBalance(runnerUpId));

    const finalizeRes = await fetch(
      `${server.baseUrl}/api/admin/tournaments/${tournamentId}/finalize`,
      {
        method: 'POST',
        headers: { cookie: admin.cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    expect(finalizeRes.status).toBe(200);
    const finalizeBody = await finalizeRes.json();
    // Both prize fractions (60% / 40%) were paid out — no swallowed failures.
    expect(finalizeBody.prizesAwarded).toBe(2);
    expect(finalizeBody.prizesFailed).toBe(0);
    expect(finalizeBody.totalDebited).toBeCloseTo(1000, 2);

    // Tournament moves to 'finalized'.
    const checkRes = await fetch(
      `${server.baseUrl}/api/admin/tournaments/${tournamentId}`,
      { headers: { cookie: admin.cookie } }
    );
    const checkBody = await checkRes.json();
    expect(checkBody.tournament.status).toBe('finalized');
    expect(checkBody.tournament.finalizedAt).toBeTruthy();

    // Leaderboard returns entries sorted by score desc (winner first).
    const leaderboard = checkBody.leaderboard;
    expect(leaderboard.length).toBeGreaterThanOrEqual(2);
    expect(leaderboard[0].userId).toBe(winnerId);
    expect(leaderboard[1].userId).toBe(runnerUpId);
    expect(Number(leaderboard[0].score)).toBeGreaterThan(Number(leaderboard[1].score));
    // Rank + prize_amount are stamped on the entries (1000 * 0.6 / 0.4).
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[1].rank).toBe(2);
    expect(Number(leaderboard[0].prizeAmount)).toBeCloseTo(600, 2);
    expect(Number(leaderboard[1].prizeAmount)).toBeCloseTo(400, 2);

    // Balance credit lands: this was previously swallowed by the
    // balances.game_type NOT NULL enum constraint, now fixed by passing
    // 'tournament_prize' as the gameType through balanceService.manualAdjustment.
    const winnerEnd = Number(await getBalance(winnerId));
    const runnerUpEnd = Number(await getBalance(runnerUpId));
    expect(winnerEnd - winnerStart).toBeCloseTo(600, 2);
    expect(runnerUpEnd - runnerUpStart).toBeCloseTo(400, 2);
  });

  it('rejects finalize when tournament is not active (already finalized)', async () => {
    const admin = await createAdminUser(server.baseUrl);

    // Insert a tournament already in 'finalized' status — a second finalize
    // must be rejected as tournament_not_active.
    await dbExec(sql`
      INSERT INTO tournaments
        (name, game_type, scoring, start_time, end_time, prize_pool, prize_distribution, status, created_at, updated_at)
      VALUES
        ('Already Done Cup', 'wheel', 'total_wagered',
         DATE_SUB(NOW(), INTERVAL 1 HOUR),
         DATE_SUB(NOW(), INTERVAL 1 MINUTE),
         '500', ${JSON.stringify({ '1': 1 })}, 'finalized', NOW(), NOW())
    `);
    const row: any = await dbExec(sql`SELECT id FROM tournaments WHERE name = 'Already Done Cup' LIMIT 1`);
    const tournamentId = Number(row?.[0]?.[0]?.id);

    const res = await fetch(
      `${server.baseUrl}/api/admin/tournaments/${tournamentId}/finalize`,
      {
        method: 'POST',
        headers: { cookie: admin.cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    expect(res.status).toBe(409);
  });
});
