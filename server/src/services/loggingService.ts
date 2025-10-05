/**
 * Game Logging Service
 * 
 * A centralized logging service for all casino games
 * Records game events, outcomes, and player interactions
 * Provides consistent structured logs across all games
 */

// Import Drizzle models
import GameLog from '../../drizzle/models/GameLog.js';

// Type definitions
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

/**
 * Enhanced logging service for game activities and system events
 */
class LoggingService {
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
      console.error('Error logging game action:', error);
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
      console.error('Error logging auth action:', error);
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
      console.error('Error logging admin action:', error);
    }
  }

  /**
   * Log system events
   * @param {string} event - System event name
   * @param {Object} data - Event data
   * @param {string} level - Log level (info, warning, error)
   */
  static async logSystemEvent(event: string, data: any = {}, level: string = 'info'): Promise<void> {
    try {
      await GameLog.create({
        userId: null, // System events don't have a user
        gameType: 'system',
        eventType: `${level}_${event}`,
        eventDetails: data,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error logging system event:', error);
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
      console.error('Error fetching logs:', error);
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
      console.error('Error fetching user logs:', error);
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
      console.error('Error fetching game type logs:', error);
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

      console.log(`Would clean up logs older than ${cutoffDate.toISOString()}`);
      
      return 0;
    } catch (error) {
      console.error('Error cleaning up old logs:', error);
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
      console.error('Error logging game event:', error);
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