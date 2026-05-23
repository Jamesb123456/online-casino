// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
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
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
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

vi.mock('../../../drizzle/db.js', () => ({
  db: { execute: mockExecute },
}));

import router from '../../../routes/adminSettings.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/settings', router);
  return app;
}

describe('Admin Settings routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.role = 'admin';
    mockAuthUser.userId = 1;
  });

  // -------------------------------------------------------------------------
  // Authorization tiers
  // -------------------------------------------------------------------------
  describe('Authorization', () => {
    it('rejects plain user on GET all', async () => {
      mockAuthUser.role = 'user';
      const res = await request(createApp()).get('/api/admin/settings');
      expect(res.status).toBe(403);
    });

    it('allows viewer on GET all', async () => {
      mockAuthUser.role = 'viewer';
      mockExecute.mockResolvedValueOnce([[]]);
      const res = await request(createApp()).get('/api/admin/settings');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ rows: [] });
    });

    it('allows operator on GET single', async () => {
      mockAuthUser.role = 'operator';
      mockExecute.mockResolvedValueOnce([[
        { key: 'default_new_user_balance', value: '500', updated_at: null, updated_by: null },
      ]]);
      const res = await request(createApp()).get('/api/admin/settings/default_new_user_balance');
      expect(res.status).toBe(200);
      expect(res.body.value).toBe(500);
    });

    it('rejects viewer on PUT (admin-only)', async () => {
      mockAuthUser.role = 'viewer';
      const res = await request(createApp())
        .put('/api/admin/settings/default_new_user_balance')
        .send({ value: 500 });
      expect(res.status).toBe(403);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('rejects operator on PUT (admin-only)', async () => {
      mockAuthUser.role = 'operator';
      const res = await request(createApp())
        .put('/api/admin/settings/default_new_user_balance')
        .send({ value: 500 });
      expect(res.status).toBe(403);
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // GET /:key
  // -------------------------------------------------------------------------
  describe('GET /:key', () => {
    it('returns the parsed value when found', async () => {
      mockExecute.mockResolvedValueOnce([[
        { key: 'min_house_edge_floor', value: '0.05', updated_at: '2026-05-19T00:00:00Z', updated_by: 1 },
      ]]);
      const res = await request(createApp()).get('/api/admin/settings/min_house_edge_floor');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        key: 'min_house_edge_floor',
        value: 0.05,
        updatedBy: 1,
      });
    });

    it('returns 404 when not found', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const res = await request(createApp()).get('/api/admin/settings/does_not_exist');
      expect(res.status).toBe(404);
    });

    it('rejects invalid key format', async () => {
      const res = await request(createApp()).get('/api/admin/settings/has spaces');
      // Express decodes %20 / + space, hitting validator
      expect([400, 404]).toContain(res.status);
    });

    it('parses object-typed stored values', async () => {
      // Drizzle's mysql2 driver returns JSON columns already parsed into objects.
      mockExecute.mockResolvedValueOnce([[
        { key: 'custom.theme', value: { a: 1 }, updated_at: null, updated_by: null },
      ]]);
      const res = await request(createApp()).get('/api/admin/settings/custom.theme');
      expect(res.status).toBe(200);
      expect(res.body.value).toEqual({ a: 1 });
    });
  });

  // -------------------------------------------------------------------------
  // GET / (list all)
  // -------------------------------------------------------------------------
  describe('GET /', () => {
    it('returns all rows with parsed values', async () => {
      mockExecute.mockResolvedValueOnce([[
        { key: 'default_new_user_balance', value: '500', updated_at: null, updated_by: 1 },
        { key: 'min_house_edge_floor', value: '0.02', updated_at: null, updated_by: 1 },
      ]]);
      const res = await request(createApp()).get('/api/admin/settings');
      expect(res.status).toBe(200);
      expect(res.body.rows).toHaveLength(2);
      expect(res.body.rows[0].value).toBe(500);
      expect(res.body.rows[1].value).toBe(0.02);
    });
  });

  // -------------------------------------------------------------------------
  // PUT /:key — allowlist enforcement
  // -------------------------------------------------------------------------
  describe('PUT /:key allowlist', () => {
    it('writes a key on the safelist', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const res = await request(createApp())
        .put('/api/admin/settings/default_new_user_balance')
        .send({ value: 1000 });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ key: 'default_new_user_balance', value: 1000 });
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('writes min_house_edge_floor', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const res = await request(createApp())
        .put('/api/admin/settings/min_house_edge_floor')
        .send({ value: 0.05 });
      expect(res.status).toBe(200);
      expect(res.body.value).toBe(0.05);
    });

    it('writes a custom.* namespaced key', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const res = await request(createApp())
        .put('/api/admin/settings/custom.experiment_a')
        .send({ value: { flag: true } });
      expect(res.status).toBe(200);
      expect(res.body.value).toEqual({ flag: true });
    });

    it('rejects service-owned key max_payout_per_round', async () => {
      const res = await request(createApp())
        .put('/api/admin/settings/max_payout_per_round')
        .send({ value: 999 });
      expect(res.status).toBe(400);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('rejects service-owned key alert_big_win', async () => {
      const res = await request(createApp())
        .put('/api/admin/settings/alert_big_win')
        .send({ value: 100 });
      expect(res.status).toBe(400);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('rejects service-owned key login_reward_min', async () => {
      const res = await request(createApp())
        .put('/api/admin/settings/login_reward_min')
        .send({ value: 10 });
      expect(res.status).toBe(400);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('rejects service-owned key profanity_words', async () => {
      const res = await request(createApp())
        .put('/api/admin/settings/profanity_words')
        .send({ value: ['bad'] });
      expect(res.status).toBe(400);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('rejects unknown un-namespaced key', async () => {
      const res = await request(createApp())
        .put('/api/admin/settings/some_random_key')
        .send({ value: 1 });
      expect(res.status).toBe(400);
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // PUT /:key — value validation
  // -------------------------------------------------------------------------
  describe('PUT /:key value validation', () => {
    it('rejects missing value field', async () => {
      const res = await request(createApp())
        .put('/api/admin/settings/default_new_user_balance')
        .send({});
      expect(res.status).toBe(400);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('rejects null value', async () => {
      const res = await request(createApp())
        .put('/api/admin/settings/default_new_user_balance')
        .send({ value: null });
      expect(res.status).toBe(400);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('accepts numbers, strings, arrays, and objects', async () => {
      mockExecute.mockResolvedValue([[]]);

      const r1 = await request(createApp())
        .put('/api/admin/settings/custom.num')
        .send({ value: 42 });
      expect(r1.status).toBe(200);

      const r2 = await request(createApp())
        .put('/api/admin/settings/custom.str')
        .send({ value: 'hello' });
      expect(r2.status).toBe(200);

      const r3 = await request(createApp())
        .put('/api/admin/settings/custom.arr')
        .send({ value: [1, 2, 3] });
      expect(r3.status).toBe(200);

      const r4 = await request(createApp())
        .put('/api/admin/settings/custom.obj')
        .send({ value: { a: 1, b: 'two' } });
      expect(r4.status).toBe(200);
    });

    it('rejects invalid key characters', async () => {
      const res = await request(createApp())
        .put('/api/admin/settings/bad key!')
        .send({ value: 1 });
      // Either 400 from key validator or 400 from allowlist — both acceptable.
      expect(res.status).toBe(400);
    });

    it('rejects undefined value (explicitly set via raw JSON-style request)', async () => {
      // body without a value property hits the missing-value branch
      const res = await request(createApp())
        .put('/api/admin/settings/default_new_user_balance')
        .send({ notValue: 1 });
      expect(res.status).toBe(400);
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 500 paths
  // -------------------------------------------------------------------------
  describe('500 paths', () => {
    it('GET / returns 500 on db error', async () => {
      mockExecute.mockRejectedValueOnce(new Error('db boom'));
      const res = await request(createApp()).get('/api/admin/settings');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error reading settings' });
    });

    it('GET /:key returns 500 on db error', async () => {
      mockExecute.mockRejectedValueOnce(new Error('db boom'));
      const res = await request(createApp()).get('/api/admin/settings/default_new_user_balance');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error reading setting' });
    });

    it('PUT /:key returns 500 on db error', async () => {
      mockExecute.mockRejectedValueOnce(new Error('db boom'));
      const res = await request(createApp())
        .put('/api/admin/settings/default_new_user_balance')
        .send({ value: 100 });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error updating setting' });
    });

    it('parses string-stored JSON (parseStoredValue try branch)', async () => {
      mockExecute.mockResolvedValueOnce([[
        { key: 'custom.x', value: '"hello"', updated_at: null, updated_by: null },
      ]]);
      const res = await request(createApp()).get('/api/admin/settings/custom.x');
      expect(res.status).toBe(200);
      expect(res.body.value).toBe('hello');
    });

    it('parseStoredValue returns raw on JSON parse failure', async () => {
      mockExecute.mockResolvedValueOnce([[
        { key: 'custom.x', value: 'not-json{', updated_at: null, updated_by: null },
      ]]);
      const res = await request(createApp()).get('/api/admin/settings/custom.x');
      expect(res.status).toBe(200);
      expect(res.body.value).toBe('not-json{');
    });
  });
});

// ---------------------------------------------------------------------------
// Wire contract — locked response shapes
// Regression gate for the upcoming A5 refactor. Any drift in keys or
// response shape from the byte-identical contract will fail here.
// ---------------------------------------------------------------------------

describe('Wire contract — Admin Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.role = 'admin';
    mockAuthUser.userId = 1;
  });

  // -------------------------------------------------------------------------
  // GET /
  // -------------------------------------------------------------------------
  describe('GET /', () => {
    it('locks { rows } shape with per-row keys', async () => {
      mockExecute.mockResolvedValueOnce([[
        { key: 'default_new_user_balance', value: '500', updated_at: '2026-05-19T00:00:00Z', updated_by: 1 },
      ]]);
      const res = await request(createApp()).get('/api/admin/settings');
      expect(res.status).toBe(200);
      expect(Object.keys(res.body)).toEqual(['rows']);
      expect(Array.isArray(res.body.rows)).toBe(true);
      expect(Object.keys(res.body.rows[0]).sort()).toEqual([
        'key',
        'updatedAt',
        'updatedBy',
        'value',
      ]);
      expect(typeof res.body.rows[0].key).toBe('string');
    });

    it('500 yields { message }', async () => {
      mockExecute.mockRejectedValueOnce(new Error('boom'));
      const res = await request(createApp()).get('/api/admin/settings');
      expect(res.status).toBe(500);
      expect(Object.keys(res.body)).toEqual(['message']);
    });

    it('403 yields { message }', async () => {
      mockAuthUser.role = 'user';
      const res = await request(createApp()).get('/api/admin/settings');
      expect(res.status).toBe(403);
      expect(Object.keys(res.body)).toEqual(['message']);
    });
  });

  // -------------------------------------------------------------------------
  // GET /:key
  // -------------------------------------------------------------------------
  describe('GET /:key', () => {
    it('locks single row shape', async () => {
      mockExecute.mockResolvedValueOnce([[
        { key: 'min_house_edge_floor', value: '0.05', updated_at: '2026-05-19T00:00:00Z', updated_by: 1 },
      ]]);
      const res = await request(createApp()).get('/api/admin/settings/min_house_edge_floor');
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(['key', 'updatedAt', 'updatedBy', 'value']);
      expect(typeof res.body.key).toBe('string');
    });

    it('404 yields { message }', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const res = await request(createApp()).get('/api/admin/settings/does_not_exist');
      expect(res.status).toBe(404);
      expect(Object.keys(res.body)).toEqual(['message']);
    });

    it('500 yields { message }', async () => {
      mockExecute.mockRejectedValueOnce(new Error('boom'));
      const res = await request(createApp()).get('/api/admin/settings/default_new_user_balance');
      expect(res.status).toBe(500);
      expect(Object.keys(res.body)).toEqual(['message']);
    });
  });

  // -------------------------------------------------------------------------
  // PUT /:key
  // -------------------------------------------------------------------------
  describe('PUT /:key', () => {
    it('locks { key, value } shape on success', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const res = await request(createApp())
        .put('/api/admin/settings/default_new_user_balance')
        .send({ value: 1000 });
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(['key', 'value']);
      expect(res.body.key).toBe('default_new_user_balance');
      expect(res.body.value).toBe(1000);
    });

    it('400 (disallowed key) yields { message }', async () => {
      const res = await request(createApp())
        .put('/api/admin/settings/max_payout_per_round')
        .send({ value: 999 });
      expect(res.status).toBe(400);
      expect(Object.keys(res.body)).toEqual(['message']);
    });

    it('400 (missing value) yields { message }', async () => {
      const res = await request(createApp())
        .put('/api/admin/settings/default_new_user_balance')
        .send({});
      expect(res.status).toBe(400);
      expect(Object.keys(res.body)).toEqual(['message']);
    });

    it('403 yields { message }', async () => {
      mockAuthUser.role = 'operator';
      const res = await request(createApp())
        .put('/api/admin/settings/default_new_user_balance')
        .send({ value: 1 });
      expect(res.status).toBe(403);
      expect(Object.keys(res.body)).toEqual(['message']);
    });

    it('500 yields { message }', async () => {
      mockExecute.mockRejectedValueOnce(new Error('boom'));
      const res = await request(createApp())
        .put('/api/admin/settings/default_new_user_balance')
        .send({ value: 100 });
      expect(res.status).toBe(500);
      expect(Object.keys(res.body)).toEqual(['message']);
    });
  });
});
