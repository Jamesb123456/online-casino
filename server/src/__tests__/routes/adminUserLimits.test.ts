// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  mockGetLimits,
  mockSetLimits,
  mockClearLimits,
} = vi.hoisted(() => ({
  mockGetLimits: vi.fn(),
  mockSetLimits: vi.fn(),
  mockClearLimits: vi.fn(),
}));

const { mockAuthUser } = vi.hoisted(() => ({
  mockAuthUser: { userId: 1, username: 'admin', role: 'admin' },
}));

vi.mock('../../../middleware/auth.js', () => ({
  authenticate: vi.fn((req, _res, next) => {
    if (!mockAuthUser) return _res.status(401).json({ message: 'No session' });
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

vi.mock('../../../src/services/userLimitsService.js', () => ({
  default: {
    getLimits: mockGetLimits,
    setLimits: mockSetLimits,
    clearLimits: mockClearLimits,
  },
}));

import router from '../../../routes/adminUserLimits.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/user-limits', router);
  return app;
}

describe('Admin User Limits routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.role = 'admin';
    mockAuthUser.userId = 1;
    mockGetLimits.mockResolvedValue({ maxBetPerRound: null, maxLossPerDay: null, lockedUntil: null, sessionLimitMinutes: null });
    mockSetLimits.mockImplementation(async (_uid, patch) => ({
      maxBetPerRound: patch.maxBetPerRound ?? null,
      maxLossPerDay: patch.maxLossPerDay ?? null,
      lockedUntil: patch.lockedUntil ?? null,
      sessionLimitMinutes: patch.sessionLimitMinutes ?? null,
    }));
    mockClearLimits.mockResolvedValue();
  });

  // -------------------------------------------------------------------------
  // GET /:userId
  // -------------------------------------------------------------------------
  describe('GET /:userId', () => {
    it('returns null limits for a user with no row (viewer allowed)', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp()).get('/api/admin/user-limits/42');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ maxBetPerRound: null, maxLossPerDay: null, lockedUntil: null, sessionLimitMinutes: null });
      expect(mockGetLimits).toHaveBeenCalledWith(42);
    });

    it('rejects plain user with 403', async () => {
      mockAuthUser.role = 'user';
      const res = await request(createApp()).get('/api/admin/user-limits/42');
      expect(res.status).toBe(403);
    });

    it('rejects invalid userId', async () => {
      const res = await request(createApp()).get('/api/admin/user-limits/0');
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // PUT /:userId
  // -------------------------------------------------------------------------
  describe('PUT /:userId', () => {
    it('admin can update all three fields', async () => {
      const future = new Date(Date.now() + 86_400_000).toISOString();
      const res = await request(createApp())
        .put('/api/admin/user-limits/42')
        .send({ maxBetPerRound: 100, maxLossPerDay: 500, lockedUntil: future });
      expect(res.status).toBe(200);
      expect(res.body.maxBetPerRound).toBe(100);
      expect(mockSetLimits).toHaveBeenCalledOnce();
      const [uid, patch, updatedBy] = mockSetLimits.mock.calls[0];
      expect(uid).toBe(42);
      expect(patch.maxBetPerRound).toBe(100);
      expect(patch.maxLossPerDay).toBe(500);
      expect(patch.lockedUntil).toBeInstanceOf(Date);
      expect(updatedBy).toBe(1);
    });

    it('operator can update', async () => {
      mockAuthUser.role = 'operator';
      const res = await request(createApp())
        .put('/api/admin/user-limits/42')
        .send({ maxBetPerRound: 100 });
      expect(res.status).toBe(200);
    });

    it('viewer is rejected with 403', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp())
        .put('/api/admin/user-limits/42')
        .send({ maxBetPerRound: 100 });
      expect(res.status).toBe(403);
      expect(mockSetLimits).not.toHaveBeenCalled();
    });

    it('accepts explicit null to clear an individual field', async () => {
      const res = await request(createApp())
        .put('/api/admin/user-limits/42')
        .send({ maxBetPerRound: null });
      expect(res.status).toBe(200);
      const [, patch] = mockSetLimits.mock.calls[0];
      expect(patch.maxBetPerRound).toBeNull();
    });

    it('rejects negative numbers with 400', async () => {
      const res = await request(createApp())
        .put('/api/admin/user-limits/42')
        .send({ maxBetPerRound: -5 });
      expect(res.status).toBe(400);
      expect(mockSetLimits).not.toHaveBeenCalled();
    });

    it('rejects past lockedUntil with 400', async () => {
      const past = new Date(Date.now() - 86_400_000).toISOString();
      const res = await request(createApp())
        .put('/api/admin/user-limits/42')
        .send({ lockedUntil: past });
      expect(res.status).toBe(400);
    });

    it('rejects empty body with 400', async () => {
      const res = await request(createApp())
        .put('/api/admin/user-limits/42')
        .send({});
      expect(res.status).toBe(400);
    });

    it('accepts sessionLimitMinutes', async () => {
      const res = await request(createApp())
        .put('/api/admin/user-limits/42')
        .send({ sessionLimitMinutes: 60 });
      expect(res.status).toBe(200);
      const [, patch] = mockSetLimits.mock.calls[0];
      expect(patch.sessionLimitMinutes).toBe(60);
      expect(res.body.sessionLimitMinutes).toBe(60);
    });

    it('accepts explicit null to clear sessionLimitMinutes', async () => {
      const res = await request(createApp())
        .put('/api/admin/user-limits/42')
        .send({ sessionLimitMinutes: null });
      expect(res.status).toBe(200);
      const [, patch] = mockSetLimits.mock.calls[0];
      expect(patch.sessionLimitMinutes).toBeNull();
    });

    it('rejects negative sessionLimitMinutes with 400', async () => {
      const res = await request(createApp())
        .put('/api/admin/user-limits/42')
        .send({ sessionLimitMinutes: -5 });
      expect(res.status).toBe(400);
      expect(mockSetLimits).not.toHaveBeenCalled();
    });

    it('rejects sessionLimitMinutes > 1440 with 400', async () => {
      const res = await request(createApp())
        .put('/api/admin/user-limits/42')
        .send({ sessionLimitMinutes: 1500 });
      expect(res.status).toBe(400);
      expect(mockSetLimits).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /:userId
  // -------------------------------------------------------------------------
  describe('DELETE /:userId', () => {
    it('admin can clear all limits', async () => {
      const res = await request(createApp()).delete('/api/admin/user-limits/42');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(mockClearLimits).toHaveBeenCalledWith(42);
    });

    it('viewer is rejected with 403', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp()).delete('/api/admin/user-limits/42');
      expect(res.status).toBe(403);
      expect(mockClearLimits).not.toHaveBeenCalled();
    });

    it('rejects invalid userId with 400', async () => {
      const res = await request(createApp()).delete('/api/admin/user-limits/0');
      expect(res.status).toBe(400);
      expect(mockClearLimits).not.toHaveBeenCalled();
    });

    it('returns 500 when service throws', async () => {
      mockClearLimits.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).delete('/api/admin/user-limits/42');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error clearing user limits' });
    });
  });

  // ---------------------------------------------------------------------------
  // 500 paths and invalid lockedUntil
  // ---------------------------------------------------------------------------
  describe('500 paths and invalid lockedUntil', () => {
    it('GET returns 500 when service throws', async () => {
      mockGetLimits.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).get('/api/admin/user-limits/42');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error reading user limits' });
    });

    it('PUT rejects lockedUntil with non-ISO string (NaN date)', async () => {
      const res = await request(createApp())
        .put('/api/admin/user-limits/42')
        .send({ lockedUntil: 'definitely-not-a-date' });
      expect(res.status).toBe(400);
      expect(mockSetLimits).not.toHaveBeenCalled();
    });

    it('PUT accepts explicit null lockedUntil', async () => {
      const res = await request(createApp())
        .put('/api/admin/user-limits/42')
        .send({ lockedUntil: null });
      expect(res.status).toBe(200);
      const [, patch] = mockSetLimits.mock.calls[0];
      expect(patch.lockedUntil).toBeNull();
    });

    it('PUT rejects invalid userId with 400', async () => {
      const res = await request(createApp())
        .put('/api/admin/user-limits/0')
        .send({ maxBetPerRound: 100 });
      expect(res.status).toBe(400);
      expect(mockSetLimits).not.toHaveBeenCalled();
    });

    it('PUT returns 500 when service throws', async () => {
      mockSetLimits.mockRejectedValue(new Error('boom'));
      const res = await request(createApp())
        .put('/api/admin/user-limits/42')
        .send({ maxBetPerRound: 100 });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error updating user limits' });
    });
  });
});
