// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockDbExecute, selectChain, updateChain } = vi.hoisted(() => {
  function chainable(result: any) {
    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockResolvedValue(result);
    chain.update = vi.fn().mockReturnValue(chain);
    chain.set = vi.fn().mockReturnValue(chain);
    return chain;
  }
  return {
    mockDbExecute: vi.fn(),
    selectChain: chainable([]),
    updateChain: chainable([]),
  };
});

vi.mock('../../../drizzle/db.js', () => ({
  db: {
    select: (...args: any[]) => selectChain.select(...args),
    update: (...args: any[]) => updateChain.update(...args),
    execute: mockDbExecute,
  },
}));

vi.mock('../../../drizzle/schema.js', () => ({
  users: {
    id: 'id',
    isActive: 'isActive',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: any[]) => args),
  sql: (strings: any, ...values: any[]) => ({ strings, values }),
}));

// ---------------------------------------------------------------------------
// Import service under test (after mocks)
// ---------------------------------------------------------------------------

import responsibleGamingService, {
  getUserActiveState,
  deactivateUser,
  getActivitySummaryLast7Days,
  getActivitySummaryLast30Days,
  listSettings,
  getSetting,
  upsertSetting,
} from '../../services/responsibleGamingService.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResponsibleGamingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectChain.where.mockResolvedValue([]);
    updateChain.where.mockResolvedValue([]);
  });

  // -------------------------------------------------------------------------
  // getUserActiveState
  // -------------------------------------------------------------------------
  describe('getUserActiveState()', () => {
    it('returns the row when the user exists (active)', async () => {
      selectChain.where.mockResolvedValueOnce([{ isActive: true }]);
      const row = await getUserActiveState(42);
      expect(row).toEqual({ isActive: true });
      expect(selectChain.select).toHaveBeenCalled();
      expect(selectChain.from).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
    });

    it('returns the row when the user exists (inactive)', async () => {
      selectChain.where.mockResolvedValueOnce([{ isActive: false }]);
      const row = await getUserActiveState(42);
      expect(row).toEqual({ isActive: false });
    });

    it('returns undefined when no user row is returned', async () => {
      selectChain.where.mockResolvedValueOnce([]);
      const row = await getUserActiveState(999);
      expect(row).toBeUndefined();
    });

    it('propagates errors from the db', async () => {
      selectChain.where.mockRejectedValueOnce(new Error('boom'));
      await expect(getUserActiveState(1)).rejects.toThrow('boom');
    });
  });

  // -------------------------------------------------------------------------
  // deactivateUser
  // -------------------------------------------------------------------------
  describe('deactivateUser()', () => {
    it('issues an update setting isActive=false and updatedAt', async () => {
      updateChain.where.mockResolvedValueOnce([]);
      await deactivateUser(42);
      expect(updateChain.update).toHaveBeenCalled();
      expect(updateChain.set).toHaveBeenCalled();
      const setCallArg = updateChain.set.mock.calls[0]?.[0];
      expect(setCallArg).toMatchObject({ isActive: false });
      expect(setCallArg.updatedAt).toBeInstanceOf(Date);
      expect(updateChain.where).toHaveBeenCalled();
    });

    it('propagates errors from the db', async () => {
      updateChain.where.mockRejectedValueOnce(new Error('db down'));
      await expect(deactivateUser(1)).rejects.toThrow('db down');
    });
  });

  // -------------------------------------------------------------------------
  // getActivitySummaryLast7Days
  // -------------------------------------------------------------------------
  describe('getActivitySummaryLast7Days()', () => {
    it('returns the first row of the aggregate result', async () => {
      mockDbExecute.mockResolvedValueOnce([
        { totalTransactions: 10, totalLosses: '200', totalWins: '500' },
      ]);
      const row = await getActivitySummaryLast7Days(7);
      expect(row).toEqual({ totalTransactions: 10, totalLosses: '200', totalWins: '500' });
      expect(mockDbExecute).toHaveBeenCalledTimes(1);
    });

    it('tolerates mysql2 [rows, fields] driver shape', async () => {
      mockDbExecute.mockResolvedValueOnce([
        [{ totalTransactions: 5, totalLosses: '100', totalWins: '300' }],
        [],
      ]);
      const row = await getActivitySummaryLast7Days(7);
      expect(row).toEqual({ totalTransactions: 5, totalLosses: '100', totalWins: '300' });
    });

    it('returns an empty object when no rows', async () => {
      mockDbExecute.mockResolvedValueOnce([]);
      const row = await getActivitySummaryLast7Days(7);
      expect(row).toEqual({});
    });
  });

  // -------------------------------------------------------------------------
  // getActivitySummaryLast30Days
  // -------------------------------------------------------------------------
  describe('getActivitySummaryLast30Days()', () => {
    it('returns the first row of the aggregate result', async () => {
      mockDbExecute.mockResolvedValueOnce([
        { totalTransactions: 50, totalLosses: '1000', totalWins: '2000' },
      ]);
      const row = await getActivitySummaryLast30Days(7);
      expect(row).toEqual({ totalTransactions: 50, totalLosses: '1000', totalWins: '2000' });
    });

    it('tolerates mysql2 [rows, fields] driver shape', async () => {
      mockDbExecute.mockResolvedValueOnce([
        [{ totalTransactions: 20, totalLosses: '500', totalWins: '800' }],
        [],
      ]);
      const row = await getActivitySummaryLast30Days(7);
      expect(row).toEqual({ totalTransactions: 20, totalLosses: '500', totalWins: '800' });
    });

    it('propagates db errors', async () => {
      mockDbExecute.mockRejectedValueOnce(new Error('db boom'));
      await expect(getActivitySummaryLast30Days(7)).rejects.toThrow('db boom');
    });
  });

  // -------------------------------------------------------------------------
  // listSettings
  // -------------------------------------------------------------------------
  describe('listSettings()', () => {
    it('returns the rows array from db.execute', async () => {
      const rows = [
        { key: 'default_new_user_balance', value: '500', updated_at: null, updated_by: 1 },
        { key: 'min_house_edge_floor', value: '0.02', updated_at: null, updated_by: 1 },
      ];
      mockDbExecute.mockResolvedValueOnce([rows]);
      const result = await listSettings();
      expect(result).toEqual(rows);
    });

    it('returns an empty array when no rows', async () => {
      mockDbExecute.mockResolvedValueOnce([[]]);
      const result = await listSettings();
      expect(result).toEqual([]);
    });

    it('propagates db errors', async () => {
      mockDbExecute.mockRejectedValueOnce(new Error('db boom'));
      await expect(listSettings()).rejects.toThrow('db boom');
    });
  });

  // -------------------------------------------------------------------------
  // getSetting
  // -------------------------------------------------------------------------
  describe('getSetting()', () => {
    it('returns the first row when found', async () => {
      mockDbExecute.mockResolvedValueOnce([
        [{ key: 'foo', value: '"bar"', updated_at: null, updated_by: null }],
      ]);
      const row = await getSetting('foo');
      expect(row).toEqual({ key: 'foo', value: '"bar"', updated_at: null, updated_by: null });
    });

    it('returns undefined when not found', async () => {
      mockDbExecute.mockResolvedValueOnce([[]]);
      const row = await getSetting('nope');
      expect(row).toBeUndefined();
    });

    it('passes the key as a bound value in the sql template', async () => {
      mockDbExecute.mockResolvedValueOnce([[]]);
      await getSetting('default_new_user_balance');
      const sqlObj = mockDbExecute.mock.calls[0][0];
      expect(sqlObj.values).toContain('default_new_user_balance');
    });
  });

  // -------------------------------------------------------------------------
  // upsertSetting
  // -------------------------------------------------------------------------
  describe('upsertSetting()', () => {
    it('issues the INSERT ... ON DUPLICATE KEY UPDATE with bound values', async () => {
      mockDbExecute.mockResolvedValueOnce([[]]);
      await upsertSetting('default_new_user_balance', '1000', 7);
      const sqlObj = mockDbExecute.mock.calls[0][0];
      // Key, valueJson (twice, once for insert and once for update), adminId (twice)
      expect(sqlObj.values).toContain('default_new_user_balance');
      expect(sqlObj.values).toContain('1000');
      expect(sqlObj.values).toContain(7);
    });

    it('substitutes null when adminId is null', async () => {
      mockDbExecute.mockResolvedValueOnce([[]]);
      await upsertSetting('custom.x', '"y"', null);
      const sqlObj = mockDbExecute.mock.calls[0][0];
      // null appears at the bound positions for updated_by
      expect(sqlObj.values).toContain(null);
    });

    it('propagates db errors', async () => {
      mockDbExecute.mockRejectedValueOnce(new Error('db boom'));
      await expect(upsertSetting('custom.x', '"y"', null)).rejects.toThrow('db boom');
    });
  });

  // -------------------------------------------------------------------------
  // Default export shape
  // -------------------------------------------------------------------------
  describe('default export', () => {
    it('exposes all public methods', () => {
      expect(typeof responsibleGamingService.getUserActiveState).toBe('function');
      expect(typeof responsibleGamingService.deactivateUser).toBe('function');
      expect(typeof responsibleGamingService.getActivitySummaryLast7Days).toBe('function');
      expect(typeof responsibleGamingService.getActivitySummaryLast30Days).toBe('function');
      expect(typeof responsibleGamingService.listSettings).toBe('function');
      expect(typeof responsibleGamingService.getSetting).toBe('function');
      expect(typeof responsibleGamingService.upsertSetting).toBe('function');
    });
  });
});
