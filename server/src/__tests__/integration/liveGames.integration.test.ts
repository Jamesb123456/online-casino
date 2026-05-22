// @ts-nocheck
/**
 * Live Games integration suite.
 *
 * Covers the /live-games namespace:
 *   - authenticated connect succeeds
 *   - get_live_games returns a snapshot for all known game types (player counts default to 0)
 *   - inserting an open game_sessions row makes that game type report players >= 1
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { startTestServer, type TestServer } from './test-server.js';
import { createTestUser, createAuthSocket, connectSocket } from './auth-helper.js';
import { getUserIdByUsername, clearGameData } from './db-helper.js';
import { waitForEvent, sleep } from './utils.js';

async function dbExec(q: any): Promise<any> {
  const { db } = await import('../../../drizzle/db.js');
  return db.execute(q);
}

async function insertOpenGameSession(userId: number, gameType: string): Promise<void> {
  await dbExec(sql`
    INSERT INTO game_sessions
      (user_id, game_type, start_time, initial_bet, total_bet, outcome, is_completed, created_at, updated_at)
    VALUES
      (${userId}, ${gameType}, NOW(), '100', '100', '0', 0, NOW(), NOW())
  `);
}

describe('Live Games Integration', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  }, 30000);

  beforeEach(async () => {
    await clearGameData();
  });

  async function connectLive(cookie: string) {
    const socket = createAuthSocket(server.baseUrl, '/live-games', cookie);
    await connectSocket(socket);
    return socket;
  }

  it('returns a snapshot for every known game type with zero players when no sessions exist', async () => {
    const u = await createTestUser(server.baseUrl);
    const socket = await connectLive(u.cookie);
    try {
      const promise = waitForEvent<any[]>(socket, 'live_games', 5000);
      socket.emit('get_live_games');
      const list = await promise;

      expect(Array.isArray(list)).toBe(true);
      const types = list.map((g: any) => g.type);
      for (const t of ['crash', 'roulette', 'blackjack', 'plinko', 'wheel', 'landmines', 'dice', 'slots']) {
        expect(types).toContain(t);
      }
      // All zero since no sessions exist
      for (const g of list) {
        expect(g.players).toBe(0);
      }
    } finally {
      socket.disconnect();
    }
  });

  it('reflects an open game session as players >= 1 for that game type', async () => {
    const u = await createTestUser(server.baseUrl);
    const userId = (await getUserIdByUsername(u.username))!;

    // Seed an open session BEFORE asking for snapshot.
    await insertOpenGameSession(userId, 'crash');

    const socket = await connectLive(u.cookie);
    try {
      const promise = waitForEvent<any[]>(socket, 'live_games', 5000);
      socket.emit('get_live_games');
      const list = await promise;

      const crash = list.find((g: any) => g.type === 'crash');
      expect(crash).toBeDefined();
      expect(crash.players).toBeGreaterThanOrEqual(1);
      expect(crash.recentPlayers).toContain(u.username);
    } finally {
      socket.disconnect();
    }
  });

  it('refreshes the snapshot after a new game session is added', async () => {
    const u = await createTestUser(server.baseUrl);
    const userId = (await getUserIdByUsername(u.username))!;

    const socket = await connectLive(u.cookie);
    try {
      // First snapshot — no sessions
      const firstPromise = waitForEvent<any[]>(socket, 'live_games', 5000);
      socket.emit('get_live_games');
      const first = await firstPromise;
      expect(first.find((g: any) => g.type === 'wheel').players).toBe(0);

      // Add an open session
      await insertOpenGameSession(userId, 'wheel');
      await sleep(50);

      // Ask again — should reflect the new session
      const secondPromise = waitForEvent<any[]>(socket, 'live_games', 5000);
      socket.emit('get_live_games');
      const second = await secondPromise;
      expect(second.find((g: any) => g.type === 'wheel').players).toBeGreaterThanOrEqual(1);
    } finally {
      socket.disconnect();
    }
  });
});
