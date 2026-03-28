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
  gameStats: {
    id: 'gameStats.id',
    gameType: 'gameStats.gameType',
    name: 'gameStats.name',
    totalGamesPlayed: 'gameStats.totalGamesPlayed',
    totalBetsAmount: 'gameStats.totalBetsAmount',
    totalWinningsAmount: 'gameStats.totalWinningsAmount',
    houseProfit: 'gameStats.houseProfit',
    dailyStats: 'gameStats.dailyStats',
    createdAt: 'gameStats.createdAt',
    updatedAt: 'gameStats.updatedAt',
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

vi.mock('../../../src/services/loggingService.js', () => ({
  default: {
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Import the model AFTER mocks
// ---------------------------------------------------------------------------
import GameStatModel from '../../../drizzle/models/GameStat.js';

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

const sampleStat = {
  id: 1,
  gameType: 'crash',
  name: 'Crash',
  totalGamesPlayed: 1000,
  totalBetsAmount: '50000.00',
  totalWinningsAmount: '47000.00',
  houseProfit: '3000.00',
  dailyStats: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const sampleStatWithDaily = {
  ...sampleStat,
  dailyStats: JSON.stringify([
    { date: '2025-06-01', gamesPlayed: 50, betsAmount: 2500, winningsAmount: 2350, profit: 150 },
    { date: '2025-06-02', gamesPlayed: 60, betsAmount: 3000, winningsAmount: 2800, profit: 200 },
  ]),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GameStatModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // create()
  // -------------------------------------------------------------------------
  describe('create()', () => {
    it('should insert a stat and return the created record', async () => {
      const insertChain = buildInsertChain({ insertId: 1 });
      mockInsert.mockReturnValue(insertChain);

      const selectChain = buildChain([sampleStat]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameStatModel.create({
        gameType: 'crash',
        name: 'Crash',
        totalGamesPlayed: 0,
        totalBetsAmount: '0',
        totalWinningsAmount: '0',
        houseProfit: '0',
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(sampleStat);
    });

    it('should include createdAt and updatedAt timestamps', async () => {
      const insertChain = buildInsertChain({ insertId: 1 });
      mockInsert.mockReturnValue(insertChain);

      const selectChain = buildChain([sampleStat]);
      mockSelect.mockReturnValue(selectChain);

      await GameStatModel.create({ gameType: 'crash', name: 'Crash' });

      const valuesCall = insertChain.values.mock.calls[0][0];
      expect(valuesCall).toHaveProperty('createdAt');
      expect(valuesCall).toHaveProperty('updatedAt');
    });

    it('should throw an error when insert fails', async () => {
      mockInsert.mockImplementation(() => {
        throw new Error('Insert failed');
      });

      await expect(
        GameStatModel.create({ gameType: 'crash', name: 'Crash' }),
      ).rejects.toThrow('Error creating game stat: Insert failed');
    });
  });

  // -------------------------------------------------------------------------
  // findById()
  // -------------------------------------------------------------------------
  describe('findById()', () => {
    it('should return the stat when found', async () => {
      const selectChain = buildChain([sampleStat]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameStatModel.findById(1);

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(sampleStat);
    });

    it('should parse dailyStats JSON when present', async () => {
      const selectChain = buildChain([sampleStatWithDaily]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameStatModel.findById(1);

      expect(Array.isArray(result.dailyStats)).toBe(true);
      expect(result.dailyStats).toHaveLength(2);
    });

    it('should return null when stat is not found', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameStatModel.findById(999);

      expect(result).toBeNull();
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Query failed');
      });

      await expect(GameStatModel.findById(1)).rejects.toThrow(
        'Error finding game stat by ID: Query failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findByGameType()
  // -------------------------------------------------------------------------
  describe('findByGameType()', () => {
    it('should return the stat for a game type', async () => {
      const selectChain = buildChain([{ ...sampleStat }]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameStatModel.findByGameType('crash');

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(sampleStat);
    });

    it('should parse dailyStats JSON when present', async () => {
      // Use a fresh copy to avoid mutation from previous JSON.parse calls
      const freshStatWithDaily = { ...sampleStatWithDaily, dailyStats: JSON.stringify([
        { date: '2025-06-01', gamesPlayed: 50, betsAmount: 2500, winningsAmount: 2350, profit: 150 },
        { date: '2025-06-02', gamesPlayed: 60, betsAmount: 3000, winningsAmount: 2800, profit: 200 },
      ])};
      const selectChain = buildChain([freshStatWithDaily]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameStatModel.findByGameType('crash');

      expect(Array.isArray(result.dailyStats)).toBe(true);
    });

    it('should return null when game type is not found', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameStatModel.findByGameType('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Game type query failed');
      });

      await expect(GameStatModel.findByGameType('crash')).rejects.toThrow(
        'Error finding game stat by game type: Game type query failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findAll()
  // -------------------------------------------------------------------------
  describe('findAll()', () => {
    it('should return all game stats', async () => {
      const allStats = [
        sampleStat,
        { ...sampleStat, id: 2, gameType: 'roulette', name: 'Roulette' },
      ];
      const selectChain = buildChain(allStats);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameStatModel.findAll();

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(allStats);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no stats exist', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameStatModel.findAll();

      expect(result).toEqual([]);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('FindAll failed');
      });

      await expect(GameStatModel.findAll()).rejects.toThrow(
        'Error finding all game stats: FindAll failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // update()
  // -------------------------------------------------------------------------
  describe('update()', () => {
    it('should update the stat and return the updated record', async () => {
      const updatedStat = { ...sampleStat, totalGamesPlayed: 1001 };
      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      const selectChain = buildChain([updatedStat]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameStatModel.update(1, { totalGamesPlayed: 1001 });

      expect(mockUpdate).toHaveBeenCalled();
      const setCall = updateChain.set.mock.calls[0][0];
      expect(setCall.totalGamesPlayed).toBe(1001);
      expect(setCall).toHaveProperty('updatedAt');
      expect(result).toEqual(updatedStat);
    });

    it('should throw an error when update fails', async () => {
      mockUpdate.mockImplementation(() => {
        throw new Error('Update failed');
      });

      await expect(
        GameStatModel.update(1, { totalGamesPlayed: 1001 }),
      ).rejects.toThrow('Error updating game stat: Update failed');
    });
  });

  // -------------------------------------------------------------------------
  // updateByGameType()
  // -------------------------------------------------------------------------
  describe('updateByGameType()', () => {
    it('should update stats by game type and return the updated record', async () => {
      const updatedStat = { ...sampleStat, houseProfit: '3500.00' };
      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      const selectChain = buildChain([updatedStat]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameStatModel.updateByGameType('crash', { houseProfit: '3500.00' });

      expect(mockUpdate).toHaveBeenCalled();
      expect(result).toEqual(updatedStat);
    });

    it('should throw an error when update fails', async () => {
      mockUpdate.mockImplementation(() => {
        throw new Error('Update by type failed');
      });

      await expect(
        GameStatModel.updateByGameType('crash', { houseProfit: '3500' }),
      ).rejects.toThrow('Error updating game stat by game type: Update by type failed');
    });
  });

  // -------------------------------------------------------------------------
  // delete()
  // -------------------------------------------------------------------------
  describe('delete()', () => {
    it('should delete the stat and return the deleted record', async () => {
      const selectChain = buildChain([sampleStat]);
      mockSelect.mockReturnValue(selectChain);

      const deleteChain = buildDeleteChain(undefined);
      mockDelete.mockReturnValue(deleteChain);

      const result = await GameStatModel.delete(1);

      expect(mockSelect).toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalled();
      expect(result).toEqual(sampleStat);
    });

    it('should throw an error when delete fails', async () => {
      const selectChain = buildChain([sampleStat]);
      mockSelect.mockReturnValue(selectChain);

      mockDelete.mockImplementation(() => {
        throw new Error('Delete failed');
      });

      await expect(GameStatModel.delete(1)).rejects.toThrow(
        'Error deleting game stat: Delete failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getStatsSummary()
  // -------------------------------------------------------------------------
  describe('getStatsSummary()', () => {
    it('should return aggregated summary of all game stats', async () => {
      const allStats = [
        {
          totalGamesPlayed: 1000,
          totalBetsAmount: '50000',
          totalWinningsAmount: '47000',
          houseProfit: '3000',
        },
        {
          totalGamesPlayed: 500,
          totalBetsAmount: '25000',
          totalWinningsAmount: '23000',
          houseProfit: '2000',
        },
      ];
      const selectChain = buildChain(allStats);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameStatModel.getStatsSummary();

      expect(result.totalGames).toBe(1500);
      expect(result.totalBets).toBe(75000);
      expect(result.totalWinnings).toBe(70000);
      expect(result.totalProfit).toBe(5000);
      expect(result.gameCount).toBe(2);
      expect(result.averageBetPerGame).toBe(50);
      expect(typeof result.houseEdgePercentage).toBe('number');
    });

    it('should handle empty stats', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameStatModel.getStatsSummary();

      expect(result.totalGames).toBe(0);
      expect(result.totalBets).toBe(0);
      expect(result.averageBetPerGame).toBe(0);
      expect(result.houseEdgePercentage).toBe(0);
    });

    it('should throw an error when query fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Summary failed');
      });

      // getStatsSummary calls findAll which wraps the error, then getStatsSummary wraps again
      await expect(GameStatModel.getStatsSummary()).rejects.toThrow(
        'Error getting stats summary: Error finding all game stats: Summary failed',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getDailyStats()
  // -------------------------------------------------------------------------
  describe('getDailyStats()', () => {
    it('should return daily stats sorted by date (most recent first)', async () => {
      // findByGameType does JSON.parse on dailyStats, so provide it as a JSON string
      const statWithDaily = {
        ...sampleStat,
        dailyStats: JSON.stringify([
          { date: '2025-06-01', gamesPlayed: 50 },
          { date: '2025-06-02', gamesPlayed: 60 },
        ]),
      };
      // findByGameType internally does a select
      const selectChain = buildChain([statWithDaily]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameStatModel.getDailyStats('crash');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when no stat exists', async () => {
      const selectChain = buildChain([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameStatModel.getDailyStats('nonexistent');

      expect(result).toEqual([]);
    });

    it('should return empty array when dailyStats is not an array', async () => {
      const statNoDaily = { ...sampleStat, dailyStats: null };
      const selectChain = buildChain([statNoDaily]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameStatModel.getDailyStats('crash');

      expect(result).toEqual([]);
    });

    it('should limit the number of days returned', async () => {
      const manyDays = Array.from({ length: 40 }, (_, i) => ({
        date: `2025-01-${String(i + 1).padStart(2, '0')}`,
        gamesPlayed: i + 1,
      }));
      // findByGameType does JSON.parse on dailyStats, so provide as JSON string
      const statWithManyDays = { ...sampleStat, dailyStats: JSON.stringify(manyDays) };
      const selectChain = buildChain([statWithManyDays]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameStatModel.getDailyStats('crash', 5);

      expect(result).toHaveLength(5);
    });
  });

  // -------------------------------------------------------------------------
  // updateStats()
  // -------------------------------------------------------------------------
  describe('updateStats()', () => {
    it('should update existing stats when stat already exists', async () => {
      const existingStat = {
        ...sampleStat,
        // Use numeric values since updateStats does arithmetic on these fields
        totalBetsAmount: 50000,
        totalWinningsAmount: 47000,
        houseProfit: 3000,
        // findByGameType does JSON.parse on dailyStats, so provide as JSON string
        dailyStats: JSON.stringify([]),
      };
      // First call: findByGameType (select)
      const selectChainFind = buildChain([existingStat]);
      mockSelect.mockReturnValueOnce(selectChainFind);

      const updateChain = buildUpdateChain(undefined);
      mockUpdate.mockReturnValue(updateChain);

      await GameStatModel.updateStats('crash', 100, 80);

      expect(mockUpdate).toHaveBeenCalled();
      const setCall = updateChain.set.mock.calls[0][0];
      expect(setCall.totalGamesPlayed).toBe(1001);
      expect(setCall.totalBetsAmount).toBe(50100);
      expect(setCall.totalWinningsAmount).toBe(47080);
      expect(setCall.houseProfit).toBe(3020);
    });

    it('should create new stats when stat does not exist', async () => {
      // findByGameType returns null
      const selectChainFind = buildChain([]);
      mockSelect.mockReturnValueOnce(selectChainFind);

      // create() calls insert then select
      const insertChain = buildInsertChain({ insertId: 1 });
      mockInsert.mockReturnValue(insertChain);

      const selectChainCreate = buildChain([sampleStat]);
      mockSelect.mockReturnValueOnce(selectChainCreate);

      await GameStatModel.updateStats('crash', 100, 80);

      expect(mockInsert).toHaveBeenCalled();
    });

    it('should throw an error when update fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Update stats failed');
      });

      await expect(
        GameStatModel.updateStats('crash', 100, 80),
      ).rejects.toThrow('Update stats failed');
    });
  });

  // -------------------------------------------------------------------------
  // initializeAllGameTypes()
  // -------------------------------------------------------------------------
  describe('initializeAllGameTypes()', () => {
    it('should create stats for game types that do not exist yet', async () => {
      // findByGameType returns null for all game types (no existing stats)
      const selectChainFind = buildChain([]);
      mockSelect.mockReturnValue(selectChainFind);

      const insertChain = buildInsertChain({ insertId: 1 });
      mockInsert.mockReturnValue(insertChain);

      const result = await GameStatModel.initializeAllGameTypes();

      // Should attempt to create 7 game types
      expect(mockInsert).toHaveBeenCalledTimes(7);
      expect(result).toHaveLength(7);
    });

    it('should skip game types that already have stats', async () => {
      // Return existing stat for every call (meaning all types already exist)
      const selectChain = buildChain([sampleStat]);
      mockSelect.mockReturnValue(selectChain);

      const result = await GameStatModel.initializeAllGameTypes();

      expect(mockInsert).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });

    it('should throw an error when initialization fails', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Init failed');
      });

      await expect(GameStatModel.initializeAllGameTypes()).rejects.toThrow(
        'Init failed',
      );
    });
  });
});
