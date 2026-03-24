// @ts-nocheck
/**
 * Wheel Game Socket Handler
 * Handles all socket.io events for the Wheel of Fortune game
 */
const balanceService = require('../services/balanceService');
const loggingService = require('../services/loggingService');

// Store active game sessions
const activeSessions = new Map();

// Store game history (in-memory for now, would be DB in production)
const gameHistory = [];

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
 * Generate a cryptographically fair wheel result
 * @param {String} serverSeed - Server generated seed for fairness
 * @param {Array<Object>} segments - Array of wheel segments
 * @returns {Object} - Selected segment and additional result data
 */
const generateWheelResult = (serverSeed = '', segments) => {
  // In a real implementation, this would use a cryptographic hash function
  // Here we're using a simplified approach for demonstration
  
  // Create a deterministic but seemingly random value from the seeds
  const seedString = `${serverSeed}-${Date.now()}`;
  let hash = 0;
  
  for (let i = 0; i < seedString.length; i++) {
    const char = seedString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Use the hash to select a segment
  const index = Math.abs(hash) % segments.length;
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
  // Extract user info from socket handshake auth or fallback to defaults
  const auth = socket.handshake.auth || {};
  const userId = auth.userId || user?._id || socket.id;
  const username = auth.username || user?.username || `Player_${userId.substring(0, 5)}`;
  const avatar = auth.avatar || user?.avatar || null;
  
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
    loggingService.logGameEvent('wheel', 'session_start', {
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
      console.error('Error joining Wheel game:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * Handle placing a bet and spinning the wheel
   */
  socket.on('wheel:place_bet', async (data, callback) => {
    try {
      // Validate bet data
      const { betAmount, difficulty = 'medium' } = data;
      
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
      
      // Create bet object with player info
      const betId = `bet_${Date.now()}_${userId}`;
      const playerInfo = activePlayers.get(userId);
      const bet = {
        id: betId,
        userId,
        username: playerInfo.username,
        avatar: playerInfo.avatar,
        betAmount,
        difficulty,
        timestamp: new Date()
      };
      
      // Add to current bets
      currentBets.push(bet);
      
      // Broadcast the bet to all clients
      socket.broadcast.emit('wheel:playerBet', bet);
      
      // Generate a unique game ID
      const gameId = Date.now().toString();
      
      // Use balanceService to record the bet transaction
      await balanceService.placeBet(userId, betAmount, 'wheel', {
        difficulty,
        wheelSessionId: gameId
      });
      
      // Log bet placed
      loggingService.logBetPlaced('wheel', gameId, userId, betAmount, {
        difficulty,
        timestamp: new Date()
      });
      
      // Get wheel segments for the selected difficulty
      const segments = getWheelSegments(difficulty);
      
      // Generate a random but fair wheel result
      const serverSeed = Math.random().toString(36).substring(2, 15);
      const result = generateWheelResult(serverSeed, segments);
      
      // Calculate winnings
      const winAmount = betAmount * result.multiplier;
      const profit = winAmount - betAmount;
      
      // Add winnings to balance
      session.balance += winAmount;
      
      // Use balanceService to record the win transaction
      if (winAmount > 0) {
        await balanceService.recordWin(userId, betAmount, winAmount, 'wheel', {
          difficulty,
          multiplier: result.multiplier,
          segmentIndex: result.segmentIndex,
          profit
        });
      }
      
      // Create game result
      const gameResult = {
        id: gameId, // Use the same gameId we generated earlier
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
      loggingService.logBetResult(
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
      
      // Add to history
      gameHistory.push(gameResult);
      session.history.push(gameResult);
      
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
      console.error('Error spinning wheel:', error);
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
      console.error('Error getting Wheel history:', error);
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
      const playerInfo = activePlayers.get(userId);
      activePlayers.delete(userId);
      
      // Broadcast to other clients that a player has left
      socket.broadcast.emit('wheel:playerLeft', { 
        id: userId,
        username: playerInfo.username
      });
      
      console.log(`Wheel: Player left - ${playerInfo.username} (${userId})`);
    }
    
    // Remove from connected users
    connectedUsers.delete(userId);
  });
}

module.exports = {
  initWheelHandlers
};