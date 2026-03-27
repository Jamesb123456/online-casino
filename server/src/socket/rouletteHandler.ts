/**
 * Roulette Game Socket Handler
 * Handles all socket.io events for the Roulette game
 * Implements multiplayer functionality with shared game state
 */
import BalanceService from '../services/balanceService.js';
import LoggingService from '../services/loggingService.js';
import crypto from 'crypto';

// Store active game sessions
const activeSessions = new Map();

// Store connected users with their socket and balance
const connectedUsers = new Map();

// Store active players with their details (for multiplayer)
const activePlayers = new Map();

// Store game history (in-memory for now, would be DB in production)
const gameHistory = [];

// Store current active bets from all players
const currentBets = [];

/**
 * Standard roulette numbers and their configurations
 * For European roulette (single zero)
 */
const ROULETTE_NUMBERS = [
  { number: 0, color: 'green' },
  { number: 32, color: 'red' },
  { number: 15, color: 'black' },
  { number: 19, color: 'red' },
  { number: 4, color: 'black' },
  { number: 21, color: 'red' },
  { number: 2, color: 'black' },
  { number: 25, color: 'red' },
  { number: 17, color: 'black' },
  { number: 34, color: 'red' },
  { number: 6, color: 'black' },
  { number: 27, color: 'red' },
  { number: 13, color: 'black' },
  { number: 36, color: 'red' },
  { number: 11, color: 'black' },
  { number: 30, color: 'red' },
  { number: 8, color: 'black' },
  { number: 23, color: 'red' },
  { number: 10, color: 'black' },
  { number: 5, color: 'red' },
  { number: 24, color: 'black' },
  { number: 16, color: 'red' },
  { number: 33, color: 'black' },
  { number: 1, color: 'red' },
  { number: 20, color: 'black' },
  { number: 14, color: 'red' },
  { number: 31, color: 'black' },
  { number: 9, color: 'red' },
  { number: 22, color: 'black' },
  { number: 18, color: 'red' },
  { number: 29, color: 'black' },
  { number: 7, color: 'red' },
  { number: 28, color: 'black' },
  { number: 12, color: 'red' },
  { number: 35, color: 'black' },
  { number: 3, color: 'red' },
  { number: 26, color: 'black' }
];

/**
 * Betting options for roulette
 */
const BET_TYPES = {
  STRAIGHT: { name: 'Straight Up', payout: 35 },
  SPLIT: { name: 'Split', payout: 17 },
  STREET: { name: 'Street', payout: 11 },
  CORNER: { name: 'Corner', payout: 8 },
  FIVE: { name: 'Five', payout: 6 },
  LINE: { name: 'Line', payout: 5 },
  COLUMN: { name: 'Column', payout: 2 },
  DOZEN: { name: 'Dozen', payout: 2 },
  RED: { name: 'Red', payout: 1 },
  BLACK: { name: 'Black', payout: 1 },
  ODD: { name: 'Odd', payout: 1 },
  EVEN: { name: 'Even', payout: 1 },
  LOW: { name: 'Low', payout: 1 },
  HIGH: { name: 'High', payout: 1 }
};

/**
 * Get all numbers for a specific bet type
 * @param {String} betType - Type of bet from BET_TYPES
 * @param {Number|String} value - Value associated with bet (e.g., number for STRAIGHT)
 * @returns {Array<Number>} - Array of numbers included in this bet
 */
const getBetNumbers = (betType, value) => {
  switch(betType) {
    case 'STRAIGHT':
      return [parseInt(value)];
    
    case 'RED':
      return ROULETTE_NUMBERS
        .filter(num => num.color === 'red')
        .map(num => num.number);
    
    case 'BLACK':
      return ROULETTE_NUMBERS
        .filter(num => num.color === 'black')
        .map(num => num.number);
    
    case 'ODD':
      return ROULETTE_NUMBERS
        .filter(num => num.number > 0 && num.number % 2 === 1)
        .map(num => num.number);
    
    case 'EVEN':
      return ROULETTE_NUMBERS
        .filter(num => num.number > 0 && num.number % 2 === 0)
        .map(num => num.number);
    
    case 'LOW':
      return Array.from({ length: 18 }, (_, i) => i + 1);
    
    case 'HIGH':
      return Array.from({ length: 18 }, (_, i) => i + 19);
    
    case 'DOZEN':
      const dozenStart = parseInt(value) * 12 - 11;
      return Array.from({ length: 12 }, (_, i) => i + dozenStart);
    
    case 'COLUMN':
      // Column 1: 1, 4, 7, ..., 34
      // Column 2: 2, 5, 8, ..., 35
      // Column 3: 3, 6, 9, ..., 36
      const col = parseInt(value);
      return Array.from({ length: 12 }, (_, i) => i * 3 + col);
    
    default:
      return [];
  }
};

/**
 * Check if a bet wins based on the winning number
 * @param {String} betType - Type of bet
 * @param {Number|String} betValue - Value of the bet
 * @param {Number} winningNumber - The winning roulette number
 * @returns {Boolean} - True if bet wins, false otherwise
 */
const isBetWinner = (betType, betValue, winningNumber) => {
  const winningNumbers = getBetNumbers(betType, betValue);
  return winningNumbers.includes(winningNumber);
};

/**
 * Calculate winning amount based on bet type and amount
 * @param {String} betType - Type of bet from BET_TYPES
 * @param {Number} betAmount - Amount bet
 * @param {Boolean} isWinner - Whether the bet wins
 * @returns {Number} - Winning amount (0 if bet loses)
 */
const calculateWinnings = (betType, betAmount, isWinner) => {
  if (!isWinner) return 0;
  
  const { payout } = BET_TYPES[betType] || { payout: 0 };
  return betAmount * (payout + 1); // Return original bet + winnings
};

/**
 * Generate a random roulette spin result
 * Uses a provably fair algorithm (simplified for demo)
 * 
 * @param {String} serverSeed - Server generated seed for fairness
 * @returns {Object} - Result with winning number and color
 */
const generateSpinResult = () => {
  // Use cryptographically secure random number for game-critical result
  const index = crypto.randomInt(ROULETTE_NUMBERS.length);
  const result = ROULETTE_NUMBERS[index];

  return {
    number: result.number,
    color: result.color,
    index: index,
    timestamp: new Date()
  };
};

/**
 * Calculate the rotation angle for the roulette wheel
 * @param {Number} index - Index of the winning pocket in ROULETTE_NUMBERS array
 * @returns {Object} - Rotation angles for different phases of the spin
 */
const calculateRotationAngles = (index) => {
  // Base rotation 
  const baseRotation = 0;
  
  // Calculate pocket angle
  const pocketAngle = 360 / ROULETTE_NUMBERS.length;
  
  // Target angle for the pocket (plus some random offset to make it look natural)
  const targetAngle = baseRotation + (index * pocketAngle);
  
  // Add random offset within the pocket (to make it look more natural)
  const randomOffset = Math.random() * (pocketAngle * 0.6) - (pocketAngle * 0.3);
  
  // Calculate different spin phases (multiple full rotations with decreasing speed)
  const phase1Rotations = 10 * 360; // Initial very fast spin (10 rotations)
  const phase2Rotations = 6 * 360;  // Medium speed spin (6 rotations)
  const phase3Rotations = 2 * 360;  // Final slow spin (2 rotations)
  
  // Duration of each phase in milliseconds
  const phaseDurations = {
    phase1: 3000,  // 3 seconds of fast spinning
    phase2: 4000,  // 4 seconds of medium spinning
    phase3: 3000,  // 3 seconds of slow spinning
    total: 10000   // 10 seconds total
  };
  
  // Calculate angles for each phase
  const finalAngle = targetAngle + randomOffset;
  
  return {
    phase1Angle: phase1Rotations,
    phase2Angle: phase2Rotations,
    phase3Angle: phase3Rotations,
    finalAngle: finalAngle,
    durations: phaseDurations
  };
};

/**
 * Initialize Roulette socket handlers
 * @param {Object} io - Socket.io instance
 * @param {Object} socket - Client socket connection
 * @param {Object} user - Authenticated user information
 */
function initRouletteHandlers(io, socket, user) {
  // Read user identity from server-side authenticated user (set by auth middleware)
  const authenticatedUser = (socket as any).user;
  if (!authenticatedUser) {
    socket.emit('roulette:error', { message: 'Authentication required' });
    socket.disconnect();
    return;
  }
  const userId = authenticatedUser.userId;
  const username = authenticatedUser.username;
  const avatar = user?.avatar || null;

  LoggingService.logGameEvent('roulette', 'player_connected', { userId, username });
  
  // Join the roulette namespace/room
  socket.join('roulette');
  
  // Create or get user session
  if (!activeSessions.has(userId)) {
    activeSessions.set(userId, {
      userId,
      balance: user?.balance || 1000, // Demo balance if no user
      history: [],
      currentBets: [],
      isSpinning: false
    });
    
    // Log session initialization
    LoggingService.logGameEvent('roulette', 'session_start', {
      userId,
      initialBalance: user?.balance || 1000,
      timestamp: new Date()
    }, userId);
  }
  
  // Add to connected users
  connectedUsers.set(userId, { socket, balance: user?.balance || 1000, username, avatar });
  
  // Add to active players for multiplayer tracking
  activePlayers.set(userId, { 
    id: userId, 
    username, 
    avatar, 
    joinedAt: Date.now() 
  });
  
  // Emit active players list to the new client
  socket.emit('roulette:activePlayers', Array.from(activePlayers.values()));
  
  // Broadcast to other clients that a new player has joined
  socket.broadcast.emit('roulette:playerJoined', { 
    id: userId, 
    username, 
    avatar, 
    joinedAt: Date.now() 
  });
  
  /**
   * Handle joining the roulette game
   */
  socket.on('roulette:join', async (data, callback) => {
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
      LoggingService.logGameEvent('roulette', 'error_join', { error: (error as any).message, userId });
      if (callback) callback({ success: false, error: (error as any).message });
    }
  });

  /**
   * Handle placing a bet
   */
  socket.on('roulette:place_bet', async (data, callback) => {
    try {
      // Validate bet data
      const { type, value, amount } = data;
      
      if (!type || !BET_TYPES[type]) {
        throw new Error('Invalid bet type');
      }
      
      if (!amount || isNaN(amount) || amount <= 0) {
        throw new Error('Invalid bet amount');
      }
      
      // Get user session
      const session = activeSessions.get(userId);
      
      // Check if user has enough balance
      if (session.balance < amount) {
        throw new Error('Insufficient balance');
      }
      
      // Create bet object with player information
      const bet = {
        id: Date.now().toString(),
        userId,
        username: connectedUsers.get(userId)?.username || 'Unknown Player',
        avatar: connectedUsers.get(userId)?.avatar,
        type,
        value: value || '',
        amount,
        timestamp: new Date()
      };
      
      // Deduct bet amount from balance
      session.balance -= amount;
      
      // Add bet to current bets
      session.currentBets.push(bet);
      
      // Add to global currentBets for multiplayer
      currentBets.push(bet);
      
      // Broadcast bet to all players in the room
      io.to('roulette').emit('roulette:playerBet', bet);
      
      // Use balanceService to record the bet transaction
      await BalanceService.placeBet(userId, amount, 'roulette', {
        betType: type, 
        betValue: value,
        rouletteSessionId: bet.id
      });
      
      // Log bet placement
      LoggingService.logBetPlaced('roulette', bet.id, userId, amount, {
        betType: type,
        betValue: value,
        timestamp: new Date()
      });
      
      // Return response
      const response = {
        success: true,
        betId: bet.id,
        balance: session.balance,
        currentBets: session.currentBets
      };
      
      if (callback) callback(response);
      
    } catch (error) {
      LoggingService.logGameEvent('roulette', 'error_place_bet', { error: (error as any).message, userId });
      if (callback) callback({ success: false, error: (error as any).message });
    }
  });

  /**
   * Handle spinning the wheel
   */
  socket.on('roulette:spin', async (data, callback) => {
    try {
      // Get user session
      const session = activeSessions.get(userId);
      
      // Check if there are any bets
      if (session.currentBets.length === 0) {
        throw new Error('No bets placed');
      }
      
      // Check if already spinning
      if (session.isSpinning) {
        throw new Error('Wheel is already spinning');
      }
      
      // Set spinning state
      session.isSpinning = true;
      
      // Generate spin result but don't reveal it to the client yet
      const result = generateSpinResult();
      
      // Store result in session for later use
      session.pendingResult = result;
      
      // Calculate angles for progressive animation
      const spinAngles = calculateRotationAngles(result.index);
      
      // Process all bets (but don't tell the client the results yet)
      const processedBets = session.currentBets.map(bet => {
        const isWinner = isBetWinner(bet.type, bet.value, result.number);
        const winAmount = calculateWinnings(bet.type, bet.amount, isWinner);
        const profit = isWinner ? (winAmount - bet.amount) : -bet.amount;
        
        return {
          ...bet,
          isWinner,
          winAmount,
          profit
        };
      });
      
      // Store processed bets in session for later use
      session.processedBets = processedBets;
      
      // Calculate total winnings and profit
      const totalWinnings = processedBets.reduce((sum, bet) => sum + (bet.winAmount || 0), 0);
      const totalProfit = processedBets.reduce((sum, bet) => sum + bet.profit, 0);
      
      // Store these in session too
      session.pendingWinnings = totalWinnings;
      session.pendingProfit = totalProfit;
      
      // Create game result ID now
      const gameId = Date.now().toString();
      session.pendingGameId = gameId;
      
      // First, send back just the initial spin data without the result
      // This lets the client start animating the wheel
      const initialResponse = {
        success: true,
        phase: 'start',
        gameId: gameId,
        spinData: {
          phase1Angle: spinAngles.phase1Angle,
          phase2Angle: spinAngles.phase2Angle,  
          phase3Angle: spinAngles.phase3Angle,
          durations: spinAngles.durations
        },
        // Don't include winning number yet!
        message: 'Wheel is spinning...'
      };
      
      // Return initial response to the client
      if (callback) callback(initialResponse);
      
      // Emit to all players that the wheel is spinning
      LoggingService.logGameEvent('roulette', 'spin_started', { userId, gameId });
      io.to('roulette').emit('roulette:spin_started', {
        userId,
        gameId,
        timestamp: new Date(),
        spinData: initialResponse.spinData
      });
      
      // After initial spin phase, reveal the result
      const resultTimeoutMs = spinAngles.durations.total - 1000; // Reveal result 1 second before animation ends
      LoggingService.logGameEvent('roulette', 'spin_result_timeout_set', { userId, resultTimeoutMs });
      
      setTimeout(() => {
        LoggingService.logGameEvent('roulette', 'result_timeout_triggered', { userId });
        
        // Only proceed if session still exists
        if (!activeSessions.has(userId)) {
          LoggingService.logGameEvent('roulette', 'error_session_missing', { userId, phase: 'result' });
          return;
        }
        
        const session = activeSessions.get(userId);
        const result = session.pendingResult;
        const processedBets = session.processedBets;
        const totalWinnings = session.pendingWinnings;
        const totalProfit = session.pendingProfit;
        const gameId = session.pendingGameId;
        
        LoggingService.logGameEvent('roulette', 'spin_data_retrieved', {
          userId,
          winningNumber: result?.number,
          totalWinnings,
          totalProfit,
          betsCount: processedBets?.length
        });
        
        // Add winnings to balance now that the result is revealed
        session.balance += totalWinnings;
        
        // Use balanceService to record win transaction if there are any winnings
        if (totalWinnings > 0) {
          BalanceService.recordWin(userId, 
            processedBets.reduce((sum, bet) => sum + bet.amount, 0), // total bet amount
            totalWinnings, 
            'roulette',
            {
              winningNumber: result.number,
              winningColor: result.color,
              bets: processedBets.map(bet => ({
                type: bet.type,
                value: bet.value,
                amount: bet.amount,
                isWinner: bet.isWinner
              }))
            }
          ).catch(err => LoggingService.logGameEvent('roulette', 'error_recording_win', { error: String(err), userId }));
        }
        
        // Create game result
        const gameResult = {
          id: gameId,
          userId,
          timestamp: new Date(),
          winningNumber: result.number,
          winningColor: result.color,
          bets: processedBets,
          totalBetAmount: processedBets.reduce((sum, bet) => sum + bet.amount, 0),
          totalWinnings,
          totalProfit
        };
        
        // Log game end and results
        LoggingService.logGameEnd('roulette', gameResult.id, {
          winningNumber: result.number,
          winningColor: result.color,
          totalBets: processedBets.length,
          totalBetAmount: processedBets.reduce((sum, bet) => sum + bet.amount, 0),
          totalWinnings,
          profit: totalProfit
        });
        
        // Add to history
        gameHistory.push(gameResult);
        session.history.push(gameResult);
        
        // Clear current bets and the pending result data
        session.currentBets = [];
        session.pendingResult = null;
        session.processedBets = null;
        session.pendingWinnings = null;
        session.pendingProfit = null;
        session.pendingGameId = null;
        
        // Emit the final result to all clients
        const resultData = {
          phase: 'result',
          gameId: gameId,
          winningNumber: result.number,
          winningColor: result.color,
          bets: processedBets,
          totalWinnings,
          totalProfit,
          timestamp: new Date()
        };
        
        LoggingService.logGameEvent('roulette', 'spin_result_emitted', {
          gameId,
          winningNumber: result.number,
          winningColor: result.color,
          totalWinnings,
          totalProfit
        });
        
        io.to('roulette').emit('roulette:spin_result', resultData);
        
        // After all animations are complete, reset spinning state
        setTimeout(() => {
          LoggingService.logGameEvent('roulette', 'round_completion_triggered', { userId });
          
          if (activeSessions.has(userId)) {
            const updatedSession = activeSessions.get(userId);
            updatedSession.isSpinning = false;
            
            // Notify clients that a new round can begin
            LoggingService.logGameEvent('roulette', 'round_complete_emitted', { userId });
            io.to('roulette').emit('roulette:round_complete', {
              message: 'Ready for new bets',
              timestamp: new Date()
            });
          } else {
            LoggingService.logGameEvent('roulette', 'error_session_missing', { userId, phase: 'round_completion' });
          }
        }, 3000); // 3 more seconds after result is shown
        
      }, resultTimeoutMs);
      
    } catch (error) {
      LoggingService.logGameEvent('roulette', 'error_spinning_wheel', { error: (error as any).message, userId });
      if (callback) callback({ success: false, error: (error as any).message });
      
      // Reset spinning state in case of error
      if (activeSessions.has(userId)) {
        const session = activeSessions.get(userId);
        session.isSpinning = false;
      }
    }
  });

  /**
   * Handle getting game history
   */
  socket.on('roulette:get_history', async (data, callback) => {
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
      LoggingService.logGameEvent('roulette', 'error_get_history', { error: (error as any).message, userId });
      if (callback) callback({ success: false, error: (error as any).message });
    }
  });

  /**
   * Handle user leaving the game
   */
  socket.on('roulette:leave', () => {
    // No specific cleanup needed here, general disconnect handler will take care of it
    socket.leave('roulette');
  });

  /**
   * Handle user disconnect
   */
  socket.on('disconnect', () => {
    // Keep user session for reconnection but mark as inactive
    if (activeSessions.has(userId)) {
      const session = activeSessions.get(userId);
      session.isSpinning = false;
    }
    
    // Remove from active players for multiplayer tracking
    if (activePlayers.has(userId)) {
      const playerInfo = activePlayers.get(userId);
      activePlayers.delete(userId);
      
      // Broadcast to other clients that a player has left
      socket.broadcast.emit('roulette:playerLeft', { 
        id: userId,
        username: playerInfo.username
      });
      
      LoggingService.logGameEvent('roulette', 'player_left', { userId, username: playerInfo.username });
    }
    
    // Remove from connected users
    connectedUsers.delete(userId);
  });
}

export default initRouletteHandlers;
export { initRouletteHandlers };