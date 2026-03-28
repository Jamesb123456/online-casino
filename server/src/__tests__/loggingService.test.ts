// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks -- use vi.hoisted so variables are available in vi.mock factories
// ---------------------------------------------------------------------------

const {
  mockGameLogCreate,
  mockGetRecentUserLogs,
  mockGetLogsByGameType,
  mockSearchByDateRange,
  mockFindWithDetails,
  mockWinstonInfo,
  mockWinstonError,
  mockWinstonWarn,
  mockWinstonLog,
  mockWinstonDebug,
  mockDbDelete,
  mockDbDeleteWhere,
} = vi.hoisted(() => ({
  mockGameLogCreate: vi.fn(),
  mockGetRecentUserLogs: vi.fn(),
  mockGetLogsByGameType: vi.fn(),
  mockSearchByDateRange: vi.fn(),
  mockFindWithDetails: vi.fn(),
  mockWinstonInfo: vi.fn(),
  mockWinstonError: vi.fn(),
  mockWinstonWarn: vi.fn(),
  mockWinstonLog: vi.fn(),
  mockWinstonDebug: vi.fn(),
  mockDbDelete: vi.fn(),
  mockDbDeleteWhere: vi.fn(),
}));

vi.mock('../../drizzle/models/GameLog.js', () => ({
  default: {
    create: mockGameLogCreate,
    getRecentUserLogs: mockGetRecentUserLogs,
    getLogsByGameType: mockGetLogsByGameType,
    searchByDateRange: mockSearchByDateRange,
    findWithDetails: mockFindWithDetails,
  },
}));

vi.mock('winston', () => {
  const mockLogger = {
    info: mockWinstonInfo,
    error: mockWinstonError,
    warn: mockWinstonWarn,
    log: mockWinstonLog,
    debug: mockWinstonDebug,
  };

  return {
    default: {
      createLogger: vi.fn().mockReturnValue(mockLogger),
      format: {
        combine: vi.fn(),
        timestamp: vi.fn(),
        errors: vi.fn(),
        printf: vi.fn(),
        colorize: vi.fn(),
      },
      transports: {
        Console: vi.fn(),
        File: vi.fn(),
      },
    },
  };
});

vi.mock('drizzle-orm', () => ({
  lt: vi.fn((...args) => args),
  eq: vi.fn((...args) => args),
  desc: vi.fn((...args) => args),
  and: vi.fn((...args) => args),
  gte: vi.fn((...args) => args),
  lte: vi.fn((...args) => args),
}));

vi.mock('../../drizzle/schema.js', () => ({
  gameLogs: {
    id: 'id',
    timestamp: 'timestamp',
    gameType: 'gameType',
    eventType: 'eventType',
    userId: 'userId',
  },
}));

vi.mock('../../drizzle/db.js', () => ({
  db: {
    delete: mockDbDelete.mockReturnValue({
      where: mockDbDeleteWhere,
    }),
  },
}));

// ---------------------------------------------------------------------------
// Import module under test
// ---------------------------------------------------------------------------

import LoggingService from '../services/loggingService.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LoggingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // logger property
  // -----------------------------------------------------------------------
  describe('logger', () => {
    it('should expose a Winston logger instance', () => {
      expect(LoggingService.logger).toBeDefined();
      expect(LoggingService.logger.info).toBeDefined();
      expect(LoggingService.logger.error).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // logGameAction
  // -----------------------------------------------------------------------
  describe('logGameAction()', () => {
    it('should create a game log entry with correct format', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 1 });

      await LoggingService.logGameAction('42', 'crash', 'bet_placed', { amount: 100 }, 5);

      expect(mockGameLogCreate).toHaveBeenCalledWith({
        userId: 42,
        gameType: 'crash',
        eventType: 'bet_placed',
        eventDetails: { amount: 100 },
        sessionId: 5,
        timestamp: expect.any(Date),
      });
    });

    it('should default sessionId to null', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 1 });

      await LoggingService.logGameAction('1', 'plinko', 'game_start', {});

      expect(mockGameLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: null,
        })
      );
    });

    it('should default eventDetails to empty object', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 1 });

      await LoggingService.logGameAction('1', 'roulette', 'spin');

      expect(mockGameLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          eventDetails: {},
        })
      );
    });

    it('should parse userId as integer', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 1 });

      await LoggingService.logGameAction('99', 'crash', 'bet_placed');

      expect(mockGameLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 99,
        })
      );
    });

    it('should not throw when GameLog.create fails', async () => {
      mockGameLogCreate.mockRejectedValue(new Error('DB insert failed'));

      await expect(
        LoggingService.logGameAction('1', 'crash', 'bet_placed', { amount: 50 })
      ).resolves.toBeUndefined();

      expect(mockWinstonError).toHaveBeenCalledWith(
        'Failed to log game action',
        expect.objectContaining({ gameType: 'crash', eventType: 'bet_placed', userId: '1' })
      );
    });
  });

  // -----------------------------------------------------------------------
  // logAuthAction
  // -----------------------------------------------------------------------
  describe('logAuthAction()', () => {
    it('should create an auth log entry with gameType "system"', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 2 });

      await LoggingService.logAuthAction('10', 'login', { ip: '127.0.0.1' });

      expect(mockGameLogCreate).toHaveBeenCalledWith({
        userId: 10,
        gameType: 'system',
        eventType: 'auth_login',
        eventDetails: { ip: '127.0.0.1' },
        timestamp: expect.any(Date),
      });
    });

    it('should prefix eventType with "auth_"', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 2 });

      await LoggingService.logAuthAction('10', 'logout', {});

      expect(mockGameLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'auth_logout',
        })
      );
    });

    it('should handle failed_login event type', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 3 });

      await LoggingService.logAuthAction('10', 'failed_login', { reason: 'wrong_password' });

      expect(mockGameLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'auth_failed_login',
          eventDetails: { reason: 'wrong_password' },
        })
      );
    });

    it('should default metadata to empty object', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 2 });

      await LoggingService.logAuthAction('10', 'login');

      expect(mockGameLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          eventDetails: {},
        })
      );
    });

    it('should not throw when GameLog.create fails', async () => {
      mockGameLogCreate.mockRejectedValue(new Error('DB down'));

      await expect(
        LoggingService.logAuthAction('10', 'login')
      ).resolves.toBeUndefined();

      expect(mockWinstonError).toHaveBeenCalledWith(
        'Failed to log auth action',
        expect.objectContaining({ eventType: 'login', userId: '10' })
      );
    });
  });

  // -----------------------------------------------------------------------
  // logAdminAction
  // -----------------------------------------------------------------------
  describe('logAdminAction()', () => {
    it('should create an admin log entry with gameType "admin"', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 4 });

      await LoggingService.logAdminAction('1', 'balance_adjustment', { targetUserId: 5, amount: 1000 });

      expect(mockGameLogCreate).toHaveBeenCalledWith({
        userId: 1,
        gameType: 'admin',
        eventType: 'balance_adjustment',
        eventDetails: { targetUserId: 5, amount: 1000 },
        timestamp: expect.any(Date),
      });
    });

    it('should default targetData to empty object', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 4 });

      await LoggingService.logAdminAction('1', 'user_ban');

      expect(mockGameLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          eventDetails: {},
        })
      );
    });

    it('should not throw when GameLog.create fails', async () => {
      mockGameLogCreate.mockRejectedValue(new Error('DB insert failed'));

      await expect(
        LoggingService.logAdminAction('1', 'balance_adjustment', { amount: 500 })
      ).resolves.toBeUndefined();

      expect(mockWinstonError).toHaveBeenCalledWith(
        'Failed to log admin action',
        expect.objectContaining({ eventType: 'balance_adjustment', adminId: '1' })
      );
    });
  });

  // -----------------------------------------------------------------------
  // logSystemEvent
  // -----------------------------------------------------------------------
  describe('logSystemEvent()', () => {
    it('should log to Winston and create a DB entry', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 5 });

      await LoggingService.logSystemEvent('server_start', { port: 5000 }, 'info');

      expect(mockWinstonLog).toHaveBeenCalledWith('info', 'system_event: server_start', { port: 5000 });
      expect(mockGameLogCreate).toHaveBeenCalledWith({
        userId: null,
        gameType: 'system',
        eventType: 'info_server_start',
        eventDetails: { port: 5000 },
        timestamp: expect.any(Date),
      });
    });

    it('should convert "warning" level to "warn" for Winston', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 5 });

      await LoggingService.logSystemEvent('high_memory', { usage: '90%' }, 'warning');

      expect(mockWinstonLog).toHaveBeenCalledWith('warn', 'system_event: high_memory', { usage: '90%' });
    });

    it('should prefix eventType with the level', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 5 });

      await LoggingService.logSystemEvent('db_connection_lost', {}, 'error');

      expect(mockGameLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'error_db_connection_lost',
        })
      );
    });

    it('should set userId to null for system events', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 5 });

      await LoggingService.logSystemEvent('cron_job', {});

      expect(mockGameLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
        })
      );
    });

    it('should default level to "info"', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 5 });

      await LoggingService.logSystemEvent('heartbeat', { uptime: 3600 });

      expect(mockWinstonLog).toHaveBeenCalledWith('info', 'system_event: heartbeat', { uptime: 3600 });
      expect(mockGameLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'info_heartbeat',
        })
      );
    });

    it('should default data to empty object', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 5 });

      await LoggingService.logSystemEvent('ping');

      expect(mockWinstonLog).toHaveBeenCalledWith('info', 'system_event: ping', {});
    });

    it('should not throw when DB insert fails', async () => {
      mockGameLogCreate.mockRejectedValue(new Error('DB failure'));

      await expect(
        LoggingService.logSystemEvent('test_event')
      ).resolves.toBeUndefined();

      expect(mockWinstonError).toHaveBeenCalledWith(
        'Failed to log system event to DB',
        expect.objectContaining({ event: 'test_event' })
      );
    });
  });

  // -----------------------------------------------------------------------
  // logBetPlaced
  // -----------------------------------------------------------------------
  describe('logBetPlaced()', () => {
    it('should call logGameEvent with bet_placed event type', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 10 });

      await LoggingService.logBetPlaced('crash', 'session_1', '5', 100, { multiplier: 2 });

      expect(mockGameLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 5,
          gameType: 'crash',
          eventType: 'bet_placed',
          eventDetails: expect.objectContaining({
            amount: 100,
            multiplier: 2,
            sessionId: 'session_1',
          }),
        })
      );
    });

    it('should handle null sessionId', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 10 });

      await LoggingService.logBetPlaced('roulette', null, '5', 50);

      expect(mockGameLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'bet_placed',
          eventDetails: expect.objectContaining({ amount: 50 }),
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // logBetResult
  // -----------------------------------------------------------------------
  describe('logBetResult()', () => {
    it('should call logGameEvent with game_result event type', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 11 });

      await LoggingService.logBetResult('crash', 'session_1', '5', 100, 200, true, { cashoutAt: 2.0 });

      expect(mockGameLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 5,
          gameType: 'crash',
          eventType: 'game_result',
          eventDetails: expect.objectContaining({
            betAmount: 100,
            winAmount: 200,
            isWin: true,
            cashoutAt: 2.0,
          }),
        })
      );
    });

    it('should handle loss results', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 12 });

      await LoggingService.logBetResult('plinko', null, '3', 50, 0, false);

      expect(mockGameLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'game_result',
          eventDetails: expect.objectContaining({
            betAmount: 50,
            winAmount: 0,
            isWin: false,
          }),
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // logGameStart
  // -----------------------------------------------------------------------
  describe('logGameStart()', () => {
    it('should call logGameEvent with game_start event type', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 13 });

      await LoggingService.logGameStart('crash', 'session_42', { roundId: 'abc' });

      expect(mockGameLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          gameType: 'crash',
          eventType: 'game_start',
          eventDetails: expect.objectContaining({
            roundId: 'abc',
            sessionId: 'session_42',
          }),
        })
      );
    });

    it('should set userId to null for game start (no specific user)', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 13 });

      await LoggingService.logGameStart('roulette', null, {});

      expect(mockGameLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // logGameEnd
  // -----------------------------------------------------------------------
  describe('logGameEnd()', () => {
    it('should call logGameEvent with game_end event type', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 14 });

      await LoggingService.logGameEnd('crash', 'session_42', { crashPoint: 2.5 });

      expect(mockGameLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          gameType: 'crash',
          eventType: 'game_end',
          eventDetails: expect.objectContaining({
            crashPoint: 2.5,
            sessionId: 'session_42',
          }),
        })
      );
    });

    it('should handle null sessionId', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 14 });

      await LoggingService.logGameEnd('wheel', null, { result: 'red' });

      expect(mockGameLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'game_end',
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // getLogs
  // -----------------------------------------------------------------------
  describe('getLogs()', () => {
    it('should return logs with no filters (calls findWithDetails)', async () => {
      const mockLogs = [
        { id: 1, gameType: 'crash', eventType: 'bet_placed' },
        { id: 2, gameType: 'roulette', eventType: 'spin' },
      ];
      mockFindWithDetails.mockResolvedValue(mockLogs);

      const logs = await LoggingService.getLogs();

      expect(mockFindWithDetails).toHaveBeenCalledWith(100);
      expect(logs).toEqual(mockLogs);
    });

    it('should filter by gameType', async () => {
      const mockLogs = [{ id: 1, gameType: 'crash' }];
      mockGetLogsByGameType.mockResolvedValue(mockLogs);

      const logs = await LoggingService.getLogs({ gameType: 'crash' });

      expect(mockGetLogsByGameType).toHaveBeenCalledWith('crash', 100);
      expect(logs).toEqual(mockLogs);
    });

    it('should filter by userId', async () => {
      const mockLogs = [{ id: 1, userId: 5 }];
      mockGetRecentUserLogs.mockResolvedValue(mockLogs);

      const logs = await LoggingService.getLogs({ userId: '5' });

      expect(mockGetRecentUserLogs).toHaveBeenCalledWith(5, 100);
      expect(logs).toEqual(mockLogs);
    });

    it('should filter by date range', async () => {
      const mockLogs = [{ id: 1, timestamp: new Date() }];
      mockSearchByDateRange.mockResolvedValue(mockLogs);

      const logs = await LoggingService.getLogs({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(mockSearchByDateRange).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date),
      );
      expect(logs).toEqual(mockLogs);
    });

    it('should respect custom limit', async () => {
      mockFindWithDetails.mockResolvedValue([]);

      await LoggingService.getLogs({ limit: 50 });

      expect(mockFindWithDetails).toHaveBeenCalledWith(50);
    });

    it('should default limit to 100', async () => {
      mockFindWithDetails.mockResolvedValue([]);

      await LoggingService.getLogs({});

      expect(mockFindWithDetails).toHaveBeenCalledWith(100);
    });

    it('should prioritize date range filter over other filters', async () => {
      mockSearchByDateRange.mockResolvedValue([]);

      await LoggingService.getLogs({
        startDate: '2024-01-01',
        gameType: 'crash',
        userId: '5',
      });

      // Date range takes priority in the if/else chain
      expect(mockSearchByDateRange).toHaveBeenCalled();
      expect(mockGetLogsByGameType).not.toHaveBeenCalled();
      expect(mockGetRecentUserLogs).not.toHaveBeenCalled();
    });

    it('should prioritize gameType filter over userId when no date range', async () => {
      mockGetLogsByGameType.mockResolvedValue([]);

      await LoggingService.getLogs({
        gameType: 'crash',
        userId: '5',
      });

      expect(mockGetLogsByGameType).toHaveBeenCalled();
      expect(mockGetRecentUserLogs).not.toHaveBeenCalled();
    });

    it('should return empty array when query fails', async () => {
      mockFindWithDetails.mockRejectedValue(new Error('DB query failed'));

      const logs = await LoggingService.getLogs();

      expect(logs).toEqual([]);
      expect(mockWinstonError).toHaveBeenCalledWith(
        'Failed to fetch logs',
        expect.objectContaining({ filters: {} })
      );
    });

    it('should handle startDate only (no endDate)', async () => {
      mockSearchByDateRange.mockResolvedValue([]);

      await LoggingService.getLogs({ startDate: '2024-06-01' });

      expect(mockSearchByDateRange).toHaveBeenCalledWith(
        expect.any(Date),
        null,
      );
    });

    it('should handle endDate only (no startDate)', async () => {
      mockSearchByDateRange.mockResolvedValue([]);

      await LoggingService.getLogs({ endDate: '2024-12-31' });

      expect(mockSearchByDateRange).toHaveBeenCalledWith(
        null,
        expect.any(Date),
      );
    });
  });

  // -----------------------------------------------------------------------
  // getUserLogs
  // -----------------------------------------------------------------------
  describe('getUserLogs()', () => {
    it('should return logs for a specific user', async () => {
      const mockLogs = [{ id: 1, userId: 10 }, { id: 2, userId: 10 }];
      mockGetRecentUserLogs.mockResolvedValue(mockLogs);

      const logs = await LoggingService.getUserLogs('10');

      expect(mockGetRecentUserLogs).toHaveBeenCalledWith(10, 50);
      expect(logs).toEqual(mockLogs);
    });

    it('should use default limit of 50', async () => {
      mockGetRecentUserLogs.mockResolvedValue([]);

      await LoggingService.getUserLogs('1');

      expect(mockGetRecentUserLogs).toHaveBeenCalledWith(1, 50);
    });

    it('should respect custom limit', async () => {
      mockGetRecentUserLogs.mockResolvedValue([]);

      await LoggingService.getUserLogs('1', 200);

      expect(mockGetRecentUserLogs).toHaveBeenCalledWith(1, 200);
    });

    it('should return empty array when query fails', async () => {
      mockGetRecentUserLogs.mockRejectedValue(new Error('DB error'));

      const logs = await LoggingService.getUserLogs('1');

      expect(logs).toEqual([]);
      expect(mockWinstonError).toHaveBeenCalledWith(
        'Failed to fetch user logs',
        expect.objectContaining({ userId: '1' })
      );
    });
  });

  // -----------------------------------------------------------------------
  // getGameTypeLogs
  // -----------------------------------------------------------------------
  describe('getGameTypeLogs()', () => {
    it('should return logs for a specific game type', async () => {
      const mockLogs = [{ id: 1, gameType: 'crash' }];
      mockGetLogsByGameType.mockResolvedValue(mockLogs);

      const logs = await LoggingService.getGameTypeLogs('crash');

      expect(mockGetLogsByGameType).toHaveBeenCalledWith('crash', 100);
      expect(logs).toEqual(mockLogs);
    });

    it('should use default limit of 100', async () => {
      mockGetLogsByGameType.mockResolvedValue([]);

      await LoggingService.getGameTypeLogs('roulette');

      expect(mockGetLogsByGameType).toHaveBeenCalledWith('roulette', 100);
    });

    it('should respect custom limit', async () => {
      mockGetLogsByGameType.mockResolvedValue([]);

      await LoggingService.getGameTypeLogs('plinko', 25);

      expect(mockGetLogsByGameType).toHaveBeenCalledWith('plinko', 25);
    });

    it('should return empty array when query fails', async () => {
      mockGetLogsByGameType.mockRejectedValue(new Error('DB error'));

      const logs = await LoggingService.getGameTypeLogs('crash');

      expect(logs).toEqual([]);
      expect(mockWinstonError).toHaveBeenCalledWith(
        'Failed to fetch game type logs',
        expect.objectContaining({ gameType: 'crash' })
      );
    });
  });

  // -----------------------------------------------------------------------
  // cleanupOldLogs
  // -----------------------------------------------------------------------
  describe('cleanupOldLogs()', () => {
    it('should delete logs older than the specified number of days', async () => {
      mockDbDeleteWhere.mockResolvedValue([{ affectedRows: 150 }]);

      const result = await LoggingService.cleanupOldLogs(30);

      expect(result).toBe(150);
      expect(mockDbDelete).toHaveBeenCalled();
      expect(mockWinstonInfo).toHaveBeenCalledWith(
        expect.stringContaining('Log cleanup: removing logs older than')
      );
      expect(mockWinstonInfo).toHaveBeenCalledWith(
        expect.stringContaining('Log cleanup complete: 150 logs deleted')
      );
    });

    it('should default to 30 days', async () => {
      mockDbDeleteWhere.mockResolvedValue([{ affectedRows: 0 }]);

      await LoggingService.cleanupOldLogs();

      expect(mockWinstonInfo).toHaveBeenCalledWith(
        expect.stringContaining('Log cleanup: removing logs older than')
      );
    });

    it('should return 0 when no logs are deleted', async () => {
      mockDbDeleteWhere.mockResolvedValue([{ affectedRows: 0 }]);

      const result = await LoggingService.cleanupOldLogs(7);

      expect(result).toBe(0);
    });

    it('should return 0 when the delete operation fails', async () => {
      mockDbDeleteWhere.mockRejectedValue(new Error('DB delete failed'));

      const result = await LoggingService.cleanupOldLogs(30);

      expect(result).toBe(0);
      expect(mockWinstonError).toHaveBeenCalledWith(
        'Failed to clean up old logs',
        expect.objectContaining({ daysToKeep: 30 })
      );
    });

    it('should handle missing affectedRows in result', async () => {
      mockDbDeleteWhere.mockResolvedValue([{}]);

      const result = await LoggingService.cleanupOldLogs(30);

      expect(result).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // logGameEvent (internal method used by convenience wrappers)
  // -----------------------------------------------------------------------
  describe('logGameEvent()', () => {
    it('should create a log entry with userId when provided', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 20 });

      await LoggingService.logGameEvent('crash', 'round_start', { round: 1 }, '5', 'session_1');

      expect(mockGameLogCreate).toHaveBeenCalledWith({
        userId: 5,
        gameType: 'crash',
        eventType: 'round_start',
        eventDetails: { round: 1, sessionId: 'session_1' },
        timestamp: expect.any(Date),
      });
    });

    it('should set userId to null when not provided', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 21 });

      await LoggingService.logGameEvent('crash', 'tick', {});

      expect(mockGameLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
        })
      );
    });

    it('should handle numeric userId', async () => {
      mockGameLogCreate.mockResolvedValue({ id: 22 });

      await LoggingService.logGameEvent('roulette', 'bet', {}, 42);

      expect(mockGameLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 42,
        })
      );
    });

    it('should not throw when GameLog.create fails', async () => {
      mockGameLogCreate.mockRejectedValue(new Error('DB failure'));

      await expect(
        LoggingService.logGameEvent('crash', 'error', {})
      ).resolves.toBeUndefined();

      expect(mockWinstonError).toHaveBeenCalledWith(
        'Failed to log game event',
        expect.objectContaining({ gameType: 'crash', eventType: 'error' })
      );
    });
  });

  // -----------------------------------------------------------------------
  // Error handling robustness
  // -----------------------------------------------------------------------
  describe('error handling', () => {
    it('should never propagate database errors from logGameAction', async () => {
      mockGameLogCreate.mockRejectedValue(new Error('Connection timeout'));

      await expect(LoggingService.logGameAction('1', 'crash', 'bet')).resolves.toBeUndefined();
    });

    it('should never propagate database errors from logAuthAction', async () => {
      mockGameLogCreate.mockRejectedValue(new Error('Connection timeout'));

      await expect(LoggingService.logAuthAction('1', 'login')).resolves.toBeUndefined();
    });

    it('should never propagate database errors from logAdminAction', async () => {
      mockGameLogCreate.mockRejectedValue(new Error('Connection timeout'));

      await expect(LoggingService.logAdminAction('1', 'adjust')).resolves.toBeUndefined();
    });

    it('should never propagate database errors from logSystemEvent', async () => {
      mockGameLogCreate.mockRejectedValue(new Error('Connection timeout'));

      await expect(LoggingService.logSystemEvent('event')).resolves.toBeUndefined();
    });

    it('should never propagate database errors from logGameEvent', async () => {
      mockGameLogCreate.mockRejectedValue(new Error('Connection timeout'));

      await expect(LoggingService.logGameEvent('crash', 'tick')).resolves.toBeUndefined();
    });

    it('should return empty array from getLogs on error', async () => {
      mockFindWithDetails.mockRejectedValue(new Error('Query timeout'));

      const result = await LoggingService.getLogs();
      expect(result).toEqual([]);
    });

    it('should return empty array from getUserLogs on error', async () => {
      mockGetRecentUserLogs.mockRejectedValue(new Error('Query timeout'));

      const result = await LoggingService.getUserLogs('1');
      expect(result).toEqual([]);
    });

    it('should return empty array from getGameTypeLogs on error', async () => {
      mockGetLogsByGameType.mockRejectedValue(new Error('Query timeout'));

      const result = await LoggingService.getGameTypeLogs('crash');
      expect(result).toEqual([]);
    });

    it('should return 0 from cleanupOldLogs on error', async () => {
      mockDbDeleteWhere.mockRejectedValue(new Error('Permission denied'));

      const result = await LoggingService.cleanupOldLogs();
      expect(result).toBe(0);
    });
  });
});
