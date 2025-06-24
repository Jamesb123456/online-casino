import { eq, desc, gte, lte, count, sum, and, or, like } from 'drizzle-orm';
import db from '../db.js';
import { transactions, users } from '../schema.js';

class TransactionModel {
  // Create a new transaction
  static async create(transactionData) {
    try {
      const [transaction] = await db.insert(transactions).values({
        ...transactionData,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      return transaction;
    } catch (error) {
      throw new Error(`Error creating transaction: ${error.message}`);
    }
  }

  // Find transaction by ID
  static async findById(id) {
    try {
      const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
      return transaction || null;
    } catch (error) {
      throw new Error(`Error finding transaction by ID: ${error.message}`);
    }
  }

  // Find transaction by ID with user details
  static async findByIdWithUser(id) {
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
      throw new Error(`Error finding transaction with user: ${error.message}`);
    }
  }

  // Get user transaction history
  static async getUserTransactionHistory(userId, limit = 50, offset = 0) {
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
      throw new Error(`Error getting user transaction history: ${error.message}`);
    }
  }

  // Get transaction stats by date range
  static async getTransactionStatsByDate(startDate, endDate) {
    try {
      const conditions = [];
      if (startDate) conditions.push(gte(transactions.createdAt, new Date(startDate)));
      if (endDate) conditions.push(lte(transactions.createdAt, new Date(endDate)));

      // Since Drizzle doesn't have direct aggregation grouping like Mongoose,
      // we need to fetch data and group manually or use raw SQL
      const query = db
        .select({
          type: transactions.type,
          amount: transactions.amount,
        })
        .from(transactions);

      if (conditions.length > 0) {
        conditions.forEach(condition => {
          query.where(condition);
        });
      }

      const results = await query;

      // Group by type manually
      const grouped = results.reduce((acc, transaction) => {
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
      throw new Error(`Error getting transaction stats: ${error.message}`);
    }
  }

  // Update transaction
  static async update(id, updateData) {
    try {
      const [updatedTransaction] = await db
        .update(transactions)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(transactions.id, id))
        .returning();

      return updatedTransaction;
    } catch (error) {
      throw new Error(`Error updating transaction: ${error.message}`);
    }
  }

  // Void a transaction
  static async voidTransaction(id, adminId, reason) {
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

      const [voidedTransaction] = await db
        .update(transactions)
        .set({
          status: 'voided',
          voidedBy: adminId,
          voidedReason: reason,
          voidedAt: new Date(),
          notes: [...currentNotes, newNote],
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, id))
        .returning();

      return voidedTransaction;
    } catch (error) {
      throw new Error(`Error voiding transaction: ${error.message}`);
    }
  }

  // Find transactions by filter
  static async findMany(filter = {}, limit = 50, offset = 0) {
    try {
      let query = db.select().from(transactions);

      // Apply filters
      const conditions = [];
      if (filter.userId) conditions.push(eq(transactions.userId, filter.userId));
      if (filter.type) conditions.push(eq(transactions.type, filter.type));
      if (filter.gameType) conditions.push(eq(transactions.gameType, filter.gameType));
      if (filter.status) conditions.push(eq(transactions.status, filter.status));

      if (conditions.length > 0) {
        // For multiple conditions, we'd need to use `and` from drizzle-orm
        conditions.forEach(condition => {
          query = query.where(condition);
        });
      }

      const results = await query
        .orderBy(desc(transactions.createdAt))
        .limit(limit)
        .offset(offset);

      return results;
    } catch (error) {
      throw new Error(`Error finding transactions: ${error.message}`);
    }
  }

  // Delete transaction
  static async delete(id) {
    try {
      const [deletedTransaction] = await db
        .delete(transactions)
        .where(eq(transactions.id, id))
        .returning();

      return deletedTransaction;
    } catch (error) {
      throw new Error(`Error deleting transaction: ${error.message}`);
    }
  }

  // Add note to transaction
  static async addNote(id, noteText, addedBy) {
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

      const [updatedTransaction] = await db
        .update(transactions)
        .set({
          notes: [...currentNotes, newNote],
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, id))
        .returning();

      return updatedTransaction;
    } catch (error) {
      throw new Error(`Error adding note to transaction: ${error.message}`);
    }
  }

  static async getUserTransactions(userId) {
    return await db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        type: transactions.type,
        amount: transactions.amount,
        status: transactions.status,
        description: transactions.description,
        gameType: transactions.gameType,
        gameData: transactions.gameData,
        createdAt: transactions.createdAt,
        processedAt: transactions.processedAt,
        createdByUsername: users.username
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.createdBy, users.id))
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
  }

  static async getTransactionsWithDetails() {
    return await db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        type: transactions.type,
        amount: transactions.amount,
        status: transactions.status,
        description: transactions.description,
        gameType: transactions.gameType,
        gameData: transactions.gameData,
        createdAt: transactions.createdAt,
        processedAt: transactions.processedAt,
        createdByUsername: users.username,
        voidedByUsername: users.username
      })
      .from(transactions)
      .leftJoin(users, eq(transactions.createdBy, users.id))
      .leftJoin(users, eq(transactions.voidedBy, users.id))
      .orderBy(desc(transactions.createdAt));
  }

  static async findOne(conditions) {
    const whereConditions = [];
    
    Object.entries(conditions).forEach(([key, value]) => {
      whereConditions.push(eq(transactions[key], value));
    });

    const result = await db
      .select()
      .from(transactions)
      .where(and(...whereConditions))
      .limit(1);
    
    return result[0] || null;
  }

  static async find(conditions = {}, options = {}) {
    let query = db.select().from(transactions);
    
    // Handle conditions
    if (Object.keys(conditions).length > 0) {
      const whereConditions = [];
      
      Object.entries(conditions).forEach(([key, value]) => {
        if (typeof value === 'object' && value.$gte && value.$lte) {
          whereConditions.push(and(
            gte(transactions[key], value.$gte),
            lte(transactions[key], value.$lte)
          ));
        } else if (typeof value === 'object' && value.$regex) {
          whereConditions.push(like(transactions[key], `%${value.$regex}%`));
        } else {
          whereConditions.push(eq(transactions[key], value));
        }
      });
      
      query = query.where(and(...whereConditions));
    }

    // Handle populate
    if (options.populate) {
      if (options.populate.includes('userId')) {
        query = query.leftJoin(users, eq(transactions.userId, users.id));
      }
      if (options.populate.includes('createdBy')) {
        query = query.leftJoin(users, eq(transactions.createdBy, users.id));
      }
    }

    // Handle sorting
    if (options.sort) {
      if (options.sort.createdAt === -1) {
        query = query.orderBy(desc(transactions.createdAt));
      }
    }

    // Handle limit
    if (options.limit) {
      query = query.limit(options.limit);
    }

    return await query;
  }

  static async updateById(id, updateData) {
    const result = await db
      .update(transactions)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(transactions.id, id))
      .returning();
    
    return result[0] || null;
  }

  static async deleteById(id) {
    const result = await db
      .delete(transactions)
      .where(eq(transactions.id, id))
      .returning();
    
    return result[0] || null;
  }

  // Instance methods (when you have a transaction object)
  async save() {
    if (this.id) {
      const result = await db
        .update(transactions)
        .set({ ...this, updatedAt: new Date() })
        .where(eq(transactions.id, this.id))
        .returning();
      
      Object.assign(this, result[0]);
      return this;
    } else {
      const result = await db.insert(transactions).values(this).returning();
      Object.assign(this, result[0]);
      return this;
    }
  }
}

export default TransactionModel; 