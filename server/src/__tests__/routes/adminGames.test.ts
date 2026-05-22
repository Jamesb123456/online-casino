// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockListConfigs,
  mockGetConfig,
  mockSetConfig,
  KNOWN_GAMES_MOCK,
} = vi.hoisted(() => ({
  mockListConfigs: vi.fn(),
  mockGetConfig: vi.fn(),
  mockSetConfig: vi.fn(),
  KNOWN_GAMES_MOCK: ['crash', 'roulette', 'wheel', 'plinko', 'landmines', 'blackjack', 'dice', 'slots'],
}));

// `mockAuthUser` is a mutable shared object so tests can toggle role/auth
// behaviour at runtime (admin / operator / viewer / user / unauthenticated).
const { mockAuthUser } = vi.hoisted(() => ({
  mockAuthUser: { userId: 1, username: 'admin', role: 'admin', authenticated: true },
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../middleware/auth.js', () => ({
  authenticate: vi.fn((req, res, next) => {
    if (!mockAuthUser.authenticated) {
      return res.status(401).json({ message: 'No valid session, authorization denied' });
    }
    req.user = {
      userId: mockAuthUser.userId,
      username: mockAuthUser.username,
      role: mockAuthUser.role,
    };
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

vi.mock('../../../src/services/gameConfigService.js', () => ({
  default: {
    listConfigs: mockListConfigs,
    getConfig: mockGetConfig,
    setConfig: mockSetConfig,
  },
  KNOWN_GAMES: KNOWN_GAMES_MOCK,
}));

// ---------------------------------------------------------------------------
// Import router under test
// ---------------------------------------------------------------------------

import router from '../../../routes/adminGames.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/games', router);
  return app;
}

const sampleConfig = {
  houseEdge: 0.04,
  payoutTable: {},
  maxBet: 0,
  enabled: true,
};

const sampleList = KNOWN_GAMES_MOCK.map((gameType) => ({ gameType, ...sampleConfig }));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Admin Game Configs routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.authenticated = true;
    mockAuthUser.role = 'admin';
    mockAuthUser.userId = 1;
    mockAuthUser.username = 'admin';
    mockListConfigs.mockResolvedValue(sampleList);
    mockGetConfig.mockResolvedValue(sampleConfig);
    mockSetConfig.mockResolvedValue(undefined);
  });

  // =========================================================================
  // Authorization
  // =========================================================================
  describe('Authorization', () => {
    it('rejects unauthenticated request on GET /configs with 401', async () => {
      mockAuthUser.authenticated = false;

      const res = await request(createApp()).get('/api/admin/games/configs');

      expect(res.status).toBe(401);
      expect(mockListConfigs).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated request on GET /:gameType/config with 401', async () => {
      mockAuthUser.authenticated = false;

      const res = await request(createApp()).get('/api/admin/games/crash/config');

      expect(res.status).toBe(401);
      expect(mockGetConfig).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated request on PUT /:gameType/config with 401', async () => {
      mockAuthUser.authenticated = false;

      const res = await request(createApp())
        .put('/api/admin/games/crash/config')
        .send({ houseEdge: 0.05 });

      expect(res.status).toBe(401);
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    it('rejects plain user on GET /configs with 403', async () => {
      mockAuthUser.role = 'user';

      const res = await request(createApp()).get('/api/admin/games/configs');

      expect(res.status).toBe(403);
      expect(mockListConfigs).not.toHaveBeenCalled();
    });

    it('allows viewer on GET /configs (read-only)', async () => {
      mockAuthUser.role = 'viewer';

      const res = await request(createApp()).get('/api/admin/games/configs');

      expect(res.status).toBe(200);
    });

    it('allows operator on GET /configs', async () => {
      mockAuthUser.role = 'operator';

      const res = await request(createApp()).get('/api/admin/games/configs');

      expect(res.status).toBe(200);
    });

    it('allows admin on GET /configs', async () => {
      const res = await request(createApp()).get('/api/admin/games/configs');

      expect(res.status).toBe(200);
    });

    it('allows viewer on GET /:gameType/config', async () => {
      mockAuthUser.role = 'viewer';

      const res = await request(createApp()).get('/api/admin/games/crash/config');

      expect(res.status).toBe(200);
    });

    it('rejects plain user on GET /:gameType/config with 403', async () => {
      mockAuthUser.role = 'user';

      const res = await request(createApp()).get('/api/admin/games/crash/config');

      expect(res.status).toBe(403);
    });

    it('rejects viewer on PUT /:gameType/config (admin-only write) with 403', async () => {
      mockAuthUser.role = 'viewer';

      const res = await request(createApp())
        .put('/api/admin/games/crash/config')
        .send({ houseEdge: 0.05 });

      expect(res.status).toBe(403);
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    it('rejects operator on PUT /:gameType/config (admin-only write) with 403', async () => {
      mockAuthUser.role = 'operator';

      const res = await request(createApp())
        .put('/api/admin/games/crash/config')
        .send({ houseEdge: 0.05 });

      expect(res.status).toBe(403);
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    it('rejects plain user on PUT /:gameType/config with 403', async () => {
      mockAuthUser.role = 'user';

      const res = await request(createApp())
        .put('/api/admin/games/crash/config')
        .send({ houseEdge: 0.05 });

      expect(res.status).toBe(403);
      expect(mockSetConfig).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // GET /configs
  // =========================================================================
  describe('GET /configs', () => {
    it('returns the list of game configs', async () => {
      const res = await request(createApp()).get('/api/admin/games/configs');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ configs: sampleList });
      expect(mockListConfigs).toHaveBeenCalledTimes(1);
    });

    it('returns 500 when listConfigs throws', async () => {
      mockListConfigs.mockRejectedValue(new Error('boom'));

      const res = await request(createApp()).get('/api/admin/games/configs');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error fetching game configs' });
    });
  });

  // =========================================================================
  // GET /:gameType/config
  // =========================================================================
  describe('GET /:gameType/config', () => {
    it('returns the config for a known game type', async () => {
      const res = await request(createApp()).get('/api/admin/games/crash/config');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ gameType: 'crash', ...sampleConfig });
      expect(mockGetConfig).toHaveBeenCalledWith('crash');
    });

    it('returns 404 for an unknown game type', async () => {
      const res = await request(createApp()).get('/api/admin/games/notarealgame/config');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'Unknown game type' });
      expect(mockGetConfig).not.toHaveBeenCalled();
    });

    it('returns 500 when getConfig throws', async () => {
      mockGetConfig.mockRejectedValue(new Error('db down'));

      const res = await request(createApp()).get('/api/admin/games/crash/config');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error fetching game config' });
    });
  });

  // =========================================================================
  // PUT /:gameType/config — validation
  // =========================================================================
  describe('PUT /:gameType/config validation', () => {
    it('returns 404 for an unknown game type', async () => {
      const res = await request(createApp())
        .put('/api/admin/games/notarealgame/config')
        .send({ houseEdge: 0.05 });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'Unknown game type' });
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    it('rejects null/empty body with 400', async () => {
      const res = await request(createApp())
        .put('/api/admin/games/crash/config')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'no_updatable_fields' });
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    it('rejects an array payload with 400 (invalid_payload)', async () => {
      const res = await request(createApp())
        .put('/api/admin/games/crash/config')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify([1, 2, 3]));

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: 'invalid_payload' });
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    it('rejects houseEdge below 0 with 400', async () => {
      const res = await request(createApp())
        .put('/api/admin/games/crash/config')
        .send({ houseEdge: -0.01 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('houseEdge');
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    it('rejects houseEdge above 0.5 with 400', async () => {
      const res = await request(createApp())
        .put('/api/admin/games/crash/config')
        .send({ houseEdge: 0.75 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('houseEdge');
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    it('rejects non-numeric houseEdge with 400', async () => {
      const res = await request(createApp())
        .put('/api/admin/games/crash/config')
        .send({ houseEdge: 'abc' });

      expect(res.status).toBe(400);
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    it('rejects negative maxBet with 400', async () => {
      const res = await request(createApp())
        .put('/api/admin/games/crash/config')
        .send({ maxBet: -100 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('maxBet');
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    it('rejects payoutTable that is an array with 400', async () => {
      const res = await request(createApp())
        .put('/api/admin/games/crash/config')
        .send({ payoutTable: [1, 2, 3] });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('payoutTable');
      expect(mockSetConfig).not.toHaveBeenCalled();
    });

    it('rejects non-boolean enabled with 400', async () => {
      const res = await request(createApp())
        .put('/api/admin/games/crash/config')
        .send({ enabled: 'yes' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('enabled');
      expect(mockSetConfig).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // PUT /:gameType/config — happy path
  // =========================================================================
  describe('PUT /:gameType/config success', () => {
    it('persists houseEdge update and returns the fresh config', async () => {
      const fresh = { ...sampleConfig, houseEdge: 0.06 };
      mockGetConfig.mockResolvedValue(fresh);

      const res = await request(createApp())
        .put('/api/admin/games/crash/config')
        .send({ houseEdge: 0.06 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ gameType: 'crash', ...fresh });
      expect(mockSetConfig).toHaveBeenCalledWith(
        'crash',
        { houseEdge: 0.06 },
        1, // admin userId from authenticate mock
      );
      expect(mockGetConfig).toHaveBeenCalledWith('crash');
    });

    it('persists full patch (houseEdge + maxBet + payoutTable + enabled)', async () => {
      const patch = {
        houseEdge: 0.03,
        maxBet: 5000,
        payoutTable: { win: 2 },
        enabled: false,
      };
      const fresh = { ...sampleConfig, ...patch };
      mockGetConfig.mockResolvedValue(fresh);

      const res = await request(createApp())
        .put('/api/admin/games/blackjack/config')
        .send(patch);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ gameType: 'blackjack', ...fresh });
      expect(mockSetConfig).toHaveBeenCalledWith('blackjack', patch, 1);
    });

    it('accepts maxBet === 0 (no limit sentinel)', async () => {
      const fresh = { ...sampleConfig, maxBet: 0 };
      mockGetConfig.mockResolvedValue(fresh);

      const res = await request(createApp())
        .put('/api/admin/games/wheel/config')
        .send({ maxBet: 0 });

      expect(res.status).toBe(200);
      expect(mockSetConfig).toHaveBeenCalledWith('wheel', { maxBet: 0 }, 1);
    });

    it('accepts enabled === false (disable a game)', async () => {
      const fresh = { ...sampleConfig, enabled: false };
      mockGetConfig.mockResolvedValue(fresh);

      const res = await request(createApp())
        .put('/api/admin/games/plinko/config')
        .send({ enabled: false });

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
      expect(mockSetConfig).toHaveBeenCalledWith('plinko', { enabled: false }, 1);
    });

    it('returns 500 when setConfig throws', async () => {
      mockSetConfig.mockRejectedValue(new Error('db write failed'));

      const res = await request(createApp())
        .put('/api/admin/games/crash/config')
        .send({ houseEdge: 0.05 });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Error updating game config' });
    });
  });
});
