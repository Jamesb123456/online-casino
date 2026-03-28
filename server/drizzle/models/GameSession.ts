import { eq, desc, gte, lte, and } from 'drizzle-orm';
import db from '../db.js';
import { gameSessions, users } from '../schema.js';

class GameSessionModel {
  // Create a new game session
  static async create(sessionData) {
    try {
      // Set totalBet to initialBet if not provided
      if (!sessionData.totalBet && sessionData.initialBet) {
        sessionData.totalBet = sessionData.initialBet;
      }

      const result = await db.insert(gameSessions).values({
        ...sessionData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const [session] = await db.select().from(gameSessions).where(eq(gameSessions.id, (result as any).insertId));
      return session;
    } catch (error) {
      throw new Error(`Error creating game session: ${error.message}`);
    }
  }

  // Find session by ID
  static async findById(id) {
    try {
      const [session] = await db.select().from(gameSessions).where(eq(gameSessions.id, id));
      return session || null;
    } catch (error) {
      throw new Error(`Error finding game session by ID: ${error.message}`);
    }
  }

  // Find sessions by user ID
  static async findByUserId(userId, limit = 50, offset = 0) {
    try {
      const sessions = await db
        .select()
        .from(gameSessions)
        .where(eq(gameSessions.userId, userId))
        .orderBy(desc(gameSessions.startTime))
        .limit(limit)
        .offset(offset);

      return sessions;
    } catch (error) {
      throw new Error(`Error finding sessions by user ID: ${error.message}`);
    }
  }

  // Update session
  static async update(id, updateData) {
    try {
      await db
        .update(gameSessions)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(gameSessions.id, id));

      const [updatedSession] = await db.select().from(gameSessions).where(eq(gameSessions.id, id));
      return updatedSession;
    } catch (error) {
      throw new Error(`Error updating game session: ${error.message}`);
    }
  }

  // Calculate profit/loss for a session
  static calculateProfit(session) {
    return parseFloat(session.outcome || 0) - parseFloat(session.totalBet || 0);
  }

  // Get game stats for a specific game type
  static async getGameStats(gameType, startDate = null, endDate = null) {
    try {
      const conditions = [eq(gameSessions.gameType, gameType)];
      
      if (startDate) {
        conditions.push(gte(gameSessions.startTime, new Date(startDate)));
      }
      if (endDate) {
        conditions.push(lte(gameSessions.startTime, new Date(endDate)));
      }

      // Get all sessions for the game type within date range
      const sessions = await db
        .select({
          totalBet: gameSessions.totalBet,
          outcome: gameSessions.outcome,
        })
        .from(gameSessions)
        .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

      // Calculate stats manually since Drizzle doesn't have direct aggregation
      let totalSessions = sessions.length;
      let totalBets = 0;
      let totalOutcome = 0;

      sessions.forEach(session => {
        totalBets += parseFloat(session.totalBet as any || '0');
        totalOutcome += parseFloat(session.outcome as any || '0');
      });

      const avgBet = totalSessions > 0 ? totalBets / totalSessions : 0;
      const houseEdge = totalBets > 0 ? 1 - (totalOutcome / totalBets) : 0;
      const profit = totalBets - totalOutcome;

      return {
        gameType,
        totalSessions,
        totalBets,
        totalOutcome,
        houseEdge,
        avgBet,
        profit,
      };
    } catch (error) {
      throw new Error(`Error getting game stats: ${error.message}`);
    }
  }

  // Get active sessions
  static async getActiveSessions(gameType = null) {
    try {
      let query: any = db
        .select()
        .from(gameSessions)
        .where(eq(gameSessions.isCompleted, false));

      if (gameType) {
        query = query.where(eq(gameSessions.gameType, gameType));
      }

      const activeSessions = await query.orderBy(desc(gameSessions.startTime));
      return activeSessions;
    } catch (error) {
      throw new Error(`Error getting active sessions: ${error.message}`);
    }
  }

  // Complete a session
  static async completeSession(id, outcome, finalMultiplier = null, resultDetails = null) {
    try {
      const updateData: any = {
        isCompleted: true,
        outcome: outcome.toString(),
        endTime: new Date(),
        updatedAt: new Date(),
      };

      if (finalMultiplier !== null) {
        updateData.finalMultiplier = finalMultiplier.toString();
      }

      if (resultDetails !== null) {
        updateData.resultDetails = resultDetails;
      }

      await db
        .update(gameSessions)
        .set(updateData)
        .where(eq(gameSessions.id, id));

      const [completedSession] = await db.select().from(gameSessions).where(eq(gameSessions.id, id));
      return completedSession;
    } catch (error) {
      throw new Error(`Error completing session: ${error.message}`);
    }
  }

  // Find sessions by game type
  static async findByGameType(gameType, limit = 50, offset = 0) {
    try {
      const sessions = await db
        .select()
        .from(gameSessions)
        .where(eq(gameSessions.gameType, gameType))
        .orderBy(desc(gameSessions.startTime))
        .limit(limit)
        .offset(offset);

      return sessions;
    } catch (error) {
      throw new Error(`Error finding sessions by game type: ${error.message}`);
    }
  }

  // Delete session
  static async delete(id) {
    try {
      const [deletedSession] = await db.select().from(gameSessions).where(eq(gameSessions.id, id));
      await db.delete(gameSessions).where(eq(gameSessions.id, id));

      return deletedSession;
    } catch (error) {
      throw new Error(`Error deleting game session: ${error.message}`);
    }
  }

  // Find sessions with user details
  static async findWithUserDetails(limit = 50, offset = 0) {
    try {
      const sessions = await db
        .select({
          id: gameSessions.id,
          userId: gameSessions.userId,
          gameType: gameSessions.gameType,
          startTime: gameSessions.startTime,
          endTime: gameSessions.endTime,
          initialBet: gameSessions.initialBet,
          totalBet: gameSessions.totalBet,
          outcome: gameSessions.outcome,
          finalMultiplier: gameSessions.finalMultiplier,
          isCompleted: gameSessions.isCompleted,
          resultDetails: gameSessions.resultDetails,
          createdAt: gameSessions.createdAt,
          updatedAt: gameSessions.updatedAt,
          username: users.username,
        })
        .from(gameSessions)
        .leftJoin(users, eq(gameSessions.userId, users.id))
        .orderBy(desc(gameSessions.startTime))
        .limit(limit)
        .offset(offset);

      return sessions;
    } catch (error) {
      throw new Error(`Error finding sessions with user details: ${error.message}`);
    }
  }

  // Get sessions by date range
  static async findByDateRange(startDate, endDate, gameType = null) {
    try {
      const conditions = [];
      
      if (startDate) {
        conditions.push(gte(gameSessions.startTime, new Date(startDate)));
      }
      if (endDate) {
        conditions.push(lte(gameSessions.startTime, new Date(endDate)));
      }
      if (gameType) {
        conditions.push(eq(gameSessions.gameType, gameType));
      }

      let query: any = db.select().from(gameSessions);

      if (conditions.length > 0) {
        query = query.where(conditions.length > 1 ? and(...conditions) : conditions[0]);
      }

      const sessions = await query.orderBy(desc(gameSessions.startTime));
      return sessions;
    } catch (error) {
      throw new Error(`Error finding sessions by date range: ${error.message}`);
    }
  }
}

export default GameSessionModel; 