/**
 * Crash game socket handler
 * This module handles the Crash game socket events and integrates with the balanceService
 * for centralized balance management across the casino.
 * 
 * Multiplayer features:
 * - Single shared game state for all connected users
 * - Real-time player bet and cashout broadcasting
 * - Active player tracking and presence management
 */
 import BalanceService from '../services/balanceService.js';
 import LoggingService from '../services/loggingService.js';
 import { calculateHouseEdge } from '../utils/gameUtils.js';

 export default function(namespace) {
   const gameState = {
     isGameRunning: false,
     isGameStarting: false,
     currentMultiplier: 1,
     crashPoint: null,
     startTime: null,
     tickInterval: null,
     gameId: null
   };

  // Store active bets by user
  const activeBets = new Map();
 
  // Store user connections with additional player info
  const connectedUsers = new Map();
 
  // Track active players in the room
  const activePlayers = new Map();
 
  // Game history
  const gameHistory = [];
 
  // Connect socket handlers
  namespace.on('connection', (socket) => {
    LoggingService.logSystemEvent('crash_namespace_connection', { socketId: socket.id });
    
    // Get authenticated user from socket
    const user = (socket as any).user;
    if (!user) {
      LoggingService.logSystemEvent('unauthenticated_crash_socket', { socketId: socket.id }, 'warning');
      socket.disconnect();
      return;
    }
    
    const userId = user.userId;
    const username = user.username;
    const avatar = null; // Could be added to user model if needed
    
    // Store user connection with player info
    connectedUsers.set(userId, { 
      socket, 
      balance: user.balance, // Use actual balance from authenticated user
      username,
      avatar
    });
    
    // Add to active players list
    activePlayers.set(userId, {
      id: userId,
      username,
      avatar,
      joinedAt: Date.now()
    });
    
    // Send initial game state
    socket.emit('gameState', {
      isGameRunning: gameState.isGameRunning,
      isGameStarting: gameState.isGameStarting,
      currentMultiplier: gameState.currentMultiplier,
      timeUntilStart: gameState.startTime ? (gameState.startTime - Date.now()) / 1000 : null
    });
    
    // Send game history
    socket.emit('gameHistory', gameHistory.slice(-10));
    
    // Send current active bets from all players
    const currentBets = Array.from(activeBets.entries()).map(([betUserId, bet]) => {
      const player = activePlayers.get(betUserId) || { username: 'Unknown', avatar: null };
      return {
        userId: betUserId,
        username: player.username,
        avatar: player.avatar,
        amount: bet.amount,
        autoCashoutAt: bet.autoCashoutAt,
        cashedOut: bet.cashedOut,
        cashedOutAt: bet.cashedOutAt,
        profit: bet.profit
      };
    });
    
    socket.emit('currentBets', currentBets);
    
    // Send active players list
    const playersList = Array.from(activePlayers.values());
    socket.emit('activePlayers', playersList);
    
    // Broadcast new player joined to all other clients
    socket.broadcast.emit('playerJoined', {
      id: userId,
      username,
      avatar
    });
    
    /**
     * Handle placing bet
     */
    socket.on('placeBet', async (data, callback) => {
      try {
        // Verify user is still authenticated
        const authenticatedUser = (socket as any).user;
        if (!authenticatedUser) {
          callback({ success: false, message: 'Authentication required' });
          return;
        }

        const { amount, autoCashoutAt } = data;
        
        // Validate bet
        if (!amount || amount <= 0) {
          return callback({ success: false, error: 'Invalid bet amount' });
        }
        
        if (gameState.isGameRunning) {
          return callback({ success: false, error: 'Cannot bet while game is running' });
        }
        
        if (activeBets.has(userId)) {
          return callback({ success: false, error: 'You already have an active bet' });
        }
        
        // Check user balance
        try {
          // In production, get the real user balance from database
          const userBalance = await BalanceService.getBalance(userId);
          
          if (amount > userBalance) {
            return callback({ success: false, error: 'Insufficient balance' });
          }
        } catch (error) {
          console.error('Error checking user balance:', error);
          return callback({ success: false, error: 'Could not verify balance' });
        }
        
        // Use balanceService to record the bet transaction
        try {
          await BalanceService.placeBet(userId, amount, 'crash', {
            autoCashoutAt,
            gameId: gameState.gameId || `game_${Date.now()}`
          });
        } catch (error) {
          console.error('Error recording bet transaction:', error);
          return callback({ success: false, error: 'Failed to place bet' });
        }
        
        // Record the bet
        activeBets.set(userId, {
          amount,
          autoCashoutAt,
          userId,
          cashedOut: false,
          cashedOutAt: null,
          profit: 0
        });
        
        // Log bet placed
        LoggingService.logBetPlaced('crash', gameState.gameId, userId, amount, {
          autoCashoutAt,
          timestamp: new Date()
        });
        
        // Get player info for the broadcast
        const playerInfo = activePlayers.get(userId) || { username: 'Unknown', avatar: null };
        
        // Notify everyone about the new bet with player details
        namespace.emit('playerBet', {
          userId,
          username: playerInfo.username,
          avatar: playerInfo.avatar,
          amount,
          autoCashoutAt
        });
        
        // Return success to client
        callback({
          success: true,
          message: 'Bet placed successfully'
        });
      } catch (error) {
        console.error('Error in placeBet:', error);
        callback({ success: false, error: 'Server error' });
      }
    });
    
    /**
     * Handle manual cashout
     */
    socket.on('cashOut', async (data, callback) => {
      try {
        // Verify user is still authenticated
        const authenticatedUser = (socket as any).user;
        if (!authenticatedUser) {
          callback({ success: false, message: 'Authentication required' });
          return;
        }
        
        if (!gameState.isGameRunning) {
          return callback({ success: false, error: 'Game is not running' });
        }
        
        const userId = authenticatedUser.userId;
        const bet = activeBets.get(userId);
        if (!bet) {
          return callback({ success: false, error: 'No active bet found' });
        }
        
        if (bet.cashedOut) {
          return callback({ success: false, error: 'Already cashed out' });
        }
        
        // Process cashout
        const cashoutMultiplier = gameState.currentMultiplier;
        const winAmount = bet.amount * cashoutMultiplier;
        const profit = winAmount - bet.amount;
        
        // Update bet record
        bet.cashedOut = true;
        bet.cashedOutAt = cashoutMultiplier;
        bet.profit = profit;
        activeBets.set(userId, bet);
        
        // Use balanceService to record the win
        try {
          await BalanceService.recordWin(userId, bet.amount, winAmount, 'crash', {
            multiplier: cashoutMultiplier,
            profit,
            gameId: gameState.gameId
          });
        } catch (error) {
          console.error('Error recording win transaction:', error);
          return callback({ success: false, error: 'Failed to process cashout' });
        }
        
        // Log cash out win
        LoggingService.logBetResult('crash', gameState.gameId, userId, bet.amount, winAmount, true, {
          multiplier: cashoutMultiplier,
          method: 'manual_cashout'
        });

        // Get player info for the broadcast
        const playerInfo = activePlayers.get(userId) || { username: 'Unknown', avatar: null };
        
        // Notify everyone about the cashout with player details
        namespace.emit('playerCashout', {
          userId,
          username: playerInfo.username,
          avatar: playerInfo.avatar,
          multiplier: cashoutMultiplier,
          profit,
          amount: bet.amount
        });
        
        // Return success to client
        callback({
          success: true,
          multiplier: cashoutMultiplier,
          winAmount,
          profit
        });
      } catch (error) {
        console.error('Error in cashOut:', error);
        callback({ success: false, error: 'Server error' });
      }
     * Handle disconnection
     */
    socket.on('disconnect', () => {
      LoggingService.logSystemEvent('crash_namespace_disconnection', { socketId: socket.id });
      
      // Remove from connected users
      connectedUsers.delete(userId);
      
      // Remove from active players and notify others
{{ ... }
    // Generate a provably fair crash point
    // In a real implementation, this would use verifiable random algorithms
    const houseEdge = calculateHouseEdge('crash');
    gameState.crashPoint = generateCrashPoint(houseEdge);
    
    LoggingService.logGameEvent('crash', 'game_seeded', { crashPoint: gameState.crashPoint });
    
    // Log game starting
    LoggingService.logGameStart('crash', gameState.gameId, {
      crashPoint: gameState.crashPoint,
      houseEdge,
{{ ... }
            multiplier: cashoutMultiplier,
            profit,
            gameId: gameState.gameId,
            autoCashout: true
          });
        } catch (error) {
          LoggingService.logSystemEvent('crash_auto_cashout_record_error', { error: String(error) }, 'error');
        }
        
        // Get player info for the broadcast
        const playerInfo = activePlayers.get(userId) || { username: 'Unknown', avatar: null };
        
        // Notify everyone about the cashout with player details
{{ ... }
    if (gameHistory.length > 50) {
      gameHistory.shift(); // Keep last 50 games
    }
    
    // Log game ended
    LoggingService.logGameEnd('crash', gameState.gameId, {
      finalMultiplier: gameState.currentMultiplier,
      gameLength: (Date.now() - gameState.startTime) / 1000
    }, {
      crashPoint: gameState.crashPoint
    });
    
    // Notify clients of crash
    namespace.emit('gameCrashed', {
      crashPoint: gameState.crashPoint,
      nextGameIn: 3 // Start next game in 3 seconds
{{ ... }
    
    // Process lost bets
    processLostBets();
    
    // Start a new game after delay
    setTimeout(() => {
      startGame();
    }, 3000);
  }
  
  /**
   * Process all bets that didn't cash out
   */
  function processLostBets() {
    // Identify and record all lost bets
    for (const [userId, bet] of activeBets.entries()) {
      if (!bet.cashedOut) {
        // Log the lost bet
        LoggingService.logBetResult('crash', gameState.gameId, userId, bet.amount, 0, false, {
          crashPoint: gameState.crashPoint,
          timestamp: new Date()
        });

        // Notify player of loss
        const userConnection = connectedUsers.get(userId);
        if (userConnection && userConnection.socket) {
          userConnection.socket.emit('betLost', {
            amount: bet.amount,
            gameId: gameState.gameId
          });
        }
      }
    }
    
    // Clear all active bets for the next game
    activeBets.clear();
  }
  
  /**
   * Generate a crash point with house edge
   * @param {Number} houseEdge - House edge percentage
   * @returns {Number} - Crash point value
   */
  function generateCrashPoint(houseEdge) {
    // Base algorithm for crash point (simplified)
    // A more sophisticated implementation would use provably fair algorithms
    const edge = 1 - houseEdge;
    
    // Generate a random value between 0 and 1
    const r = Math.random();
    
    // Apply mathematical formula to create house edge
    // This is a simplified version; real casinos use more complex formulas
    if (r < houseEdge) {
      // House edge forces early crash (with 1-5x multiplier)
      return 1 + (Math.random() * 4);
    } else {
      // Normal distribution centered around 2x with variance
      // This creates a bell curve with most values between 1.5x and 10x
      // but still allows for rare high multipliers
      const variance = Math.random() * Math.random() * 20; // Higher variance for occasional big crashes
      return 1 + variance;
    }
  }
  
  // Log service initialization
  LoggingService.logGameEvent('crash', 'service_initialized', {
    timestamp: new Date()
  });
  
  // Start first game immediately
  startGame();
  
  // Return methods for external interactions
  return {
    getGameState: () => ({ ...gameState }),
    getGameHistory: () => [...gameHistory]
  };
};