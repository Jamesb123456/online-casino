/**
 * Plinko Game Socket Handler
 * Handles all socket.io events for the Plinko game
 */
import BalanceService from '../services/balanceService.js';
import LoggingService from '../services/loggingService.js';
import { generatePath, calculateMultiplier } from '../utils/plinkoUtils.js';
import { validateSocketData, plinkoDropBallSchema } from '../validation/schemas.js';
import crypto from 'crypto';

// Store active game sessions
const activeSessions = new Map();

// Store game history (in-memory, capped to prevent unbounded growth)
const gameHistory = [];
const MAX_HISTORY = 100;

/**
 * Initialize Plinko socket handlers
 * @param {Object} io - Socket.io instance
 * @param {Object} socket - Client socket connection
 * @param {Object} user - Authenticated user information
 */
function initPlinkoHandlers(io, socket, user) {
  // Read user identity from server-side authenticated user (set by auth middleware)
  const authenticatedUser = (socket as any).user;
  if (!authenticatedUser) {
    socket.emit('plinko:error', { message: 'Authentication required' });
    socket.disconnect();
    return;
  }
  const userId = authenticatedUser.userId;

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
    LoggingService.logGameEvent('plinko', 'session_start', {
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
      LoggingService.logGameEvent('plinko', 'error_join', { error: error.message, userId });
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * Handle dropping a ball (placing a bet)
   */
  socket.on('plinko:drop_ball', async (data, callback) => {
    try {
      // Validate bet data with Zod
      const validated = validateSocketData(plinkoDropBallSchema, data);
      const { betAmount, risk, rows } = validated;

      // Get user session
      const session = activeSessions.get(userId);

      // Check if user has enough balance
      if (session.balance < betAmount) {
        throw new Error('Insufficient balance');
      }

      // Deduct bet amount from balance
      session.balance -= betAmount;

      // Generate a unique game ID
      const gameId = crypto.randomUUID();

      // Use BalanceService to record the bet transaction
      await BalanceService.placeBet(userId, betAmount, 'plinko', {
        risk,
        rows,
        plinkoSessionId: gameId
      });

      // Log bet placed
      LoggingService.logBetPlaced('plinko', gameId, userId, betAmount, {
        risk,
        rows,
        timestamp: new Date()
      });

      // Generate the ball path using cryptographic seed
      const serverSeed = crypto.randomBytes(16).toString('hex');
      const path = generatePath(rows, serverSeed);

      // Calculate the multiplier based on the path and risk level
      const multiplier = calculateMultiplier(path[path.length - 1], rows, risk);

      // Calculate winnings
      const winAmount = betAmount * multiplier;
      const profit = winAmount - betAmount;

      // Add winnings to balance
      session.balance += winAmount;

      // Use BalanceService to record the win transaction
      if (winAmount > 0) {
        await BalanceService.recordWin(userId, betAmount, winAmount, 'plinko', {
          risk,
          rows,
          multiplier,
          path: path.join(','),
          profit
        });
      }

      // Create game result
      const gameResult = {
        id: gameId,
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
      LoggingService.logBetResult(
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

      // Add to history (capped)
      gameHistory.push(gameResult);
      if (gameHistory.length > MAX_HISTORY) gameHistory.splice(0, gameHistory.length - MAX_HISTORY);
      session.history.push(gameResult);
      if (session.history.length > MAX_HISTORY) session.history.splice(0, session.history.length - MAX_HISTORY);

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
      LoggingService.logGameEvent('plinko', 'error_drop_ball', { error: error.message, userId });
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
      LoggingService.logGameEvent('plinko', 'error_get_history', { error: error.message, userId });
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

export default initPlinkoHandlers;
export { initPlinkoHandlers };
