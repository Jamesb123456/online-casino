// @ts-nocheck
import { eq, desc, gte, lte, and, like } from 'drizzle-orm';
import db from '../db.js';
import { gameLogs, users, gameSessions } from '../schema.js';

class GameLogModel {
  // Create a new game log
  static async create(logData) {
    try {
      const [log] = await db.insert(gameLogs).values({
        ...logData,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      return log;
    } catch (error) {
      throw new Error(`Error creating game log: ${error.message}`);
    }
  }

  // Find log by ID
  static async findById(id) {
    try {
      const [log] = await db.select().from(gameLogs).where(eq(gameLogs.id, id));
      return log || null;
    } catch (error) {
      throw new Error(`Error finding game log by ID: ${error.message}`);
    }
  }

  // Get recent logs for a user
  static async getRecentUserLogs(userId, limit = 100) {
    try {
      const userLogs = await db
        .select({
          id: gameLogs.id,
          sessionId: gameLogs.sessionId,
          gameType: gameLogs.gameType,
          eventType: gameLogs.eventType,
          eventDetails: gameLogs.eventDetails,
          amount: gameLogs.amount,
          timestamp: gameLogs.timestamp,
          metadata: gameLogs.metadata,
          createdAt: gameLogs.createdAt,
          // Include session details if available
          sessionStartTime: gameSessions.startTime,
          sessionGameType: gameSessions.gameType,
        })
        .from(gameLogs)
        .leftJoin(gameSessions, eq(gameLogs.sessionId, gameSessions.id))
        .where(eq(gameLogs.userId, userId))
        .orderBy(desc(gameLogs.timestamp))
        .limit(limit);

      return userLogs;
    } catch (error) {
      throw new Error(`Error getting recent user logs: ${error.message}`);
    }
  }

  // Get logs by game type
  static async getLogsByGameType(gameType, limit = 100) {
    try {
      const logs = await db
        .select({
          id: gameLogs.id,
          sessionId: gameLogs.sessionId,
          userId: gameLogs.userId,
          gameType: gameLogs.gameType,
          eventType: gameLogs.eventType,
          eventDetails: gameLogs.eventDetails,
          amount: gameLogs.amount,
          timestamp: gameLogs.timestamp,
          metadata: gameLogs.metadata,
          createdAt: gameLogs.createdAt,
          username: users.username,
        })
        .from(gameLogs)
        .leftJoin(users, eq(gameLogs.userId, users.id))
        .where(eq(gameLogs.gameType, gameType))
        .orderBy(desc(gameLogs.timestamp))
        .limit(limit);

      return logs;
    } catch (error) {
      throw new Error(`Error getting logs by game type: ${error.message}`);
    }
  }

  // Search logs by date range
  static async searchByDateRange(startDate, endDate, gameType = null, eventType = null, limit = 1000) {
    try {
      const conditions = [];
      
      if (startDate) {
        conditions.push(gte(gameLogs.timestamp, new Date(startDate)));
      }
      if (endDate) {
        conditions.push(lte(gameLogs.timestamp, new Date(endDate)));
      }
      if (gameType) {
        conditions.push(eq(gameLogs.gameType, gameType));
      }
      if (eventType) {
        conditions.push(eq(gameLogs.eventType, eventType));
      }

      let query = db
        .select({
          id: gameLogs.id,
          sessionId: gameLogs.sessionId,
          userId: gameLogs.userId,
          gameType: gameLogs.gameType,
          eventType: gameLogs.eventType,
          eventDetails: gameLogs.eventDetails,
          amount: gameLogs.amount,
          timestamp: gameLogs.timestamp,
          metadata: gameLogs.metadata,
          createdAt: gameLogs.createdAt,
          username: users.username,
          sessionStartTime: gameSessions.startTime,
        })
        .from(gameLogs)
        .leftJoin(users, eq(gameLogs.userId, users.id))
        .leftJoin(gameSessions, eq(gameLogs.sessionId, gameSessions.id));

      if (conditions.length > 0) {
        query = query.where(conditions.length > 1 ? and(...conditions) : conditions[0]);
      }

      const logs = await query
        .orderBy(desc(gameLogs.timestamp))
        .limit(limit);

      return logs;
    } catch (error) {
      throw new Error(`Error searching logs by date range: ${error.message}`);
    }
  }

  // Find logs by session ID
  static async findBySessionId(sessionId, limit = 100) {
    try {
      const logs = await db
        .select()
        .from(gameLogs)
        .where(eq(gameLogs.sessionId, sessionId))
        .orderBy(desc(gameLogs.timestamp))
        .limit(limit);

      return logs;
    } catch (error) {
      throw new Error(`Error finding logs by session ID: ${error.message}`);
    }
  }

  // Find logs by event type
  static async findByEventType(eventType, limit = 100, offset = 0) {
    try {
      const logs = await db
        .select()
        .from(gameLogs)
        .where(eq(gameLogs.eventType, eventType))
        .orderBy(desc(gameLogs.timestamp))
        .limit(limit)
        .offset(offset);

      return logs;
    } catch (error) {
      throw new Error(`Error finding logs by event type: ${error.message}`);
    }
  }

  // Update log
  static async update(id, updateData) {
    try {
      const [updatedLog] = await db
        .update(gameLogs)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(gameLogs.id, id))
        .returning();

      return updatedLog;
    } catch (error) {
      throw new Error(`Error updating game log: ${error.message}`);
    }
  }

  // Delete log
  static async delete(id) {
    try {
      const [deletedLog] = await db
        .delete(gameLogs)
        .where(eq(gameLogs.id, id))
        .returning();

      return deletedLog;
    } catch (error) {
      throw new Error(`Error deleting game log: ${error.message}`);
    }
  }

  // Get logs with full details (including user and session info)
  static async findWithDetails(limit = 100, offset = 0) {
    try {
      const logs = await db
        .select({
          id: gameLogs.id,
          sessionId: gameLogs.sessionId,
          userId: gameLogs.userId,
          gameType: gameLogs.gameType,
          eventType: gameLogs.eventType,
          eventDetails: gameLogs.eventDetails,
          amount: gameLogs.amount,
          timestamp: gameLogs.timestamp,
          metadata: gameLogs.metadata,
          createdAt: gameLogs.createdAt,
          updatedAt: gameLogs.updatedAt,
          username: users.username,
          sessionStartTime: gameSessions.startTime,
          sessionIsCompleted: gameSessions.isCompleted,
        })
        .from(gameLogs)
        .leftJoin(users, eq(gameLogs.userId, users.id))
        .leftJoin(gameSessions, eq(gameLogs.sessionId, gameSessions.id))
        .orderBy(desc(gameLogs.timestamp))
        .limit(limit)
        .offset(offset);

      return logs;
    } catch (error) {
      throw new Error(`Error finding logs with details: ${error.message}`);
    }
  }

  // Get log count by criteria
  static async getLogCount(gameType = null, eventType = null, userId = null) {
    try {
      const conditions = [];
      
      if (gameType) {
        conditions.push(eq(gameLogs.gameType, gameType));
      }
      if (eventType) {
        conditions.push(eq(gameLogs.eventType, eventType));
      }
      if (userId) {
        conditions.push(eq(gameLogs.userId, userId));
      }

      let query = db.select({ count: gameLogs.id }).from(gameLogs);

      if (conditions.length > 0) {
        query = query.where(conditions.length > 1 ? and(...conditions) : conditions[0]);
      }

      const result = await query;
      return result.length;
    } catch (error) {
      throw new Error(`Error getting log count: ${error.message}`);
    }
  }

  // Get event statistics
  static async getEventStats(gameType = null) {
    try {
      let query = db
        .select({
          eventType: gameLogs.eventType,
          gameType: gameLogs.gameType,
          amount: gameLogs.amount,
        })
        .from(gameLogs);

      if (gameType) {
        query = query.where(eq(gameLogs.gameType, gameType));
      }

      const logs = await query;

      // Group by event type manually
      const eventStats = logs.reduce((acc, log) => {
        const key = log.eventType;
        if (!acc[key]) {
          acc[key] = { eventType: key, count: 0, totalAmount: 0 };
        }
        acc[key].count += 1;
        if (log.amount) {
          acc[key].totalAmount += parseFloat(log.amount);
        }
        return acc;
      }, {});

      return Object.values(eventStats);
    } catch (error) {
      throw new Error(`Error getting event stats: ${error.message}`);
    }
  }

  static async getUserLogs(userId) {
    return await db
      .select({
        id: gameLogs.id,
        userId: gameLogs.userId,
        gameType: gameLogs.gameType,
        action: gameLogs.action,
        gameData: gameLogs.gameData,
        timestamp: gameLogs.timestamp,
        sessionId: gameLogs.sessionId
      })
      .from(gameLogs)
      .leftJoin(gameSessions, eq(gameLogs.sessionId, gameSessions.id))
      .where(eq(gameLogs.userId, userId))
      .orderBy(desc(gameLogs.timestamp));
  }

  static async getGameTypeLogs(gameType) {
    return await db
      .select({
        id: gameLogs.id,
        userId: gameLogs.userId,
        gameType: gameLogs.gameType,
        action: gameLogs.action,
        gameData: gameLogs.gameData,
        timestamp: gameLogs.timestamp,
        username: users.username
      })
      .from(gameLogs)
      .leftJoin(users, eq(gameLogs.userId, users.id))
      .where(eq(gameLogs.gameType, gameType))
      .orderBy(desc(gameLogs.timestamp));
  }

  static async getLogsWithFilters(filters = {}) {
    let query = db
      .select({
        id: gameLogs.id,
        userId: gameLogs.userId,
        gameType: gameLogs.gameType,
        action: gameLogs.action,
        gameData: gameLogs.gameData,
        timestamp: gameLogs.timestamp,
        username: users.username,
        sessionId: gameLogs.sessionId
      })
      .from(gameLogs)
      .leftJoin(users, eq(gameLogs.userId, users.id))
      .leftJoin(gameSessions, eq(gameLogs.sessionId, gameSessions.id));

    const whereConditions = [];

    // Handle different filter types
    if (filters.userId) {
      whereConditions.push(eq(gameLogs.userId, filters.userId));
    }

    if (filters.gameType) {
      whereConditions.push(eq(gameLogs.gameType, filters.gameType));
    }

    if (filters.action) {
      if (typeof filters.action === 'object' && filters.action.$regex) {
        whereConditions.push(like(gameLogs.action, `%${filters.action.$regex}%`));
      } else {
        whereConditions.push(eq(gameLogs.action, filters.action));
      }
    }

    if (filters.timestamp) {
      if (filters.timestamp.$gte && filters.timestamp.$lte) {
        whereConditions.push(and(
          gte(gameLogs.timestamp, filters.timestamp.$gte),
          lte(gameLogs.timestamp, filters.timestamp.$lte)
        ));
      } else if (filters.timestamp.$gte) {
        whereConditions.push(gte(gameLogs.timestamp, filters.timestamp.$gte));
      } else if (filters.timestamp.$lte) {
        whereConditions.push(lte(gameLogs.timestamp, filters.timestamp.$lte));
      }
    }

    if (whereConditions.length > 0) {
      query = query.where(and(...whereConditions));
    }

    return await query.orderBy(desc(gameLogs.timestamp));
  }

  static async findOne(conditions) {
    const whereConditions = [];
    
    Object.entries(conditions).forEach(([key, value]) => {
      whereConditions.push(eq(gameLogs[key], value));
    });

    const result = await db
      .select()
      .from(gameLogs)
      .where(and(...whereConditions))
      .limit(1);
    
    return result[0] || null;
  }

  static async find(conditions = {}) {
    const whereConditions = [];
    
    Object.entries(conditions).forEach(([key, value]) => {
      if (typeof value === 'object' && value.$gte && value.$lte) {
        whereConditions.push(and(
          gte(gameLogs[key], value.$gte),
          lte(gameLogs[key], value.$lte)
        ));
      } else {
        whereConditions.push(eq(gameLogs[key], value));
      }
    });

    if (whereConditions.length === 0) {
      return await db.select().from(gameLogs).orderBy(desc(gameLogs.timestamp));
    }

    return await db
      .select()
      .from(gameLogs)
      .where(and(...whereConditions))
      .orderBy(desc(gameLogs.timestamp));
  }

  // Instance method for save functionality
  async save() {
    if (this.id) {
      const result = await db
        .update(gameLogs)
        .set(this)
        .where(eq(gameLogs.id, this.id))
        .returning();
      
      Object.assign(this, result[0]);
      return this;
    } else {
      const result = await db.insert(gameLogs).values(this).returning();
      Object.assign(this, result[0]);
      return this;
    }
  }
}

export default GameLogModel; 