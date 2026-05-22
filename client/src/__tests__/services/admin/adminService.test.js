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
let adminService;

beforeEach(async () => {
  vi.resetModules();
  const apiMod = await import('@/services/api');
  api = apiMod.default;
  Object.values(api).forEach((fn) => fn.mockReset && fn.mockReset());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const mod = await import('@/services/admin/adminService');
  adminService = mod.default;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('adminService', () => {
  describe('getDashboardStats', () => {
    it('forwards to GET /admin/dashboard', async () => {
      api.get.mockResolvedValueOnce({ total: 1 });
      const result = await adminService.getDashboardStats();
      expect(api.get).toHaveBeenCalledWith('/admin/dashboard');
      expect(result).toEqual({ total: 1 });
    });

    it('rethrows when the api errors', async () => {
      api.get.mockRejectedValueOnce(new Error('boom'));
      await expect(adminService.getDashboardStats()).rejects.toThrow('boom');
    });
  });

  describe('getGameStats', () => {
    it('passes filters as params', async () => {
      api.get.mockResolvedValueOnce([]);
      await adminService.getGameStats({ gameType: 'crash' });
      expect(api.get).toHaveBeenCalledWith('/admin/games', { params: { gameType: 'crash' } });
    });

    it('uses default empty filters', async () => {
      api.get.mockResolvedValueOnce([]);
      await adminService.getGameStats();
      expect(api.get).toHaveBeenCalledWith('/admin/games', { params: {} });
    });

    it('rethrows on error', async () => {
      api.get.mockRejectedValueOnce(new Error('nope'));
      await expect(adminService.getGameStats()).rejects.toThrow('nope');
    });
  });

  describe('getPlayers', () => {
    it('returns response unchanged when it has a players field', async () => {
      api.get.mockResolvedValueOnce({ players: [{ id: 1 }], totalCount: 1 });
      const r = await adminService.getPlayers({ page: 2 });
      expect(api.get).toHaveBeenCalledWith('/admin/users', { params: { page: 2 } });
      expect(r).toEqual({ players: [{ id: 1 }], totalCount: 1 });
    });

    it('normalizes array response into { players, totalCount }', async () => {
      api.get.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
      const r = await adminService.getPlayers();
      expect(r).toEqual({ players: [{ id: 1 }, { id: 2 }], totalCount: 2 });
    });

    it('returns object responses without a players field unchanged', async () => {
      api.get.mockResolvedValueOnce({ data: 'x' });
      const r = await adminService.getPlayers();
      expect(r).toEqual({ data: 'x' });
    });

    it('rethrows on error', async () => {
      api.get.mockRejectedValueOnce(new Error('fail'));
      await expect(adminService.getPlayers()).rejects.toThrow('fail');
    });
  });

  describe('createPlayer', () => {
    it('POSTs to /admin/users', async () => {
      api.post.mockResolvedValueOnce({ id: 'u1' });
      const r = await adminService.createPlayer({ username: 'x' });
      expect(api.post).toHaveBeenCalledWith('/admin/users', { username: 'x' });
      expect(r).toEqual({ id: 'u1' });
    });

    it('rethrows on error', async () => {
      api.post.mockRejectedValueOnce(new Error('fail'));
      await expect(adminService.createPlayer({})).rejects.toThrow('fail');
    });
  });

  describe('updatePlayer', () => {
    it('PUTs to /admin/users/:id', async () => {
      api.put.mockResolvedValueOnce({ ok: true });
      await adminService.updatePlayer('u1', { name: 'y' });
      expect(api.put).toHaveBeenCalledWith('/admin/users/u1', { name: 'y' });
    });

    it('rethrows on error', async () => {
      api.put.mockRejectedValueOnce(new Error('fail'));
      await expect(adminService.updatePlayer('u1', {})).rejects.toThrow('fail');
    });
  });

  describe('deletePlayer', () => {
    it('DELETEs /admin/users/:id', async () => {
      api.delete.mockResolvedValueOnce({ ok: true });
      await adminService.deletePlayer('u1');
      expect(api.delete).toHaveBeenCalledWith('/admin/users/u1');
    });

    it('rethrows on error', async () => {
      api.delete.mockRejectedValueOnce(new Error('fail'));
      await expect(adminService.deletePlayer('u1')).rejects.toThrow('fail');
    });
  });

  describe('addFunds', () => {
    it('POSTs a positive amount with credit reason', async () => {
      api.post.mockResolvedValueOnce({ ok: true });
      await adminService.addFunds('u1', 50);
      expect(api.post).toHaveBeenCalledWith('/admin/users/u1/balance', {
        amount: 50,
        reason: 'Admin credit',
      });
    });

    it('uses absolute value of negative input', async () => {
      api.post.mockResolvedValueOnce({ ok: true });
      await adminService.addFunds('u1', -25);
      expect(api.post).toHaveBeenCalledWith('/admin/users/u1/balance', {
        amount: 25,
        reason: 'Admin credit',
      });
    });

    it('rethrows on error', async () => {
      api.post.mockRejectedValueOnce(new Error('fail'));
      await expect(adminService.addFunds('u1', 1)).rejects.toThrow('fail');
    });
  });

  describe('removeFunds', () => {
    it('POSTs a negative amount with debit reason', async () => {
      api.post.mockResolvedValueOnce({ ok: true });
      await adminService.removeFunds('u1', 50);
      expect(api.post).toHaveBeenCalledWith('/admin/users/u1/balance', {
        amount: -50,
        reason: 'Admin debit',
      });
    });

    it('inverts negative input into a negative amount', async () => {
      api.post.mockResolvedValueOnce({ ok: true });
      await adminService.removeFunds('u1', -25);
      expect(api.post).toHaveBeenCalledWith('/admin/users/u1/balance', {
        amount: -25,
        reason: 'Admin debit',
      });
    });

    it('rethrows on error', async () => {
      api.post.mockRejectedValueOnce(new Error('fail'));
      await expect(adminService.removeFunds('u1', 1)).rejects.toThrow('fail');
    });
  });

  describe('getTransactions', () => {
    it('GETs /admin/transactions with params', async () => {
      api.get.mockResolvedValueOnce({ items: [] });
      await adminService.getTransactions({ limit: 10 });
      expect(api.get).toHaveBeenCalledWith('/admin/transactions', { params: { limit: 10 } });
    });

    it('uses default empty params', async () => {
      api.get.mockResolvedValueOnce({ items: [] });
      await adminService.getTransactions();
      expect(api.get).toHaveBeenCalledWith('/admin/transactions', { params: {} });
    });

    it('rethrows on error', async () => {
      api.get.mockRejectedValueOnce(new Error('fail'));
      await expect(adminService.getTransactions()).rejects.toThrow('fail');
    });
  });
});
