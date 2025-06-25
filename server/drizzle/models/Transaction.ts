import { eq, desc, gte, lte, count, sum, and, or, like } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import db from '../db.js';
import { transactions, users } from '../schema.js';

interface TransactionFilter {
  userId?: number;
  type?: 'deposit' | 'withdrawal' | 'game_win' | 'game_loss' | 'admin_adjustment' | 'bonus';
  gameType?: 'crash' | 'plinko' | 'wheel' | 'roulette' | 'blackjack';
  status?: 'pending' | 'completed' | 'failed' | 'voided' | 'processing';
}

interface QueryOptions {
  populate?: string[];
  sort?: { createdAt?: -1 | 1 };
  limit?: number;
}

interface SelectFields {
  [key: string]: any;
}

class TransactionModel {
  // Create a new transaction
  static async create(transactionData: any) {
    try {
      await db.insert(transactions).values({
        ...transactionData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Get the inserted transaction by finding the most recent one for this user
      const [transaction] = await db.select().from(transactions)
        .where(eq(transactions.userId, transactionData.userId))
        .orderBy(desc(transactions.createdAt))
        .limit(1);

      return transaction;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Error creating transaction: ${err.message}`);
    }
  }

  // Find transaction by ID
  static async findById(id: number) {
    try {
      const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
      return transaction || null;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Error finding transaction by ID: ${err.message}`);
    }
  }

  // Find transaction by ID with user details
  static async findByIdWithUser(id: number) {
    try {
      const [transaction] = await db
        .select({
          id: transactions.id,
          userId: transactions.userId,
          type: transactions.type,
          gameType: transactions.gameType,
          amount: transactions.amount,
          balanceBefore: transactions.balanceBefore,
          balanceAfter: transactions.balanceAfter,
          status: transactions.status,
          createdBy: transactions.createdBy,
          reference: transactions.reference,
          description: transactions.description,
          gameSessionId: transactions.gameSessionId,
          metadata: transactions.metadata,
          notes: transactions.notes,
          voidedBy: transactions.voidedBy,
          voidedReason: transactions.voidedReason,
          voidedAt: transactions.voidedAt,
          createdAt: transactions.createdAt,
          updatedAt: transactions.updatedAt,
          createdByUsername: users.username,
        })
        .from(transactions)
        .leftJoin(users, eq(transactions.createdBy, users.id))
        .where(eq(transactions.id, id));

      return transaction || null;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Error finding transaction with user: ${err.message}`);
    }
  }

  // Get user transaction history
  static async getUserTransactionHistory(userId: number, limit = 50, offset = 0) {
    try {
      const transactionHistory = await db
        .select({
          id: transactions.id,
          type: transactions.type,
          gameType: transactions.gameType,
          amount: transactions.amount,
          balanceBefore: transactions.balanceBefore,
          balanceAfter: transactions.balanceAfter,
          status: transactions.status,
          reference: transactions.reference,
          description: transactions.description,
          gameSessionId: transactions.gameSessionId,
          metadata: transactions.metadata,
          notes: transactions.notes,
          voidedBy: transactions.voidedBy,
          voidedReason: transactions.voidedReason,
          voidedAt: transactions.voidedAt,
          createdAt: transactions.createdAt,
          updatedAt: transactions.updatedAt,
          createdByUsername: users.username,
        })
        .from(transactions)
        .leftJoin(users, eq(transactions.createdBy, users.id))
        .where(eq(transactions.userId, userId))
        .orderBy(desc(transactions.createdAt))
        .limit(limit)
        .offset(offset);

      return transactionHistory;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Error getting user transaction history: ${err.message}`);
    }
  }

  // Get transaction stats by date range
  static async getTransactionStatsByDate(startDate?: string, endDate?: string) {
    try {
      const conditions = [];
      if (startDate) conditions.push(gte(transactions.createdAt, new Date(startDate)));
      if (endDate) conditions.push(lte(transactions.createdAt, new Date(endDate)));

      // Since Drizzle doesn't have direct aggregation grouping like Mongoose,
      // we need to fetch data and group manually or use raw SQL
      let query = db
        .select({
          type: transactions.type,
          amount: transactions.amount,
        })
        .from(transactions);

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const results = await query;

      // Group by type manually
      const grouped = results.reduce((acc: any, transaction: any) => {
        const type = transaction.type;
        if (!acc[type]) {
          acc[type] = { type, count: 0, totalAmount: 0 };
        }
        acc[type].count += 1;
        acc[type].totalAmount += parseFloat(transaction.amount);
        return acc;
      }, {});

      return Object.values(grouped);
    } catch (error) {
      const err = error as Error;
      throw new Error(`Error getting transaction stats: ${err.message}`);
    }
  }

  // Update transaction
  static async update(id: number, updateData: any) {
    try {
      await db
        .update(transactions)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(transactions.id, id));

      // Get the updated transaction
      const [updatedTransaction] = await db.select().from(transactions).where(eq(transactions.id, id));
      return updatedTransaction;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Error updating transaction: ${err.message}`);
    }
  }

  // Void a transaction
  static async voidTransaction(id: number, adminId: number, reason: string) {
    try {
      // First get the current transaction
      const transaction = await this.findById(id);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status === 'voided') {
        throw new Error('Transaction already voided');
      }

      // Get current notes and add new note
      const currentNotes = Array.isArray(transaction.notes) ? transaction.notes : [];
      const newNote = {
        text: `Transaction voided: ${reason}`,
        addedBy: adminId,
        timestamp: new Date(),
      };

      await db
        .update(transactions)
        .set({
          status: 'voided',
          voidedBy: adminId,
          voidedReason: reason,
          voidedAt: new Date(),
          notes: [...currentNotes, newNote],
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, id));

      // Get the updated transaction
      const [voidedTransaction] = await db.select().from(transactions).where(eq(transactions.id, id));
      return voidedTransaction;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Error voiding transaction: ${err.message}`);
    }
  }

  // Find transactions by filter
  static async findMany(filter: TransactionFilter = {}, limit = 50, offset = 0) {
    try {
      let baseQuery = db.select().from(transactions);

      if (filter.userId) {
        baseQuery = baseQuery.where(eq(transactions.userId, filter.userId));
      }
      if (filter.type) {
        baseQuery = baseQuery.where(eq(transactions.type, filter.type));
      }
      if (filter.gameType) {
        baseQuery = baseQuery.where(eq(transactions.gameType, filter.gameType));
      }
      if (filter.status) {
        baseQuery = baseQuery.where(eq(transactions.status, filter.status));
      }

      const results = await baseQuery
        .orderBy(desc(transactions.createdAt))
        .limit(limit)
        .offset(offset);

      return results;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Error finding transactions: ${err.message}`);
    }
  }

  // Delete transaction
  static async delete(id: number) {
    try {
      await db
        .delete(transactions)
        .where(eq(transactions.id, id));

      return { id, deleted: true };
    } catch (error) {
      const err = error as Error;
      throw new Error(`Error deleting transaction: ${err.message}`);
    }
  }

  // Add note to transaction
  static async addNote(id: number, noteText: string, addedBy: number) {
    try {
      const transaction = await this.findById(id);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const currentNotes = Array.isArray(transaction.notes) ? transaction.notes : [];
      const newNote = {
        text: noteText,
        addedBy,
        timestamp: new Date(),
      };

      await db
        .update(transactions)
        .set({
          notes: [...currentNotes, newNote],
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, id));

      // Get the updated transaction
      const [updatedTransaction] = await db.select().from(transactions).where(eq(transactions.id, id));
      return updatedTransaction;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Error adding note to transaction: ${err.message}`);
    }
  }

  static async getUserTransactions(userId: number) {
    return await db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        type: transactions.type,
        amount: transactions.amount,
        status: transactions.status,
        description: transactions.description,
        gameType: transactions.gameType,
        createdAt: transactions.createdAt,
        createdByUsername: users.username
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.createdBy, users.id))
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
  }

  static async getTransactionsWithDetails() {
    const createdByUser = alias(users, 'createdByUser');
    const voidedByUser = alias(users, 'voidedByUser');
    
    return await db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        type: transactions.type,
        amount: transactions.amount,
        status: transactions.status,
        description: transactions.description,
        gameType: transactions.gameType,
        createdAt: transactions.createdAt,
        createdByUsername: createdByUser.username,
        voidedByUsername: voidedByUser.username
      })
      .from(transactions)
      .leftJoin(createdByUser, eq(transactions.createdBy, createdByUser.id))
      .leftJoin(voidedByUser, eq(transactions.voidedBy, voidedByUser.id))
      .orderBy(desc(transactions.createdAt));
  }

  static async findOne(conditions: Record<string, any>) {
    const whereConditions = [];
    
    for (const [key, value] of Object.entries(conditions)) {
      if (key === 'id') {
        whereConditions.push(eq(transactions.id, value));
      } else if (key === 'userId') {
        whereConditions.push(eq(transactions.userId, value));
      } else if (key === 'type') {
        whereConditions.push(eq(transactions.type, value));
      } else if (key === 'gameType') {
        whereConditions.push(eq(transactions.gameType, value));
      } else if (key === 'status') {
        whereConditions.push(eq(transactions.status, value));
      } else if (key === 'reference') {
        whereConditions.push(eq(transactions.reference, value));
      } else if (key === 'gameSessionId') {
        whereConditions.push(eq(transactions.gameSessionId, value));
      }
    }

    const result = await db
      .select()
      .from(transactions)
      .where(and(...whereConditions))
      .limit(1);
    
    return result[0] || null;
  }

  static async find(conditions: Record<string, any> = {}, options: QueryOptions = {}) {
    const userAlias = alias(users, 'userInfo');
    const createdByAlias = alias(users, 'createdByInfo');
    
    // Base select fields for transactions
    let selectFields: SelectFields = {
      id: transactions.id,
      userId: transactions.userId,
      type: transactions.type,
      amount: transactions.amount,
      status: transactions.status,
      description: transactions.description,
      gameType: transactions.gameType,
      createdAt: transactions.createdAt,
      reference: transactions.reference,
      balanceBefore: transactions.balanceBefore,
      balanceAfter: transactions.balanceAfter,
      createdBy: transactions.createdBy,
      voidedBy: transactions.voidedBy,
      voidedReason: transactions.voidedReason,
      voidedAt: transactions.voidedAt,
      updatedAt: transactions.updatedAt,
      notes: transactions.notes,
      metadata: transactions.metadata,
      gameSessionId: transactions.gameSessionId
    };

    // Add joined fields if populated
    if (options.populate) {
      if (options.populate.includes('userId')) {
        selectFields.userUsername = userAlias.username;
      }
      if (options.populate.includes('createdBy')) {
        selectFields.createdByUsername = createdByAlias.username;
      }
    }

    let query = db.select(selectFields).from(transactions);
    
    // Handle populate joins
    if (options.populate) {
      if (options.populate.includes('userId')) {
        query = query.leftJoin(userAlias, eq(transactions.userId, userAlias.id));
      }
      if (options.populate.includes('createdBy')) {
        query = query.leftJoin(createdByAlias, eq(transactions.createdBy, createdByAlias.id));
      }
    }
    
    // Handle conditions
    if (Object.keys(conditions).length > 0) {
      const whereConditions = [];
      
      for (const [key, value] of Object.entries(conditions)) {
        if (value && typeof value === 'object' && '$gte' in value && '$lte' in value) {
          if (key === 'createdAt') {
            whereConditions.push(and(
              gte(transactions.createdAt, value.$gte),
              lte(transactions.createdAt, value.$lte)
            ));
          } else if (key === 'amount') {
            whereConditions.push(and(
              gte(transactions.amount, value.$gte),
              lte(transactions.amount, value.$lte)
            ));
          }
        } else if (value && typeof value === 'object' && '$regex' in value) {
          if (key === 'description') {
            whereConditions.push(like(transactions.description, `%${value.$regex}%`));
          } else if (key === 'reference') {
            whereConditions.push(like(transactions.reference, `%${value.$regex}%`));
          }
        } else {
          if (key === 'id') {
            whereConditions.push(eq(transactions.id, value));
          } else if (key === 'userId') {
            whereConditions.push(eq(transactions.userId, value));
          } else if (key === 'type') {
            whereConditions.push(eq(transactions.type, value));
          } else if (key === 'gameType') {
            whereConditions.push(eq(transactions.gameType, value));
          } else if (key === 'status') {
            whereConditions.push(eq(transactions.status, value));
          } else if (key === 'reference') {
            whereConditions.push(eq(transactions.reference, value));
          } else if (key === 'gameSessionId') {
            whereConditions.push(eq(transactions.gameSessionId, value));
          }
        }
      }
      
      if (whereConditions.length > 0) {
        query = query.where(and(...whereConditions));
      }
    }

    // Handle sorting
    if (options.sort?.createdAt === -1) {
      query = query.orderBy(desc(transactions.createdAt));
    }

    // Handle limit
    if (options.limit) {
      query = query.limit(options.limit);
    }

    return await query;
  }

  static async updateById(id: number, updateData: any) {
    await db
      .update(transactions)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(transactions.id, id));
    
    // Get the updated transaction
    const [result] = await db.select().from(transactions).where(eq(transactions.id, id));
    return result || null;
  }

  static async deleteById(id: number) {
    // Get the transaction before deleting
    const [result] = await db.select().from(transactions).where(eq(transactions.id, id));
    
    await db
      .delete(transactions)
      .where(eq(transactions.id, id));
    
    return result || null;
  }
}

export default TransactionModel; 