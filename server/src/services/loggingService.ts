/**
 * Game Logging Service
 *
 * A centralized logging service for all casino games and system events.
 * Records game events, outcomes, and player interactions.
 * Provides consistent structured logs across all games.
 *
 * Uses Winston for console and file-based logging with proper log levels.
 * Database logging via GameLog model for persistent game/audit trails.
 */

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

// Import Drizzle models
import GameLog from '../../drizzle/models/GameLog.js';

// Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve logs directory relative to server root
const logsDir = path.resolve(__dirname, '..', '..', 'logs');

// ──────────────────────────────────────────────
// Winston Logger Configuration
// ──────────────────────────────────────────────

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  })
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    // Console transport (always active)
    new winston.transports.Console({
      format: consoleFormat,
    }),

    // Combined log file (info and above)
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: logFormat,
      level: 'info',
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
      tailable: true,
    }),

    // Error-only log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      format: logFormat,
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
      tailable: true,
    }),
  ],
  // Do not exit on uncaught errors handled by the logger itself
  exitOnError: false,
});

// ──────────────────────────────────────────────
// Type definitions
// ──────────────────────────────────────────────

interface LogFilters {
  userId?: string;
  gameType?: string;
  eventType?: string | RegExp;
  startDate?: string | Date;
  endDate?: string | Date;
  limit?: number;
}

interface QueryFilters {
  userId?: string;
  gameType?: string;
  eventType?: string | { $regex: RegExp };
  timestamp?: {
    $gte?: Date;
    $lte?: Date;
  };
}

interface ParsedLogEntry {
  id?: number;
  userId?: number | null;
  gameType: string;
  eventType: string;
  eventDetails: any;
  sessionId?: number | null;
  timestamp: Date;
  username?: string | null;
}

// ──────────────────────────────────────────────
// LoggingService Class
// ──────────────────────────────────────────────

/**
 * Enhanced logging service for game activities and system events.
 * Exposes a Winston `logger` for direct use, and higher-level methods
 * that persist events to the database.
 */
class LoggingService {
  /**
   * Winston logger instance.
   * Use for general-purpose logging that does not need to be persisted to the DB.
   *
   * Examples:
   *   LoggingService.logger.info('Server started', { port: 5000 });
   *   LoggingService.logger.error('Connection failed', { error: err.message });
   *   LoggingService.logger.warn('Deprecation notice', { feature: 'xyz' });
   *   LoggingService.logger.debug('Debugging details', { data });
   */
  static logger = winstonLogger;

  /**
   * Log a game action
   * @param {string} userId - User performing the action
   * @param {string} gameType - Type of game (crash, plinko, etc.)
   * @param {string} eventType - Event type being performed
   * @param {Object} eventDetails - Game-specific data
   * @param {string} sessionId - Optional game session ID
   */
  static async logGameAction(userId: string, gameType: string, eventType: string, eventDetails: any = {}, sessionId: number | null = null): Promise<void> {
    try {
      await GameLog.create({
        userId: parseInt(userId),
        gameType,
        eventType,
        eventDetails,
        sessionId,
        timestamp: new Date()
      });
    } catch (error) {
      winstonLogger.error('Failed to log game action', { error: String(error), gameType, eventType, userId });
      // Don't throw error to avoid breaking game flow
    }
  }

  /**
   * Log user authentication events
   * @param {string} userId - User ID
   * @param {string} eventType - Authentication event type (login, logout, failed_login)
   * @param {Object} metadata - Additional metadata (IP, user agent, etc.)
   */
  static async logAuthAction(userId: string, eventType: string, metadata: any = {}): Promise<void> {
    try {
      await GameLog.create({
        userId: parseInt(userId),
        gameType: 'system',
        eventType: `auth_${eventType}`,
        eventDetails: metadata,
        timestamp: new Date()
      });
    } catch (error) {
      winstonLogger.error('Failed to log auth action', { error: String(error), eventType, userId });
    }
  }

  /**
   * Log admin actions
   * @param {string} adminId - Admin user ID
   * @param {string} eventType - Admin event type
   * @param {Object} targetData - Data about what was affected
   */
  static async logAdminAction(adminId: string, eventType: string, targetData: any = {}): Promise<void> {
    try {
      await GameLog.create({
        userId: parseInt(adminId),
        gameType: 'admin',
        eventType,
        eventDetails: targetData,
        timestamp: new Date()
      });
    } catch (error) {
      winstonLogger.error('Failed to log admin action', { error: String(error), eventType, adminId });
    }
  }

  /**
   * Log system events
   * @param {string} event - System event name
   * @param {Object} data - Event data
   * @param {string} level - Log level (info, warning, error)
   */
  static async logSystemEvent(event: string, data: any = {}, level: string = 'info'): Promise<void> {
    // Also write to Winston so system events appear in log files / console
    const winstonLevel = level === 'warning' ? 'warn' : level;
    winstonLogger.log(winstonLevel, `system_event: ${event}`, data);

    try {
      await GameLog.create({
        userId: null, // System events don't have a user
        gameType: 'system',
        eventType: `${level}_${event}`,
        eventDetails: data,
        timestamp: new Date()
      });
    } catch (error) {
      winstonLogger.error('Failed to log system event to DB', { error: String(error), event, level });
    }
  }

  /**
   * Get logs with filters
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Filtered logs
   */
  static async getLogs(filters: LogFilters = {}): Promise<ParsedLogEntry[]> {
    try {
      const {
        userId,
        gameType,
        eventType,
        startDate,
        endDate,
        limit = 100
      } = filters;

      if (startDate || endDate) {
        return await GameLog.searchByDateRange(
          startDate ? new Date(startDate) : null,
          endDate ? new Date(endDate) : null
        ) as ParsedLogEntry[];
      }

      if (gameType) {
        return await GameLog.getLogsByGameType(gameType, limit) as ParsedLogEntry[];
      }

      if (userId) {
        return await GameLog.getRecentUserLogs(parseInt(userId), limit) as ParsedLogEntry[];
      }

      return await GameLog.findWithDetails(limit) as ParsedLogEntry[];
    } catch (error) {
      winstonLogger.error('Failed to fetch logs', { error: String(error), filters });
      return [];
    }
  }

  /**
   * Get user activity logs
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of logs to return
   * @returns {Promise<Array>} User activity logs
   */
  static async getUserLogs(userId: string, limit: number = 50): Promise<ParsedLogEntry[]> {
    try {
      return await GameLog.getRecentUserLogs(parseInt(userId), limit) as ParsedLogEntry[];
    } catch (error) {
      winstonLogger.error('Failed to fetch user logs', { error: String(error), userId });
      return [];
    }
  }

  /**
   * Get game type specific logs
   * @param {string} gameType - Game type
   * @param {number} limit - Maximum number of logs to return
   * @returns {Promise<Array>} Game type logs
   */
  static async getGameTypeLogs(gameType: string, limit: number = 100): Promise<ParsedLogEntry[]> {
    try {
      return await GameLog.getLogsByGameType(gameType, limit);
    } catch (error) {
      winstonLogger.error('Failed to fetch game type logs', { error: String(error), gameType });
      return [];
    }
  }

  /**
   * Clean up old logs (older than specified days)
   * @param {number} daysToKeep - Number of days to keep logs
   * @returns {Promise<number>} Number of logs deleted
   */
  static async cleanupOldLogs(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      winstonLogger.info(`Log cleanup: removing logs older than ${cutoffDate.toISOString()}`);

      // Import required functions for the delete query
      const { lt } = await import('drizzle-orm');
      const { gameLogs } = await import('../../drizzle/schema.js');
      const { db } = await import('../../drizzle/db.js');

      const result = await db.delete(gameLogs).where(lt(gameLogs.timestamp, cutoffDate));
      const deletedCount = (result as any)[0]?.affectedRows || 0;

      winstonLogger.info(`Log cleanup complete: ${deletedCount} logs deleted`);
      return deletedCount;
    } catch (error) {
      winstonLogger.error('Failed to clean up old logs', { error: String(error), daysToKeep });
      return 0;
    }
  }

  /**
   * Convenience wrappers used by socket handlers (backwards-compat)
   */
  static async logGameEvent(gameType: string, eventType: string, eventDetails: any = {}, userId?: string | number, sessionId?: string | number): Promise<void> {
    try {
      await GameLog.create({
        userId: userId !== undefined && userId !== null ? Number(userId) : null,
        gameType,
        eventType,
        eventDetails: { ...eventDetails, sessionId },
        timestamp: new Date()
      });
    } catch (error) {
      winstonLogger.error('Failed to log game event', { error: String(error), gameType, eventType });
    }
  }

  static async logBetPlaced(gameType: string, sessionId: string | number | null, userId: string | number, amount: number, metadata: any = {}): Promise<void> {
    await this.logGameEvent(gameType, 'bet_placed', { amount, ...metadata }, userId, sessionId ?? undefined);
  }

  static async logBetResult(gameType: string, sessionId: string | number | null, userId: string | number, betAmount: number, winAmount: number, isWin: boolean, metadata: any = {}): Promise<void> {
    await this.logGameEvent(gameType, 'game_result', { betAmount, winAmount, isWin, ...metadata }, userId, sessionId ?? undefined);
  }

  static async logGameStart(gameType: string, sessionId: string | number | null, metadata: any = {}): Promise<void> {
    await this.logGameEvent(gameType, 'game_start', metadata, undefined, sessionId ?? undefined);
  }

  static async logGameEnd(gameType: string, sessionId: string | number | null, metadata: any = {}): Promise<void> {
    await this.logGameEvent(gameType, 'game_end', metadata, undefined, sessionId ?? undefined);
  }
}

export default LoggingService;
