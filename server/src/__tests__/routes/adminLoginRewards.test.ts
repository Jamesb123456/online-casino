// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockGetConfig, mockSetConfig } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockSetConfig: vi.fn(),
}));

const { mockAuthUser } = vi.hoisted(() => ({
  mockAuthUser: { userId: 1, username: 'admin', role: 'admin' },
}));

vi.mock('../../../middleware/auth.js', () => ({
  authenticate: vi.fn((req, res, next) => {
    req.user = mockAuthUser;
    next();
  }),
  adminOnly: vi.fn((req, res, next) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    next();
  }),
  adminOrOperatorOrViewer: vi.fn((req, res, next) => {
    if (!['admin', 'operator', 'viewer'].includes(req.user?.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  }),
}));

vi.mock('../../../src/services/loggingService.js', () => ({
  default: { logSystemEvent: vi.fn() },
}));

vi.mock('../../../src/services/loginRewardConfigService.js', () => ({
  default: {
    getLoginRewardConfig: mockGetConfig,
    setLoginRewardConfig: mockSetConfig,
  },
}));

import router from '../../../routes/adminLoginRewards.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/login-rewards', router);
  return app;
}

const defaultConfig = { min: 10, max: 100, streakBonus: 0, capPerDay: null };

describe('Admin Login Rewards routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.role = 'admin';
    mockAuthUser.userId = 1;
    mockGetConfig.mockResolvedValue(defaultConfig);
    mockSetConfig.mockResolvedValue(undefined);
  });

  // ---------------------------------------------------------------------------
  // Authorization
  // ---------------------------------------------------------------------------
  describe('Authorization', () => {
    it('rejects plain user on GET /config', async () => {
      mockAuthUser.role = 'user';
      const res = await request(createApp()).get('/api/admin/login-rewards/config');
      expect(res.status).toBe(403);
    });

    it('allows viewer on GET /config', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp()).get('/api/admin/login-rewards/config');
      expect(res.status).toBe(200);
    });

    it('allows operator on GET /config', async () => {
      mockAuthUser.role = 'operator';
      const res = await request(createApp()).get('/api/admin/login-rewards/config');
      expect(res.status).toBe(200);
    });

    it('allows admin on GET /config', async () => {
      const res = await request(createApp()).get('/api/admin/login-rewards/config');
      expect(res.status).toBe(200);
    });

    it('rejects viewer on PUT /config', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp())
        .put('/api/admin/login-rewards/config')
        .send({ min: 5 });
      expect(res.status).toBe(403);
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    it('rejects operator on PUT /config (config is admin-only)', async () => {
      mockAuthUser.role = 'operator';
      const res = await request(createApp())
        .put('/api/admin/login-rewards/config')
        .send({ min: 5 });
      expect(res.status).toBe(403);
      expect(mockSetConfig).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // GET /config
  // ---------------------------------------------------------------------------
  describe('GET /config', () => {
    it('returns the current config', async () => {
      const res = await request(createApp()).get('/api/admin/login-rewards/config');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(defaultConfig);
      expect(mockGetConfig).toHaveBeenCalled();
    });

    it('returns 500 on service error', async () => {
      mockGetConfig.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).get('/api/admin/login-rewards/config');
      expect(res.status).toBe(500);
    });
  });

  // ---------------------------------------------------------------------------
  // PUT /config — validation
  // ---------------------------------------------------------------------------
  describe('PUT /config validation', () => {
    it('rejects empty body', async () => {
      const res = await request(createApp())
        .put('/api/admin/login-rewards/config')
        .send({});
      expect(res.status).toBe(400);
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    it('rejects negative min', async () => {
      const res = await request(createApp())
        .put('/api/admin/login-rewards/config')
        .send({ min: -1 });
      expect(res.status).toBe(400);
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    it('rejects non-numeric max', async () => {
      const res = await request(createApp())
        .put('/api/admin/login-rewards/config')
        .send({ max: 'abc' });
      expect(res.status).toBe(400);
    });

    it('rejects negative streakBonus', async () => {
      const res = await request(createApp())
        .put('/api/admin/login-rewards/config')
        .send({ streakBonus: -5 });
      expect(res.status).toBe(400);
    });

    it('rejects negative capPerDay', async () => {
      const res = await request(createApp())
        .put('/api/admin/login-rewards/config')
        .send({ capPerDay: -100 });
      expect(res.status).toBe(400);
    });

    it('accepts null capPerDay (unlimited)', async () => {
      const res = await request(createApp())
        .put('/api/admin/login-rewards/config')
        .send({ capPerDay: null });
      expect(res.status).toBe(200);
      expect(mockSetConfig).toHaveBeenCalledWith({ capPerDay: null }, 1);
    });

    it('rejects when patch would yield max < min (cross-field check)', async () => {
      mockGetConfig.mockResolvedValueOnce({ min: 50, max: 200, streakBonus: 0, capPerDay: null });
      const res = await request(createApp())
        .put('/api/admin/login-rewards/config')
        .send({ max: 10 }); // would make max(10) < current min(50)
      expect(res.status).toBe(400);
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    it('rejects when both provided and max < min', async () => {
      const res = await request(createApp())
        .put('/api/admin/login-rewards/config')
        .send({ min: 100, max: 50 });
      expect(res.status).toBe(400);
      expect(mockSetConfig).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // PUT /config — happy path
  // ---------------------------------------------------------------------------
  describe('PUT /config success', () => {
    it('persists the patch and returns the fresh config', async () => {
      const fresh = { min: 20, max: 200, streakBonus: 5, capPerDay: 500000 };
      // First call inside route is the merge-check; second is the post-write read.
      mockGetConfig
        .mockResolvedValueOnce(defaultConfig)
        .mockResolvedValueOnce(fresh);

      const res = await request(createApp())
        .put('/api/admin/login-rewards/config')
        .send({ min: 20, max: 200, streakBonus: 5, capPerDay: 500000 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(fresh);
      expect(mockSetConfig).toHaveBeenCalledWith(
        { min: 20, max: 200, streakBonus: 5, capPerDay: 500000 },
        1
      );
    });

    it('returns 500 on service error', async () => {
      mockSetConfig.mockRejectedValue(new Error('boom'));
      const res = await request(createApp())
        .put('/api/admin/login-rewards/config')
        .send({ min: 10 });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error updating login reward config' });
    });

    it('rejects array body via validateConfigPatch (invalid_payload)', async () => {
      const res = await request(createApp())
        .put('/api/admin/login-rewards/config')
        .send([1, 2] as any);
      expect(res.status).toBe(400);
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    it('GET → PUT → GET roundtrip', async () => {
      // GET 1 — initial
      let res = await request(createApp()).get('/api/admin/login-rewards/config');
      expect(res.body).toEqual(defaultConfig);

      // PUT
      const patched = { min: 50, max: 500, streakBonus: 10, capPerDay: null };
      mockGetConfig
        .mockResolvedValueOnce(defaultConfig) // merge-check
        .mockResolvedValueOnce(patched);       // post-write read
      res = await request(createApp())
        .put('/api/admin/login-rewards/config')
        .send({ min: 50, max: 500, streakBonus: 10 });
      expect(res.status).toBe(200);

      // GET 2 — fresh value
      mockGetConfig.mockResolvedValueOnce(patched);
      res = await request(createApp()).get('/api/admin/login-rewards/config');
      expect(res.body).toEqual(patched);
    });
  });
});
