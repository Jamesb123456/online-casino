// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks -- use vi.hoisted so variables are available in vi.mock factories
// ---------------------------------------------------------------------------

const {
  mockTransaction,
  mockSelect,
  mockInsert,
  mockUpdate,
  mockExecute,
  mockUserFindById,
  mockGetCachedBalance,
  mockCacheBalance,
  mockInvalidateBalance,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockExecute: vi.fn(),
  mockUserFindById: vi.fn(),
  mockGetCachedBalance: vi.fn(),
  mockCacheBalance: vi.fn(),
  mockInvalidateBalance: vi.fn(),
}));

vi.mock('../../drizzle/db.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    execute: mockExecute,
    transaction: mockTransaction,
  },
}));

vi.mock('../../drizzle/models/User.js', () => ({
  default: {
    findById: mockUserFindById,
  },
}));

vi.mock('../../drizzle/models/Transaction.js', () => ({
  default: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('../../drizzle/models/Balance.js', () => ({
  default: {
    getBalanceHistory: vi.fn().mockResolvedValue([]),
    getCurrentBalance: vi.fn().mockResolvedValue(100),
  },
}));

vi.mock('../../drizzle/schema.js', () => ({
  users: { id: 'id', balance: 'balance', updatedAt: 'updatedAt' },
  transactions: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args) => args),
  sql: vi.fn((...args) => args),
}));

vi.mock('../services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
    logGameEvent: vi.fn(),
  },
}));

vi.mock('../services/redisService.js', () => ({
  default: {
    getCachedBalance: mockGetCachedBalance,
    cacheBalance: mockCacheBalance,
    invalidateBalance: mockInvalidateBalance,
  },
}));

// ---------------------------------------------------------------------------
// Import module under test
// ---------------------------------------------------------------------------

import BalanceService from '../services/balanceService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeUser(overrides = {}) {
  return {
    id: 1,
    username: 'testuser',
    balance: '1000.00',
    role: 'user',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Build a mock transaction (tx) object for the credit path.
 *
 * Credit path flow:
 * 1. tx.select().from(users).where(...) -> [user] (initial lookup)
 * 2. tx.update(users).set(...).where(...) -> void
 * 3. tx.execute(sql`INSERT INTO transactions ...`) -> [{insertId}]
 * 4. tx.execute(sql`INSERT INTO balances ...`) -> void
 * 5. tx.select().from(users).where(...) -> [updatedUser]
 * 6. tx.select().from(transactions).where(...) -> [txRow]
 */
function buildCreditTx({ initialUser, updatedUser, txRow }) {
  const fromWhere = vi.fn().mockReturnValue({
    where: vi.fn()
      .mockResolvedValueOnce([initialUser])   // 1
      .mockResolvedValueOnce([updatedUser])    // 5
      .mockResolvedValueOnce([txRow]),          // 6
  });

  return {
    select: vi.fn().mockReturnValue({ from: fromWhere }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    execute: vi.fn()
      .mockResolvedValueOnce([{ insertId: txRow.id }])   // 3 INSERT transactions
      .mockResolvedValueOnce(undefined),                   // 4 INSERT balances
    insert: vi.fn(),
  };
}

/**
 * Build a mock transaction (tx) object for the debit path.
 *
 * Debit path flow (current working tree):
 * 1. tx.execute(sql`SELECT balance FROM users WHERE id = ? FOR UPDATE`) -> [[{balance}]]
 * 2. tx.execute(sql`UPDATE users SET balance = ? WHERE id = ?`) -> void
 * 3. tx.execute(sql`INSERT INTO transactions ...`) -> [{insertId}]
 * 4. tx.execute(sql`INSERT INTO balances ...`) -> void
 * 5. tx.select().from(users).where(...) -> [updatedUser]
 * 6. tx.select().from(transactions).where(...) -> [txRow]
 */
function buildDebitTx({ initialBalance, updatedUser, txRow }) {
  const fromWhere = vi.fn().mockReturnValue({
    where: vi.fn()
      .mockResolvedValueOnce([updatedUser])    // 5
      .mockResolvedValueOnce([txRow]),          // 6
  });

  return {
    select: vi.fn().mockReturnValue({ from: fromWhere }),
    update: vi.fn(),
    execute: vi.fn()
      .mockResolvedValueOnce([[{ balance: initialBalance }]])  // 1 SELECT FOR UPDATE
      .mockResolvedValueOnce(undefined)                         // 2 UPDATE users
      .mockResolvedValueOnce([{ insertId: txRow.id }])          // 3 INSERT transactions
      .mockResolvedValueOnce(undefined),                        // 4 INSERT balances
    insert: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BalanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: Redis cache returns null (cache miss)
    mockGetCachedBalance.mockResolvedValue(null);
    mockCacheBalance.mockResolvedValue(undefined);
    mockInvalidateBalance.mockResolvedValue(undefined);
  });

  // -----------------------------------------------------------------------
  // updateBalance
  // -----------------------------------------------------------------------
  describe('updateBalance()', () => {
    it('should credit a positive amount and return the updated user + transaction', async () => {
      const initialUser = fakeUser();
      const updatedUser = fakeUser({ balance: '1100.00' });
      const txRow = { id: 42, type: 'game_win', amount: '100.00' };

      const tx = buildCreditTx({ initialUser, updatedUser, txRow });
      mockTransaction.mockImplementation(async (cb) => cb(tx));

      const result = await BalanceService.updateBalance(1, 100, 'game_win', 'crash');

      expect(mockTransaction).toHaveBeenCalledOnce();
      expect(result.user).toEqual(updatedUser);
      expect(result.transaction).toEqual(txRow);
      expect(tx.update).toHaveBeenCalled();
      expect(mockInvalidateBalance).toHaveBeenCalledWith(1);
    });

    it('should debit a negative amount using SELECT FOR UPDATE locking', async () => {
      const updatedUser = fakeUser({ balance: '900.00' });
      const txRow = { id: 43, type: 'game_loss', amount: '-100.00' };

      const tx = buildDebitTx({ initialBalance: '1000.00', updatedUser, txRow });
      mockTransaction.mockImplementation(async (cb) => cb(tx));

      const result = await BalanceService.updateBalance(1, -100, 'game_loss', 'crash');

      expect(mockTransaction).toHaveBeenCalledOnce();
      // Debit path uses execute for everything, not Drizzle ORM update
      expect(tx.update).not.toHaveBeenCalled();
      expect(result.user).toEqual(updatedUser);
      expect(result.transaction).toEqual(txRow);
    });

    it('should throw "User not found" when the user does not exist (credit path)', async () => {
      const fromWhere = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValueOnce([]),
      });

      const tx = {
        select: vi.fn().mockReturnValue({ from: fromWhere }),
        update: vi.fn(),
        execute: vi.fn(),
        insert: vi.fn(),
      };
      mockTransaction.mockImplementation(async (cb) => cb(tx));

      await expect(
        BalanceService.updateBalance(999, 100, 'game_win')
      ).rejects.toThrow('User not found');
    });

    it('should throw "User not found" when the user does not exist (debit path)', async () => {
      const tx = {
        select: vi.fn(),
        update: vi.fn(),
        execute: vi.fn()
          .mockResolvedValueOnce([[undefined]]),  // SELECT FOR UPDATE returns no row
        insert: vi.fn(),
      };
      // Also handle the case where the row array is empty
      tx.execute.mockReset();
      tx.execute.mockResolvedValueOnce([[]]);  // Empty result set from SELECT FOR UPDATE
      mockTransaction.mockImplementation(async (cb) => cb(tx));

      await expect(
        BalanceService.updateBalance(1, -100, 'game_loss', 'crash')
      ).rejects.toThrow('User not found');
    });

    it('should throw "Insufficient balance" when deducting more than available', async () => {
      const tx = {
        select: vi.fn(),
        update: vi.fn(),
        execute: vi.fn()
          .mockResolvedValueOnce([[{ balance: '50.00' }]]),  // SELECT FOR UPDATE -> balance 50
        insert: vi.fn(),
      };
      mockTransaction.mockImplementation(async (cb) => cb(tx));

      await expect(
        BalanceService.updateBalance(1, -100, 'game_loss', 'crash')
      ).rejects.toThrow('Insufficient balance');
    });
  });

  // -----------------------------------------------------------------------
  // placeBet
  // -----------------------------------------------------------------------
  describe('placeBet()', () => {
    it('should deduct the bet amount using a negative value', async () => {
      const updatedUser = fakeUser({ balance: '900.00' });
      const txRow = { id: 44, type: 'game_loss', amount: '-100.00' };

      const tx = buildDebitTx({ initialBalance: '1000.00', updatedUser, txRow });
      mockTransaction.mockImplementation(async (cb) => cb(tx));

      const result = await BalanceService.placeBet(1, 100, 'crash');

      expect(mockTransaction).toHaveBeenCalledOnce();
      expect(result.user).toEqual(updatedUser);
    });

    it('should always pass a negative amount even when given a positive betAmount', async () => {
      const updatedUser = fakeUser({ balance: '950.00' });
      const txRow = { id: 45, type: 'game_loss', amount: '-50.00' };

      const tx = buildDebitTx({ initialBalance: '1000.00', updatedUser, txRow });
      mockTransaction.mockImplementation(async (cb) => cb(tx));

      const result = await BalanceService.placeBet(1, 50, 'roulette');

      expect(result.user.balance).toBe('950.00');
    });
  });

  // -----------------------------------------------------------------------
  // recordWin
  // -----------------------------------------------------------------------
  describe('recordWin()', () => {
    it('should add winnings as a positive amount', async () => {
      const initialUser = fakeUser();
      const updatedUser = fakeUser({ balance: '1200.00' });
      const txRow = { id: 46, type: 'game_win', amount: '200.00' };

      const tx = buildCreditTx({ initialUser, updatedUser, txRow });
      mockTransaction.mockImplementation(async (cb) => cb(tx));

      const result = await BalanceService.recordWin(1, 100, 200, 'crash', { multiplier: 2 });

      expect(result.user).toEqual(updatedUser);
      expect(result.transaction).toEqual(txRow);
      expect(tx.update).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // getBalance
  // -----------------------------------------------------------------------
  describe('getBalance()', () => {
    it('should return the parsed balance for an existing user (cache miss)', async () => {
      mockGetCachedBalance.mockResolvedValue(null);
      mockUserFindById.mockResolvedValue(fakeUser({ balance: '500.75' }));

      const balance = await BalanceService.getBalance(1);

      expect(balance).toBe(500.75);
      expect(mockUserFindById).toHaveBeenCalledWith(1);
      expect(mockCacheBalance).toHaveBeenCalledWith(1, 500.75);
    });

    it('should return cached balance when available (cache hit)', async () => {
      mockGetCachedBalance.mockResolvedValue(750.50);

      const balance = await BalanceService.getBalance(1);

      expect(balance).toBe(750.50);
      expect(mockUserFindById).not.toHaveBeenCalled();
    });

    it('should throw "User not found" when user does not exist', async () => {
      mockGetCachedBalance.mockResolvedValue(null);
      mockUserFindById.mockResolvedValue(null);

      await expect(BalanceService.getBalance(999)).rejects.toThrow('User not found');
    });
  });

  // -----------------------------------------------------------------------
  // hasSufficientBalance
  // -----------------------------------------------------------------------
  describe('hasSufficientBalance()', () => {
    it('should return true when balance is greater than the requested amount', async () => {
      mockGetCachedBalance.mockResolvedValue(null);
      mockUserFindById.mockResolvedValue(fakeUser({ balance: '1000.00' }));

      const result = await BalanceService.hasSufficientBalance(1, 500);

      expect(result).toBe(true);
    });

    it('should return true from cache when cached balance is sufficient', async () => {
      mockGetCachedBalance.mockResolvedValue(1000);

      const result = await BalanceService.hasSufficientBalance(1, 500);

      expect(result).toBe(true);
    });

    it('should return true when balance equals the requested amount exactly', async () => {
      mockGetCachedBalance.mockResolvedValue(null);
      mockUserFindById.mockResolvedValue(fakeUser({ balance: '100.00' }));

      const result = await BalanceService.hasSufficientBalance(1, 100);

      expect(result).toBe(true);
    });

    it('should return false when balance is less than the requested amount', async () => {
      mockGetCachedBalance.mockResolvedValue(null);
      mockUserFindById.mockResolvedValue(fakeUser({ balance: '50.00' }));

      const result = await BalanceService.hasSufficientBalance(1, 100);

      expect(result).toBe(false);
    });

    it('should return false when user is not found (error case)', async () => {
      mockGetCachedBalance.mockResolvedValue(null);
      mockUserFindById.mockRejectedValue(new Error('User not found'));

      const result = await BalanceService.hasSufficientBalance(999, 100);

      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // _mapTransactionTypeToBalanceType
  // -----------------------------------------------------------------------
  describe('_mapTransactionTypeToBalanceType()', () => {
    it('should map "deposit" to "deposit"', () => {
      expect(BalanceService._mapTransactionTypeToBalanceType('deposit')).toBe('deposit');
    });

    it('should map "withdrawal" to "withdrawal"', () => {
      expect(BalanceService._mapTransactionTypeToBalanceType('withdrawal')).toBe('withdrawal');
    });

    it('should map "game_win" to "win"', () => {
      expect(BalanceService._mapTransactionTypeToBalanceType('game_win')).toBe('win');
    });

    it('should map "game_loss" to "loss"', () => {
      expect(BalanceService._mapTransactionTypeToBalanceType('game_loss')).toBe('loss');
    });

    it('should map "admin_adjustment" to "admin_adjustment"', () => {
      expect(BalanceService._mapTransactionTypeToBalanceType('admin_adjustment')).toBe('admin_adjustment');
    });

    it('should map "bonus" to "win"', () => {
      expect(BalanceService._mapTransactionTypeToBalanceType('bonus')).toBe('win');
    });

    it('should default to "admin_adjustment" for unknown types', () => {
      expect(BalanceService._mapTransactionTypeToBalanceType('unknown_type')).toBe('admin_adjustment');
    });
  });

  // -----------------------------------------------------------------------
  // manualAdjustment
  // -----------------------------------------------------------------------
  describe('manualAdjustment()', () => {
    it('should delegate to updateBalance with admin_adjustment type', async () => {
      const initialUser = fakeUser();
      const updatedUser = fakeUser({ balance: '1500.00' });
      const txRow = { id: 50, type: 'admin_adjustment', amount: '500.00' };

      const tx = buildCreditTx({ initialUser, updatedUser, txRow });
      mockTransaction.mockImplementation(async (cb) => cb(tx));

      const result = await BalanceService.manualAdjustment(1, 500, 'Bonus for loyalty', 99);

      expect(result.user).toEqual(updatedUser);
    });
  });

  // -----------------------------------------------------------------------
  // updateGameBalance (alias)
  // -----------------------------------------------------------------------
  describe('updateGameBalance()', () => {
    it('should behave identically to updateBalance', async () => {
      const initialUser = fakeUser();
      const updatedUser = fakeUser({ balance: '1100.00' });
      const txRow = { id: 51, type: 'game_win', amount: '100.00' };

      const tx = buildCreditTx({ initialUser, updatedUser, txRow });
      mockTransaction.mockImplementation(async (cb) => cb(tx));

      const result = await BalanceService.updateGameBalance(1, 100, 'game_win', 'crash');

      expect(result.user).toEqual(updatedUser);
    });
  });
});
