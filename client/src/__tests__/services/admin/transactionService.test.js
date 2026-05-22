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
let transactionService;

beforeEach(async () => {
  vi.resetModules();
  const apiMod = await import('@/services/api');
  api = apiMod.default;
  Object.values(api).forEach((fn) => fn.mockReset && fn.mockReset());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const mod = await import('@/services/admin/transactionService');
  transactionService = mod.default;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('transactionService', () => {
  describe('getTransactions', () => {
    it('GETs /admin/transactions with params', async () => {
      api.get.mockResolvedValueOnce({ items: [] });
      await transactionService.getTransactions({ page: 1 });
      expect(api.get).toHaveBeenCalledWith('/admin/transactions', { params: { page: 1 } });
    });

    it('defaults params to an empty object', async () => {
      api.get.mockResolvedValueOnce({});
      await transactionService.getTransactions();
      expect(api.get).toHaveBeenCalledWith('/admin/transactions', { params: {} });
    });

    it('rethrows on error', async () => {
      api.get.mockRejectedValueOnce(new Error('fail'));
      await expect(transactionService.getTransactions()).rejects.toThrow('fail');
    });
  });

  describe('createTransaction', () => {
    it('POSTs the transaction body', async () => {
      api.post.mockResolvedValueOnce({ id: 't1' });
      await transactionService.createTransaction({ amount: 100 });
      expect(api.post).toHaveBeenCalledWith('/admin/transactions', { amount: 100 });
    });

    it('rethrows on error', async () => {
      api.post.mockRejectedValueOnce(new Error('fail'));
      await expect(transactionService.createTransaction({})).rejects.toThrow('fail');
    });
  });

  describe('voidTransaction', () => {
    it('PUTs the void endpoint with reason', async () => {
      api.put.mockResolvedValueOnce({ ok: true });
      await transactionService.voidTransaction('t1', 'duplicate');
      expect(api.put).toHaveBeenCalledWith('/admin/transactions/t1/void', { reason: 'duplicate' });
    });

    it('rethrows on error', async () => {
      api.put.mockRejectedValueOnce(new Error('fail'));
      await expect(transactionService.voidTransaction('t1', 'r')).rejects.toThrow('fail');
    });
  });
});
