// @ts-nocheck
/**
 * Chat integration suite.
 *
 * Covers the /chat namespace:
 *   - sending a message persists a row in `messages` and is broadcast
 *   - profanity is replaced with asterisks before persistence
 *   - mute prevents sending and surfaces a `chat_error`
 *   - admin soft-delete sets `deleted_at` on the message row
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { startTestServer, type TestServer } from './test-server.js';
import {
  createTestUser,
  createAdminUser,
  createAuthSocket,
  connectSocket,
} from './auth-helper.js';
import { getUserIdByUsername, clearChatData } from './db-helper.js';
import { waitForEvent, sleep } from './utils.js';
import chatModerationService from '../../services/chatModerationService.js';

async function dbExec(q: any): Promise<any> {
  const { db } = await import('../../../drizzle/db.js');
  return db.execute(q);
}

async function getMessageById(id: number): Promise<any | null> {
  const result: any = await dbExec(sql`SELECT * FROM messages WHERE id = ${id} LIMIT 1`);
  return result?.[0]?.[0] ?? null;
}

async function getLatestMessageByUser(userId: number): Promise<any | null> {
  const result: any = await dbExec(
    sql`SELECT * FROM messages WHERE user_id = ${userId} ORDER BY id DESC LIMIT 1`
  );
  return result?.[0]?.[0] ?? null;
}

describe('Chat Integration', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  }, 30000);

  beforeEach(async () => {
    await clearChatData();
    // The profanity wordlist cache is per-process; reset so settings tweaks
    // (none in these tests, but defensive) are picked up immediately.
    chatModerationService._resetCache();
  });

  async function connectChat(cookie: string) {
    const socket = createAuthSocket(server.baseUrl, '/chat', cookie);
    await connectSocket(socket);
    // /chat emits message_history shortly after connect; wait briefly.
    await waitForEvent(socket, 'message_history', 5000).catch(() => null);
    return socket;
  }

  it('sends a message, broadcasts it, and persists a row in messages', async () => {
    const u = await createTestUser(server.baseUrl);
    const userId = (await getUserIdByUsername(u.username))!;
    const socket = await connectChat(u.cookie);
    try {
      const broadcast = waitForEvent<any>(socket, 'new_message', 5000);
      socket.emit('send_message', { content: 'hello world' });

      const msg = await broadcast;
      expect(msg.content).toBe('hello world');
      expect(msg.userId).toBe(userId);

      await sleep(150);
      const row = await getLatestMessageByUser(userId);
      expect(row).toBeTruthy();
      expect(row.content).toBe('hello world');
      expect(row.deleted_at).toBeFalsy();
    } finally {
      socket.disconnect();
    }
  });

  it('replaces profanity with asterisks before persisting', async () => {
    const u = await createTestUser(server.baseUrl);
    const userId = (await getUserIdByUsername(u.username))!;
    const socket = await connectChat(u.cookie);
    try {
      const broadcast = waitForEvent<any>(socket, 'new_message', 5000);
      // 'shit' is in DEFAULT_PROFANITY_WORDS (length 4 → '****')
      socket.emit('send_message', { content: 'this is shit yo' });

      const msg = await broadcast;
      expect(msg.content).toBe('this is **** yo');

      await sleep(150);
      const row = await getLatestMessageByUser(userId);
      expect(row.content).toBe('this is **** yo');
    } finally {
      socket.disconnect();
    }
  });

  it('rejects send_message from a muted user and emits chat_error', async () => {
    const u = await createTestUser(server.baseUrl);
    const userId = (await getUserIdByUsername(u.username))!;

    // Mute for 1 hour
    await chatModerationService.muteUser(userId, 60 * 60 * 1000, null, 'test_mute');

    const socket = await connectChat(u.cookie);
    try {
      const errored = waitForEvent<any>(socket, 'chat_error', 5000);
      socket.emit('send_message', { content: 'should not pass' });

      const err = await errored;
      expect(err.message).toMatch(/muted/i);

      await sleep(150);
      const row = await getLatestMessageByUser(userId);
      expect(row).toBeFalsy();
    } finally {
      socket.disconnect();
    }
  });

  it('admin DELETE /api/admin/chat/messages/:id soft-deletes the row', async () => {
    const u = await createTestUser(server.baseUrl);
    const userId = (await getUserIdByUsername(u.username))!;
    const admin = await createAdminUser(server.baseUrl);

    const socket = await connectChat(u.cookie);
    let msgId: number;
    try {
      const broadcast = waitForEvent<any>(socket, 'new_message', 5000);
      socket.emit('send_message', { content: 'delete me' });
      await broadcast;
      // Broadcast payload uses MySQL insertId which can come back as undefined
      // in the model fallback path; the DB row is authoritative.
      await sleep(150);
      const row = await getLatestMessageByUser(userId);
      msgId = Number(row?.id);
      expect(msgId).toBeGreaterThan(0);
    } finally {
      socket.disconnect();
    }

    const res = await fetch(`${server.baseUrl}/api/admin/chat/messages/${msgId}`, {
      method: 'DELETE',
      headers: { cookie: admin.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'spam' }),
    });
    expect(res.status).toBe(200);

    const row = await getMessageById(msgId);
    expect(row).toBeTruthy();
    expect(row.deleted_at).toBeTruthy();
    expect(row.deleted_reason).toBe('spam');
  });
});
