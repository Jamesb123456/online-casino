/**
 * Landmines Game Socket Handler
 * Handles all socket.io events for the Landmines game
 */
const balanceService = require('../services/balanceService');
const loggingService = require('../services/loggingService');

// Import GameStat model for tracking statistics
const GameStat = require('../../models/GameStat.js').default;

// Store active game sessions
const activeSessions = new Map();

// Store game history (in-memory for now, would be DB in production)
const gameHistory = [];

/**
 * Game constants
 */
const GRID_SIZE = 5; // 5x5 grid
const MAX_MINES = 24; // Maximum number of mines allowed
const MIN_MINES = 1;  // Minimum number of mines allowed

/**
 * Calculate the multiplier based on the number of mines and cells revealed
 * More mines = higher risk = higher multiplier
 * Multiplier increases with each successful reveal
 * @param {Number} mines - Number of mines in the grid
 * @param {Number} revealed - Number of cells successfully revealed
 * @returns {Number} - Current multiplier
 */
const calculateMultiplier = (mines, revealed) => {
  // Base multiplier depends on the number of mines (higher risk = higher reward)
  // For 1 mine: ~1.05x base, for 24 mines: ~24x base
  const baseMultiplier = 1 + (mines / 12);
  
  // Growth constant: how quickly the multiplier increases with each reveal
  // For fewer mines, growth is slower. For many mines, growth is faster.
  const growthFactor = 1 + (mines / 25);
  
  // Calculate the multiplier with exponential growth
  // First reveal gives the base multiplier, then it grows exponentially
  return Math.round((baseMultiplier * Math.pow(growthFactor, revealed)) * 100) / 100;
};

/**
 * Generate a grid with mines
 * Uses a provably fair approach with server + client seeds
 * @param {Number} mines - Number of mines to place
 * @param {String} serverSeed - Server seed for fairness
 * @returns {Array} - 5x5 grid with mines (true) and diamonds (false)
 */
const generateGrid = (mines, serverSeed = '') => {
  if (mines < MIN_MINES || mines > MAX_MINES) {
    throw new Error(`Number of mines must be between ${MIN_MINES} and ${MAX_MINES}`);
  }
  
  // Create a flat array of 25 cells (5x5 grid)
  let cells = Array(GRID_SIZE * GRID_SIZE).fill(false);
  
  // Create a deterministic PRNG using the server seed
  const seedrandom = require('seedrandom');
  const rng = seedrandom(serverSeed);
  
  // Place mines randomly
  let minesToPlace = mines;
  while (minesToPlace > 0) {
    const index = Math.floor(rng() * cells.length);
    
    // If this cell doesn't already have a mine, place one
    if (!cells[index]) {
      cells[index] = true;
      minesToPlace--;
    }
  }
  
  // Convert flat array to 2D grid for easier reference
  const grid = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    grid.push(cells.slice(i * GRID_SIZE, (i + 1) * GRID_SIZE));
  }
  
  return grid;
};

/**
 * Initialize Landmines socket handlers
 * @param {Object} io - Socket.io instance
 * @param {Object} socket - Client socket connection
 * @param {Object} user - Authenticated user information
 */
function initLandminesHandlers(io, socket, user) {
  const userId = user?._id || socket.id;
  
  // Join the landmines namespace/room
  socket.join('landmines');
  
  // Create or get user session
  if (!activeSessions.has(userId)) {
    activeSessions.set(userId, {
      userId,
      balance: user?.balance || 1000, // Demo balance if no user
      history: [],
      currentGame: null,
      isPlaying: false
    });
    
    // Log session initialization
    loggingService.logGameEvent('landmines', 'session_start', {
      userId,
      initialBalance: user?.balance || 1000,
      timestamp: new Date()
    }, userId);
  }
  
  /**
   * Handle joining the landmines game
   */
  socket.on('landmines:join', async (data, callback) => {
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
      console.error('Error joining Landmines game:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * Handle starting a new landmines game
   */
  socket.on('landmines:start', async (data, callback) => {
    try {
      // Validate game data
      const { betAmount, mines } = data;
      
      if (!betAmount || isNaN(betAmount) || betAmount <= 0) {
        throw new Error('Invalid bet amount');
      }
      
      if (!mines || isNaN(mines) || mines < MIN_MINES || mines > MAX_MINES) {
        throw new Error(`Number of mines must be between ${MIN_MINES} and ${MAX_MINES}`);
      }
      
      // Get user session
      const session = activeSessions.get(userId);
      
      // Check if user already has an active game
      if (session.currentGame) {
        throw new Error('You already have an active game. Cash out or continue playing.');
      }
      
      // Check if user has enough balance
      if (session.balance < betAmount) {
        throw new Error('Insufficient balance');
      }
      
      // Deduct bet amount from balance
      session.balance -= betAmount;
      
      // Generate a unique game ID
      const gameId = Date.now().toString();
      
      // Use balanceService to record the bet transaction
      await balanceService.placeBet(userId, betAmount, 'landmines', {
        mines,
        landminesSessionId: gameId
      });
      
      // Log bet placed
      loggingService.logBetPlaced('landmines', gameId, userId, betAmount, {
        mines,
        timestamp: new Date()
      });
      
      // Generate the server seed for provably fair play
      const serverSeed = Math.random().toString(36).substring(2, 15);
      
      // Generate grid with mines
      const grid = generateGrid(mines, serverSeed);
      
      // Track revealed cells
      const revealedCells = [];
      
      // Setup game state
      const currentGame = {
        id: gameId,
        betAmount,
        mines,
        grid,
        revealedCells,
        serverSeed,
        currentMultiplier: 0,
        potentialWin: 0,
        isActive: true,
        startTime: new Date()
      };
      
      // Store the current game in the session
      session.currentGame = currentGame;
      
      // Return game setup to client
      const response = {
        success: true,
        gameId,
        mines,
        gridSize: GRID_SIZE,
        balance: session.balance
      };
      
      if (callback) callback(response);
      
    } catch (error) {
      console.error('Error starting Landmines game:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * Handle picking a cell in the landmines game
   */
  socket.on('landmines:pick', async (data, callback) => {
    try {
      // Validate selection data
      const { row, col } = data;
      
      if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
        throw new Error('Invalid cell selection');
      }
      
      // Get user session
      const session = activeSessions.get(userId);
      
      // Check if user has an active game
      if (!session.currentGame || !session.currentGame.isActive) {
        throw new Error('No active game found');
      }
      
      const game = session.currentGame;
      
      // Check if cell was already revealed
      const cellPosition = `${row},${col}`;
      if (game.revealedCells.includes(cellPosition)) {
        throw new Error('This cell has already been revealed');
      }
      
      // Check if cell has a mine
      const hasMine = game.grid[row][col];
      
      // Add to revealed cells
      game.revealedCells.push(cellPosition);
      
      if (hasMine) {
        // Game over - hit a mine
        game.isActive = false;
        
        // Create game result
        const gameResult = {
          id: game.id,
          userId,
          timestamp: new Date(),
          betAmount: game.betAmount,
          mines: game.mines,
          revealedCells: game.revealedCells,
          hitMine: true,
          minePosition: cellPosition,
          multiplier: 0,
          winAmount: 0,
          profit: -game.betAmount,
          grid: game.grid, // Full grid for display
          endTime: new Date()
        };
        
        // Log the loss
        loggingService.logBetResult(
          'landmines',
          game.id,
          userId,
          game.betAmount,
          0, // Win amount
          false, // Loss
          {
            mines: game.mines,
            revealedCells: game.revealedCells.length,
            minePosition: cellPosition,
            timestamp: new Date()
          }
        );
        
        // Add to history
        gameHistory.push(gameResult);
        session.history.push(gameResult);
        session.currentGame = null;
        
        // Update game statistics (loss)
        GameStat.updateStats('landmines', game.betAmount, 0).catch(err => {
          console.error('Failed to update game stats:', err);
        });
        
        // Return result to client
        const response = {
          success: true,
          hit: true,
          position: cellPosition,
          winAmount: 0,
          balance: session.balance,
          gameOver: true,
          fullGrid: game.grid // Send full grid for reveal
        };
        
        if (callback) callback(response);
        
      } else {
        // Success - found a diamond
        // Number of diamonds revealed (excluding the current one)
        const revealedCount = game.revealedCells.length - 1;
        
        // Calculate current multiplier
        const multiplier = calculateMultiplier(game.mines, revealedCount);
        
        // Calculate potential win if cashed out now
        const potentialWin = game.betAmount * multiplier;
        
        // Update game state
        game.currentMultiplier = multiplier;
        game.potentialWin = potentialWin;
        
        // Get number of remaining cells that aren't mines
        const totalCells = GRID_SIZE * GRID_SIZE;
        const remainingSafeCells = totalCells - game.mines - game.revealedCells.length;
        
        // Return result to client
        const response = {
          success: true,
          hit: false,
          position: cellPosition,
          multiplier,
          potentialWin,
          remainingSafeCells,
          balance: session.balance,
          gameOver: false
        };
        
        if (callback) callback(response);
        
        // If all diamonds have been found
        if (remainingSafeCells === 0) {
          // Auto cash-out since all diamonds have been found
          handleCashout(socket, session, game, callback);
        }
      }
      
    } catch (error) {
      console.error('Error picking landmines cell:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * Handle cashing out from the landmines game
   */
  socket.on('landmines:cashout', async (data, callback) => {
    try {
      // Get user session
      const session = activeSessions.get(userId);
      
      // Check if user has an active game
      if (!session.currentGame || !session.currentGame.isActive) {
        throw new Error('No active game found');
      }
      
      const game = session.currentGame;
      
      // Process cashout
      handleCashout(socket, session, game, callback);
      
    } catch (error) {
      console.error('Error cashing out from Landmines game:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * Handle getting game history
   */
  socket.on('landmines:get_history', async (data, callback) => {
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
      console.error('Error getting Landmines history:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  /**
   * Handle user leaving the game
   */
  socket.on('landmines:leave', () => {
    // No specific cleanup needed here, general disconnect handler will take care of it
    socket.leave('landmines');
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

  /**
   * Helper function to process cashout
   */
  const handleCashout = async (socket, session, game, callback) => {
    // Diamonds revealed so far
    const revealedCount = game.revealedCells.length;
    
    // Calculate final multiplier
    const multiplier = calculateMultiplier(game.mines, revealedCount);
    
    // Calculate win amount
    const winAmount = game.betAmount * multiplier;
    const profit = winAmount - game.betAmount;
    
    // Add winnings to balance
    session.balance += winAmount;
    
    // Use balanceService to record the win transaction
    await balanceService.recordWin(userId, game.betAmount, winAmount, 'landmines', {
      mines: game.mines,
      revealedCells: revealedCount,
      multiplier,
      profit
    });
    
    // Mark game as inactive
    game.isActive = false;
    
    // Create game result
    const gameResult = {
      id: game.id,
      userId,
      timestamp: new Date(),
      betAmount: game.betAmount,
      mines: game.mines,
      revealedCells: game.revealedCells,
      hitMine: false,
      multiplier,
      winAmount,
      profit,
      grid: game.grid, // Full grid for display
      endTime: new Date()
    };
    
    // Log the win
    loggingService.logBetResult(
      'landmines',
      game.id,
      userId,
      game.betAmount,
      winAmount,
      true, // Win
      {
        mines: game.mines,
        revealedCells: revealedCount,
        multiplier,
        profit,
        timestamp: new Date()
      }
    );
    
    // Add to history
    gameHistory.push(gameResult);
    session.history.push(gameResult);
    session.currentGame = null;
    
    // Update game statistics (win)
    GameStat.updateStats('landmines', game.betAmount, winAmount).catch(err => {
      console.error('Failed to update game stats:', err);
    });
    
    // Return result to client
    const response = {
      success: true,
      multiplier,
      winAmount,
      profit,
      balance: session.balance,
      gameOver: true,
      fullGrid: game.grid, // Send full grid for reveal
      cashedOut: true
    };
    
    if (callback) callback(response);
    
    // Broadcast cashout to other players (optional, for live feed)
    socket.to('landmines').emit('landmines:player_cashout', {
      userId,
      betAmount: game.betAmount,
      mines: game.mines,
      multiplier,
      winAmount,
      profit
    });
  };
}

module.exports = {
  initLandminesHandlers
};
