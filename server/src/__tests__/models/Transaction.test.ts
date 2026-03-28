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

vi.mock('../../../drizzle/db.js', () => {
  const dbObj = {
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
  };
  return { db: dbObj, default: dbObj };
});

vi.mock('../../../drizzle/schema.js', () => ({
  users: {
    id: 'users.id',
    username: 'users.username',
    balance: 'users.balance',
    role: 'users.role',
    avatar: 'users.avatar',
  },
  transactions: {
    id: 'transactions.id',
    userId: 'transactions.userId',
    type: 'transactions.type',
    gameType: 'transactions.gameType',
    amount: 'transactions.amount',
    balanceBefore: 'transactions.balanceBefore',
    balanceAfter: 'transactions.balanceAfter',
    status: 'transactions.status',
    createdBy: 'transactions.createdBy',
    reference: 'transactions.reference',
    description: 'transactions.description',
    gameSessionId: 'transactions.gameSessionId',
    metadata: 'transactions.metadata',
    notes: 'transactions.notes',
    voidedBy: 'transactions.voidedBy',
    voidedReason: 'transactions.voidedReason',
    voidedAt: 'transactions.voidedAt',
    createdAt: 'transactions.createdAt',
    updatedAt: 'transactions.updatedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args) => ({ type: 'eq', args })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  or: vi.fn((...args) => ({ type: 'or', args })),
  desc: vi.fn((col) => ({ type: 'desc', col })),
  asc: vi.fn((col) => ({ type: 'asc', col })),
  sql: vi.fn((...args) => ({ type: 'sql', args })),
  count: vi.fn(() => 'count_fn'),
  like: vi.fn((...args) => ({ type: 'like', args })),
  between: vi.fn((...args) => ({ type: 'between', args })),
  gte: vi.fn((...args) => ({ type: 'gte', args })),
  lte: vi.fn((...args) => ({ type: 'lte', args })),
  isNull: vi.fn((col) => ({ type: 'isNull', col })),
  isNotNull: vi.fn((col) => ({ type: 'isNotNull', col })),
  inArray: vi.fn((...args) => ({ type: 'inArray', args })),
  sum: vi.fn(() => 'sum'),
}));

vi.mock('drizzle-orm/mysql-core', () => ({
  alias: vi.fn((table, name) => ({
    ...table,
    _alias: name,
  })),
}));

// ---------------------------------------------------------------------------
// Import the model AFTER mocks
// ---------------------------------------------------------------------------
import TransactionModel from '../../../drizzle/models/Transaction.js';

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

function buildUpdateChain(resolvedValue: any) {
  const chain: any = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve(resolvedValue),
    [Symbol.toStringTag]: 'Promise',
  };
  chain.then = (resolve: any, reject?: any) => Promise.resolve(resolvedValue).then(resolve, reject);
  chain.catch = (reject: any) => Promise.resolve(resolvedValue).catch(reject);
  return chain;
}

function buildDeleteChain(resolvedValue: any) {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
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

const sampleTransaction = {
  id: 1,
  userId: 10,
  type: 'deposit',
  gameType: null,
  amount: '100.00',
  balanceBefore: '0.00',
  balanceAfter: '100.00',
  status: 'completed',
  createdBy: null,
  reference: 'REF-001',
  description: 'Initial deposit',
  gameSessionId: null,
  metadata: null,
  notes: null,
  voidedBy: null,
  voidedReason: null,
  voidedAt: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const sampleVoidedTransaction = {
  ...sampleTransaction,
  id: 2,
  status: 'voided',
  voidedBy: 5,
  voidedReason: 'Fraud detected',
  voidedAt: new Date('2025-01-02'),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TransactionModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // create()
  // -------------------------------------------------------------------------
  describe('create()', () => {
    it('should insert a transaction and return the created record', async () => {
      const insertChain = buildInsertChain({ insertId: 1 });
      mockInsert.mockReturnValue(insertChain);

      const selectChain = buildChain([sampleTransaction]);
      mockSelect.mockReturnValue(selectChain);

      const result = await TransactionModel.create({
        userId: 10,
        type: 'deposit',
        amount: '100.00',
        balanceBefore: '0.00',
        balanceAfter: '100.00',
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(sampleTransaction);
    });

    it('should include createdAt and updatedAt timestamps', async () => {
      const insertChain = buildInsertChain({ insertId: 1 });
      mockInsert.mockReturnValue(insertChain);

      const selectChain = buildChain([sampleTransaction]);
      mockSelect.mockReturnValue(selectChain);

      await TransactionModel.create({ userId: 10, type: 'deposit', amount: '50' });

      const valuesCall = insertChain.values.mock.calls[0][0];
      expect(valuesCall).toHaveProperty('createdAt');
      expect(valuesCall).toHaveProperty('updatedAt');
    });

    it('should throw an error when insert fails', async () => {
      mockInsert.mockImplementation(() => {
        throw new Error('Insert failed');
      });

      await expect(
        TransactionModel.create({ userId: 10, type: 'deposit' }),
      ).rejects.toThrow('Error creating transaction: Insert failed');
    });
  });

  // -------------------------------------------------------------------------
  // findById()
  // -------------------------------------------------------------------------
  describe('findById()', () => {
    it('should return the transaction when found', async () => {
      const selectChain = buildChain([sampleTransaction]);
      mockSelect.mockReturnValue(selectChain);

      const result = await TransactionModel.findById(1);

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(sampleTransaction);
    });

    it('should return null when transaction is not found', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await TransactionModel.findById(999);

      expect(result).toBeNull();
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Query failed');
      });

      await expect(TransactionModel.findById(1)).rejects.toThrow(
        'Error finding transaction by ID: Query failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findByIdWithUser()
  // -------------------------------------------------------------------------
  describe('findByIdWithUser()', () => {
    it('should return transaction with user details when found', async () => {
      const txWithUser = { ...sampleTransaction, createdByUsername: 'admin' };
      const selectChain = buildChain([txWithUser]);
      mockSelect.mockReturnValue(selectChain);

      const result = await TransactionModel.findByIdWithUser(1);

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.leftJoin).toHaveBeenCalled();
      expect(result).toEqual(txWithUser);
    });

    it('should return null when not found', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await TransactionModel.findByIdWithUser(999);

      expect(result).toBeNull();
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Join failed');
      });

      await expect(TransactionModel.findByIdWithUser(1)).rejects.toThrow(
        'Error finding transaction with user: Join failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getUserTransactionHistory()
  // -------------------------------------------------------------------------
  describe('getUserTransactionHistory()', () => {
    it('should return paginated transaction history for a user', async () => {
      const txList = [sampleTransaction, { ...sampleTransaction, id: 2 }];
      const selectChain = buildChain(txList);
      mockSelect.mockReturnValue(selectChain);

      const result = await TransactionModel.getUserTransactionHistory(10, 50, 0);

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.leftJoin).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(50);
      expect(selectChain.offset).toHaveBeenCalledWith(0);
      expect(result).toEqual(txList);
    });

    it('should use default limit and offset values', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await TransactionModel.getUserTransactionHistory(10);

      expect(selectChain.limit).toHaveBeenCalledWith(50);
      expect(selectChain.offset).toHaveBeenCalledWith(0);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('History failed');
      });

      await expect(
        TransactionModel.getUserTransactionHistory(10),
      ).rejects.toThrow('Error getting user transaction history: History failed');
    });
  });

  // -------------------------------------------------------------------------
  // getTransactionStatsByDate()
  // -------------------------------------------------------------------------
  describe('getTransactionStatsByDate()', () => {
    it('should return aggregated stats grouped by type', async () => {
      const rawResults = [
        { type: 'deposit', amount: '100.00' },
        { type: 'deposit', amount: '200.00' },
        { type: 'game_win', amount: '50.00' },
      ];
      const selectChain = buildChain(rawResults);
      mockSelect.mockReturnValue(selectChain);

      const result = await TransactionModel.getTransactionStatsByDate();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2); // deposit and game_win groups
      const depositGroup = result.find((r: any) => r.type === 'deposit');
      expect(depositGroup.count).toBe(2);
      expect(depositGroup.totalAmount).toBe(300);
    });

    it('should apply date range filters when provided', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await TransactionModel.getTransactionStatsByDate('2025-01-01', '2025-12-31');

      expect(selectChain.where).toHaveBeenCalled();
    });

    it('should return empty array when no transactions exist', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await TransactionModel.getTransactionStatsByDate();

      expect(result).toEqual([]);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Stats failed');
      });

      await expect(
        TransactionModel.getTransactionStatsByDate(),
      ).rejects.toThrow('Error getting transaction stats: Stats failed');
    });
  });

  // -------------------------------------------------------------------------
  // update()
  // -------------------------------------------------------------------------
  describe('update()', () => {
    it('should update the transaction and return the updated record', async () => {
      const updatedTx = { ...sampleTransaction, status: 'failed' };
      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      const selectChain = buildChain([updatedTx]);
      mockSelect.mockReturnValue(selectChain);

      const result = await TransactionModel.update(1, { status: 'failed' });

      expect(mockUpdate).toHaveBeenCalled();
      const setCall = updateChain.set.mock.calls[0][0];
      expect(setCall.status).toBe('failed');
      expect(setCall).toHaveProperty('updatedAt');
      expect(result).toEqual(updatedTx);
    });

    it('should throw an error when update fails', async () => {
      mockUpdate.mockImplementation(() => {
        throw new Error('Update failed');
      });

      await expect(
        TransactionModel.update(1, { status: 'failed' }),
      ).rejects.toThrow('Error updating transaction: Update failed');
    });
  });

  // -------------------------------------------------------------------------
  // voidTransaction()
  // -------------------------------------------------------------------------
  describe('voidTransaction()', () => {
    it('should void a transaction and return the voided record', async () => {
      // First call: findById (via select)
      const selectChainFind = buildChain([sampleTransaction]);
      // Second call: after update, fetch voided record
      const selectChainVoided = buildChain([sampleVoidedTransaction]);

      mockSelect
        .mockReturnValueOnce(selectChainFind)
        .mockReturnValueOnce(selectChainVoided);

      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      const result = await TransactionModel.voidTransaction(1, 5, 'Fraud detected');

      expect(mockUpdate).toHaveBeenCalled();
      const setCall = updateChain.set.mock.calls[0][0];
      expect(setCall.status).toBe('voided');
      expect(setCall.voidedBy).toBe(5);
      expect(setCall.voidedReason).toBe('Fraud detected');
      expect(setCall).toHaveProperty('voidedAt');
      expect(result).toEqual(sampleVoidedTransaction);
    });

    it('should throw an error when transaction is not found', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await expect(
        TransactionModel.voidTransaction(999, 5, 'Not found'),
      ).rejects.toThrow('Error voiding transaction: Transaction not found');
    });

    it('should throw an error when transaction is already voided', async () => {
      const selectChain = buildChain([sampleVoidedTransaction]);
      mockSelect.mockReturnValue(selectChain);

      await expect(
        TransactionModel.voidTransaction(2, 5, 'Already voided'),
      ).rejects.toThrow('Error voiding transaction: Transaction already voided');
    });

    it('should append a note to existing notes', async () => {
      const txWithNotes = { ...sampleTransaction, notes: [{ text: 'old note' }] };
      const selectChainFind = buildChain([txWithNotes]);
      const selectChainAfter = buildChain([sampleVoidedTransaction]);
      mockSelect
        .mockReturnValueOnce(selectChainFind)
        .mockReturnValueOnce(selectChainAfter);

      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      await TransactionModel.voidTransaction(1, 5, 'Void reason');

      const setCall = updateChain.set.mock.calls[0][0];
      expect(setCall.notes).toHaveLength(2);
      expect(setCall.notes[0]).toEqual({ text: 'old note' });
      expect(setCall.notes[1].text).toContain('Transaction voided');
    });
  });

  // -------------------------------------------------------------------------
  // count()
  // -------------------------------------------------------------------------
  describe('count()', () => {
    it('should return the count of transactions', async () => {
      const selectChain = buildChain([{ count: 42 }]);
      mockSelect.mockReturnValue(selectChain);

      const result = await TransactionModel.count();

      expect(result).toBe(42);
    });

    it('should apply filter conditions', async () => {
      const selectChain = buildChain([{ count: 5 }]);
      mockSelect.mockReturnValue(selectChain);

      const result = await TransactionModel.count({ userId: 10, type: 'deposit' });

      expect(selectChain.where).toHaveBeenCalled();
      expect(result).toBe(5);
    });

    it('should return 0 when no results', async () => {
      const selectChain = buildChain([{}]);
      mockSelect.mockReturnValue(selectChain);

      const result = await TransactionModel.count();

      expect(result).toBe(0);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Count failed');
      });

      await expect(TransactionModel.count()).rejects.toThrow(
        'Error counting transactions: Count failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findMany()
  // -------------------------------------------------------------------------
  describe('findMany()', () => {
    it('should return transactions with default pagination', async () => {
      const txList = [sampleTransaction];
      const selectChain = buildChain(txList);
      mockSelect.mockReturnValue(selectChain);

      const result = await TransactionModel.findMany();

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(50);
      expect(selectChain.offset).toHaveBeenCalledWith(0);
      expect(result).toEqual(txList);
    });

    it('should apply userId filter', async () => {
      const selectChain = buildChain([sampleTransaction]);
      mockSelect.mockReturnValue(selectChain);

      await TransactionModel.findMany({ userId: 10 });

      expect(selectChain.where).toHaveBeenCalled();
    });

    it('should apply type filter', async () => {
      const selectChain = buildChain([sampleTransaction]);
      mockSelect.mockReturnValue(selectChain);

      await TransactionModel.findMany({ type: 'deposit' });

      expect(selectChain.where).toHaveBeenCalled();
    });

    it('should apply gameType filter', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await TransactionModel.findMany({ gameType: 'crash' });

      expect(selectChain.where).toHaveBeenCalled();
    });

    it('should apply status filter', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await TransactionModel.findMany({ status: 'completed' });

      expect(selectChain.where).toHaveBeenCalled();
    });

    it('should apply custom limit and offset', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await TransactionModel.findMany({}, 25, 10);

      expect(selectChain.limit).toHaveBeenCalledWith(25);
      expect(selectChain.offset).toHaveBeenCalledWith(10);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('FindMany failed');
      });

      await expect(TransactionModel.findMany()).rejects.toThrow(
        'Error finding transactions: FindMany failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // delete()
  // -------------------------------------------------------------------------
  describe('delete()', () => {
    it('should delete the transaction and return success object', async () => {
      const deleteChain = buildDeleteChain(undefined);
      mockDelete.mockReturnValue(deleteChain);

      const result = await TransactionModel.delete(1);

      expect(mockDelete).toHaveBeenCalled();
      expect(result).toEqual({ id: 1, deleted: true });
    });

    it('should throw an error when delete fails', async () => {
      mockDelete.mockImplementation(() => {
        throw new Error('Delete failed');
      });

      await expect(TransactionModel.delete(1)).rejects.toThrow(
        'Error deleting transaction: Delete failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // addNote()
  // -------------------------------------------------------------------------
  describe('addNote()', () => {
    it('should add a note to a transaction', async () => {
      const txWithNote = { ...sampleTransaction, notes: [{ text: 'New note', addedBy: 5 }] };

      // findById select
      const selectChainFind = buildChain([sampleTransaction]);
      const selectChainAfter = buildChain([txWithNote]);
      mockSelect
        .mockReturnValueOnce(selectChainFind)
        .mockReturnValueOnce(selectChainAfter);

      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      const result = await TransactionModel.addNote(1, 'New note', 5);

      expect(mockUpdate).toHaveBeenCalled();
      const setCall = updateChain.set.mock.calls[0][0];
      expect(setCall.notes).toHaveLength(1);
      expect(setCall.notes[0].text).toBe('New note');
      expect(setCall.notes[0].addedBy).toBe(5);
      expect(result).toEqual(txWithNote);
    });

    it('should throw when transaction is not found', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await expect(
        TransactionModel.addNote(999, 'Note', 5),
      ).rejects.toThrow('Error adding note to transaction: Transaction not found');
    });

    it('should append to existing notes array', async () => {
      const txWithExistingNotes = { ...sampleTransaction, notes: [{ text: 'Existing' }] };
      const selectChainFind = buildChain([txWithExistingNotes]);
      const selectChainAfter = buildChain([txWithExistingNotes]);
      mockSelect
        .mockReturnValueOnce(selectChainFind)
        .mockReturnValueOnce(selectChainAfter);

      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      await TransactionModel.addNote(1, 'Second note', 5);

      const setCall = updateChain.set.mock.calls[0][0];
      expect(setCall.notes).toHaveLength(2);
      expect(setCall.notes[0].text).toBe('Existing');
      expect(setCall.notes[1].text).toBe('Second note');
    });
  });

  // -------------------------------------------------------------------------
  // updateById()
  // -------------------------------------------------------------------------
  describe('updateById()', () => {
    it('should update and return the updated transaction', async () => {
      const updatedTx = { ...sampleTransaction, description: 'Updated desc' };
      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      const selectChain = buildChain([updatedTx]);
      mockSelect.mockReturnValue(selectChain);

      const result = await TransactionModel.updateById(1, { description: 'Updated desc' });

      expect(mockUpdate).toHaveBeenCalled();
      expect(result).toEqual(updatedTx);
    });

    it('should return null when transaction not found after update', async () => {
      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await TransactionModel.updateById(999, { description: 'x' });

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // deleteById()
  // -------------------------------------------------------------------------
  describe('deleteById()', () => {
    it('should return the deleted transaction', async () => {
      const selectChain = buildChain([sampleTransaction]);
      mockSelect.mockReturnValue(selectChain);

      const deleteChain = buildDeleteChain(undefined);
      mockDelete.mockReturnValue(deleteChain);

      const result = await TransactionModel.deleteById(1);

      expect(mockSelect).toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalled();
      expect(result).toEqual(sampleTransaction);
    });

    it('should return null when transaction does not exist', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const deleteChain = buildDeleteChain(undefined);
      mockDelete.mockReturnValue(deleteChain);

      const result = await TransactionModel.deleteById(999);

      expect(result).toBeNull();
    });
  });
});
