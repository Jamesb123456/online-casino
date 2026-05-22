// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockSelect, mockInsert, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../../drizzle/db.js', () => {
  const dbObj = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  };
  return { db: dbObj, default: dbObj };
});

vi.mock('../../../drizzle/schema.js', () => ({
  balances: {
    id: 'balances.id',
    userId: 'balances.userId',
    amount: 'balances.amount',
    previousBalance: 'balances.previousBalance',
    changeAmount: 'balances.changeAmount',
    type: 'balances.type',
    gameType: 'balances.gameType',
    note: 'balances.note',
    adminId: 'balances.adminId',
    transactionId: 'balances.transactionId',
    createdAt: 'balances.createdAt',
    updatedAt: 'balances.updatedAt',
  },
  users: {
    id: 'users.id',
    username: 'users.username',
  },
  transactions: {
    id: 'transactions.id',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args) => ({ type: 'eq', args })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  desc: vi.fn((col) => ({ type: 'desc', col })),
}));

// ---------------------------------------------------------------------------
// Import the model AFTER mocks
// ---------------------------------------------------------------------------
import BalanceModel from '../../../drizzle/models/Balance.js';

// ---------------------------------------------------------------------------
// Chain helpers (drizzle uses thenable chained builders)
// ---------------------------------------------------------------------------
function buildChain(resolvedValue: any) {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
  };
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(resolvedValue).then(resolve, reject);
  chain.catch = (reject: any) => Promise.resolve(resolvedValue).catch(reject);
  return chain;
}

function buildInsertChain(resolvedValue: any) {
  const chain: any = { values: vi.fn().mockReturnThis() };
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(resolvedValue).then(resolve, reject);
  chain.catch = (reject: any) => Promise.resolve(resolvedValue).catch(reject);
  return chain;
}

function buildUpdateChain(resolvedValue: any) {
  const chain: any = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  };
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(resolvedValue).then(resolve, reject);
  chain.catch = (reject: any) => Promise.resolve(resolvedValue).catch(reject);
  return chain;
}

function buildDeleteChain(resolvedValue: any) {
  const chain: any = { where: vi.fn().mockReturnThis() };
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(resolvedValue).then(resolve, reject);
  chain.catch = (reject: any) => Promise.resolve(resolvedValue).catch(reject);
  return chain;
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleBalance = {
  id: 1,
  userId: 42,
  amount: '500.00',
  previousBalance: '400.00',
  changeAmount: '100.00',
  type: 'win',
  gameType: 'crash',
  note: 'win',
  adminId: null,
  transactionId: 7,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

describe('BalanceModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // create()
  // -------------------------------------------------------------------------
  describe('create()', () => {
    it('inserts a balance and returns the created record', async () => {
      mockInsert.mockReturnValue(buildInsertChain({ insertId: 1 }));
      mockSelect.mockReturnValue(buildChain([sampleBalance]));

      const result = await BalanceModel.create({
        userId: 42,
        amount: '500.00',
        previousBalance: '400.00',
        changeAmount: '100.00',
        type: 'win',
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(sampleBalance);
    });

    it('stamps createdAt and updatedAt on the inserted row', async () => {
      const insertChain = buildInsertChain({ insertId: 1 });
      mockInsert.mockReturnValue(insertChain);
      mockSelect.mockReturnValue(buildChain([sampleBalance]));

      await BalanceModel.create({ userId: 42, amount: '100', type: 'win' });

      const vals = insertChain.values.mock.calls[0][0];
      expect(vals).toHaveProperty('createdAt');
      expect(vals).toHaveProperty('updatedAt');
    });

    it('throws a wrapped error when insert fails', async () => {
      mockInsert.mockImplementation(() => {
        throw new Error('insert exploded');
      });

      await expect(BalanceModel.create({ userId: 1 })).rejects.toThrow(
        'Error creating balance record: insert exploded',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findById()
  // -------------------------------------------------------------------------
  describe('findById()', () => {
    it('returns the balance when found', async () => {
      mockSelect.mockReturnValue(buildChain([sampleBalance]));
      const result = await BalanceModel.findById(1);
      expect(result).toEqual(sampleBalance);
    });

    it('returns null when balance does not exist', async () => {
      mockSelect.mockReturnValue(buildChain([]));
      const result = await BalanceModel.findById(999);
      expect(result).toBeNull();
    });

    it('wraps query errors', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('boom');
      });
      await expect(BalanceModel.findById(1)).rejects.toThrow(
        'Error finding balance by ID: boom',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getCurrentBalance()
  // -------------------------------------------------------------------------
  describe('getCurrentBalance()', () => {
    it('returns the parsed float amount of the latest balance', async () => {
      mockSelect.mockReturnValue(buildChain([{ ...sampleBalance, amount: '123.45' }]));
      const result = await BalanceModel.getCurrentBalance(42);
      expect(result).toBe(123.45);
    });

    it('returns 0 when the user has no balance rows', async () => {
      mockSelect.mockReturnValue(buildChain([]));
      const result = await BalanceModel.getCurrentBalance(42);
      expect(result).toBe(0);
    });

    it('wraps query errors', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('db down');
      });
      await expect(BalanceModel.getCurrentBalance(42)).rejects.toThrow(
        'Error getting current balance: db down',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getBalanceHistory()
  // -------------------------------------------------------------------------
  describe('getBalanceHistory()', () => {
    it('returns the joined history rows with default limit', async () => {
      const rows = [
        {
          id: 1,
          userId: 42,
          amount: '500.00',
          prevAmount: '400.00',
          changeAmount: '100.00',
          changeType: 'win',
          reason: 'win',
          description: 'crash',
          createdAt: new Date(),
          adminUsername: null,
          transactionId: 7,
        },
      ];
      const chain = buildChain(rows);
      mockSelect.mockReturnValue(chain);

      const result = await BalanceModel.getBalanceHistory(42);

      expect(result).toEqual(rows);
      expect(chain.limit).toHaveBeenCalledWith(50);
    });

    it('respects a custom limit', async () => {
      const chain = buildChain([]);
      mockSelect.mockReturnValue(chain);
      await BalanceModel.getBalanceHistory(42, 10);
      expect(chain.limit).toHaveBeenCalledWith(10);
    });

    it('wraps query errors', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('history failed');
      });
      await expect(BalanceModel.getBalanceHistory(42)).rejects.toThrow(
        'Error getting balance history: history failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findByUserId()
  // -------------------------------------------------------------------------
  describe('findByUserId()', () => {
    it('returns paginated rows using default limit/offset', async () => {
      const chain = buildChain([sampleBalance]);
      mockSelect.mockReturnValue(chain);

      const result = await BalanceModel.findByUserId(42);

      expect(result).toEqual([sampleBalance]);
      expect(chain.limit).toHaveBeenCalledWith(50);
      expect(chain.offset).toHaveBeenCalledWith(0);
    });

    it('forwards custom limit and offset', async () => {
      const chain = buildChain([]);
      mockSelect.mockReturnValue(chain);
      await BalanceModel.findByUserId(42, 5, 10);
      expect(chain.limit).toHaveBeenCalledWith(5);
      expect(chain.offset).toHaveBeenCalledWith(10);
    });

    it('wraps query errors', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('paginate failed');
      });
      await expect(BalanceModel.findByUserId(42)).rejects.toThrow(
        'Error finding balances by user ID: paginate failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // isPositiveChange()
  // -------------------------------------------------------------------------
  describe('isPositiveChange()', () => {
    it('returns true when change is positive', () => {
      expect(BalanceModel.isPositiveChange({ changeAmount: '50.00' })).toBe(true);
    });

    it('returns false when change is negative', () => {
      expect(BalanceModel.isPositiveChange({ changeAmount: '-50.00' })).toBe(false);
    });

    it('returns false when change is zero', () => {
      expect(BalanceModel.isPositiveChange({ changeAmount: '0' })).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // update()
  // -------------------------------------------------------------------------
  describe('update()', () => {
    it('updates a balance and returns the updated row', async () => {
      const updateChain = buildUpdateChain({});
      mockUpdate.mockReturnValue(updateChain);
      mockSelect.mockReturnValue(buildChain([sampleBalance]));

      const result = await BalanceModel.update(1, { note: 'updated' });

      expect(mockUpdate).toHaveBeenCalled();
      expect(updateChain.set).toHaveBeenCalled();
      expect(result).toEqual(sampleBalance);
    });

    it('wraps update errors', async () => {
      mockUpdate.mockImplementation(() => {
        throw new Error('update failed');
      });
      await expect(BalanceModel.update(1, {})).rejects.toThrow(
        'Error updating balance: update failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // delete()
  // -------------------------------------------------------------------------
  describe('delete()', () => {
    it('returns the deleted record', async () => {
      mockSelect.mockReturnValue(buildChain([sampleBalance]));
      mockDelete.mockReturnValue(buildDeleteChain({}));

      const result = await BalanceModel.delete(1);

      expect(mockDelete).toHaveBeenCalled();
      expect(result).toEqual(sampleBalance);
    });

    it('wraps delete errors', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('lookup failed');
      });
      await expect(BalanceModel.delete(1)).rejects.toThrow(
        'Error deleting balance: lookup failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findWithDetails()
  // -------------------------------------------------------------------------
  describe('findWithDetails()', () => {
    it('filters by user id when provided', async () => {
      const chain = buildChain([sampleBalance]);
      mockSelect.mockReturnValue(chain);

      const result = await BalanceModel.findWithDetails(42, 5, 10);

      expect(result).toEqual([sampleBalance]);
      expect(chain.where).toHaveBeenCalled();
      expect(chain.limit).toHaveBeenCalledWith(5);
      expect(chain.offset).toHaveBeenCalledWith(10);
    });

    it('skips the where clause when userId is null', async () => {
      const chain = buildChain([sampleBalance]);
      mockSelect.mockReturnValue(chain);

      await BalanceModel.findWithDetails();

      expect(chain.where).not.toHaveBeenCalled();
    });

    it('wraps query errors', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('details failed');
      });
      await expect(BalanceModel.findWithDetails()).rejects.toThrow(
        'Error finding balances with details: details failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findByType()
  // -------------------------------------------------------------------------
  describe('findByType()', () => {
    it('returns rows filtered by type only', async () => {
      const chain = buildChain([sampleBalance]);
      mockSelect.mockReturnValue(chain);

      const result = await BalanceModel.findByType('win');

      expect(result).toEqual([sampleBalance]);
      expect(chain.limit).toHaveBeenCalledWith(50);
    });

    it('returns rows filtered by type and userId', async () => {
      const chain = buildChain([sampleBalance]);
      mockSelect.mockReturnValue(chain);

      await BalanceModel.findByType('win', 42, 25);

      expect(chain.limit).toHaveBeenCalledWith(25);
    });

    it('wraps query errors', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('type failed');
      });
      await expect(BalanceModel.findByType('win')).rejects.toThrow(
        'Error finding balances by type: type failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findByGameType()
  // -------------------------------------------------------------------------
  describe('findByGameType()', () => {
    it('returns rows filtered by game type only', async () => {
      const chain = buildChain([sampleBalance]);
      mockSelect.mockReturnValue(chain);

      const result = await BalanceModel.findByGameType('crash');

      expect(result).toEqual([sampleBalance]);
    });

    it('returns rows filtered by game type and userId', async () => {
      const chain = buildChain([sampleBalance]);
      mockSelect.mockReturnValue(chain);

      await BalanceModel.findByGameType('crash', 42, 15);
      expect(chain.limit).toHaveBeenCalledWith(15);
    });

    it('wraps query errors', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('gametype failed');
      });
      await expect(BalanceModel.findByGameType('crash')).rejects.toThrow(
        'Error finding balances by game type: gametype failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getBalanceStats()
  // -------------------------------------------------------------------------
  describe('getBalanceStats()', () => {
    it('aggregates wins, losses, deposits, withdrawals and net profit', async () => {
      const rows = [
        { changeAmount: '100', type: 'win' },
        { changeAmount: '50', type: 'win' },
        { changeAmount: '-40', type: 'loss' },
        { changeAmount: '200', type: 'deposit' },
        { changeAmount: '-30', type: 'withdrawal' },
        { changeAmount: '999', type: 'other' }, // exercises default branch
      ];
      mockSelect.mockReturnValue(buildChain(rows));

      const result = await BalanceModel.getBalanceStats(42);

      expect(result).toEqual({
        totalWins: 150,
        totalLosses: 40,
        totalDeposits: 200,
        totalWithdrawals: 30,
        netProfit: 110,
      });
    });

    it('returns zeros when there are no rows', async () => {
      mockSelect.mockReturnValue(buildChain([]));
      const result = await BalanceModel.getBalanceStats(42);
      expect(result).toEqual({
        totalWins: 0,
        totalLosses: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        netProfit: 0,
      });
    });

    it('wraps query errors', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('stats failed');
      });
      await expect(BalanceModel.getBalanceStats(42)).rejects.toThrow(
        'Error getting balance stats: stats failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getLatestBalance()
  // -------------------------------------------------------------------------
  describe('getLatestBalance()', () => {
    it('returns the most recent balance row', async () => {
      mockSelect.mockReturnValue(buildChain([sampleBalance]));
      const result = await BalanceModel.getLatestBalance(42);
      expect(result).toEqual(sampleBalance);
    });

    it('returns null when there are no rows', async () => {
      mockSelect.mockReturnValue(buildChain([]));
      const result = await BalanceModel.getLatestBalance(42);
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // findByUserIdAndType()
  // -------------------------------------------------------------------------
  describe('findByUserIdAndType()', () => {
    it('returns the first matching row', async () => {
      mockSelect.mockReturnValue(buildChain([sampleBalance]));
      const result = await BalanceModel.findByUserIdAndType(42, 'win');
      expect(result).toEqual(sampleBalance);
    });

    it('returns null when no row matches', async () => {
      mockSelect.mockReturnValue(buildChain([]));
      const result = await BalanceModel.findByUserIdAndType(42, 'loss');
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // findAll()
  // -------------------------------------------------------------------------
  describe('findAll()', () => {
    it('returns all balance rows', async () => {
      mockSelect.mockReturnValue(buildChain([sampleBalance]));
      const result = await BalanceModel.findAll();
      expect(result).toEqual([sampleBalance]);
    });
  });
});
