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

// Use ES6 imports to avoid variable conflicts
import BalanceService from '../services/balanceService.js';
import LoggingService from '../services/loggingService.js';
import { calculateHouseEdge } from '../utils/gameUtils.js';
import { validateSocketData, crashPlaceBetSchema } from '../validation/schemas.js';
import crypto from 'crypto';

/** Safely invoke a socket acknowledgement callback — if the client did not
 *  supply one (or the connection was severed), this prevents the server from
 *  crashing with "callback is not a function". */
function safeCallback(cb: unknown, payload: Record<string, unknown>) {
  if (typeof cb === 'function') {
    cb(payload);
  }
}

// Namespace crash-specific variables to avoid conflicts
// Configurable timing constants (overridable via env vars for integration tests)
const CRASH_COUNTDOWN_MS = parseInt(process.env.CRASH_COUNTDOWN_MS || '5000');
const CRASH_NEXT_GAME_MS = parseInt(process.env.CRASH_NEXT_GAME_MS || '3000');

const crashGame = {
  activeSessions: new Map(),
  gameHistory: [],
  gameState: {
    status: 'waiting', // 'waiting', 'countdown', 'flying', 'crashed'
    players: new Map(), // Map of playerId -> player data
    bets: new Map(), // Map of playerId -> bet data  
    currentMultiplier: 1,
    gameId: null,
    crashPoint: null,
    startTime: null,
    tickInterval: null
  }
};

/**
 * Initialize Crash game socket handlers
 * @param {Object} namespace - Socket.IO namespace
 */
export default function initCrashHandlers(namespace) {
  // Store game state
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
    LoggingService.logGameEvent('crash', 'client_connected', { socketId: socket.id });
    
    // Get authenticated user from socket
    const user = (socket as any).user;
    if (!user) {
      LoggingService.logSystemEvent('unauthenticated_user', { handler: 'crash' }, 'warning');
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
          safeCallback(callback, { success: false, message: 'Authentication required' });
          return;
        }

        // Validate input with Zod
        const validated = validateSocketData(crashPlaceBetSchema, data);
        const { amount, autoCashoutAt } = validated;

        if (gameState.isGameRunning) {
          return safeCallback(callback, { success: false, error: 'Cannot bet while game is running' });
        }

        if (activeBets.has(userId)) {
          return safeCallback(callback, { success: false, error: 'You already have an active bet' });
        }

        // Check user balance
        try {
          // In production, get the real user balance from database
          const userBalance = await BalanceService.getBalance(userId);

          if (amount > userBalance) {
            return safeCallback(callback, { success: false, error: 'Insufficient balance' });
          }
        } catch (error) {
          LoggingService.logGameEvent('crash', 'error_checking_balance', { error: String(error), userId });
          return safeCallback(callback, { success: false, error: 'Could not verify balance' });
        }

        // Use balanceService to record the bet transaction
        try {
          await BalanceService.placeBet(userId, amount, 'crash', {
            autoCashoutAt,
            gameId: gameState.gameId || `game_${Date.now()}`
          });
          // Emit balance update to the player
          const newBalance = await BalanceService.getBalance(userId);
          socket.emit('balanceUpdate', { balance: newBalance });
        } catch (error) {
          LoggingService.logGameEvent('crash', 'error_recording_bet', { error: String(error), userId });
          return safeCallback(callback, { success: false, error: 'Failed to place bet' });
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
        safeCallback(callback, {
          success: true,
          message: 'Bet placed successfully'
        });
      } catch (error) {
        LoggingService.logGameEvent('crash', 'error_place_bet', { error: String(error), userId });
        safeCallback(callback, { success: false, error: 'Server error' });
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
          safeCallback(callback, { success: false, message: 'Authentication required' });
          return;
        }

        if (!gameState.isGameRunning) {
          return safeCallback(callback, { success: false, error: 'Game is not running' });
        }

        const userId = authenticatedUser.userId;
        const bet = activeBets.get(userId);
        if (!bet) {
          return safeCallback(callback, { success: false, error: 'No active bet found' });
        }

        if (bet.cashedOut) {
          return safeCallback(callback, { success: false, error: 'Already cashed out' });
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
          // Emit balance update to the player
          const newBalance = await BalanceService.getBalance(userId);
          socket.emit('balanceUpdate', { balance: newBalance });
        } catch (error) {
          LoggingService.logGameEvent('crash', 'error_recording_win', { error: String(error), userId });
          return safeCallback(callback, { success: false, error: 'Failed to process cashout' });
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
        safeCallback(callback, {
          success: true,
          multiplier: cashoutMultiplier,
          winAmount,
          profit
        });
      } catch (error) {
        LoggingService.logGameEvent('crash', 'error_cashout', { error: String(error), userId });
        safeCallback(callback, { success: false, error: 'Server error' });
      }
    });
    
    /**
     * Handle disconnection
     */
    socket.on('disconnect', () => {
      LoggingService.logGameEvent('crash', 'client_disconnected', { socketId: socket.id, userId });
      
      // Remove from connected users
      connectedUsers.delete(userId);
      
      // Remove from active players and notify others
      if (activePlayers.has(userId)) {
        const playerInfo = activePlayers.get(userId);
        activePlayers.delete(userId);
        
        // Broadcast player left to all remaining clients
        namespace.emit('playerLeft', {
          id: userId,
          username: playerInfo.username
        });
      }
    });
  });
  
  /**
   * Start a new game cycle
   */
  function startGame() {
    if (gameState.isGameRunning || gameState.isGameStarting) {
      return;
    }
    
    // Mark game as starting soon
    gameState.isGameStarting = true;
    gameState.gameId = `game_${Date.now()}`;
    
    // Generate a provably fair crash point
    // In a real implementation, this would use verifiable random algorithms
    const houseEdge = calculateHouseEdge('crash');
    gameState.crashPoint = generateCrashPoint(houseEdge);
    
    // Log game starting (do NOT log crash point to avoid game integrity issues)
    LoggingService.logGameStart('crash', gameState.gameId, {
      houseEdge,
      startTime: new Date()
    });
    
    // Notify clients game is starting soon
    namespace.emit('gameStarting', {
      gameId: gameState.gameId,
      startingIn: CRASH_COUNTDOWN_MS / 1000 // Start in N seconds
    });

    // Set the start time to N seconds in the future
    gameState.startTime = Date.now() + CRASH_COUNTDOWN_MS;

    // Start the game after countdown
    setTimeout(() => {
      if (!gameState.isGameStarting) return; // Safety check
      
      // Start the game
      gameState.isGameStarting = false;
      gameState.isGameRunning = true;
      gameState.currentMultiplier = 1.0;
      gameState.startTime = Date.now();
      
      // Notify clients game has started
      namespace.emit('gameStarted', {
        gameId: gameState.gameId
      });
      
      // Start ticking the multiplier
      gameState.tickInterval = setInterval(() => tickGame(), 100);
    }, CRASH_COUNTDOWN_MS);
  }
  
  /**
   * Update the game state on each tick
   */
  function tickGame() {
    if (!gameState.isGameRunning) return;
    
    // Calculate elapsed time
    const elapsed = (Date.now() - gameState.startTime) / 1000;
    
    // Calculate new multiplier (exponential growth function)
    // This formula can be adjusted for game balance
    gameState.currentMultiplier = Math.pow(Math.E, 0.06 * elapsed);
    
    // Cap multiplier at 50x — force crash if reached
    if (gameState.currentMultiplier >= 50) {
      gameState.currentMultiplier = 50;
      gameOver();
      return;
    }

    // Check for auto-cashouts (async, catch errors to prevent crashing the server)
    processAutoCashouts().catch(err => {
      LoggingService.logSystemEvent('crash_auto_cashout_error', { error: String(err) }, 'error');
    });

    // Check if game should crash
    if (gameState.currentMultiplier >= gameState.crashPoint) {
      gameOver();
      return;
    }
    
    // Notify clients of new multiplier
    namespace.emit('multiplierUpdate', {
      multiplier: gameState.currentMultiplier
    });
  }
  
  /**
   * Process automatic cashouts
   */
  async function processAutoCashouts() {
    // Check all active bets for auto cashout
    for (const [userId, bet] of activeBets.entries()) {
      if (bet.cashedOut) continue;
      
      if (bet.autoCashoutAt && gameState.currentMultiplier >= bet.autoCashoutAt) {
        // Process auto-cashout
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
            gameId: gameState.gameId,
            autoCashout: true
          });
          // Emit balance update to the player
          const userConnection2 = connectedUsers.get(userId);
          if (userConnection2?.socket) {
            const newBal = await BalanceService.getBalance(userId);
            userConnection2.socket.emit('balanceUpdate', { balance: newBal });
          }
        } catch (error) {
          LoggingService.logGameEvent('crash', 'error_auto_cashout', { error: String(error), userId });
        }
        
        // Get player info for the broadcast
        const playerInfo = activePlayers.get(userId) || { username: 'Unknown', avatar: null };
        
        // Notify everyone about the cashout with player details
        namespace.emit('playerCashout', {
          userId,
          username: playerInfo.username,
          avatar: playerInfo.avatar,
          multiplier: cashoutMultiplier,
          profit,
          amount: bet.amount,
          automatic: true
        });
        
        // Notify the specific user
        const userConnection = connectedUsers.get(userId);
        if (userConnection && userConnection.socket) {
          userConnection.socket.emit('autoCashoutSuccess', {
            multiplier: cashoutMultiplier,
            winAmount,
            profit
          });
        }
      }
    }
  }
  
  /**
   * End the current game
   */
  function gameOver() {
    if (!gameState.isGameRunning) return;
    
    // Stop the tick interval
    clearInterval(gameState.tickInterval);
    
    // Update game state
    gameState.isGameRunning = false;
    gameState.isGameStarting = false; // Safety reset to prevent startGame guard from blocking

    // Record game in history
    const gameResult = {
      gameId: gameState.gameId,
      crashPoint: gameState.crashPoint,
      timestamp: Date.now()
    };
    
    gameHistory.push(gameResult);
    if (gameHistory.length > 50) {
      gameHistory.shift(); // Keep last 50 games
    }
    
    // Log game ended
    LoggingService.logGameEnd('crash', gameState.gameId, {
      finalMultiplier: gameState.currentMultiplier,
      gameLength: (Date.now() - gameState.startTime) / 1000,
      crashPoint: gameState.crashPoint
    });
    
    // Notify clients of crash
    namespace.emit('gameCrashed', {
      crashPoint: gameState.crashPoint,
      nextGameIn: CRASH_NEXT_GAME_MS / 1000 // Start next game in N seconds
    });

    // Process lost bets — wrapped in try-catch so the next game always starts
    try {
      processLostBets();
    } catch (err) {
      LoggingService.logSystemEvent('crash_process_lost_bets_error', { error: String(err) }, 'error');
    }

    // Start a new game after delay — always schedule regardless of errors above
    setTimeout(() => {
      startGame();
    }, CRASH_NEXT_GAME_MS);
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
  function generateCrashPoint(houseEdge: number): number {
    // Generate cryptographically secure random in [0, 1)
    const r = crypto.randomBytes(4).readUInt32BE(0) / 0x100000000;

    // With probability = houseEdge, crash at 1.00x (instant crash)
    if (r < houseEdge) {
      return 1.0;
    }

    // Otherwise crashPoint = (1 - houseEdge) / (1 - r)
    // This gives exactly `houseEdge` house edge at any cashout target.
    const crashPoint = (1 - houseEdge) / (1 - r);

    // Cap at 50x max payout, floor to 2 decimal places
    return Math.min(50, Math.max(1.0, Math.floor(crashPoint * 100) / 100));
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