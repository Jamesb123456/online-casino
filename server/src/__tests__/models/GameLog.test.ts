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
  gameLogs: {
    id: 'gameLogs.id',
    sessionId: 'gameLogs.sessionId',
    userId: 'gameLogs.userId',
    gameType: 'gameLogs.gameType',
    eventType: 'gameLogs.eventType',
    eventDetails: 'gameLogs.eventDetails',
    amount: 'gameLogs.amount',
    timestamp: 'gameLogs.timestamp',
    metadata: 'gameLogs.metadata',
    createdAt: 'gameLogs.createdAt',
    updatedAt: 'gameLogs.updatedAt',
  },
  users: {
    id: 'users.id',
    username: 'users.username',
    avatar: 'users.avatar',
  },
  gameSessions: {
    id: 'gameSessions.id',
    startTime: 'gameSessions.startTime',
    gameType: 'gameSessions.gameType',
    isCompleted: 'gameSessions.isCompleted',
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
import GameLogModel from '../../../drizzle/models/GameLog.js';

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

const sampleLog = {
  id: 1,
  sessionId: 100,
  userId: 10,
  gameType: 'crash',
  eventType: 'bet_placed',
  eventDetails: { amount: 50 },
  amount: '50.00',
  timestamp: new Date('2025-06-01T12:00:00Z'),
  metadata: null,
  createdAt: new Date('2025-06-01T12:00:00Z'),
  updatedAt: new Date('2025-06-01T12:00:00Z'),
};

const sampleLogWithUser = {
  ...sampleLog,
  username: 'testuser',
};

const sampleLogWithSession = {
  ...sampleLog,
  sessionStartTime: new Date('2025-06-01T11:50:00Z'),
  sessionGameType: 'crash',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GameLogModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // create()
  // -------------------------------------------------------------------------
  describe('create()', () => {
    it('should insert a game log and return the created record', async () => {
      const insertChain = buildInsertChain({ insertId: 1 });
      mockInsert.mockReturnValue(insertChain);

      const selectChain = buildChain([sampleLog]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameLogModel.create({
        sessionId: 100,
        userId: 10,
        gameType: 'crash',
        eventType: 'bet_placed',
        eventDetails: { amount: 50 },
        amount: '50.00',
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(sampleLog);
    });

    it('should include createdAt and updatedAt timestamps', async () => {
      const insertChain = buildInsertChain({ insertId: 1 });
      mockInsert.mockReturnValue(insertChain);

      const selectChain = buildChain([sampleLog]);
      mockSelect.mockReturnValue(selectChain);

      await GameLogModel.create({ gameType: 'crash', eventType: 'bet_placed', eventDetails: {} });

      const valuesCall = insertChain.values.mock.calls[0][0];
      expect(valuesCall).toHaveProperty('createdAt');
      expect(valuesCall).toHaveProperty('updatedAt');
      expect(valuesCall.createdAt).toBeInstanceOf(Date);
    });

    it('should throw an error when insert fails', async () => {
      mockInsert.mockImplementation(() => {
        throw new Error('Insert failed');
      });

      await expect(
        GameLogModel.create({ gameType: 'crash', eventType: 'bet', eventDetails: {} }),
      ).rejects.toThrow('Error creating game log: Insert failed');
    });
  });

  // -------------------------------------------------------------------------
  // findById()
  // -------------------------------------------------------------------------
  describe('findById()', () => {
    it('should return the log when found', async () => {
      const selectChain = buildChain([sampleLog]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameLogModel.findById(1);

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(sampleLog);
    });

    it('should return null when log is not found', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameLogModel.findById(999);

      expect(result).toBeNull();
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Query failed');
      });

      await expect(GameLogModel.findById(1)).rejects.toThrow(
        'Error finding game log by ID: Query failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getRecentUserLogs()
  // -------------------------------------------------------------------------
  describe('getRecentUserLogs()', () => {
    it('should return recent logs for a user with session details', async () => {
      const logsWithSession = [sampleLogWithSession];
      const selectChain = buildChain(logsWithSession);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameLogModel.getRecentUserLogs(10);

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.leftJoin).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(100);
      expect(result).toEqual(logsWithSession);
    });

    it('should accept a custom limit', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await GameLogModel.getRecentUserLogs(10, 25);

      expect(selectChain.limit).toHaveBeenCalledWith(25);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('User logs failed');
      });

      await expect(GameLogModel.getRecentUserLogs(10)).rejects.toThrow(
        'Error getting recent user logs: User logs failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getLogsByGameType()
  // -------------------------------------------------------------------------
  describe('getLogsByGameType()', () => {
    it('should return logs filtered by game type with user details', async () => {
      const logsWithUser = [sampleLogWithUser];
      const selectChain = buildChain(logsWithUser);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameLogModel.getLogsByGameType('crash');

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.leftJoin).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(100);
      expect(result).toEqual(logsWithUser);
    });

    it('should accept a custom limit', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await GameLogModel.getLogsByGameType('roulette', 50);

      expect(selectChain.limit).toHaveBeenCalledWith(50);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Game type logs failed');
      });

      await expect(GameLogModel.getLogsByGameType('crash')).rejects.toThrow(
        'Error getting logs by game type: Game type logs failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // searchByDateRange()
  // -------------------------------------------------------------------------
  describe('searchByDateRange()', () => {
    it('should return logs within the date range', async () => {
      const selectChain = buildChain([sampleLogWithUser]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameLogModel.searchByDateRange('2025-01-01', '2025-12-31');

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.leftJoin).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(1000);
      expect(result).toEqual([sampleLogWithUser]);
    });

    it('should accept optional gameType and eventType filters', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await GameLogModel.searchByDateRange('2025-01-01', '2025-12-31', 'crash', 'bet_placed');

      expect(selectChain.where).toHaveBeenCalled();
    });

    it('should work with no filters (no where clause)', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await GameLogModel.searchByDateRange(null, null);

      // No conditions, so where should not be called
      expect(selectChain.where).not.toHaveBeenCalled();
    });

    it('should accept a custom limit', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await GameLogModel.searchByDateRange('2025-01-01', '2025-12-31', null, null, 500);

      expect(selectChain.limit).toHaveBeenCalledWith(500);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Date range failed');
      });

      await expect(
        GameLogModel.searchByDateRange('2025-01-01', '2025-12-31'),
      ).rejects.toThrow('Error searching logs by date range: Date range failed');
    });
  });

  // -------------------------------------------------------------------------
  // findBySessionId()
  // -------------------------------------------------------------------------
  describe('findBySessionId()', () => {
    it('should return logs for a session', async () => {
      const sessionLogs = [sampleLog, { ...sampleLog, id: 2 }];
      const selectChain = buildChain(sessionLogs);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameLogModel.findBySessionId(100);

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(100);
      expect(result).toEqual(sessionLogs);
    });

    it('should accept a custom limit', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await GameLogModel.findBySessionId(100, 25);

      expect(selectChain.limit).toHaveBeenCalledWith(25);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Session logs failed');
      });

      await expect(GameLogModel.findBySessionId(100)).rejects.toThrow(
        'Error finding logs by session ID: Session logs failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findByEventType()
  // -------------------------------------------------------------------------
  describe('findByEventType()', () => {
    it('should return logs filtered by event type', async () => {
      const eventLogs = [sampleLog];
      const selectChain = buildChain(eventLogs);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameLogModel.findByEventType('bet_placed');

      expect(mockSelect).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(100);
      expect(selectChain.offset).toHaveBeenCalledWith(0);
      expect(result).toEqual(eventLogs);
    });

    it('should accept custom limit and offset', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await GameLogModel.findByEventType('win', 25, 10);

      expect(selectChain.limit).toHaveBeenCalledWith(25);
      expect(selectChain.offset).toHaveBeenCalledWith(10);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Event type failed');
      });

      await expect(GameLogModel.findByEventType('bet_placed')).rejects.toThrow(
        'Error finding logs by event type: Event type failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // update()
  // -------------------------------------------------------------------------
  describe('update()', () => {
    it('should update the log and return the updated record', async () => {
      const updatedLog = { ...sampleLog, eventType: 'win' };

      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      const selectChain = buildChain([updatedLog]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameLogModel.update(1, { eventType: 'win' });

      expect(mockUpdate).toHaveBeenCalled();
      const setCall = updateChain.set.mock.calls[0][0];
      expect(setCall.eventType).toBe('win');
      expect(setCall).toHaveProperty('updatedAt');
      expect(result).toEqual(updatedLog);
    });

    it('should throw an error when update fails', async () => {
      mockUpdate.mockImplementation(() => {
        throw new Error('Update failed');
      });

      await expect(GameLogModel.update(1, { eventType: 'win' })).rejects.toThrow(
        'Error updating game log: Update failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // delete()
  // -------------------------------------------------------------------------
  describe('delete()', () => {
    it('should delete the log and return the deleted record', async () => {
      const selectChain = buildChain([sampleLog]);
      mockSelect.mockReturnValue(selectChain);

      const deleteChain = buildDeleteChain(undefined);
      mockDelete.mockReturnValue(deleteChain);

      const result = await GameLogModel.delete(1);

      expect(mockSelect).toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalled();
      expect(result).toEqual(sampleLog);
    });

    it('should throw an error when delete fails', async () => {
      const selectChain = buildChain([sampleLog]);
      mockSelect.mockReturnValue(selectChain);

      mockDelete.mockImplementation(() => {
        throw new Error('Delete failed');
      });

      await expect(GameLogModel.delete(1)).rejects.toThrow(
        'Error deleting game log: Delete failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getEventStats()
  // -------------------------------------------------------------------------
  describe('getEventStats()', () => {
    it('should return aggregated event statistics', async () => {
      const rawLogs = [
        { eventType: 'bet_placed', gameType: 'crash', amount: '50.00' },
        { eventType: 'bet_placed', gameType: 'crash', amount: '100.00' },
        { eventType: 'win', gameType: 'crash', amount: '200.00' },
      ];
      const selectChain = buildChain(rawLogs);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameLogModel.getEventStats();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2); // bet_placed and win
      const betPlacedStat = result.find((s: any) => s.eventType === 'bet_placed');
      expect(betPlacedStat.count).toBe(2);
      expect(betPlacedStat.totalAmount).toBe(150);
    });

    it('should filter by gameType when provided', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await GameLogModel.getEventStats('crash');

      expect(selectChain.where).toHaveBeenCalled();
    });

    it('should return empty array when no logs exist', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameLogModel.getEventStats();

      expect(result).toEqual([]);
    });

    it('should handle logs with null amount', async () => {
      const rawLogs = [
        { eventType: 'session_start', gameType: 'crash', amount: null },
        { eventType: 'session_start', gameType: 'crash', amount: null },
      ];
      const selectChain = buildChain(rawLogs);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameLogModel.getEventStats();

      expect(result).toHaveLength(1);
      const stat = result[0];
      expect(stat.count).toBe(2);
      expect(stat.totalAmount).toBe(0); // null amounts should not add
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Stats failed');
      });

      await expect(GameLogModel.getEventStats()).rejects.toThrow(
        'Error getting event stats: Stats failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getLogCount()
  // -------------------------------------------------------------------------
  describe('getLogCount()', () => {
    it('should return the count of matching logs', async () => {
      const selectChain = buildChain([{ count: 'id1' }, { count: 'id2' }, { count: 'id3' }]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameLogModel.getLogCount();

      expect(result).toBe(3); // result.length
    });

    it('should apply filters when provided', async () => {
      const selectChain = buildChain([{ count: 'id1' }]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameLogModel.getLogCount('crash', 'bet_placed', 10);

      expect(selectChain.where).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Count failed');
      });

      await expect(GameLogModel.getLogCount()).rejects.toThrow(
        'Error getting log count: Count failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findWithDetails()
  // -------------------------------------------------------------------------
  describe('findWithDetails()', () => {
    it('should return logs with user and session details', async () => {
      const detailedLogs = [
        {
          ...sampleLog,
          username: 'testuser',
          sessionStartTime: new Date(),
          sessionIsCompleted: false,
        },
      ];
      const selectChain = buildChain(detailedLogs);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameLogModel.findWithDetails();

      expect(mockSelect).toHaveBeenCalled();
      // Two leftJoins: users and gameSessions
      expect(selectChain.leftJoin).toHaveBeenCalledTimes(2);
      expect(selectChain.orderBy).toHaveBeenCalled();
      expect(selectChain.limit).toHaveBeenCalledWith(100);
      expect(selectChain.offset).toHaveBeenCalledWith(0);
      expect(result).toEqual(detailedLogs);
    });

    it('should accept custom limit and offset', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      await GameLogModel.findWithDetails(25, 10);

      expect(selectChain.limit).toHaveBeenCalledWith(25);
      expect(selectChain.offset).toHaveBeenCalledWith(10);
    });
  });
});
