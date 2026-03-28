import { eq, desc, gte, lte, and, like } from 'drizzle-orm';
import db from '../db.js';
import { gameLogs, users, gameSessions } from '../schema.js';

class GameLogModel {
  // Create a new game log
  static async create(logData: any) {
    try {
      const result = await db.insert(gameLogs).values({
        ...logData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const [log] = await db.select().from(gameLogs).where(eq(gameLogs.id, (result as any).insertId));
      return log;
    } catch (error) {
      throw new Error(`Error creating game log: ${(error as Error).message}`);
    }
  }

  // Find log by ID
  static async findById(id: any) {
    try {
      const [log] = await db.select().from(gameLogs).where(eq(gameLogs.id, id));
      return log || null;
    } catch (error) {
      throw new Error(`Error finding game log by ID: ${(error as Error).message}`);
    }
  }

  // Get recent logs for a user
  static async getRecentUserLogs(userId: any, limit = 100) {
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
      throw new Error(`Error getting recent user logs: ${(error as Error).message}`);
    }
  }

  // Get logs by game type
  static async getLogsByGameType(gameType: any, limit = 100) {
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
      throw new Error(`Error getting logs by game type: ${(error as Error).message}`);
    }
  }

  // Search logs by date range
  static async searchByDateRange(startDate: any, endDate: any, gameType: any = null, eventType: any = null, limit = 1000) {
    try {
      const conditions: any[] = [];

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

      let query: any = db
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
      throw new Error(`Error searching logs by date range: ${(error as Error).message}`);
    }
  }

  // Find logs by session ID
  static async findBySessionId(sessionId: any, limit = 100) {
    try {
      const logs = await db
        .select()
        .from(gameLogs)
        .where(eq(gameLogs.sessionId, sessionId))
        .orderBy(desc(gameLogs.timestamp))
        .limit(limit);

      return logs;
    } catch (error) {
      throw new Error(`Error finding logs by session ID: ${(error as Error).message}`);
    }
  }

  // Find logs by event type
  static async findByEventType(eventType: any, limit = 100, offset = 0) {
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
      throw new Error(`Error finding logs by event type: ${(error as Error).message}`);
    }
  }

  // Update log
  static async update(id: any, updateData: any) {
    try {
      await db
        .update(gameLogs)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(gameLogs.id, id));

      const [updatedLog] = await db.select().from(gameLogs).where(eq(gameLogs.id, id));
      return updatedLog;
    } catch (error) {
      throw new Error(`Error updating game log: ${(error as Error).message}`);
    }
  }

  // Delete log
  static async delete(id: any) {
    try {
      const [deletedLog] = await db.select().from(gameLogs).where(eq(gameLogs.id, id));
      await db.delete(gameLogs).where(eq(gameLogs.id, id));

      return deletedLog;
    } catch (error) {
      throw new Error(`Error deleting game log: ${(error as Error).message}`);
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
      throw new Error(`Error finding logs with details: ${(error as Error).message}`);
    }
  }

  // Get log count by criteria
  static async getLogCount(gameType: any = null, eventType: any = null, userId: any = null) {
    try {
      const conditions: any[] = [];

      if (gameType) {
        conditions.push(eq(gameLogs.gameType, gameType));
      }
      if (eventType) {
        conditions.push(eq(gameLogs.eventType, eventType));
      }
      if (userId) {
        conditions.push(eq(gameLogs.userId, userId));
      }

      let query: any = db.select({ count: gameLogs.id }).from(gameLogs);

      if (conditions.length > 0) {
        query = query.where(conditions.length > 1 ? and(...conditions) : conditions[0]);
      }

      const result = await query;
      return result.length;
    } catch (error) {
      throw new Error(`Error getting log count: ${(error as Error).message}`);
    }
  }

  // Get event statistics
  static async getEventStats(gameType: any = null) {
    try {
      let query: any = db
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
      const eventStats: any = logs.reduce((acc: any, log: any) => {
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
      throw new Error(`Error getting event stats: ${(error as Error).message}`);
    }
  }

  static async getUserLogs(userId: any) {
    return await db
      .select({
        id: gameLogs.id,
        userId: gameLogs.userId,
        gameType: gameLogs.gameType,
        eventType: gameLogs.eventType,
        eventDetails: gameLogs.eventDetails,
        timestamp: gameLogs.timestamp,
        sessionId: gameLogs.sessionId
      })
      .from(gameLogs)
      .leftJoin(gameSessions, eq(gameLogs.sessionId, gameSessions.id))
      .where(eq(gameLogs.userId, userId))
      .orderBy(desc(gameLogs.timestamp));
  }

  static async getGameTypeLogs(gameType: any) {
    return await db
      .select({
        id: gameLogs.id,
        userId: gameLogs.userId,
        gameType: gameLogs.gameType,
        eventType: gameLogs.eventType,
        eventDetails: gameLogs.eventDetails,
        timestamp: gameLogs.timestamp,
        username: users.username
      })
      .from(gameLogs)
      .leftJoin(users, eq(gameLogs.userId, users.id))
      .where(eq(gameLogs.gameType, gameType))
      .orderBy(desc(gameLogs.timestamp));
  }

  static async getLogsWithFilters(filters: any = {}) {
    let query: any = db
      .select({
        id: gameLogs.id,
        userId: gameLogs.userId,
        gameType: gameLogs.gameType,
        eventType: gameLogs.eventType,
        eventDetails: gameLogs.eventDetails,
        timestamp: gameLogs.timestamp,
        username: users.username,
        sessionId: gameLogs.sessionId
      })
      .from(gameLogs)
      .leftJoin(users, eq(gameLogs.userId, users.id))
      .leftJoin(gameSessions, eq(gameLogs.sessionId, gameSessions.id));

    const whereConditions: any[] = [];

    if (filters.userId) {
      whereConditions.push(eq(gameLogs.userId, filters.userId));
    }

    if (filters.gameType) {
      whereConditions.push(eq(gameLogs.gameType, filters.gameType));
    }

    if (filters.eventType) {
      if (typeof filters.eventType === 'object' && filters.eventType.$regex) {
        whereConditions.push(like(gameLogs.eventType, `%${filters.eventType.$regex}%`));
      } else {
        whereConditions.push(eq(gameLogs.eventType, filters.eventType));
      }
    }

    if (filters.timestamp) {
      if (filters.timestamp.$gte && filters.timestamp.$lte) {
        whereConditions.push(and(
          gte(gameLogs.timestamp, filters.timestamp.$gte),
          lte(gameLogs.timestamp, filters.timestamp.$lte)
        ) as any);
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

  static async findOne(conditions: any) {
    const whereConditions: any[] = [];

    Object.entries(conditions).forEach(([key, value]: [string, any]) => {
      whereConditions.push(eq((gameLogs as any)[key], value));
    });

    const result = await db
      .select()
      .from(gameLogs)
      .where(and(...whereConditions))
      .limit(1);

    return result[0] || null;
  }

  static async find(conditions: any = {}) {
    const whereConditions: any[] = [];

    Object.entries(conditions).forEach(([key, value]: [string, any]) => {
      if (typeof value === 'object' && value.$gte && value.$lte) {
        whereConditions.push(and(
          gte((gameLogs as any)[key], value.$gte),
          lte((gameLogs as any)[key], value.$lte)
        ));
      } else {
        whereConditions.push(eq((gameLogs as any)[key], value));
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
    const self = this as any;
    if (self.id) {
      await db
        .update(gameLogs)
        .set(self)
        .where(eq(gameLogs.id, self.id));

      const [updated] = await db.select().from(gameLogs).where(eq(gameLogs.id, self.id));
      Object.assign(this, updated);
      return this;
    } else {
      const result = await db.insert(gameLogs).values(self);
      const [inserted] = await db.select().from(gameLogs).where(eq(gameLogs.id, (result as any).insertId));
      Object.assign(this, inserted);
      return this;
    }
  }
}

export default GameLogModel;
