// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock('../../../drizzle/db.js', () => ({
  db: {
    execute: mockExecute,
  },
}));

vi.mock('drizzle-orm', () => ({
  sql: Object.assign(
    (...args: any[]) => args,
    { join: (...args: any[]) => args },
  ),
}));

vi.mock('../../services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  },
}));

import UserDefaultsService from '../../services/userDefaultsService.js';

describe('UserDefaultsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (UserDefaultsService as any).invalidate();
  });

  describe('getDefaultNewUserBalance()', () => {
    it('returns hard-coded default (0) when no settings row exists', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const amount = await UserDefaultsService.getDefaultNewUserBalance();

      expect(amount).toBe(0);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('returns settings-override numeric value when present (string)', async () => {
      mockExecute.mockResolvedValueOnce([[{ value: '5000' }]]);

      const amount = await UserDefaultsService.getDefaultNewUserBalance();

      expect(amount).toBe(5000);
    });

    it('returns settings-override numeric value when present (JSON-encoded number)', async () => {
      mockExecute.mockResolvedValueOnce([[{ value: '1234.56' }]]);

      const amount = await UserDefaultsService.getDefaultNewUserBalance();

      expect(amount).toBe(1234.56);
    });

    it('returns settings-override numeric value when present (raw number)', async () => {
      mockExecute.mockResolvedValueOnce([[{ value: 750 }]]);

      const amount = await UserDefaultsService.getDefaultNewUserBalance();

      expect(amount).toBe(750);
    });

    it('falls back to default when settings value is null', async () => {
      mockExecute.mockResolvedValueOnce([[{ value: null }]]);

      const amount = await UserDefaultsService.getDefaultNewUserBalance();

      expect(amount).toBe(0);
    });

    it('falls back to default when settings value is empty string', async () => {
      mockExecute.mockResolvedValueOnce([[{ value: '' }]]);

      const amount = await UserDefaultsService.getDefaultNewUserBalance();

      expect(amount).toBe(0);
    });

    it('falls back to default when settings value is non-numeric string ("abc")', async () => {
      mockExecute.mockResolvedValueOnce([[{ value: 'abc' }]]);

      const amount = await UserDefaultsService.getDefaultNewUserBalance();

      expect(amount).toBe(0);
    });

    it('falls back to default when settings value is negative', async () => {
      mockExecute.mockResolvedValueOnce([[{ value: '-100' }]]);

      const amount = await UserDefaultsService.getDefaultNewUserBalance();

      expect(amount).toBe(0);
    });

    it('falls back to default when settings value is zero', async () => {
      mockExecute.mockResolvedValueOnce([[{ value: '0' }]]);

      const amount = await UserDefaultsService.getDefaultNewUserBalance();

      expect(amount).toBe(0);
    });

    it('falls back to default when settings value is NaN string', async () => {
      mockExecute.mockResolvedValueOnce([[{ value: 'NaN' }]]);

      const amount = await UserDefaultsService.getDefaultNewUserBalance();

      expect(amount).toBe(0);
    });

    it('falls back to default when settings value is Infinity-like', async () => {
      mockExecute.mockResolvedValueOnce([[{ value: 'Infinity' }]]);

      const amount = await UserDefaultsService.getDefaultNewUserBalance();

      expect(amount).toBe(0);
    });

    it('falls back to default when DB throws (does not propagate)', async () => {
      mockExecute.mockRejectedValueOnce(new Error('DB down'));

      const amount = await UserDefaultsService.getDefaultNewUserBalance();

      expect(amount).toBe(0);
    });

    it('caches successful reads within the TTL window', async () => {
      mockExecute.mockResolvedValueOnce([[{ value: '500' }]]);

      const first = await UserDefaultsService.getDefaultNewUserBalance();
      const second = await UserDefaultsService.getDefaultNewUserBalance();
      const third = await UserDefaultsService.getDefaultNewUserBalance();

      expect(first).toBe(500);
      expect(second).toBe(500);
      expect(third).toBe(500);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('invalidate() forces a fresh DB read on next call', async () => {
      mockExecute.mockResolvedValueOnce([[{ value: '100' }]]);
      const first = await UserDefaultsService.getDefaultNewUserBalance();
      expect(first).toBe(100);

      (UserDefaultsService as any).invalidate();

      mockExecute.mockResolvedValueOnce([[{ value: '999' }]]);
      const second = await UserDefaultsService.getDefaultNewUserBalance();

      expect(second).toBe(999);
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });
  });
});
