import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

let api;
let analyticsService;

beforeEach(async () => {
  vi.resetModules();
  const apiMod = await import('@/services/api');
  api = apiMod.default;
  Object.values(api).forEach((fn) => fn.mockReset && fn.mockReset());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const mod = await import('@/services/admin/analyticsService');
  analyticsService = mod.default;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('analyticsService', () => {
  describe('getAllGamesOverview', () => {
    it('GETs /admin/analytics/games with params', async () => {
      api.get.mockResolvedValueOnce({ games: [] });
      await analyticsService.getAllGamesOverview({ period: '7d' });
      expect(api.get).toHaveBeenCalledWith('/admin/analytics/games', { params: { period: '7d' } });
    });

    it('uses default empty params', async () => {
      api.get.mockResolvedValueOnce({});
      await analyticsService.getAllGamesOverview();
      expect(api.get).toHaveBeenCalledWith('/admin/analytics/games', { params: {} });
    });

    it('rethrows on error', async () => {
      api.get.mockRejectedValueOnce(new Error('fail'));
      await expect(analyticsService.getAllGamesOverview()).rejects.toThrow('fail');
    });
  });

  describe('getGameDetail', () => {
    it('GETs the typed game-detail path', async () => {
      api.get.mockResolvedValueOnce({});
      await analyticsService.getGameDetail('crash', { period: '30d' });
      expect(api.get).toHaveBeenCalledWith('/admin/analytics/games/crash', { params: { period: '30d' } });
    });

    it('defaults params to an empty object', async () => {
      api.get.mockResolvedValueOnce({});
      await analyticsService.getGameDetail('roulette');
      expect(api.get).toHaveBeenCalledWith('/admin/analytics/games/roulette', { params: {} });
    });

    it('rethrows on error', async () => {
      api.get.mockRejectedValueOnce(new Error('fail'));
      await expect(analyticsService.getGameDetail('crash')).rejects.toThrow('fail');
    });
  });

  describe('getPlayerProfile', () => {
    it('GETs /admin/analytics/players/:id/profile', async () => {
      api.get.mockResolvedValueOnce({ id: 'u1' });
      await analyticsService.getPlayerProfile('u1');
      expect(api.get).toHaveBeenCalledWith('/admin/analytics/players/u1/profile');
    });

    it('rethrows on error', async () => {
      api.get.mockRejectedValueOnce(new Error('fail'));
      await expect(analyticsService.getPlayerProfile('u1')).rejects.toThrow('fail');
    });
  });

  describe('getPlayerSessions', () => {
    it('GETs sessions with provided params', async () => {
      api.get.mockResolvedValueOnce([]);
      await analyticsService.getPlayerSessions('u1', { page: 2 });
      expect(api.get).toHaveBeenCalledWith('/admin/analytics/players/u1/sessions', {
        params: { page: 2 },
      });
    });

    it('defaults params to an empty object', async () => {
      api.get.mockResolvedValueOnce([]);
      await analyticsService.getPlayerSessions('u1');
      expect(api.get).toHaveBeenCalledWith('/admin/analytics/players/u1/sessions', { params: {} });
    });

    it('rethrows on error', async () => {
      api.get.mockRejectedValueOnce(new Error('fail'));
      await expect(analyticsService.getPlayerSessions('u1')).rejects.toThrow('fail');
    });
  });

  describe('getTopPlayers', () => {
    it('GETs /admin/analytics/top-players', async () => {
      api.get.mockResolvedValueOnce([]);
      await analyticsService.getTopPlayers({ limit: 20 });
      expect(api.get).toHaveBeenCalledWith('/admin/analytics/top-players', { params: { limit: 20 } });
    });

    it('defaults params to an empty object', async () => {
      api.get.mockResolvedValueOnce([]);
      await analyticsService.getTopPlayers();
      expect(api.get).toHaveBeenCalledWith('/admin/analytics/top-players', { params: {} });
    });

    it('rethrows on error', async () => {
      api.get.mockRejectedValueOnce(new Error('fail'));
      await expect(analyticsService.getTopPlayers()).rejects.toThrow('fail');
    });
  });

  describe('getRevenue', () => {
    it('GETs /admin/analytics/revenue', async () => {
      api.get.mockResolvedValueOnce({});
      await analyticsService.getRevenue({ granularity: 'day' });
      expect(api.get).toHaveBeenCalledWith('/admin/analytics/revenue', {
        params: { granularity: 'day' },
      });
    });

    it('defaults params to an empty object', async () => {
      api.get.mockResolvedValueOnce({});
      await analyticsService.getRevenue();
      expect(api.get).toHaveBeenCalledWith('/admin/analytics/revenue', { params: {} });
    });

    it('rethrows on error', async () => {
      api.get.mockRejectedValueOnce(new Error('fail'));
      await expect(analyticsService.getRevenue()).rejects.toThrow('fail');
    });
  });
});
