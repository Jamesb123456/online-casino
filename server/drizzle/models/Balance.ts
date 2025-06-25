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

      // For MySQL, we need to get the last inserted ID differently
      // Get the created balance record using the result's insertId or by querying the latest record
      const [balance] = await db
        .select()
        .from(balances)
        .where(eq(balances.userId, balanceData.userId))
        .orderBy(desc(balances.createdAt))
        .limit(1);
      return balance;
    } catch (error) {
      throw new Error(`Error creating balance record: ${(error as Error).message}`);
    }
  }

  // Find balance by ID
  static async findById(id) {
    try {
      const [balance] = await db.select().from(balances).where(eq(balances.id, id));
      return balance || null;
    } catch (error) {
      throw new Error(`Error finding balance by ID: ${(error as Error).message}`);
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
      throw new Error(`Error getting current balance: ${(error as Error).message}`);
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
      throw new Error(`Error getting balance history: ${(error as Error).message}`);
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
      throw new Error(`Error finding balances by user ID: ${(error as Error).message}`);
    }
  }

  // Check if balance change was positive
  static isPositiveChange(balance) {
    return parseFloat(balance.changeAmount) > 0;
  }

  // Update balance record
  static async update(id, updateData) {
    try {
      await db
        .update(balances)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(balances.id, id));

      // Get the updated record
      const [updatedBalance] = await db
        .select()
        .from(balances)
        .where(eq(balances.id, id));

      return updatedBalance;
    } catch (error) {
      throw new Error(`Error updating balance: ${(error as Error).message}`);
    }
  }

  // Delete balance record
  static async delete(id) {
    try {
      // Get the record before deleting it
      const [balanceToDelete] = await db
        .select()
        .from(balances)
        .where(eq(balances.id, id));

      await db
        .delete(balances)
        .where(eq(balances.id, id));

      return balanceToDelete;
    } catch (error) {
      throw new Error(`Error deleting balance: ${(error as Error).message}`);
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
        const results = await query
          .where(eq(balances.userId, userId))
          .orderBy(desc(balances.createdAt))
          .limit(limit)
          .offset(offset);
        return results;
      }

      const results = await query
        .orderBy(desc(balances.createdAt))
        .limit(limit)
        .offset(offset);

      return results;
    } catch (error) {
      throw new Error(`Error finding balances with details: ${(error as Error).message}`);
    }
  }

  // Find balances by type
  static async findByType(type, userId = null, limit = 50) {
    try {
      if (userId) {
        const results = await db
          .select()
          .from(balances)
          .where(and(eq(balances.type, type), eq(balances.userId, userId)))
          .orderBy(desc(balances.createdAt))
          .limit(limit);
        return results;
      }

      const results = await db
        .select()
        .from(balances)
        .where(eq(balances.type, type))
        .orderBy(desc(balances.createdAt))
        .limit(limit);

      return results;
    } catch (error) {
      throw new Error(`Error finding balances by type: ${(error as Error).message}`);
    }
  }

  // Find balances by game type
  static async findByGameType(gameType, userId = null, limit = 50) {
    try {
      if (userId) {
        const results = await db
          .select()
          .from(balances)
          .where(and(eq(balances.gameType, gameType), eq(balances.userId, userId)))
          .orderBy(desc(balances.createdAt))
          .limit(limit);
        return results;
      }

      const results = await db
        .select()
        .from(balances)
        .where(eq(balances.gameType, gameType))
        .orderBy(desc(balances.createdAt))
        .limit(limit);

      return results;
    } catch (error) {
      throw new Error(`Error finding balances by game type: ${(error as Error).message}`);
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
      throw new Error(`Error getting balance stats: ${(error as Error).message}`);
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

  // Get balance by specific user ID and type
  static async findByUserIdAndType(userId, type) {
    const result = await db
      .select()
      .from(balances)
      .where(and(eq(balances.userId, userId), eq(balances.type, type)))
      .limit(1);
    
    return result[0] || null;
  }

  // Get all balances (mainly for admin use)
  static async findAll() {
    return await db.select().from(balances);
  }
}

export default BalanceModel; 