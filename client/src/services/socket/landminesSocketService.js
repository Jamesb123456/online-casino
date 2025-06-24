import socketService from '../socketService';

// Get the socket instance from the main socket service
const socket = socketService.getSocket('/landmines');

/**
 * Join the landmines game room
 * @param {Function} callback - Callback function with response data
 */
const joinLandminesGame = (callback) => {
  socket.emit('landmines:join', {}, callback);
};

/**
 * Leave the landmines game room
 */
const leaveLandminesGame = () => {
  socket.emit('landmines:leave');
};

/**
 * Start a new landmines game
 * @param {Object} gameData - Game settings (betAmount, mines)
 * @param {Function} callback - Callback function with response data
 */
const startGame = (gameData, callback) => {
  socket.emit('landmines:start', gameData, callback);
};

/**
 * Pick a cell on the landmines grid
 * @param {Object} pickData - Cell position data (row, col)
 * @param {Function} callback - Callback function with response data
 */
const pickCell = (pickData, callback) => {
  socket.emit('landmines:pick', pickData, callback);
};

/**
 * Cash out current game
 * @param {Function} callback - Callback function with response data
 */
const cashOut = (callback) => {
  socket.emit('landmines:cashout', {}, callback);
};

/**
 * Get game history
 * @param {Object} options - Options like limit of history items
 * @param {Function} callback - Callback function with response data
 */
const getGameHistory = (options, callback) => {
  socket.emit('landmines:get_history', options, callback);
};

/**
 * Subscribe to player cashout events
 * @param {Function} callback - Callback function with event data
 * @returns {Function} Unsubscribe function
 */
const onPlayerCashout = (callback) => {
  socket.on('landmines:player_cashout', callback);
  return () => { socket.off('landmines:player_cashout', callback); };
};

/**
 * Mock functions for development/testing
 */
const mockStartGame = (gameData, callback) => {
  const { betAmount, mines } = gameData;
  
  // Store the mines count in a session-like variable for other mock functions
  sessionStorage.setItem('landmines_mines_count', mines);
  sessionStorage.setItem('landmines_bet_amount', betAmount);
  
  // Clear any existing grid to ensure a new one is generated for this game
  sessionStorage.removeItem('landmines_mock_grid');
  sessionStorage.removeItem('landmines_mock_revealed');
  
  // Generate a fresh game ID
  const gameId = Date.now().toString();
  sessionStorage.setItem('landmines_game_id', gameId);
  
  // Store difficulty-specific keys
  sessionStorage.setItem('landmines_last_difficulty', mines);
  
  setTimeout(() => {
    callback({
      success: true,
      gameId,
      mines,
      gridSize: 5,
      balance: 1000 - betAmount
    });
  }, 300);
};

const mockPickCell = (pickData, callback) => {
  const { row, col } = pickData;
  
  // Get the user-selected mines count from session storage
  const minesCount = parseInt(sessionStorage.getItem('landmines_mines_count')) || 5;
  const betAmount = parseInt(sessionStorage.getItem('landmines_bet_amount')) || 10;
  
  // Generate a random grid for this game
  try {
    // Get the game ID and last difficulty
    const gameId = sessionStorage.getItem('landmines_game_id') || Date.now().toString();
    const lastDifficulty = parseInt(sessionStorage.getItem('landmines_last_difficulty')) || 0;
    
    // Store grid with a game-specific and difficulty-specific key
    const gridKey = `landmines_mock_grid_${gameId}_${minesCount}`;
    const revealedKey = `landmines_mock_revealed_${gameId}_${minesCount}`;
    
    // Always create a fresh grid for each cell pick (first pick in a game)
    // or if the difficulty has changed
    if (!sessionStorage.getItem(gridKey) || lastDifficulty !== minesCount) {
    // Create a grid with exactly the specified number of mines
    const gridSize = 5;
    const totalCells = gridSize * gridSize;
    const flatGrid = Array(totalCells).fill(false);
    
    // Place mines randomly using true randomness
    // Create an array of indices and shuffle them to avoid infinite loops
    let indices = Array.from({length: totalCells}, (_, i) => i);
    
    // Fisher-Yates shuffle algorithm with Math.random() for true randomness
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    // Place mines using the shuffled indices
    for (let i = 0; i < minesCount && i < totalCells; i++) {
      flatGrid[indices[i]] = true;
    }
    
    // Convert to 2D grid
    const grid = [];
    for (let i = 0; i < gridSize; i++) {
      const row = [];
      for (let j = 0; j < gridSize; j++) {
        row.push(flatGrid[i * gridSize + j]);
      }
      grid.push(row);
    }
    
    // Store the grid for this game session with game-specific and difficulty-specific keys
    sessionStorage.setItem(gridKey, JSON.stringify(grid));
    sessionStorage.setItem(revealedKey, JSON.stringify([]));
    
    // Also update the general keys for backward compatibility
    sessionStorage.setItem('landmines_mock_grid', JSON.stringify(grid));
    sessionStorage.setItem('landmines_mock_revealed', JSON.stringify([]));
    }
  } catch (error) {
    console.error('Error generating grid:', error);
    // Fallback to a simple grid if session storage fails
    const gridSize = 5;
    const grid = Array(gridSize).fill().map(() => Array(gridSize).fill(false));
    
    // Place mines (just a few for safety)
    for (let i = 0; i < 5; i++) {
      const r = Math.floor(Math.random() * gridSize);
      const c = Math.floor(Math.random() * gridSize);
      grid[r][c] = true;
    }
    return grid;
  }
  
  // Get the stored grid and revealed cells with safety checks
  let grid, revealedCells;
  
  try {
    const gridData = sessionStorage.getItem('landmines_mock_grid');
    grid = gridData ? JSON.parse(gridData) : null;
    
    // If grid is null or invalid, create a fallback grid
    if (!grid || !Array.isArray(grid) || grid.length !== 5) {
      console.warn('Invalid grid data, creating fallback');
      grid = Array(5).fill().map(() => Array(5).fill(false));
      
      // Add some mines based on minesCount
      const totalCells = 25;
      const mineIndices = new Set();
      while (mineIndices.size < Math.min(minesCount, 15)) {
        mineIndices.add(Math.floor(Math.random() * totalCells));
      }
      
      mineIndices.forEach(index => {
        const r = Math.floor(index / 5);
        const c = index % 5;
        grid[r][c] = true;
      });
      
      // Store the fallback grid
      sessionStorage.setItem('landmines_mock_grid', JSON.stringify(grid));
    }
    
    const revealedData = sessionStorage.getItem('landmines_mock_revealed');
    revealedCells = revealedData ? JSON.parse(revealedData) : [];
    
    // Add current cell to revealed cells
    revealedCells.push(`${row},${col}`);
    sessionStorage.setItem('landmines_mock_revealed', JSON.stringify(revealedCells));
  } catch (error) {
    console.error('Error processing grid data:', error);
    // Create emergency fallback
    grid = Array(5).fill().map(() => Array(5).fill(false));
    grid[row][col] = Math.random() < 0.2; // 20% chance of mine
    revealedCells = [`${row},${col}`];
  }
  
  // Check if we hit a mine (with safety check)
  const hitMine = grid && grid[row] && grid[row][col] === true;
  const safeCellsTotal = 25 - minesCount;
  const safeCellsRevealed = revealedCells.filter(cell => {
    const [r, c] = cell.split(',').map(Number);
    return !grid[r][c];
  }).length;
  
  // Calculate multiplier based on the actual revealed safe cells and mines count
  const multiplier = safeCellsRevealed > 0 ? Math.pow(1.05, safeCellsRevealed) * (1 + minesCount/20) : 1;
  const potentialWin = betAmount * multiplier;
  
  setTimeout(() => {
    if (hitMine) {
      // Game over - hit a mine
      callback({
        success: true,
        hit: true,
        position: `${row},${col}`,
        winAmount: 0,
        balance: 1000, // Mock balance
        gameOver: true,
        fullGrid: grid // Use the stored grid
      });
      // Reset the mock game state
      sessionStorage.removeItem('landmines_mock_grid');
      sessionStorage.removeItem('landmines_mock_revealed');
    } else {
      // Success - found a diamond
      callback({
        success: true,
        hit: false,
        position: `${row},${col}`,
        multiplier,
        potentialWin,
        remainingSafeCells: safeCellsTotal - safeCellsRevealed,
        balance: 1000, // Mock balance
        gameOver: safeCellsRevealed >= safeCellsTotal // Game over if all safe cells are revealed
      });
      
      // If all safe cells revealed, also return the grid and reset state
      if (safeCellsRevealed >= safeCellsTotal) {
        // Fix: properly include fullGrid in the callback object
        callback({
          success: true,
          hit: false,
          position: `${row},${col}`,
          multiplier,
          potentialWin,
          remainingSafeCells: 0,
          balance: 1000,
          gameOver: true,
          fullGrid: grid
        });
        sessionStorage.removeItem('landmines_mock_grid');
        sessionStorage.removeItem('landmines_mock_revealed');
      }
    }
  }, 300);
};

const mockCashOut = (callback) => {
  // Get the stored data with safety checks for the specific game and difficulty
  let grid, revealedCells, minesCount, betAmount;

  try {
    // Get the game ID for game-specific storage keys
    const gameId = sessionStorage.getItem('landmines_game_id') || Date.now().toString();
    minesCount = parseInt(sessionStorage.getItem('landmines_mines_count')) || 5;
    betAmount = parseInt(sessionStorage.getItem('landmines_bet_amount')) || 10;

    // Try to get grid using game-specific and difficulty-specific key first
    const gridKey = `landmines_mock_grid_${gameId}_${minesCount}`;
    const revealedKey = `landmines_mock_revealed_${gameId}_${minesCount}`;

    // First try game-specific storage, fall back to general storage
    let gridData = sessionStorage.getItem(gridKey) || sessionStorage.getItem('landmines_mock_grid');
    grid = gridData ? JSON.parse(gridData) : null;

    // Create fallback grid if needed
    if (!grid || !Array.isArray(grid)) {
      grid = Array(5).fill().map(() => Array(5).fill(false));
    }

    const revealedData = sessionStorage.getItem(revealedKey) || sessionStorage.getItem('landmines_mock_revealed');
    revealedCells = revealedData ? JSON.parse(revealedData) : [];
  } catch (error) {
    console.error('Error in mockCashOut:', error);
    // Default values for error case
    grid = Array(5).fill().map(() => Array(5).fill(false));
    revealedCells = [];
    minesCount = 5;
    betAmount = 10;
  }
  
  // Calculate safe cells revealed
  const safeCellsRevealed = revealedCells.filter(cell => {
    const [r, c] = cell.split(',').map(Number);
    return !grid[r][c];
  }).length;
  
  // Calculate multiplier properly based on mines and revealed cells
  const multiplier = safeCellsRevealed > 0 ? Math.pow(1.05, safeCellsRevealed) * (1 + minesCount/20) : 1;
  const winAmount = Math.floor(betAmount * multiplier);
  
  setTimeout(() => {
    // Simulate a successful cashout
    callback({
      success: true,
      multiplier,
      winAmount,
      profit: winAmount - betAmount,
      fullGrid: grid // Use the stored grid
    });
    
    // Reset the mock game state
    sessionStorage.removeItem('landmines_mock_grid');
    sessionStorage.removeItem('landmines_mock_revealed');
  }, 300);
};

export default {
  // Real socket functions
  joinLandminesGame,
  leaveLandminesGame,
  startGame,
  pickCell,
  cashOut,
  getGameHistory,
  onPlayerCashout,
  
  // Mock functions for development
  mockStartGame,
  mockPickCell,
  mockCashOut
};
