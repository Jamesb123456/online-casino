/**
 * Wheel Game Socket Handler
 * Handles all socket.io events for the Wheel of Fortune game
 */
import BalanceService from '../services/balanceService.js';
import LoggingService from '../services/loggingService.js';
import { validateSocketData, wheelPlaceBetSchema } from '../validation/schemas.js';
import crypto from 'crypto';

// Store active game sessions
const activeSessions = new Map();

// Store game history (in-memory, capped to prevent unbounded growth)
const gameHistory = [];
const MAX_HISTORY = 100;

// Multiplayer data structures
const connectedUsers = new Map(); // Map of userId -> socket info
const activePlayers = new Map();  // Map of userId -> player info
const currentBets = [];           // Array of all active bets from all players

/**
 * Get wheel segments configuration based on difficulty
 * @param {String} difficulty - Difficulty level (easy, medium, hard)
 * @returns {Array<Object>} - Array of wheel segment configurations
 */
const getWheelSegments = (difficulty = 'medium') => {
  // Predefined wheel segments for different difficulty levels
  const wheelSegments = {
    easy: [
      { multiplier: 1.5, color: '#3498db', weight: 3 }, // Blue
      { multiplier: 2, color: '#2ecc71', weight: 2 },   // Green
      { multiplier: 0.5, color: '#e74c3c', weight: 2 }, // Red
      { multiplier: 1, color: '#f1c40f', weight: 4 },   // Yellow
      { multiplier: 0.2, color: '#e67e22', weight: 2 }, // Orange
      { multiplier: 3, color: '#9b59b6', weight: 1 }    // Purple
    ],
    medium: [
      { multiplier: 2, color: '#3498db', weight: 2 },   // Blue
      { multiplier: 3, color: '#2ecc71', weight: 1 },   // Green
      { multiplier: 0.2, color: '#e74c3c', weight: 3 }, // Red
      { multiplier: 1, color: '#f1c40f', weight: 3 },   // Yellow
      { multiplier: 0.5, color: '#e67e22', weight: 2 }, // Orange
      { multiplier: 5, color: '#9b59b6', weight: 1 }    // Purple
    ],
    hard: [
      { multiplier: 3, color: '#3498db', weight: 1 },   // Blue
      { multiplier: 5, color: '#2ecc71', weight: 1 },   // Green
      { multiplier: 0.1, color: '#e74c3c', weight: 4 }, // Red
      { multiplier: 0.5, color: '#f1c40f', weight: 2 }, // Yellow
      { multiplier: 0.2, color: '#e67e22', weight: 2 }, // Orange
      { multiplier: 10, color: '#9b59b6', weight: 1 }   // Purple
    ]
  };

  // Get segments for the selected difficulty
  const segments = wheelSegments[difficulty] || wheelSegments.medium;

  // Expand segments based on weight
  const expandedSegments = [];
  segments.forEach(segment => {
    for (let i = 0; i < segment.weight; i++) {
      expandedSegments.push({
        multiplier: segment.multiplier,
        color: segment.color
      });
    }
  });

  return expandedSegments;
};

/**
 * Generate a cryptographically secure wheel result
 * @param {Array<Object>} segments - Array of wheel segments
 * @returns {Object} - Selected segment and additional result data
 */
const generateWheelResult = (segments) => {
  // Use cryptographically secure random number for game-critical result
  const index = crypto.randomInt(segments.length);
  return {
    segmentIndex: index,
    multiplier: segments[index].multiplier,
    color: segments[index].color,
    timestamp: new Date()
  };
};

/**
 * Initialize Wheel socket handlers
 * @param {Object} io - Socket.io instance
 * @param {Object} socket - Client socket connection
 * @param {Object} user - Authenticated user information
 */
function initWheelHandlers(io, socket, user) {
  // Read user identity from server-side authenticated user (set by auth middleware)
  const authenticatedUser = (socket as any).user;
  if (!authenticatedUser) {
    socket.emit('wheel:error', { message: 'Authentication required' });
    socket.disconnect();
    return;
  }
  const userId = authenticatedUser.userId;
  const username = authenticatedUser.username;
  const avatar = user?.avatar || null;

  // Join the wheel namespace/room
  socket.join('wheel');

  // Track connected user
  connectedUsers.set(userId, {
    socketId: socket.id,
    userId,
    username,
    avatar,
    balance: user?.balance || 1000 // Demo balance if no user
  });

  // Add to active players
  const playerInfo = {
    id: userId,
    username,
    avatar,
    joinedAt: new Date()
  };

  activePlayers.set(userId, playerInfo);

  // Broadcast to other clients that a new player has joined
  socket.broadcast.emit('wheel:playerJoined', playerInfo);

  // Send current active players to the new client
  socket.emit('wheel:activePlayers', Array.from(activePlayers.values()));

  // Send current bets to the new client
  socket.emit('wheel:currentBets', currentBets);

  // Create or get user session
  if (!activeSessions.has(userId)) {
    activeSessions.set(userId, {
      userId,
      balance: user?.balance || 1000, // Demo balance if no user
      history: [],
      isPlaying: false
    });

    // Log session initialization
    LoggingService.logGameEvent('wheel', 'session_start', {
      userId,
      username,
      initialBalance: user?.balance || 1000,
      timestamp: new Date()
    }, userId);
  }

  /**
   * Handle joining the wheel game
   */
  socket.on('wheel:join', async (data, callback) => {
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
      LoggingService.logGameEvent('wheel', 'error_join', { error: error.message, userId });
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * Handle placing a bet and spinning the wheel
   */
  socket.on('wheel:place_bet', async (data, callback) => {
    try {
      // Validate bet data with Zod
      const validated = validateSocketData(wheelPlaceBetSchema, data);
      const { betAmount, difficulty } = validated;

      // Get user session
      const session = activeSessions.get(userId);

      // Check if user has enough balance
      if (session.balance < betAmount) {
        throw new Error('Insufficient balance');
      }

      // Deduct bet amount from balance
      session.balance -= betAmount;

      // Create bet object with player info
      const betId = `bet_${Date.now()}_${userId}`;
      const betPlayerInfo = activePlayers.get(userId);
      const bet = {
        id: betId,
        userId,
        username: betPlayerInfo.username,
        avatar: betPlayerInfo.avatar,
        betAmount,
        difficulty,
        timestamp: new Date()
      };

      // Add to current bets
      currentBets.push(bet);

      // Broadcast the bet to all clients
      socket.broadcast.emit('wheel:playerBet', bet);

      // Generate a unique game ID
      const gameId = crypto.randomUUID();

      // Use BalanceService to record the bet transaction
      await BalanceService.placeBet(userId, betAmount, 'wheel', {
        difficulty,
        wheelSessionId: gameId
      });

      // Log bet placed
      LoggingService.logBetPlaced('wheel', gameId, userId, betAmount, {
        difficulty,
        timestamp: new Date()
      });

      // Get wheel segments for the selected difficulty
      const segments = getWheelSegments(difficulty);

      // Generate a cryptographically secure wheel result
      const result = generateWheelResult(segments);

      // Calculate winnings
      const winAmount = betAmount * result.multiplier;
      const profit = winAmount - betAmount;

      // Add winnings to balance
      session.balance += winAmount;

      // Use BalanceService to record the win transaction
      if (winAmount > 0) {
        await BalanceService.recordWin(userId, betAmount, winAmount, 'wheel', {
          difficulty,
          multiplier: result.multiplier,
          segmentIndex: result.segmentIndex,
          profit
        });
      }

      // Create game result
      const gameResult = {
        id: gameId,
        userId,
        timestamp: new Date(),
        betAmount,
        difficulty,
        segmentIndex: result.segmentIndex,
        multiplier: result.multiplier,
        color: result.color,
        winAmount,
        profit
      };

      // Log game result
      LoggingService.logBetResult(
        'wheel',
        gameId,
        userId,
        betAmount,
        winAmount,
        profit >= 0, // true if win, false if loss
        {
          multiplier: result.multiplier,
          segmentIndex: result.segmentIndex,
          color: result.color,
          difficulty,
          timestamp: new Date()
        }
      );

      // Add to history (capped)
      gameHistory.push(gameResult);
      if (gameHistory.length > MAX_HISTORY) gameHistory.splice(0, gameHistory.length - MAX_HISTORY);
      session.history.push(gameResult);
      if (session.history.length > MAX_HISTORY) session.history.splice(0, session.history.length - MAX_HISTORY);
      currentBets.length = 0;

      // Calculate target angle for animation
      const segmentAngle = 360 / segments.length;
      const baseRotation = 270; // Arrow at top is 270 degrees
      const targetAngle = baseRotation - (result.segmentIndex * segmentAngle);
      const randomOffset = Math.random() * (segmentAngle * 0.6) - (segmentAngle * 0.3);
      const fullRotations = 4 * 360; // 4 full rotations
      const finalAngle = targetAngle + randomOffset + fullRotations;

      // Send result to client
      const response = {
        success: true,
        gameId: gameResult.id,
        targetAngle: finalAngle,
        segmentIndex: result.segmentIndex,
        multiplier: result.multiplier,
        winAmount,
        profit,
        balance: session.balance
      };

      if (callback) callback(response);

      // Broadcast to room that a new game happened (for real-time updates)
      socket.to('wheel').emit('wheel:game_result', {
        userId,
        betAmount,
        multiplier: result.multiplier,
        profit
      });

    } catch (error) {
      LoggingService.logGameEvent('wheel', 'error_place_bet', { error: error.message, userId });
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * Handle getting game history
   */
  socket.on('wheel:get_history', async (data, callback) => {
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
      LoggingService.logGameEvent('wheel', 'error_get_history', { error: error.message, userId });
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * Handle user leaving the game
   */
  socket.on('wheel:leave', () => {
    socket.leave('wheel');
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

    // Remove from active players for multiplayer tracking
    if (activePlayers.has(userId)) {
      const playerLeftInfo = activePlayers.get(userId);
      activePlayers.delete(userId);

      // Broadcast to other clients that a player has left
      socket.broadcast.emit('wheel:playerLeft', {
        id: userId,
        username: playerLeftInfo.username
      });

      LoggingService.logGameEvent('wheel', 'player_left', { userId, username: playerLeftInfo.username });
    }

    // Remove from connected users
    connectedUsers.delete(userId);
  });
}

export default initWheelHandlers;
export { initWheelHandlers };
