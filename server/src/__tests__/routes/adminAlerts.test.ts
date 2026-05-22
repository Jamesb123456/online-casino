// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  mockGetRecent,
  mockAcknowledge,
  mockAcknowledgeAll,
  mockGetThresholds,
  mockSetThresholds,
} = vi.hoisted(() => ({
  mockGetRecent: vi.fn(),
  mockAcknowledge: vi.fn(),
  mockAcknowledgeAll: vi.fn(),
  mockGetThresholds: vi.fn(),
  mockSetThresholds: vi.fn(),
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

vi.mock('../../../src/services/alertService.js', () => ({
  default: {
    getRecent: mockGetRecent,
    acknowledge: mockAcknowledge,
    acknowledgeAll: mockAcknowledgeAll,
    getThresholds: mockGetThresholds,
    setThresholds: mockSetThresholds,
  },
}));

import router from '../../../routes/adminAlerts.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/alerts', router);
  return app;
}

describe('Admin Alerts routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.role = 'admin';
    mockAuthUser.userId = 1;
    mockGetRecent.mockResolvedValue({ rows: [], total: 0, unreadCount: 0 });
    mockAcknowledge.mockResolvedValue({ id: 1, acknowledged: true });
    mockAcknowledgeAll.mockResolvedValue(0);
    mockGetThresholds.mockResolvedValue({ bigWin: 50_000, houseLow: 100_000, rapidBetsPerMin: 30 });
    mockSetThresholds.mockResolvedValue({ bigWin: 75_000, houseLow: 100_000, rapidBetsPerMin: 30 });
  });

  // -------------------------------------------------------------------------
  // GET /
  // -------------------------------------------------------------------------
  describe('GET /', () => {
    it('allows viewer', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp()).get('/api/admin/alerts');
      expect(res.status).toBe(200);
    });

    it('rejects plain user', async () => {
      mockAuthUser.role = 'user';
      const res = await request(createApp()).get('/api/admin/alerts');
      expect(res.status).toBe(403);
    });

    it('returns rows + total + unreadCount', async () => {
      mockGetRecent.mockResolvedValue({
        rows: [{ id: 1, type: 'big_win' }],
        total: 1,
        unreadCount: 1,
      });
      const res = await request(createApp()).get('/api/admin/alerts?unreadOnly=true');
      expect(res.status).toBe(200);
      expect(res.body.unreadCount).toBe(1);
      expect(res.body.rows[0].id).toBe(1);
      expect(mockGetRecent).toHaveBeenCalledWith(
        expect.objectContaining({ unreadOnly: true }),
      );
    });

    it('forwards type and limit filters', async () => {
      await request(createApp()).get('/api/admin/alerts?type=big_win&limit=10&offset=5');
      expect(mockGetRecent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'big_win', limit: 10, offset: 5 }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // POST /:id/acknowledge
  // -------------------------------------------------------------------------
  describe('POST /:id/acknowledge', () => {
    it('allows operator', async () => {
      mockAuthUser.role = 'operator';
      const res = await request(createApp()).post('/api/admin/alerts/5/acknowledge');
      expect(res.status).toBe(200);
      expect(mockAcknowledge).toHaveBeenCalledWith(5, 1);
    });

    it('rejects viewer', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp()).post('/api/admin/alerts/5/acknowledge');
      expect(res.status).toBe(403);
    });

    it('rejects an invalid id', async () => {
      const res = await request(createApp()).post('/api/admin/alerts/0/acknowledge');
      expect(res.status).toBe(400);
    });

    it('returns 404 when alert not found', async () => {
      mockAcknowledge.mockRejectedValue(new Error('alert_not_found'));
      const res = await request(createApp()).post('/api/admin/alerts/9999/acknowledge');
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // POST /acknowledge-all
  // -------------------------------------------------------------------------
  describe('POST /acknowledge-all', () => {
    it('returns the count', async () => {
      mockAcknowledgeAll.mockResolvedValue(3);
      const res = await request(createApp()).post('/api/admin/alerts/acknowledge-all');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(3);
    });

    it('rejects viewer', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp()).post('/api/admin/alerts/acknowledge-all');
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // GET/PUT /settings
  // -------------------------------------------------------------------------
  describe('Settings', () => {
    it('GET allows viewer', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp()).get('/api/admin/alerts/settings');
      expect(res.status).toBe(200);
      expect(res.body.bigWin).toBe(50_000);
    });

    it('PUT rejects operator (admin-only)', async () => {
      mockAuthUser.role = 'operator';
      const res = await request(createApp())
        .put('/api/admin/alerts/settings')
        .send({ bigWin: 75_000 });
      expect(res.status).toBe(403);
      expect(mockSetThresholds).not.toHaveBeenCalled();
    });

    it('PUT allows admin and roundtrips the values', async () => {
      const res = await request(createApp())
        .put('/api/admin/alerts/settings')
        .send({ bigWin: 75_000 });
      expect(res.status).toBe(200);
      expect(res.body.bigWin).toBe(75_000);
      expect(mockSetThresholds).toHaveBeenCalledWith({ bigWin: 75_000 }, 1);
    });

    it('PUT rejects negative values', async () => {
      const res = await request(createApp())
        .put('/api/admin/alerts/settings')
        .send({ houseLow: -1 });
      expect(res.status).toBe(400);
      expect(mockSetThresholds).not.toHaveBeenCalled();
    });

    it('PUT rejects empty body', async () => {
      const res = await request(createApp()).put('/api/admin/alerts/settings').send({});
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // 500 error paths (catch blocks)
  // -------------------------------------------------------------------------
  describe('500 error paths', () => {
    it('GET / returns 500 when service throws', async () => {
      mockGetRecent.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).get('/api/admin/alerts');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error reading alerts' });
    });

    it('GET /settings returns 500 when service throws', async () => {
      mockGetThresholds.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).get('/api/admin/alerts/settings');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error reading alert settings' });
    });

    it('PUT /settings returns 500 when service throws', async () => {
      mockSetThresholds.mockRejectedValue(new Error('boom'));
      const res = await request(createApp())
        .put('/api/admin/alerts/settings')
        .send({ bigWin: 1000 });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error updating alert settings' });
    });

    it('POST /acknowledge-all returns 500 when service throws', async () => {
      mockAcknowledgeAll.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).post('/api/admin/alerts/acknowledge-all');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error acknowledging alerts' });
    });

    it('POST /:id/acknowledge returns 500 on non-404 service error', async () => {
      mockAcknowledge.mockRejectedValue(new Error('boom'));
      const res = await request(createApp()).post('/api/admin/alerts/5/acknowledge');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error acknowledging alert' });
    });
  });
});
