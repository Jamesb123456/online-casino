const User = require('../models/User');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

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
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find user and update balance
      const user = await User.findById(userId).session(session);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Check if user has enough balance for deductions
      if (amount < 0 && user.balance + amount < 0) {
        throw new Error('Insufficient balance');
      }
      
      // Update user balance
      user.balance += amount;
      await user.save({ session });
      
      // Create transaction record
      const transaction = new Transaction({
        userId,
        amount,
        type,
        gameType,
        balanceAfter: user.balance,
        status: 'completed',
        metadata
      });
      
      await transaction.save({ session });
      
      // Commit the transaction
      await session.commitTransaction();
      session.endSession();
      
      return { user, transaction };
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      session.endSession();
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
      'bet',
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
      'win',
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
      'adjustment',
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
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    return user.balance;
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
  async getTransactionHistory(userId, options = {}) {
    const { limit = 20, skip = 0, type, gameType } = options;
    
    const query = { userId };
    
    if (type) {
      query.type = type;
    }
    
    if (gameType) {
      query.gameType = gameType;
    }
    
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
      
    const count = await Transaction.countDocuments(query);
    
    return {
      transactions,
      total: count
    };
  }
}

module.exports = new BalanceService();