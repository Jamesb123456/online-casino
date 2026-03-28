// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const {
  mockSelect,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockExecute,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockExecute: vi.fn(),
}));

vi.mock('../../../drizzle/db.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    execute: mockExecute,
    transaction: vi.fn(async (cb) =>
      cb({
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
        execute: mockExecute,
      }),
    ),
  },
}));

vi.mock('../../../drizzle/schema.js', () => ({
  loginRewards: {
    id: 'loginRewards.id',
    userId: 'loginRewards.userId',
    amount: 'loginRewards.amount',
    transactionId: 'loginRewards.transactionId',
    createdAt: 'loginRewards.createdAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args) => ({ type: 'eq', args })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  or: vi.fn((...args) => ({ type: 'or', args })),
  desc: vi.fn((col) => ({ type: 'desc', col })),
  asc: vi.fn((col) => ({ type: 'asc', col })),
  sql: vi.fn((strings, ...values) => ({ type: 'sql', strings, values })),
  count: vi.fn(() => 'count_fn'),
  like: vi.fn((...args) => ({ type: 'like', args })),
  between: vi.fn((...args) => ({ type: 'between', args })),
  gte: vi.fn((...args) => ({ type: 'gte', args })),
  lte: vi.fn((...args) => ({ type: 'lte', args })),
  gt: vi.fn((...args) => ({ type: 'gt', args })),
  lt: vi.fn((...args) => ({ type: 'lt', args })),
  isNull: vi.fn((col) => ({ type: 'isNull', col })),
  isNotNull: vi.fn((col) => ({ type: 'isNotNull', col })),
  inArray: vi.fn((...args) => ({ type: 'inArray', args })),
  sum: vi.fn(() => 'sum'),
}));

// ---------------------------------------------------------------------------
// Import the model AFTER mocks
// ---------------------------------------------------------------------------
import LoginRewardModel from '../../../drizzle/models/LoginReward.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildChain(resolvedValue: any) {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve(resolvedValue),
    [Symbol.toStringTag]: 'Promise',
  };
  chain.then = (resolve: any, reject?: any) => Promise.resolve(resolvedValue).then(resolve, reject);
  chain.catch = (reject: any) => Promise.resolve(resolvedValue).catch(reject);
  return chain;
}

function buildInsertChain(resolvedValue: any) {
  const chain: any = {
    values: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve(resolvedValue),
    [Symbol.toStringTag]: 'Promise',
  };
  chain.then = (resolve: any, reject?: any) => Promise.resolve(resolvedValue).then(resolve, reject);
  chain.catch = (reject: any) => Promise.resolve(resolvedValue).catch(reject);
  return chain;
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleReward = {
  id: 1,
  userId: 10,
  amount: '50.00',
  transactionId: 100,
  createdAt: new Date('2025-06-01T10:00:00Z'),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LoginRewardModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // create()
  // -------------------------------------------------------------------------
  describe('create()', () => {
    it('should insert a login reward and return the created record', async () => {
      const insertChain = buildInsertChain({ insertId: 1 });
      mockInsert.mockReturnValue(insertChain);

      const selectChain = buildChain([sampleReward]);
      mockSelect.mockReturnValue(selectChain);

      const result = await LoginRewardModel.create({
        userId: 10,
        amount: 50,
        transactionId: 100,
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(sampleReward);
    });

    it('should convert numeric amount to string', async () => {
      const insertChain = buildInsertChain({ insertId: 1 });
      mockInsert.mockReturnValue(insertChain);

      const selectChain = buildChain([sampleReward]);
      mockSelect.mockReturnValue(selectChain);

      await LoginRewardModel.create({ userId: 10, amount: 50 });

      const valuesCall = insertChain.values.mock.calls[0][0];
      expect(valuesCall.amount).toBe('50');
    });

    it('should keep string amount as-is', async () => {
      const insertChain = buildInsertChain({ insertId: 1 });
      mockInsert.mockReturnValue(insertChain);

      const selectChain = buildChain([sampleReward]);
      mockSelect.mockReturnValue(selectChain);

      await LoginRewardModel.create({ userId: 10, amount: '75.50' });

      const valuesCall = insertChain.values.mock.calls[0][0];
      expect(valuesCall.amount).toBe('75.50');
    });

    it('should throw when userId is missing', async () => {
      await expect(
        LoginRewardModel.create({ amount: 50 }),
      ).rejects.toThrow('Error creating login reward: userId and amount are required fields for login rewards');
    });

    it('should throw when amount is missing', async () => {
      await expect(
        LoginRewardModel.create({ userId: 10 }),
      ).rejects.toThrow('Error creating login reward: userId and amount are required fields for login rewards');
    });

    it('should throw an error when insert fails', async () => {
      mockInsert.mockImplementation(() => {
        throw new Error('Insert failed');
      });

      await expect(
        LoginRewardModel.create({ userId: 10, amount: 50 }),
      ).rejects.toThrow('Error creating login reward: Insert failed');
    });
  });

  // -------------------------------------------------------------------------
  // hasClaimedToday()
  // -------------------------------------------------------------------------
  describe('hasClaimedToday()', () => {
    it('should return true when a reward exists for today', async () => {
      const selectChain = buildChain([sampleReward]);
      mockSelect.mockReturnValue(selectChain);

      const result = await LoginRewardModel.hasClaimedToday(10);

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when no reward exists for today', async () => {
      const selectChain = buildChain([undefined]);
      mockSelect.mockReturnValue(selectChain);

      const result = await LoginRewardModel.hasClaimedToday(10);

      expect(result).toBe(false);
    });

    it('should return false when result is empty', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await LoginRewardModel.hasClaimedToday(10);

      expect(result).toBe(false);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Claim check failed');
      });

      await expect(LoginRewardModel.hasClaimedToday(10)).rejects.toThrow(
        'Error checking reward claim status: Claim check failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getHistoryByUserId()
  // -------------------------------------------------------------------------
  describe('getHistoryByUserId()', () => {
    it('should return reward history for a user', async () => {
      const rewardHistory = [
        sampleReward,
        { ...sampleReward, id: 2, amount: '75.00' },
      ];
      const selectChain = buildChain(rewardHistory);
      mockSelect.mockReturnValue(selectChain);

      const result = await LoginRewardModel.getHistoryByUserId(10);

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(30);
      expect(result).toEqual(rewardHistory);
    });

    it('should accept a custom limit', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await LoginRewardModel.getHistoryByUserId(10, 10);

      expect(selectChain.limit).toHaveBeenCalledWith(10);
    });

    it('should return empty array when no history exists', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await LoginRewardModel.getHistoryByUserId(10);

      expect(result).toEqual([]);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('History failed');
      });

      await expect(LoginRewardModel.getHistoryByUserId(10)).rejects.toThrow(
        'Error getting reward history: History failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getTotalRewardsByUserId()
  // -------------------------------------------------------------------------
  describe('getTotalRewardsByUserId()', () => {
    it('should return the total rewards amount for a user', async () => {
      const selectChain = buildChain([{ total: '500.00' }]);
      mockSelect.mockReturnValue(selectChain);

      const result = await LoginRewardModel.getTotalRewardsByUserId(10);

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toBe(500);
    });

    it('should return 0 when no rewards exist (null total)', async () => {
      const selectChain = buildChain([{ total: null }]);
      mockSelect.mockReturnValue(selectChain);

      const result = await LoginRewardModel.getTotalRewardsByUserId(10);

      expect(result).toBe(0);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Total rewards failed');
      });

      await expect(LoginRewardModel.getTotalRewardsByUserId(10)).rejects.toThrow(
        'Error calculating total rewards: Total rewards failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getTotalRewardsToday()
  // -------------------------------------------------------------------------
  describe('getTotalRewardsToday()', () => {
    it('should return the total rewards claimed today across all users', async () => {
      const selectChain = buildChain([{ total: '1500.00' }]);
      mockSelect.mockReturnValue(selectChain);

      const result = await LoginRewardModel.getTotalRewardsToday();

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(result).toBe(1500);
    });

    it('should return 0 when no rewards were claimed today', async () => {
      const selectChain = buildChain([{ total: null }]);
      mockSelect.mockReturnValue(selectChain);

      const result = await LoginRewardModel.getTotalRewardsToday();

      expect(result).toBe(0);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Today rewards failed');
      });

      await expect(LoginRewardModel.getTotalRewardsToday()).rejects.toThrow(
        "Error calculating today's rewards: Today rewards failed",
      );
    });
  });

  // -------------------------------------------------------------------------
  // generateRewardAmount()
  // -------------------------------------------------------------------------
  describe('generateRewardAmount()', () => {
    it('should return a number between 0 and 100 inclusive', () => {
      for (let i = 0; i < 100; i++) {
        const amount = LoginRewardModel.generateRewardAmount();
        expect(amount).toBeGreaterThanOrEqual(0);
        expect(amount).toBeLessThanOrEqual(100);
        expect(Number.isInteger(amount)).toBe(true);
      }
    });

    it('should return an integer', () => {
      const amount = LoginRewardModel.generateRewardAmount();
      expect(amount).toBe(Math.floor(amount));
    });
  });
});
