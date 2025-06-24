import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db.js';
import { balances, users, transactions } from '../schema.js';

class BalanceModel {
  // Create a new balance record
  static async create(balanceData) {
    try {
      const result = await db.insert(balances).values({
        ...balanceData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Get the created balance record
      const balanceId = result.insertId;
      const [balance] = await db.select().from(balances).where(eq(balances.id, balanceId));
      return balance;
    } catch (error) {
      throw new Error(`Error creating balance record: ${error.message}`);
    }
  }

  // Find balance by ID
  static async findById(id) {
    try {
      const [balance] = await db.select().from(balances).where(eq(balances.id, id));
      return balance || null;
    } catch (error) {
      throw new Error(`Error finding balance by ID: ${error.message}`);
    }
  }

  // Get current balance for a user
  static async getCurrentBalance(userId) {
    try {
      const [latestBalance] = await db
        .select()
        .from(balances)
        .where(eq(balances.userId, userId))
        .orderBy(desc(balances.createdAt))
        .limit(1);

      return latestBalance ? parseFloat(latestBalance.amount) : 0;
    } catch (error) {
      throw new Error(`Error getting current balance: ${error.message}`);
    }
  }

  // Get balance history for a user
  static async getBalanceHistory(userId, limit = 50) {
    try {
      const balanceHistory = await db
        .select({
          id: balances.id,
          userId: balances.userId,
          amount: balances.amount,
          prevAmount: balances.previousBalance,
          changeAmount: balances.changeAmount,
          changeType: balances.type,
          reason: balances.note,
          description: balances.gameType,
          createdAt: balances.createdAt,
          adminUsername: users.username,
          transactionId: balances.transactionId,
        })
        .from(balances)
        .leftJoin(users, eq(balances.adminId, users.id))
        .leftJoin(transactions, eq(balances.transactionId, transactions.id))
        .where(eq(balances.userId, userId))
        .orderBy(desc(balances.createdAt))
        .limit(limit);

      return balanceHistory;
    } catch (error) {
      throw new Error(`Error getting balance history: ${error.message}`);
    }
  }

  // Find balances by user ID
  static async findByUserId(userId, limit = 50, offset = 0) {
    try {
      const userBalances = await db
        .select()
        .from(balances)
        .where(eq(balances.userId, userId))
        .orderBy(desc(balances.createdAt))
        .limit(limit)
        .offset(offset);

      return userBalances;
    } catch (error) {
      throw new Error(`Error finding balances by user ID: ${error.message}`);
    }
  }

  // Check if balance change was positive
  static isPositiveChange(balance) {
    return parseFloat(balance.changeAmount) > 0;
  }

  // Update balance record
  static async update(id, updateData) {
    try {
      const [updatedBalance] = await db
        .update(balances)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(balances.id, id))
        .returning();

      return updatedBalance;
    } catch (error) {
      throw new Error(`Error updating balance: ${error.message}`);
    }
  }

  // Delete balance record
  static async delete(id) {
    try {
      const [deletedBalance] = await db
        .delete(balances)
        .where(eq(balances.id, id))
        .returning();

      return deletedBalance;
    } catch (error) {
      throw new Error(`Error deleting balance: ${error.message}`);
    }
  }

  // Find balances with full details (including related data)
  static async findWithDetails(userId = null, limit = 50, offset = 0) {
    try {
      let query = db
        .select({
          id: balances.id,
          userId: balances.userId,
          amount: balances.amount,
          previousBalance: balances.previousBalance,
          changeAmount: balances.changeAmount,
          type: balances.type,
          gameType: balances.gameType,
          note: balances.note,
          createdAt: balances.createdAt,
          updatedAt: balances.updatedAt,
          username: users.username,
          adminUsername: users.username,
        })
        .from(balances)
        .leftJoin(users, eq(balances.userId, users.id));

      if (userId) {
        query = query.where(eq(balances.userId, userId));
      }

      const results = await query
        .orderBy(desc(balances.createdAt))
        .limit(limit)
        .offset(offset);

      return results;
    } catch (error) {
      throw new Error(`Error finding balances with details: ${error.message}`);
    }
  }

  // Find balances by type
  static async findByType(type, userId = null, limit = 50) {
    try {
      let query = db
        .select()
        .from(balances)
        .where(eq(balances.type, type));

      if (userId) {
        query = query.where(eq(balances.userId, userId));
      }

      const results = await query
        .orderBy(desc(balances.createdAt))
        .limit(limit);

      return results;
    } catch (error) {
      throw new Error(`Error finding balances by type: ${error.message}`);
    }
  }

  // Find balances by game type
  static async findByGameType(gameType, userId = null, limit = 50) {
    try {
      let query = db
        .select()
        .from(balances)
        .where(eq(balances.gameType, gameType));

      if (userId) {
        query = query.where(eq(balances.userId, userId));
      }

      const results = await query
        .orderBy(desc(balances.createdAt))
        .limit(limit);

      return results;
    } catch (error) {
      throw new Error(`Error finding balances by game type: ${error.message}`);
    }
  }

  // Get balance statistics for a user
  static async getBalanceStats(userId) {
    try {
      const allBalances = await db
        .select({
          changeAmount: balances.changeAmount,
          type: balances.type,
        })
        .from(balances)
        .where(eq(balances.userId, userId));

      let totalWins = 0;
      let totalLosses = 0;
      let totalDeposits = 0;
      let totalWithdrawals = 0;

      allBalances.forEach(balance => {
        const amount = parseFloat(balance.changeAmount);
        switch (balance.type) {
          case 'win':
            totalWins += amount;
            break;
          case 'loss':
            totalLosses += Math.abs(amount);
            break;
          case 'deposit':
            totalDeposits += amount;
            break;
          case 'withdrawal':
            totalWithdrawals += Math.abs(amount);
            break;
        }
      });

      return {
        totalWins,
        totalLosses,
        totalDeposits,
        totalWithdrawals,
        netProfit: totalWins - totalLosses,
      };
    } catch (error) {
      throw new Error(`Error getting balance stats: ${error.message}`);
    }
  }

  static async getLatestBalance(userId) {
    const result = await db
      .select()
      .from(balances)
      .where(eq(balances.userId, userId))
      .orderBy(desc(balances.createdAt))
      .limit(1);
    
    return result[0] || null;
  }

  static async findOne(conditions) {
    const whereConditions = [];
    
    Object.entries(conditions).forEach(([key, value]) => {
      whereConditions.push(eq(balances[key], value));
    });

    const result = await db
      .select()
      .from(balances)
      .where(and(...whereConditions))
      .limit(1);
    
    return result[0] || null;
  }

  static async find(conditions = {}) {
    const whereConditions = [];
    
    Object.entries(conditions).forEach(([key, value]) => {
      whereConditions.push(eq(balances[key], value));
    });

    if (whereConditions.length === 0) {
      return await db.select().from(balances);
    }

    return await db
      .select()
      .from(balances)
      .where(and(...whereConditions));
  }
}

export default BalanceModel; 