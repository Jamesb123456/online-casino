// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { mockGetRange, mockSaveSnapshot } = vi.hoisted(() => ({
  mockGetRange: vi.fn(),
  mockSaveSnapshot: vi.fn(),
}));

const { mockAuthUser } = vi.hoisted(() => ({
  mockAuthUser: { userId: 1, username: 'admin', role: 'admin' },
}));

vi.mock('../../../middleware/auth.js', () => ({
  authenticate: vi.fn((req, res, next) => { req.user = mockAuthUser; next(); }),
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

vi.mock('../../../src/services/snapshotService.js', () => ({
  default: { getRange: mockGetRange, saveSnapshot: mockSaveSnapshot },
}));

vi.mock('../../../src/services/loggingService.js', () => ({
  default: { logSystemEvent: vi.fn() },
}));

import router from '../../../routes/adminSnapshots.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/snapshots', router);
  return app;
}

const sampleSnap = {
  id: 1,
  snapshotDate: '2026-05-19',
  houseBalanceClose: '500000.00',
  totalBets: '1000.00',
  totalWins: '500.00',
  ggr: '500.00',
  bonusesPaid: '50.00',
  ngr: '450.00',
  activePlayerCount: 10,
  newPlayerCount: 2,
  createdAt: '2026-05-20T00:05:00Z',
};

describe('Admin Snapshots routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.role = 'admin';
    mockAuthUser.userId = 1;
    mockGetRange.mockResolvedValue([sampleSnap]);
    mockSaveSnapshot.mockResolvedValue(sampleSnap);
  });

  describe('GET /', () => {
    it('allows admin', async () => {
      const res = await request(createApp()).get('/api/admin/snapshots');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.snapshots)).toBe(true);
      expect(res.body.snapshots[0].ggr).toBe(500);
    });

    it('allows operator (read-only)', async () => {
      mockAuthUser.role = 'operator';
      const res = await request(createApp()).get('/api/admin/snapshots');
      expect(res.status).toBe(200);
    });

    it('allows viewer (read-only)', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp()).get('/api/admin/snapshots');
      expect(res.status).toBe(200);
    });

    it('rejects plain user', async () => {
      mockAuthUser.role = 'user';
      const res = await request(createApp()).get('/api/admin/snapshots');
      expect(res.status).toBe(403);
    });

    it('defaults to last 30 days when no range provided', async () => {
      await request(createApp()).get('/api/admin/snapshots');
      const [from, to] = mockGetRange.mock.calls[0];
      expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(from <= to).toBe(true);
    });

    it('passes through valid from/to query params', async () => {
      await request(createApp())
        .get('/api/admin/snapshots?from=2026-05-01&to=2026-05-19');
      expect(mockGetRange).toHaveBeenCalledWith('2026-05-01', '2026-05-19');
    });

    it('ignores malformed dates and falls back to defaults', async () => {
      await request(createApp()).get('/api/admin/snapshots?from=BAD&to=ALSO_BAD');
      const [from, to] = mockGetRange.mock.calls[0];
      expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns 400 when from > to', async () => {
      const res = await request(createApp())
        .get('/api/admin/snapshots?from=2026-05-20&to=2026-05-01');
      expect(res.status).toBe(400);
      expect(mockGetRange).not.toHaveBeenCalled();
    });

    it('returns 500 on service error', async () => {
      mockGetRange.mockRejectedValueOnce(new Error('boom'));
      const res = await request(createApp()).get('/api/admin/snapshots');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /recompute', () => {
    it('allows admin', async () => {
      const res = await request(createApp())
        .post('/api/admin/snapshots/recompute')
        .send({ date: '2026-05-19' });
      expect(res.status).toBe(200);
      expect(res.body.snapshot.snapshotDate).toBe('2026-05-19');
      expect(mockSaveSnapshot).toHaveBeenCalledWith('2026-05-19');
    });

    it('rejects operator', async () => {
      mockAuthUser.role = 'operator';
      const res = await request(createApp())
        .post('/api/admin/snapshots/recompute')
        .send({ date: '2026-05-19' });
      expect(res.status).toBe(403);
      expect(mockSaveSnapshot).not.toHaveBeenCalled();
    });

    it('rejects viewer', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp())
        .post('/api/admin/snapshots/recompute')
        .send({ date: '2026-05-19' });
      expect(res.status).toBe(403);
    });

    it('rejects plain user', async () => {
      mockAuthUser.role = 'user';
      const res = await request(createApp())
        .post('/api/admin/snapshots/recompute')
        .send({ date: '2026-05-19' });
      expect(res.status).toBe(403);
    });

    it('returns 400 for malformed date', async () => {
      const res = await request(createApp())
        .post('/api/admin/snapshots/recompute')
        .send({ date: 'not-a-date' });
      expect(res.status).toBe(400);
      expect(mockSaveSnapshot).not.toHaveBeenCalled();
    });

    it('returns 400 for missing date', async () => {
      const res = await request(createApp())
        .post('/api/admin/snapshots/recompute')
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns 500 on service error', async () => {
      mockSaveSnapshot.mockRejectedValueOnce(new Error('db boom'));
      const res = await request(createApp())
        .post('/api/admin/snapshots/recompute')
        .send({ date: '2026-05-19' });
      expect(res.status).toBe(500);
    });
  });
});
