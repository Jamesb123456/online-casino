/**
 * Game Logging Service
 * 
 * A centralized logging service for all casino games
 * Records game events, outcomes, and player interactions
 * Provides consistent structured logs across all games
 */

const mongoose = require('mongoose');
const GameLog = require('../models/GameLog');

class LoggingService {
  /**
   * Log a game event
   * @param {String} gameType - Type of game (crash, plinko, wheel, etc.)
   * @param {String} eventType - Type of event (started, ended, bet_placed, etc.)
   * @param {Object} data - Event data (game state, bet details, etc.)
   * @param {String} userId - User ID (if applicable)
   * @returns {Promise<Object>} Created log entry
   */
  async logGameEvent(gameType, eventType, data = {}, userId = null) {
    try {
      const log = new GameLog({
        gameType,
        eventType,
        userId,
        data,
        timestamp: new Date()
      });
      
      await log.save();
      return log;
    } catch (error) {
      console.error(`Error logging game event: ${error.message}`);
      // Still return the log data even if saving failed
      return { gameType, eventType, userId, data, timestamp: new Date(), error: error.message };
    }
  }
  
  /**
   * Log a game start event
   * @param {String} gameType - Type of game
   * @param {String} gameId - Unique game ID
   * @param {Object} initialState - Initial game state
   * @returns {Promise<Object>} Created log entry
   */
  async logGameStart(gameType, gameId, initialState = {}) {
    return this.logGameEvent(gameType, 'game_started', {
      gameId,
      initialState,
      startTime: new Date()
    });
  }
  
  /**
   * Log a game end event
   * @param {String} gameType - Type of game
   * @param {String} gameId - Unique game ID
   * @param {Object} finalState - Final game state
   * @param {Object} outcome - Game outcome details
   * @returns {Promise<Object>} Created log entry
   */
  async logGameEnd(gameType, gameId, finalState = {}, outcome = {}) {
    return this.logGameEvent(gameType, 'game_ended', {
      gameId,
      finalState,
      outcome,
      endTime: new Date()
    });
  }
  
  /**
   * Log a bet placed event
   * @param {String} gameType - Type of game
   * @param {String} gameId - Unique game ID
   * @param {String} userId - User ID
   * @param {Number} amount - Bet amount
   * @param {Object} betDetails - Additional bet details
   * @returns {Promise<Object>} Created log entry
   */
  async logBetPlaced(gameType, gameId, userId, amount, betDetails = {}) {
    return this.logGameEvent(gameType, 'bet_placed', {
      gameId,
      amount,
      betDetails
    }, userId);
  }
  
  /**
   * Log a bet result event
   * @param {String} gameType - Type of game
   * @param {String} gameId - Unique game ID
   * @param {String} userId - User ID
   * @param {Number} betAmount - Original bet amount
   * @param {Number} winAmount - Amount won (0 for losses)
   * @param {Boolean} isWin - Whether the bet was won
   * @param {Object} resultDetails - Additional result details
   * @returns {Promise<Object>} Created log entry
   */
  async logBetResult(gameType, gameId, userId, betAmount, winAmount, isWin, resultDetails = {}) {
    return this.logGameEvent(gameType, isWin ? 'bet_won' : 'bet_lost', {
      gameId,
      betAmount,
      winAmount,
      profit: winAmount - betAmount,
      resultDetails
    }, userId);
  }
  
  /**
   * Log a player action event
   * @param {String} gameType - Type of game
   * @param {String} gameId - Unique game ID
   * @param {String} userId - User ID
   * @param {String} action - Action taken
   * @param {Object} actionDetails - Additional action details
   * @returns {Promise<Object>} Created log entry
   */
  async logPlayerAction(gameType, gameId, userId, action, actionDetails = {}) {
    return this.logGameEvent(gameType, 'player_action', {
      gameId,
      action,
      actionDetails
    }, userId);
  }
  
  /**
   * Get game logs for a specific game type
   * @param {String} gameType - Type of game
   * @param {Object} options - Query options
   * @param {Number} options.limit - Maximum number of logs
   * @param {Number} options.skip - Number of logs to skip
   * @param {String} options.sortBy - Field to sort by
   * @param {Number} options.sortDir - Sort direction (1 for ascending, -1 for descending)
   * @param {String} options.eventType - Filter by event type
   * @param {String} options.userId - Filter by user ID
   * @returns {Promise<Array>} Game logs
   */
  async getGameLogs(gameType, options = {}) {
    const {
      limit = 50,
      skip = 0,
      sortBy = 'timestamp',
      sortDir = -1,
      eventType = null,
      userId = null,
      gameId = null,
      startDate = null,
      endDate = null
    } = options;
    
    const query = { gameType };
    
    if (eventType) {
      query.eventType = eventType;
    }
    
    if (userId) {
      query.userId = userId;
    }
    
    if (gameId) {
      query['data.gameId'] = gameId;
    }
    
    if (startDate || endDate) {
      query.timestamp = {};
      
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }
    
    const sort = {};
    sort[sortBy] = sortDir;
    
    const logs = await GameLog.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit);
      
    const total = await GameLog.countDocuments(query);
    
    return {
      logs,
      total,
      page: Math.floor(skip / limit) + 1,
      totalPages: Math.ceil(total / limit)
    };
  }
  
  /**
   * Get game statistics
   * @param {String} gameType - Type of game (optional, for all games if not specified)
   * @param {String} startDate - Start date (ISO string)
   * @param {String} endDate - End date (ISO string)
   * @returns {Promise<Object>} Game statistics
   */
  async getGameStats(gameType = null, startDate = null, endDate = null) {
    const query = {};
    
    if (gameType) {
      query.gameType = gameType;
    }
    
    if (startDate || endDate) {
      query.timestamp = {};
      
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }
    
    // Overall statistics
    const totalGames = await GameLog.countDocuments({
      ...query,
      eventType: 'game_ended'
    });
    
    const totalBets = await GameLog.countDocuments({
      ...query,
      eventType: 'bet_placed'
    });
    
    // Group events by type
    const eventCounts = await GameLog.aggregate([
      { $match: query },
      { $group: { _id: '$eventType', count: { $sum: 1 } } }
    ]);
    
    // Group by game type if no specific game type is provided
    let gameTypeCounts = [];
    if (!gameType) {
      gameTypeCounts = await GameLog.aggregate([
        { $match: query },
        { $group: { _id: '$gameType', count: { $sum: 1 } } }
      ]);
    }
    
    // Get win/loss statistics
    const winLossStats = await GameLog.aggregate([
      { 
        $match: { 
          ...query, 
          eventType: { $in: ['bet_won', 'bet_lost'] } 
        } 
      },
      { 
        $group: { 
          _id: '$eventType',
          count: { $sum: 1 },
          totalAmount: { $sum: '$data.betAmount' }
        } 
      }
    ]);
    
    // Format the statistics
    const eventStats = {};
    eventCounts.forEach(item => {
      eventStats[item._id] = item.count;
    });
    
    const gameTypeStats = {};
    gameTypeCounts.forEach(item => {
      gameTypeStats[item._id] = item.count;
    });
    
    const winLoss = {
      wins: 0,
      losses: 0,
      winAmount: 0,
      lossAmount: 0
    };
    
    winLossStats.forEach(item => {
      if (item._id === 'bet_won') {
        winLoss.wins = item.count;
        winLoss.winAmount = item.totalAmount;
      } else if (item._id === 'bet_lost') {
        winLoss.losses = item.count;
        winLoss.lossAmount = item.totalAmount;
      }
    });
    
    return {
      totalEvents: await GameLog.countDocuments(query),
      totalGames,
      totalBets,
      eventStats,
      gameTypeStats: gameType ? null : gameTypeStats,
      winLossStats: winLoss,
      timeRange: {
        start: startDate ? new Date(startDate) : null,
        end: endDate ? new Date(endDate) : null
      }
    };
  }
}

module.exports = new LoggingService();