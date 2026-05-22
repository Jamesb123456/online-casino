// @ts-nocheck
/**
 * House Treasury integration suite.
 *
 * Exercises HouseService end-to-end against the test MySQL:
 *   - creditHouse/debitHouse adjust the singleton house_account row and write
 *     audit rows to house_transactions
 *   - GET /api/admin/house surfaces the current balance + caps
 *   - PUT /api/admin/house/caps round-trips
 *   - snapshotService aggregates a day's transactions into a daily_snapshots row
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { startTestServer, type TestServer } from './test-server.js';
import { createAdminUser, createTestUser } from './auth-helper.js';
import {
  getUserIdByUsername,
  clearGameData,
  clearHouseData,
  clearSnapshots,
  insertTransaction,
} from './db-helper.js';
import HouseService from '../../services/houseService.js';
import snapshotService from '../../services/snapshotService.js';

async function dbExec(q: any): Promise<any> {
  const { db } = await import('../../../drizzle/db.js');
  return db.execute(q);
}

async function countHouseTransactions(type?: string): Promise<number> {
  const res: any = type
    ? await dbExec(sql`SELECT COUNT(*) AS c FROM house_transactions WHERE type = ${type}`)
    : await dbExec(sql`SELECT COUNT(*) AS c FROM house_transactions`);
  return Number(res?.[0]?.[0]?.c ?? 0);
}

describe('House Treasury Integration', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  }, 30000);

  beforeEach(async () => {
    await clearGameData();
    await clearHouseData();
    await clearSnapshots();
  });

  it('creditHouse increases the balance and writes a bet_credit audit row', async () => {
    const before = await HouseService.getHouseBalance();
    const { balanceAfter } = await HouseService.creditHouse(150, {
      userId: null,
      gameType: 'crash',
      reason: 'loss',
    });
    expect(balanceAfter).toBeCloseTo(before + 150, 2);

    const credits = await countHouseTransactions('bet_credit');
    expect(credits).toBeGreaterThanOrEqual(1);

    const balanceNow = await HouseService.getHouseBalance();
    expect(balanceNow).toBeCloseTo(before + 150, 2);
  });

  it('debitHouse decreases the balance and writes a payout_debit audit row', async () => {
    // Seed the house so the debit is solvent.
    await HouseService.topUp(500, null, 'seed');
    const before = await HouseService.getHouseBalance();

    const { balanceAfter } = await HouseService.debitHouse(120, {
      userId: null,
      gameType: 'crash',
      reason: 'payout',
    });
    expect(balanceAfter).toBeCloseTo(before - 120, 2);

    const debits = await countHouseTransactions('payout_debit');
    expect(debits).toBeGreaterThanOrEqual(1);
  });

  it('debitHouse aborts with house_insufficient when the house cannot cover the payout', async () => {
    // Empty house — debit must throw and balance must not change.
    const before = await HouseService.getHouseBalance();
    await expect(HouseService.debitHouse(50, { reason: 'payout' })).rejects.toThrow(/insufficient/i);
    const after = await HouseService.getHouseBalance();
    expect(after).toBeCloseTo(before, 2);
  });

  it('GET /api/admin/house returns the current balance and caps', async () => {
    const admin = await createAdminUser(server.baseUrl);
    await HouseService.topUp(1234, null, 'seed');

    const res = await fetch(`${server.baseUrl}/api/admin/house`, {
      headers: { cookie: admin.cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.balance).toBeCloseTo(1234, 2);
    expect(body.caps).toBeDefined();
    expect(typeof body.caps.perRound).toBe('number');
  });

  it('PUT /api/admin/house/caps updates a cap and the GET reflects it', async () => {
    const admin = await createAdminUser(server.baseUrl);

    const put = await fetch(`${server.baseUrl}/api/admin/house/caps`, {
      method: 'PUT',
      headers: { cookie: admin.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ perRound: 5000 }),
    });
    expect(put.status).toBe(200);

    const get = await fetch(`${server.baseUrl}/api/admin/house/caps`, {
      headers: { cookie: admin.cookie },
    });
    const body = await get.json();
    expect(body.caps.perRound).toBe(5000);
  });

  it('GET /api/admin/house is forbidden for a non-admin user', async () => {
    const player = await createTestUser(server.baseUrl);
    const res = await fetch(`${server.baseUrl}/api/admin/house`, {
      headers: { cookie: player.cookie },
    });
    expect(res.status).toBe(403);
  });

  it('snapshotService aggregates a day of transactions into a daily_snapshots row', async () => {
    const player = await createTestUser(server.baseUrl);
    const playerId = (await getUserIdByUsername(player.username))!;

    // Seed transactions for "today" (UTC). game_loss are stored negative, but
    // the snapshot uses ABS(); game_win is positive.
    const now = new Date();
    await insertTransaction({ userId: playerId, type: 'game_loss', amount: -50, gameType: 'crash', createdAt: now });
    await insertTransaction({ userId: playerId, type: 'game_loss', amount: -25, gameType: 'crash', createdAt: now });
    await insertTransaction({ userId: playerId, type: 'game_win', amount: 30, gameType: 'crash', createdAt: now });

    const dateUtc = now.toISOString().slice(0, 10);
    const snap = await snapshotService.saveSnapshot(dateUtc);
    expect(snap).toBeDefined();
    expect(Number(snap.totalBets)).toBeCloseTo(75, 2); // |-50| + |-25|
    expect(Number(snap.totalWins)).toBeCloseTo(30, 2);
    expect(Number(snap.ggr)).toBeCloseTo(45, 2); // 75 - 30
    expect(Number(snap.activePlayerCount)).toBeGreaterThanOrEqual(1);

    // Re-saving the same date is idempotent (ON DUPLICATE KEY UPDATE).
    const again = await snapshotService.saveSnapshot(dateUtc);
    expect(Number(again.totalBets)).toBeCloseTo(75, 2);
  });
});
