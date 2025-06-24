/**
 * Game Logging Service
 * 
 * A centralized logging service for all casino games
 * Records game events, outcomes, and player interactions
 * Provides consistent structured logs across all games
 */

// Import Drizzle models
import GameLog from '../../drizzle/models/GameLog.js';

/**
 * Enhanced logging service for game activities and system events
 */
class LoggingService {
  /**
   * Log a game action
   * @param {string} userId - User performing the action
   * @param {string} gameType - Type of game (crash, plinko, etc.)
   * @param {string} action - Action being performed
   * @param {Object} gameData - Game-specific data
   * @param {string} sessionId - Optional game session ID
   */
  static async logGameAction(userId, gameType, action, gameData = {}, sessionId = null) {
    try {
      await GameLog.create({
        userId,
        gameType,
        action,
        gameData: JSON.stringify(gameData),
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
   * @param {string} action - Authentication action (login, logout, failed_login)
   * @param {Object} metadata - Additional metadata (IP, user agent, etc.)
   */
  static async logAuthAction(userId, action, metadata = {}) {
    try {
      await GameLog.create({
        userId,
        gameType: 'system',
        action: `auth_${action}`,
        gameData: JSON.stringify(metadata),
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error logging auth action:', error);
    }
  }

  /**
   * Log admin actions
   * @param {string} adminId - Admin user ID
   * @param {string} action - Admin action
   * @param {Object} targetData - Data about what was affected
   */
  static async logAdminAction(adminId, action, targetData = {}) {
    try {
      await GameLog.create({
        userId: adminId,
        gameType: 'admin',
        action,
        gameData: JSON.stringify(targetData),
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
  static async logSystemEvent(event, data = {}, level = 'info') {
    try {
      await GameLog.create({
        userId: null, // System events don't have a user
        gameType: 'system',
        action: `${level}_${event}`,
        gameData: JSON.stringify(data),
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
  static async getLogs(filters = {}) {
    try {
      const {
        userId,
        gameType,
        action,
        startDate,
        endDate,
        limit = 100
      } = filters;

      const queryFilters = {};

      if (userId) queryFilters.userId = userId;
      if (gameType) queryFilters.gameType = gameType;
      if (action) {
        if (typeof action === 'string') {
          queryFilters.action = action;
        } else {
          queryFilters.action = { $regex: action };
        }
      }

      if (startDate || endDate) {
        queryFilters.timestamp = {};
        if (startDate) queryFilters.timestamp.$gte = new Date(startDate);
        if (endDate) queryFilters.timestamp.$lte = new Date(endDate);
      }

      const logs = await GameLog.getLogsWithFilters(queryFilters);
      
      // Parse gameData back to objects
      return logs.map(log => ({
        ...log,
        gameData: log.gameData ? JSON.parse(log.gameData) : {}
      }));
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
  static async getUserLogs(userId, limit = 50) {
    try {
      const logs = await GameLog.getUserLogs(userId);
      
      // Parse gameData and limit results
      return logs.slice(0, limit).map(log => ({
        ...log,
        gameData: log.gameData ? JSON.parse(log.gameData) : {}
      }));
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
  static async getGameTypeLogs(gameType, limit = 100) {
    try {
      const logs = await GameLog.getGameTypeLogs(gameType);
      
      // Parse gameData and limit results
      return logs.slice(0, limit).map(log => ({
        ...log,
        gameData: log.gameData ? JSON.parse(log.gameData) : {}
      }));
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
  static async cleanupOldLogs(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Note: This would need to be implemented with appropriate Drizzle delete query
      // For now, we'll log the intention
      console.log(`Would clean up logs older than ${cutoffDate.toISOString()}`);
      
      return 0; // Return 0 for now
    } catch (error) {
      console.error('Error cleaning up old logs:', error);
      return 0;
    }
  }
}

export default LoggingService;