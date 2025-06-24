import UserModel from '../../drizzle/models/User.js';
import TransactionModel from '../../drizzle/models/Transaction.js';
import BalanceModel from '../../drizzle/models/Balance.js';

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
      // Find user and check balance
      const user = await UserModel.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const currentBalance = parseFloat(user.balance);
      
      // Check if user has enough balance for deductions
      if (amount < 0 && currentBalance + amount < 0) {
        throw new Error('Insufficient balance');
      }
      
      const newBalance = currentBalance + amount;
      
      // Create transaction record first
      const transaction = await TransactionModel.create({
        userId,
        amount: amount.toString(),
        type,
        gameType,
        balanceBefore: currentBalance.toString(),
        balanceAfter: newBalance.toString(),
        status: 'completed',
        metadata
      });
      
      // Update user balance
      const updatedUser = await UserModel.update(userId, { 
        balance: newBalance.toString() 
      });
      
      // Create balance history record
      await BalanceModel.create({
        userId,
        amount: newBalance.toString(),
        previousBalance: currentBalance.toString(),
        changeAmount: amount.toString(),
        type: this._mapTransactionTypeToBalanceType(type),
        gameType,
        transactionId: transaction.id
      });
      
      return { user: updatedUser, transaction };
    } catch (error) {
      console.error('Error updating balance:', error);
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
  async getTransactionHistory(userId, options = {}) {
    const { limit = 20, skip = 0, type, gameType } = options;
    
    const filter = { userId };
    if (type) filter.type = type;
    if (gameType) filter.gameType = gameType;
    
    const transactions = await TransactionModel.findMany(filter, limit, skip);
    
    // Get total count for pagination (simplified)
    const allTransactions = await TransactionModel.findMany(filter);
    const count = allTransactions.length;
    
    return {
      transactions,
      total: count
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
}

export default new BalanceService();