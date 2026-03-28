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
  gameSessions: {
    id: 'gameSessions.id',
    userId: 'gameSessions.userId',
    gameType: 'gameSessions.gameType',
    startTime: 'gameSessions.startTime',
    endTime: 'gameSessions.endTime',
    initialBet: 'gameSessions.initialBet',
    totalBet: 'gameSessions.totalBet',
    outcome: 'gameSessions.outcome',
    finalMultiplier: 'gameSessions.finalMultiplier',
    gameState: 'gameSessions.gameState',
    isCompleted: 'gameSessions.isCompleted',
    resultDetails: 'gameSessions.resultDetails',
    createdAt: 'gameSessions.createdAt',
    updatedAt: 'gameSessions.updatedAt',
  },
  users: {
    id: 'users.id',
    username: 'users.username',
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

// ---------------------------------------------------------------------------
// Import the model AFTER mocks
// ---------------------------------------------------------------------------
import GameSessionModel from '../../../drizzle/models/GameSession.js';

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

const sampleSession = {
  id: 1,
  userId: 10,
  gameType: 'crash',
  startTime: new Date('2025-06-01T12:00:00Z'),
  endTime: null,
  initialBet: '50.00',
  totalBet: '50.00',
  outcome: '0',
  finalMultiplier: null,
  gameState: null,
  isCompleted: false,
  resultDetails: null,
  createdAt: new Date('2025-06-01T12:00:00Z'),
  updatedAt: new Date('2025-06-01T12:00:00Z'),
};

const completedSession = {
  ...sampleSession,
  isCompleted: true,
  outcome: '100.00',
  finalMultiplier: '2.000000',
  endTime: new Date('2025-06-01T12:05:00Z'),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GameSessionModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // create()
  // -------------------------------------------------------------------------
  describe('create()', () => {
    it('should insert a session and return the created record', async () => {
      const insertChain = buildInsertChain({ insertId: 1 });
      mockInsert.mockReturnValue(insertChain);

      const selectChain = buildChain([sampleSession]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameSessionModel.create({
        userId: 10,
        gameType: 'crash',
        initialBet: '50.00',
        totalBet: '50.00',
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(sampleSession);
    });

    it('should set totalBet to initialBet if not provided', async () => {
      const insertChain = buildInsertChain({ insertId: 1 });
      mockInsert.mockReturnValue(insertChain);

      const selectChain = buildChain([sampleSession]);
      mockSelect.mockReturnValue(selectChain);

      await GameSessionModel.create({
        userId: 10,
        gameType: 'crash',
        initialBet: '50.00',
      });

      const valuesCall = insertChain.values.mock.calls[0][0];
      expect(valuesCall.totalBet).toBe('50.00');
    });

    it('should include createdAt and updatedAt timestamps', async () => {
      const insertChain = buildInsertChain({ insertId: 1 });
      mockInsert.mockReturnValue(insertChain);

      const selectChain = buildChain([sampleSession]);
      mockSelect.mockReturnValue(selectChain);

      await GameSessionModel.create({
        userId: 10,
        gameType: 'crash',
        initialBet: '50.00',
        totalBet: '50.00',
      });

      const valuesCall = insertChain.values.mock.calls[0][0];
      expect(valuesCall).toHaveProperty('createdAt');
      expect(valuesCall).toHaveProperty('updatedAt');
    });

    it('should throw an error when insert fails', async () => {
      mockInsert.mockImplementation(() => {
        throw new Error('Insert failed');
      });

      await expect(
        GameSessionModel.create({ userId: 10, gameType: 'crash', initialBet: '50' }),
      ).rejects.toThrow('Error creating game session: Insert failed');
    });
  });

  // -------------------------------------------------------------------------
  // findById()
  // -------------------------------------------------------------------------
  describe('findById()', () => {
    it('should return the session when found', async () => {
      const selectChain = buildChain([sampleSession]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameSessionModel.findById(1);

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(sampleSession);
    });

    it('should return null when session is not found', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameSessionModel.findById(999);

      expect(result).toBeNull();
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Query failed');
      });

      await expect(GameSessionModel.findById(1)).rejects.toThrow(
        'Error finding game session by ID: Query failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findByUserId()
  // -------------------------------------------------------------------------
  describe('findByUserId()', () => {
    it('should return sessions for a user with pagination', async () => {
      const sessions = [sampleSession, { ...sampleSession, id: 2 }];
      const selectChain = buildChain(sessions);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameSessionModel.findByUserId(10);

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(50);
      expect(selectChain.offset).toHaveBeenCalledWith(0);
      expect(result).toEqual(sessions);
    });

    it('should accept custom limit and offset', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await GameSessionModel.findByUserId(10, 25, 10);

      expect(selectChain.limit).toHaveBeenCalledWith(25);
      expect(selectChain.offset).toHaveBeenCalledWith(10);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('User sessions failed');
      });

      await expect(GameSessionModel.findByUserId(10)).rejects.toThrow(
        'Error finding sessions by user ID: User sessions failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findByGameType()
  // -------------------------------------------------------------------------
  describe('findByGameType()', () => {
    it('should return sessions filtered by game type', async () => {
      const sessions = [sampleSession];
      const selectChain = buildChain(sessions);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameSessionModel.findByGameType('crash');

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(50);
      expect(selectChain.offset).toHaveBeenCalledWith(0);
      expect(result).toEqual(sessions);
    });

    it('should accept custom limit and offset', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await GameSessionModel.findByGameType('roulette', 20, 5);

      expect(selectChain.limit).toHaveBeenCalledWith(20);
      expect(selectChain.offset).toHaveBeenCalledWith(5);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Game type failed');
      });

      await expect(GameSessionModel.findByGameType('crash')).rejects.toThrow(
        'Error finding sessions by game type: Game type failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // update()
  // -------------------------------------------------------------------------
  describe('update()', () => {
    it('should update the session and return the updated record', async () => {
      const updatedSession = { ...sampleSession, totalBet: '100.00' };
      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      const selectChain = buildChain([updatedSession]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameSessionModel.update(1, { totalBet: '100.00' });

      expect(mockUpdate).toHaveBeenCalled();
      const setCall = updateChain.set.mock.calls[0][0];
      expect(setCall.totalBet).toBe('100.00');
      expect(setCall).toHaveProperty('updatedAt');
      expect(result).toEqual(updatedSession);
    });

    it('should throw an error when update fails', async () => {
      mockUpdate.mockImplementation(() => {
        throw new Error('Update failed');
      });

      await expect(
        GameSessionModel.update(1, { totalBet: '100' }),
      ).rejects.toThrow('Error updating game session: Update failed');
    });
  });

  // -------------------------------------------------------------------------
  // delete()
  // -------------------------------------------------------------------------
  describe('delete()', () => {
    it('should delete the session and return the deleted record', async () => {
      const selectChain = buildChain([sampleSession]);
      mockSelect.mockReturnValue(selectChain);

      const deleteChain = buildDeleteChain(undefined);
      mockDelete.mockReturnValue(deleteChain);

      const result = await GameSessionModel.delete(1);

      expect(mockSelect).toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalled();
      expect(result).toEqual(sampleSession);
    });

    it('should throw an error when delete fails', async () => {
      const selectChain = buildChain([sampleSession]);
      mockSelect.mockReturnValue(selectChain);

      mockDelete.mockImplementation(() => {
        throw new Error('Delete failed');
      });

      await expect(GameSessionModel.delete(1)).rejects.toThrow(
        'Error deleting game session: Delete failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getActiveSessions()
  // -------------------------------------------------------------------------
  describe('getActiveSessions()', () => {
    it('should return only incomplete sessions', async () => {
      const activeSessions = [sampleSession];
      const selectChain = buildChain(activeSessions);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameSessionModel.getActiveSessions();

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(result).toEqual(activeSessions);
    });

    it('should apply game type filter when provided', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await GameSessionModel.getActiveSessions('crash');

      // Two where calls: isCompleted and gameType
      expect(selectChain.where).toHaveBeenCalledTimes(2);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Active sessions failed');
      });

      await expect(GameSessionModel.getActiveSessions()).rejects.toThrow(
        'Error getting active sessions: Active sessions failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // completeSession()
  // -------------------------------------------------------------------------
  describe('completeSession()', () => {
    it('should mark a session as completed with outcome', async () => {
      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      const selectChain = buildChain([completedSession]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameSessionModel.completeSession(1, 100);

      expect(mockUpdate).toHaveBeenCalled();
      const setCall = updateChain.set.mock.calls[0][0];
      expect(setCall.isCompleted).toBe(true);
      expect(setCall.outcome).toBe('100');
      expect(setCall).toHaveProperty('endTime');
      expect(setCall.endTime).toBeInstanceOf(Date);
      expect(result).toEqual(completedSession);
    });

    it('should include finalMultiplier when provided', async () => {
      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      const selectChain = buildChain([completedSession]);
      mockSelect.mockReturnValue(selectChain);

      await GameSessionModel.completeSession(1, 100, 2.5);

      const setCall = updateChain.set.mock.calls[0][0];
      expect(setCall.finalMultiplier).toBe('2.5');
    });

    it('should include resultDetails when provided', async () => {
      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      const selectChain = buildChain([completedSession]);
      mockSelect.mockReturnValue(selectChain);

      const details = { crashPoint: 2.5 };
      await GameSessionModel.completeSession(1, 100, null, details);

      const setCall = updateChain.set.mock.calls[0][0];
      expect(setCall.resultDetails).toEqual(details);
    });

    it('should not include finalMultiplier when null', async () => {
      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      const selectChain = buildChain([completedSession]);
      mockSelect.mockReturnValue(selectChain);

      await GameSessionModel.completeSession(1, 100);

      const setCall = updateChain.set.mock.calls[0][0];
      expect(setCall).not.toHaveProperty('finalMultiplier');
    });

    it('should throw an error when completion fails', async () => {
      mockUpdate.mockImplementation(() => {
        throw new Error('Complete failed');
      });

      await expect(
        GameSessionModel.completeSession(1, 100),
      ).rejects.toThrow('Error completing session: Complete failed');
    });
  });

  // -------------------------------------------------------------------------
  // calculateProfit()
  // -------------------------------------------------------------------------
  describe('calculateProfit()', () => {
    it('should calculate profit correctly (outcome - totalBet)', () => {
      const profit = GameSessionModel.calculateProfit({
        outcome: '100.00',
        totalBet: '50.00',
      });

      expect(profit).toBe(50);
    });

    it('should handle negative profit (loss)', () => {
      const profit = GameSessionModel.calculateProfit({
        outcome: '0',
        totalBet: '50.00',
      });

      expect(profit).toBe(-50);
    });

    it('should handle missing outcome', () => {
      const profit = GameSessionModel.calculateProfit({
        outcome: null,
        totalBet: '50.00',
      });

      expect(profit).toBe(-50);
    });

    it('should handle missing totalBet', () => {
      const profit = GameSessionModel.calculateProfit({
        outcome: '100',
        totalBet: null,
      });

      expect(profit).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // getGameStats()
  // -------------------------------------------------------------------------
  describe('getGameStats()', () => {
    it('should return aggregated stats for a game type', async () => {
      const sessionData = [
        { totalBet: '100.00', outcome: '80.00' },
        { totalBet: '50.00', outcome: '0' },
        { totalBet: '75.00', outcome: '150.00' },
      ];
      const selectChain = buildChain(sessionData);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameSessionModel.getGameStats('crash');

      expect(result.gameType).toBe('crash');
      expect(result.totalSessions).toBe(3);
      expect(result.totalBets).toBe(225);
      expect(result.totalOutcome).toBe(230);
      expect(result.profit).toBeCloseTo(-5);
      expect(result.avgBet).toBe(75);
      expect(typeof result.houseEdge).toBe('number');
    });

    it('should apply date range filters', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await GameSessionModel.getGameStats('crash', '2025-01-01', '2025-12-31');

      expect(selectChain.where).toHaveBeenCalled();
    });

    it('should return zero values when no sessions exist', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameSessionModel.getGameStats('crash');

      expect(result.totalSessions).toBe(0);
      expect(result.totalBets).toBe(0);
      expect(result.totalOutcome).toBe(0);
      expect(result.avgBet).toBe(0);
      expect(result.houseEdge).toBe(0);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Stats failed');
      });

      await expect(GameSessionModel.getGameStats('crash')).rejects.toThrow(
        'Error getting game stats: Stats failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findWithUserDetails()
  // -------------------------------------------------------------------------
  describe('findWithUserDetails()', () => {
    it('should return sessions with joined user details', async () => {
      const sessionsWithUser = [
        { ...sampleSession, username: 'testuser' },
      ];
      const selectChain = buildChain(sessionsWithUser);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameSessionModel.findWithUserDetails();

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.leftJoin).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(50);
      expect(selectChain.offset).toHaveBeenCalledWith(0);
      expect(result).toEqual(sessionsWithUser);
    });

    it('should accept custom limit and offset', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await GameSessionModel.findWithUserDetails(20, 10);

      expect(selectChain.limit).toHaveBeenCalledWith(20);
      expect(selectChain.offset).toHaveBeenCalledWith(10);
    });
  });

  // -------------------------------------------------------------------------
  // findByDateRange()
  // -------------------------------------------------------------------------
  describe('findByDateRange()', () => {
    it('should return sessions within the date range', async () => {
      const selectChain = buildChain([sampleSession]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameSessionModel.findByDateRange('2025-01-01', '2025-12-31');

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(result).toEqual([sampleSession]);
    });

    it('should apply gameType filter when provided', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await GameSessionModel.findByDateRange('2025-01-01', '2025-12-31', 'crash');

      expect(selectChain.where).toHaveBeenCalled();
    });

    it('should work with no date range', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await GameSessionModel.findByDateRange(null, null);

      // No conditions, so where should not be called
      expect(selectChain.where).not.toHaveBeenCalled();
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Date range failed');
      });

      await expect(
        GameSessionModel.findByDateRange('2025-01-01', '2025-12-31'),
      ).rejects.toThrow('Error finding sessions by date range: Date range failed');
    });
  });
});
