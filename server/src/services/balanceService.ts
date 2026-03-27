// @ts-nocheck -- TODO: fix Drizzle/Express type errors and remove this directive
import UserModel from '../../drizzle/models/User.js';
import TransactionModel from '../../drizzle/models/Transaction.js';
import BalanceModel from '../../drizzle/models/Balance.js';
import { db } from '../../drizzle/db.js';
import { users, transactions } from '../../drizzle/schema.js';
import { eq, sql } from 'drizzle-orm';
import LoggingService from './loggingService.js';

/**
 * Balance Service
 * Centralized service for handling balance operations across all games
 */
class BalanceService {
  /**
   * Update a user's balance
   * @param {String} userId - User ID
   * @param {Number} amount - Amount to add (positive) or subtract (negative)
   * @param {String} type - Transaction type
   * @param {String} gameType - Game type (if applicable)
   * @param {Object} metadata - Additional transaction metadata
   * @returns {Promise<Object>} Updated user and transaction
   */
  async updateBalance(userId, amount, type, gameType = null, metadata = {}) {
    try {
      const result = await db.transaction(async (tx) => {
        // Find user and check balance inside the transaction
        const [user] = await tx.select().from(users).where(eq(users.id, userId));

        if (!user) {
          throw new Error('User not found');
        }

        const currentBalance = parseFloat(user.balance);

        // Check if user has enough balance for deductions
        if (amount < 0 && currentBalance + amount < 0) {
          throw new Error('Insufficient balance');
        }

        const newBalance = currentBalance + amount;

        // Atomically update user balance with a conditional check to prevent race conditions.
        // For deductions, ensure balance hasn't changed since we read it (optimistic lock).
        if (amount < 0) {
          const updateResult = await tx.execute(
            sql`UPDATE users SET balance = ${newBalance.toString()}, updated_at = NOW() WHERE id = ${userId} AND balance >= ${Math.abs(amount).toString()}`
          );
          if ((updateResult as any)[0]?.affectedRows === 0) {
            throw new Error('Insufficient balance');
          }
        } else {
          await tx
            .update(users)
            .set({ balance: newBalance.toString(), updatedAt: new Date() })
            .where(eq(users.id, userId));
        }

        // Create transaction record
        const insertTxResult = await tx.execute(
          sql`INSERT INTO transactions (user_id, amount, type, game_type, balance_before, balance_after, status, metadata, created_at, updated_at) VALUES (${userId}, ${amount.toString()}, ${type}, ${gameType}, ${currentBalance.toString()}, ${newBalance.toString()}, 'completed', ${JSON.stringify(metadata)}, NOW(), NOW())`
        );
        const transactionId = (insertTxResult as any)[0]?.insertId;

        // Create balance history record
        await tx.execute(
          sql`INSERT INTO balances (user_id, amount, previous_balance, change_amount, type, game_type, transaction_id, created_at, updated_at) VALUES (${userId}, ${newBalance.toString()}, ${currentBalance.toString()}, ${amount.toString()}, ${this._mapTransactionTypeToBalanceType(type)}, ${gameType}, ${transactionId}, NOW(), NOW())`
        );

        // Fetch the updated user and transaction to return
        const [updatedUser] = await tx.select().from(users).where(eq(users.id, userId));

        // Fetch the created transaction record
        const [transaction] = await tx.select().from(transactions).where(eq(transactions.id, transactionId));

        return { user: updatedUser, transaction };
      });

      return result;
    } catch (error) {
      LoggingService.logSystemEvent('balance_update_error', {
        userId,
        amount,
        type,
        gameType,
        error: error instanceof Error ? error.message : String(error),
      }, 'error');
      throw error;
    }
  }
  
  /**
   * Handle a game bet
   * @param {String} userId - User ID
   * @param {Number} betAmount - Bet amount
   * @param {String} gameType - Type of game
   * @param {Object} metadata - Additional bet metadata
   * @returns {Promise<Object>} Updated user and transaction
   */
  async placeBet(userId, betAmount, gameType, metadata = {}) {
    return this.updateBalance(
      userId,
      -Math.abs(betAmount),
      'game_loss',
      gameType,
      metadata
    );
  }
  
  /**
   * Handle a game win
   * @param {String} userId - User ID
   * @param {Number} betAmount - Original bet amount
   * @param {Number} winAmount - Win amount (total payout including original bet)
   * @param {String} gameType - Type of game
   * @param {Object} metadata - Additional win metadata
   * @returns {Promise<Object>} Updated user and transaction
   */
  async recordWin(userId, betAmount, winAmount, gameType, metadata = {}) {
    return this.updateBalance(
      userId,
      winAmount,
      'game_win',
      gameType,
      { ...metadata, betAmount }
    );
  }
  
  /**
   * Handle a manual adjustment (admin function)
   * @param {String} userId - User ID
   * @param {Number} amount - Amount to adjust
   * @param {String} reason - Reason for adjustment
   * @param {String} adminId - Admin user ID
   * @returns {Promise<Object>} Updated user and transaction
   */
  async manualAdjustment(userId, amount, reason, adminId) {
    return this.updateBalance(
      userId,
      amount,
      'admin_adjustment',
      null,
      { reason, adminId }
    );
  }
  
  /**
   * Get user balance
   * @param {String} userId - User ID
   * @returns {Promise<Number>} User balance
   */
  async getBalance(userId) {
    const user = await UserModel.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    return parseFloat(user.balance);
  }
  
  /**
   * Get transaction history for a user
   * @param {String} userId - User ID
   * @param {Object} options - Query options
   * @param {Number} options.limit - Maximum number of transactions
   * @param {Number} options.skip - Number of transactions to skip
   * @param {String} options.type - Filter by transaction type
   * @param {String} options.gameType - Filter by game type
   * @returns {Promise<Array>} Transactions
   */
  async getTransactionHistory(userId: string, options: any = {}) {
    const { limit = 20, skip = 0, type, gameType } = options;

    const filter: any = { userId };
    if (type) filter.type = type;
    if (gameType) filter.gameType = gameType;

    const [txns, total] = await Promise.all([
      TransactionModel.findMany(filter, limit, skip),
      TransactionModel.count(filter),
    ]);

    return {
      transactions: txns,
      total,
    };
  }

  /**
   * Helper method to map transaction types to balance types
   * @param {String} transactionType 
   * @returns {String} Balance type
   */
  _mapTransactionTypeToBalanceType(transactionType) {
    const mapping = {
      'deposit': 'deposit',
      'withdrawal': 'withdrawal',
      'game_win': 'win',
      'game_loss': 'loss',
      'admin_adjustment': 'admin_adjustment',
      'bonus': 'win'
    };
    
    return mapping[transactionType] || 'admin_adjustment';
  }

  /**
   * Get balance history for a user
   * @param {String} userId - User ID
   * @param {Number} limit - Number of records to return
   * @returns {Promise<Array>} Balance history
   */
  async getBalanceHistory(userId, limit = 50) {
    return await BalanceModel.getBalanceHistory(userId, limit);
  }

  /**
   * Get current balance from balance history
   * @param {String} userId - User ID
   * @returns {Promise<Number>} Current balance
   */
  async getCurrentBalanceFromHistory(userId) {
    return await BalanceModel.getCurrentBalance(userId);
  }

  /**
   * Check if user has sufficient balance for a bet
   * @param {String} userId - User ID
   * @param {Number} amount - Amount to check
   * @returns {Promise<Boolean>} Whether user has sufficient balance
   */
  async hasSufficientBalance(userId, amount) {
    try {
      const balance = await this.getBalance(userId);
      return balance >= amount;
    } catch (error) {
      LoggingService.logSystemEvent('sufficient_balance_check_error', {
        userId,
        amount,
        error: error instanceof Error ? error.message : String(error),
      }, 'error');
      return false;
    }
  }

  /**
   * Alias for updateBalance for backward compatibility
   * @param {String} userId - User ID
   * @param {Number} amount - Amount to add/subtract
   * @param {String} type - Transaction type
   * @param {String} gameType - Game type
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Updated user and transaction
   */
  async updateGameBalance(userId, amount, type, gameType = null, metadata = {}) {
    return this.updateBalance(userId, amount, type, gameType, metadata);
  }
}

export default new BalanceService();