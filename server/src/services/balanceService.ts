import Decimal from 'decimal.js';
import UserModel from '../../drizzle/models/User.js';
import TransactionModel from '../../drizzle/models/Transaction.js';
import BalanceModel from '../../drizzle/models/Balance.js';
import { db } from '../../drizzle/db.js';
import { users, transactions } from '../../drizzle/schema.js';
import { eq, sql } from 'drizzle-orm';
import LoggingService from './loggingService.js';
import RedisService from './redisService.js';

// Configure Decimal.js for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Balance Service
 * Centralized service for handling balance operations across all games.
 * All financial arithmetic uses Decimal.js to avoid floating-point errors.
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
        let currentBalance: Decimal;
        let newBalance: Decimal;
        const changeAmount = new Decimal(amount);

        if (changeAmount.isNegative()) {
          // For deductions, use SELECT FOR UPDATE to acquire a row-level lock
          // preventing race conditions from concurrent balance operations.
          // This is stronger than the optimistic WHERE balance >= X approach
          // because it serializes concurrent deduction attempts for the same user.
          const lockResult = await tx.execute(
            sql`SELECT balance FROM users WHERE id = ${userId} FOR UPDATE`
          );
          const row = (lockResult as any)[0]?.[0];
          if (!row) {
            throw new Error('User not found');
          }

          currentBalance = new Decimal(String(row.balance || '0'));
          const deduction = changeAmount.abs();

          if (currentBalance.lt(deduction)) {
            throw new Error('Insufficient balance');
          }

          newBalance = currentBalance.minus(deduction);
          await tx.execute(
            sql`UPDATE users SET balance = ${newBalance.toFixed(2)}, updated_at = NOW() WHERE id = ${userId}`
          );
        } else {
          // For credits, a simple read + update within the transaction is sufficient
          const [user] = await tx.select().from(users).where(eq(users.id, userId));

          if (!user) {
            throw new Error('User not found');
          }

          currentBalance = new Decimal(user.balance || '0');
          newBalance = currentBalance.plus(changeAmount);

          await tx
            .update(users)
            .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
            .where(eq(users.id, userId));
        }

        const newBalanceStr = newBalance.toFixed(2);
        const currentBalanceStr = currentBalance.toFixed(2);
        const changeAmountStr = changeAmount.toFixed(2);

        // Create transaction record
        const insertTxResult = await tx.execute(
          sql`INSERT INTO transactions (user_id, amount, transaction_type, game_type, balance_before, balance_after, transaction_status, metadata, created_at, updated_at) VALUES (${userId}, ${changeAmountStr}, ${type}, ${gameType}, ${currentBalanceStr}, ${newBalanceStr}, 'completed', ${JSON.stringify(metadata)}, NOW(), NOW())`
        );
        const transactionId = (insertTxResult as any)[0]?.insertId;

        // Create balance history record
        await tx.execute(
          sql`INSERT INTO balances (user_id, amount, previous_balance, change_amount, balance_type, game_type, transaction_id, created_at, updated_at) VALUES (${userId}, ${newBalanceStr}, ${currentBalanceStr}, ${changeAmountStr}, ${this._mapTransactionTypeToBalanceType(type)}, ${gameType}, ${transactionId}, NOW(), NOW())`
        );

        // Fetch the updated user and transaction to return
        const [updatedUser] = await tx.select().from(users).where(eq(users.id, userId));

        // Fetch the created transaction record
        const [transaction] = await tx.select().from(transactions).where(eq(transactions.id, transactionId));

        return { user: updatedUser, transaction };
      });

      // Invalidate balance cache after successful update
      await RedisService.invalidateBalance(userId);

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
    // Use Decimal to negate the bet amount precisely
    const negativeBet = new Decimal(betAmount).abs().neg().toNumber();
    return this.updateBalance(
      userId,
      negativeBet,
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
    // Check cache first
    const cached = await RedisService.getCachedBalance(userId);
    if (cached !== null) {
      return cached;
    }

    const user = await UserModel.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const balance = new Decimal(user.balance || '0').toNumber();

    // Cache the balance for subsequent reads
    await RedisService.cacheBalance(userId, balance);

    return balance;
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
      const requiredAmount = new Decimal(amount);

      // Check cache first for quick rejection
      const cached = await RedisService.getCachedBalance(userId);
      if (cached !== null && new Decimal(cached).gte(requiredAmount)) {
        return true;
      }

      // Fall through to DB for authoritative check
      const balance = await this.getBalance(userId);
      return new Decimal(balance).gte(requiredAmount);
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