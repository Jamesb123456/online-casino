// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockIsMuted,
  mockMuteUser,
  mockUnmuteUser,
  mockSoftDeleteMessage,
  mockGetRecentMessagesForAdmin,
  mockGetActiveMutes,
  mockGetProfanityWords,
  mockSetProfanityWords,
} = vi.hoisted(() => ({
  mockIsMuted: vi.fn(),
  mockMuteUser: vi.fn(),
  mockUnmuteUser: vi.fn(),
  mockSoftDeleteMessage: vi.fn(),
  mockGetRecentMessagesForAdmin: vi.fn(),
  mockGetActiveMutes: vi.fn(),
  mockGetProfanityWords: vi.fn(),
  mockSetProfanityWords: vi.fn(),
}));

const { mockAuthUser } = vi.hoisted(() => ({
  mockAuthUser: { userId: 1, username: 'admin', role: 'admin' },
}));

vi.mock('../../../middleware/auth.js', () => ({
  authenticate: vi.fn((req, _res, next) => {
    req.user = mockAuthUser;
    next();
  }),
  adminOnly: vi.fn((req, res, next) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    next();
  }),
  adminOrOperator: vi.fn((req, res, next) => {
    if (!['admin', 'operator'].includes(req.user?.role)) return res.status(403).json({ message: 'Forbidden' });
    next();
  }),
  adminOrOperatorOrViewer: vi.fn((req, res, next) => {
    if (!['admin', 'operator', 'viewer'].includes(req.user?.role)) return res.status(403).json({ message: 'Forbidden' });
    next();
  }),
}));

vi.mock('../../../src/services/loggingService.js', () => ({
  default: { logSystemEvent: vi.fn() },
}));

vi.mock('../../../src/services/chatModerationService.js', () => ({
  default: {
    isMuted: mockIsMuted,
    muteUser: mockMuteUser,
    unmuteUser: mockUnmuteUser,
    softDeleteMessage: mockSoftDeleteMessage,
    getRecentMessagesForAdmin: mockGetRecentMessagesForAdmin,
    getActiveMutes: mockGetActiveMutes,
    getProfanityWords: mockGetProfanityWords,
    setProfanityWords: mockSetProfanityWords,
  },
}));

import router, { setIo } from '../../../routes/adminChat.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/chat', router);
  return app;
}

describe('Admin Chat Moderation routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.role = 'admin';
    mockAuthUser.userId = 1;
    mockGetRecentMessagesForAdmin.mockResolvedValue([]);
    mockGetActiveMutes.mockResolvedValue([]);
    mockGetProfanityWords.mockResolvedValue(['fuck', 'shit']);
    mockSetProfanityWords.mockResolvedValue(undefined);
    mockSoftDeleteMessage.mockResolvedValue(undefined);
    mockUnmuteUser.mockResolvedValue(undefined);
    mockMuteUser.mockResolvedValue({
      id: 1,
      userId: 2,
      mutedUntil: new Date(Date.now() + 60_000),
      mutedBy: 1,
      reason: null,
      createdAt: new Date(),
    });
    setIo(null);
  });

  // -------------------------------------------------------------------------
  // Role tiering
  // -------------------------------------------------------------------------
  describe('Authorization', () => {
    it('rejects plain user on GET /messages', async () => {
      mockAuthUser.role = 'user';
      const res = await request(createApp()).get('/api/admin/chat/messages');
      expect(res.status).toBe(403);
    });

    it('allows viewer on GET /messages', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp()).get('/api/admin/chat/messages');
      expect(res.status).toBe(200);
    });

    it('allows operator on DELETE /messages/:id', async () => {
      mockAuthUser.role = 'operator';
      const res = await request(createApp()).delete('/api/admin/chat/messages/5');
      expect(res.status).toBe(200);
      expect(mockSoftDeleteMessage).toHaveBeenCalled();
    });

    it('rejects viewer on DELETE /messages/:id', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp()).delete('/api/admin/chat/messages/5');
      expect(res.status).toBe(403);
      expect(mockSoftDeleteMessage).not.toHaveBeenCalled();
    });

    it('rejects viewer on POST /mute', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp())
        .post('/api/admin/chat/mute')
        .send({ userId: 2, durationMinutes: 15 });
      expect(res.status).toBe(403);
    });

    it('allows operator on POST /mute', async () => {
      mockAuthUser.role = 'operator';
      const res = await request(createApp())
        .post('/api/admin/chat/mute')
        .send({ userId: 2, durationMinutes: 15 });
      expect(res.status).toBe(200);
      expect(mockMuteUser).toHaveBeenCalled();
    });

    it('rejects operator on PUT /profanity-words (admin-only)', async () => {
      mockAuthUser.role = 'operator';
      const res = await request(createApp())
        .put('/api/admin/chat/profanity-words')
        .send({ words: ['x'] });
      expect(res.status).toBe(403);
      expect(mockSetProfanityWords).not.toHaveBeenCalled();
    });

    it('allows admin on PUT /profanity-words', async () => {
      const res = await request(createApp())
        .put('/api/admin/chat/profanity-words')
        .send({ words: ['x'] });
      expect(res.status).toBe(200);
      expect(mockSetProfanityWords).toHaveBeenCalledWith(['x'], 1);
    });
  });

  // -------------------------------------------------------------------------
  // GET /messages
  // -------------------------------------------------------------------------
  describe('GET /messages', () => {
    it('returns rows from the service', async () => {
      const rows = [{ id: 1, content: 'hi', userId: 2 }];
      mockGetRecentMessagesForAdmin.mockResolvedValue(rows);
      const res = await request(createApp()).get('/api/admin/chat/messages?limit=50');
      expect(res.status).toBe(200);
      expect(res.body.rows).toEqual(rows);
      expect(mockGetRecentMessagesForAdmin).toHaveBeenCalledWith(50, true);
    });

    it('passes includeDeleted=false correctly', async () => {
      mockGetRecentMessagesForAdmin.mockResolvedValue([]);
      await request(createApp()).get('/api/admin/chat/messages?includeDeleted=false');
      expect(mockGetRecentMessagesForAdmin).toHaveBeenCalledWith(100, false);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /messages/:id
  // -------------------------------------------------------------------------
  describe('DELETE /messages/:id', () => {
    it('soft-deletes with adminId and optional reason', async () => {
      const res = await request(createApp())
        .delete('/api/admin/chat/messages/42')
        .send({ reason: 'rude' });
      expect(res.status).toBe(200);
      expect(mockSoftDeleteMessage).toHaveBeenCalledWith(42, 1, 'rude');
    });

    it('rejects an invalid id', async () => {
      const res = await request(createApp()).delete('/api/admin/chat/messages/0');
      expect(res.status).toBe(400);
      expect(mockSoftDeleteMessage).not.toHaveBeenCalled();
    });

    it('emits a socket event when an io is registered', async () => {
      const emit = vi.fn();
      setIo({ emit } as any);
      const res = await request(createApp()).delete('/api/admin/chat/messages/9');
      expect(res.status).toBe(200);
      expect(emit).toHaveBeenCalledWith('chat_message_deleted', expect.objectContaining({ messageId: 9 }));
    });
  });

  // -------------------------------------------------------------------------
  // POST /mute & /unmute roundtrip
  // -------------------------------------------------------------------------
  describe('POST /mute', () => {
    it('rejects invalid duration', async () => {
      const res = await request(createApp())
        .post('/api/admin/chat/mute')
        .send({ userId: 2, durationMinutes: 0 });
      expect(res.status).toBe(400);
      expect(mockMuteUser).not.toHaveBeenCalled();
    });

    it('rejects invalid userId', async () => {
      const res = await request(createApp())
        .post('/api/admin/chat/mute')
        .send({ userId: 'oops', durationMinutes: 15 });
      expect(res.status).toBe(400);
    });

    it('accepts forever (-1) and converts minutes -> ms in the service call', async () => {
      const res = await request(createApp())
        .post('/api/admin/chat/mute')
        .send({ userId: 2, durationMinutes: -1, reason: 'troll' });
      expect(res.status).toBe(200);
      expect(mockMuteUser).toHaveBeenCalledWith(2, -1, 1, 'troll');
    });

    it('passes finite minutes converted to ms', async () => {
      const res = await request(createApp())
        .post('/api/admin/chat/mute')
        .send({ userId: 2, durationMinutes: 15 });
      expect(res.status).toBe(200);
      expect(mockMuteUser).toHaveBeenCalledWith(2, 15 * 60_000, 1, null);
    });
  });

  describe('POST /unmute', () => {
    it('calls service.unmuteUser', async () => {
      const res = await request(createApp())
        .post('/api/admin/chat/unmute')
        .send({ userId: 2 });
      expect(res.status).toBe(200);
      expect(mockUnmuteUser).toHaveBeenCalledWith(2);
    });

    it('rejects invalid userId', async () => {
      const res = await request(createApp())
        .post('/api/admin/chat/unmute')
        .send({ userId: -1 });
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Profanity wordlist
  // -------------------------------------------------------------------------
  describe('Profanity wordlist', () => {
    it('GET returns current words', async () => {
      mockGetProfanityWords.mockResolvedValue(['a', 'b']);
      const res = await request(createApp()).get('/api/admin/chat/profanity-words');
      expect(res.status).toBe(200);
      expect(res.body.words).toEqual(['a', 'b']);
    });

    it('PUT rejects non-array body', async () => {
      const res = await request(createApp())
        .put('/api/admin/chat/profanity-words')
        .send({ words: 'oops' });
      expect(res.status).toBe(400);
      expect(mockSetProfanityWords).not.toHaveBeenCalled();
    });

    it('PUT writes and returns the stored list', async () => {
      mockSetProfanityWords.mockResolvedValue(undefined);
      mockGetProfanityWords.mockResolvedValue(['foo']);
      const res = await request(createApp())
        .put('/api/admin/chat/profanity-words')
        .send({ words: ['foo'] });
      expect(res.status).toBe(200);
      expect(res.body.words).toEqual(['foo']);
    });

    it('PUT rejects when array exceeds MAX_WORDS', async () => {
      const big = Array.from({ length: 1001 }, (_, i) => `w${i}`);
      const res = await request(createApp())
        .put('/api/admin/chat/profanity-words')
        .send({ words: big });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Too many/);
      expect(mockSetProfanityWords).not.toHaveBeenCalled();
    });

    it('PUT rejects when a word is too long', async () => {
      const res = await request(createApp())
        .put('/api/admin/chat/profanity-words')
        .send({ words: ['a'.repeat(101)] });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at most/);
      expect(mockSetProfanityWords).not.toHaveBeenCalled();
    });

    it('PUT rejects when a word is non-string', async () => {
      const res = await request(createApp())
        .put('/api/admin/chat/profanity-words')
        .send({ words: ['ok', 123] });
      expect(res.status).toBe(400);
      expect(mockSetProfanityWords).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // POST /mute — boundary
  // -------------------------------------------------------------------------
  describe('POST /mute boundary', () => {
    it('rejects durationMinutes > 525600', async () => {
      const res = await request(createApp())
        .post('/api/admin/chat/mute')
        .send({ userId: 2, durationMinutes: 525_601 });
      expect(res.status).toBe(400);
      expect(mockMuteUser).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // GET /mutes
  // -------------------------------------------------------------------------
  describe('GET /mutes', () => {
    it('returns active mutes', async () => {
      mockGetActiveMutes.mockResolvedValue([{ id: 1, userId: 2 }]);
      const res = await request(createApp()).get('/api/admin/chat/mutes');
      expect(res.status).toBe(200);
      expect(res.body.rows).toHaveLength(1);
    });

    it('rejects plain user', async () => {
      mockAuthUser.role = 'user';
      const res = await request(createApp()).get('/api/admin/chat/mutes');
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // emitModerationEvent ignores throws (warn-level only)
  // -------------------------------------------------------------------------
  describe('emit error handling', () => {
    it('DELETE /messages still succeeds when io.emit throws', async () => {
      const throwingIo = { emit: vi.fn(() => { throw new Error('emit fail'); }) };
      setIo(throwingIo as any);
      const res = await request(createApp()).delete('/api/admin/chat/messages/3');
      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // 500 error paths
  // -------------------------------------------------------------------------
  describe('500 error paths', () => {
    it('GET /messages returns 500 when service throws', async () => {
      mockGetRecentMessagesForAdmin.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).get('/api/admin/chat/messages');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error reading messages' });
    });

    it('DELETE /messages/:id returns 500 when service throws', async () => {
      mockSoftDeleteMessage.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).delete('/api/admin/chat/messages/3');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error deleting message' });
    });

    it('POST /mute returns 500 when service throws', async () => {
      mockMuteUser.mockRejectedValue(new Error('boom'));
      const res = await request(createApp())
        .post('/api/admin/chat/mute')
        .send({ userId: 2, durationMinutes: 15 });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error muting user' });
    });

    it('POST /unmute returns 500 when service throws', async () => {
      mockUnmuteUser.mockRejectedValue(new Error('boom'));
      const res = await request(createApp())
        .post('/api/admin/chat/unmute')
        .send({ userId: 2 });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error unmuting user' });
    });

    it('GET /mutes returns 500 when service throws', async () => {
      mockGetActiveMutes.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).get('/api/admin/chat/mutes');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error reading mutes' });
    });

    it('GET /profanity-words returns 500 when service throws', async () => {
      mockGetProfanityWords.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).get('/api/admin/chat/profanity-words');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error reading profanity words' });
    });

    it('PUT /profanity-words returns 500 when service throws', async () => {
      mockSetProfanityWords.mockRejectedValue(new Error('boom'));
      const res = await request(createApp())
        .put('/api/admin/chat/profanity-words')
        .send({ words: ['x'] });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error updating profanity words' });
    });
  });
});
