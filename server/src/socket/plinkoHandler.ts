// @ts-nocheck
/**
 * Plinko Game Socket Handler
 * Handles all socket.io events for the Plinko game
 */
const balanceService = require('../services/balanceService');
const loggingService = require('../services/loggingService').default;

const { generatePath, calculateMultiplier } = require('../utils/plinkoUtils');

// Store active game sessions
const activeSessions = new Map();

// Store game history (in-memory for now, would be DB in production)
const gameHistory = [];

/**
 * Initialize Plinko socket handlers
 * @param {Object} io - Socket.io instance
 * @param {Object} socket - Client socket connection
 * @param {Object} user - Authenticated user information
 */
function initPlinkoHandlers(io, socket, user) {
  const userId = user?._id || socket.id;
  
  // Join the plinko namespace/room
  socket.join('plinko');
  
  // Create or get user session
  if (!activeSessions.has(userId)) {
    activeSessions.set(userId, {
      userId,
      balance: user?.balance || 1000, // Demo balance if no user
      history: [],
      currentBets: [],
      isPlaying: false
    });
    
    // Log session initialization
    loggingService.logGameEvent('plinko', 'session_start', {
      userId,
      initialBalance: user?.balance || 1000,
      timestamp: new Date()
    }, userId);
  }
  
  /**
   * Handle joining the plinko game
   */
  socket.on('plinko:join', async (data, callback) => {
    try {
      // Get recent game history (limited to last 10 results)
      const recentHistory = gameHistory.slice(-10);
      
      // Get user session
      const session = activeSessions.get(userId);
      
      // Return game state to the client
      const response = {
        success: true,
        balance: session.balance,
        history: recentHistory
      };
      
      if (callback) callback(response);
      
    } catch (error) {
      console.error('Error joining Plinko game:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * Handle dropping a ball (placing a bet)
   */
  socket.on('plinko:drop_ball', async (data, callback) => {
    try {
      // Validate bet data
      const { betAmount, risk = 'medium', rows = 16 } = data;
      
      if (!betAmount || isNaN(betAmount) || betAmount <= 0) {
        throw new Error('Invalid bet amount');
      }
      
      // Get user session
      const session = activeSessions.get(userId);
      
      // Check if user has enough balance
      if (session.balance < betAmount) {
        throw new Error('Insufficient balance');
      }
      
      // Deduct bet amount from balance
      session.balance -= betAmount;
      
      // Generate a unique game ID
      const gameId = Date.now().toString();
      
      // Use balanceService to record the bet transaction
      await balanceService.placeBet(userId, betAmount, 'plinko', {
        risk,
        rows,
        plinkoSessionId: gameId
      });
      
      // Log bet placed
      loggingService.logBetPlaced('plinko', gameId, userId, betAmount, {
        risk,
        rows,
        timestamp: new Date()
      });
      
      // Generate the ball path (simplified for demonstration)
      const serverSeed = Math.random().toString(36).substring(2, 15);
      const path = generatePath(rows, serverSeed);
      
      // Calculate the multiplier based on the path and risk level
      const multiplier = calculateMultiplier(path[path.length - 1], rows, risk);
      
      // Calculate winnings
      const winAmount = betAmount * multiplier;
      const profit = winAmount - betAmount;
      
      // Add winnings to balance
      session.balance += winAmount;
      
      // Use balanceService to record the win transaction
      if (winAmount > 0) {
        await balanceService.recordWin(userId, betAmount, winAmount, 'plinko', {
          risk,
          rows,
          multiplier,
          path: path.join(','),
          profit
        });
      }
      
      // Create game result
      const gameResult = {
        id: gameId, // Use the same gameId we generated earlier
        userId,
        timestamp: new Date(),
        betAmount,
        risk,
        path,
        landingPosition: path[path.length - 1],
        multiplier,
        winAmount,
        profit
      };
      
      // Log game result
      loggingService.logBetResult(
        'plinko', 
        gameId, 
        userId, 
        betAmount, 
        winAmount, 
        profit >= 0, // true if win, false if loss
        {
          risk,
          rows,
          multiplier,
          landingPosition: path[path.length - 1],
          path: path.join(','),
          timestamp: new Date()
        }
      );
      
      // Add to history
      gameHistory.push(gameResult);
      session.history.push(gameResult);
      
      // Wait a bit to simulate ball drop animation time
      // In real implementation, we'd send path data first and results later
      
      // Send result to client
      const response = {
        success: true,
        gameId: gameResult.id,
        path: gameResult.path,
        multiplier: gameResult.multiplier,
        winAmount: gameResult.winAmount,
        profit: gameResult.profit,
        balance: session.balance
      };
      
      if (callback) callback(response);
      
      // Broadcast to room that a new game happened (for real-time updates)
      socket.to('plinko').emit('plinko:game_result', {
        userId,
        betAmount,
        multiplier,
        profit
      });
      
    } catch (error) {
      console.error('Error dropping Plinko ball:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * Handle getting game history
   */
  socket.on('plinko:get_history', async (data, callback) => {
    try {
      const limit = data?.limit || 10;
      
      // Get user session
      const session = activeSessions.get(userId);
      
      // Get recent game history (limited to specified number)
      const userHistory = session.history.slice(-limit);
      const globalHistory = gameHistory.slice(-limit);
      
      // Return history to the client
      const response = {
        success: true,
        userHistory,
        globalHistory
      };
      
      if (callback) callback(response);
      
    } catch (error) {
      console.error('Error getting Plinko history:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * Handle user leaving the game
   */
  socket.on('plinko:leave', () => {
    // No specific cleanup needed here, general disconnect handler will take care of it
    socket.leave('plinko');
  });

  /**
   * Handle user disconnect
   */
  socket.on('disconnect', () => {
    // Keep user session for reconnection but mark as inactive
    if (activeSessions.has(userId)) {
      const session = activeSessions.get(userId);
      session.isPlaying = false;
    }
  });
}

module.exports = {
  initPlinkoHandlers
};