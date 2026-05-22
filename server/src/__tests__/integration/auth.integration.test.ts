// @ts-nocheck
/**
 * Auth integration suite.
 * Exercises Better Auth sign-up, sign-in, sign-out, and the custom
 * /api/auth/refresh-session endpoint. Each happy-path test verifies a
 * `session` row is present in MySQL after auth completes.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { startTestServer, type TestServer } from './test-server.js';
import { createTestUser, loginTestUser } from './auth-helper.js';

async function countSessionsForUser(userId: number): Promise<number> {
  const { db } = await import('../../../drizzle/db.js');
  const result: any = await db.execute(sql`SELECT COUNT(*) AS c FROM session WHERE user_id = ${userId}`);
  return Number(result?.[0]?.[0]?.c ?? 0);
}

describe('Auth Integration', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  }, 30000);

  it('sign-up creates a user, returns a session cookie, and inserts a session row', async () => {
    const u = await createTestUser(server.baseUrl);
    expect(u.cookie).toBeTruthy();
    expect(u.userId).toBeTruthy();

    const sessions = await countSessionsForUser(u.userId!);
    expect(sessions).toBeGreaterThanOrEqual(1);
  });

  it('sign-in (email/password) returns a session cookie and persists a new session row', async () => {
    const u = await createTestUser(server.baseUrl);
    const before = await countSessionsForUser(u.userId!);

    const loginCookie = await loginTestUser(server.baseUrl, u.username);
    expect(loginCookie).toBeTruthy();

    const after = await countSessionsForUser(u.userId!);
    expect(after).toBeGreaterThan(before);
  });

  it('sign-in with wrong password is rejected (401-style failure)', async () => {
    const u = await createTestUser(server.baseUrl);
    const email = `${u.username}@test.local`;

    const res = await fetch(`${server.baseUrl}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'WRONG-PASSWORD-123!' }),
    });

    expect(res.ok).toBe(false);
    expect([400, 401, 403]).toContain(res.status);
  });

  it('GET /api/auth/refresh-session returns user data when authenticated', async () => {
    const u = await createTestUser(server.baseUrl);
    const res = await fetch(`${server.baseUrl}/api/auth/refresh-session`, {
      headers: { cookie: u.cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ username: u.username });
    expect(body.id).toBeDefined();
    expect(body.role).toBeDefined();
  });

  it('GET /api/auth/refresh-session without cookie returns 401', async () => {
    const res = await fetch(`${server.baseUrl}/api/auth/refresh-session`);
    expect(res.status).toBe(401);
  });

  it('sign-out clears the session row in DB', async () => {
    const u = await createTestUser(server.baseUrl);
    const sessionsBefore = await countSessionsForUser(u.userId!);
    expect(sessionsBefore).toBeGreaterThanOrEqual(1);

    const res = await fetch(`${server.baseUrl}/api/auth/sign-out`, {
      method: 'POST',
      headers: { cookie: u.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    // Better Auth typically returns 200 with { success: true }; tolerate 204 too.
    expect([200, 204]).toContain(res.status);

    const sessionsAfter = await countSessionsForUser(u.userId!);
    expect(sessionsAfter).toBeLessThan(sessionsBefore);
  });
});
