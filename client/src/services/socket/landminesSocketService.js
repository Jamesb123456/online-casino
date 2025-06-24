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
  
  setTimeout(() => {
    callback({
      success: true,
      gameId: Date.now().toString(),
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
  
  // Generate a semi-consistent grid based on row+col
  try {
    // Check if grid exists first
    if (!sessionStorage.getItem('landmines_mock_grid')) {
    // Create a grid with exactly the specified number of mines
    const gridSize = 5;
    const totalCells = gridSize * gridSize;
    const flatGrid = Array(totalCells).fill(false);
    
    // Place mines randomly but deterministically
    // Create an array of indices and shuffle them to avoid infinite loops
    let indices = Array.from({length: totalCells}, (_, i) => i);
    
    // Fisher-Yates shuffle algorithm
    for (let i = indices.length - 1; i > 0; i--) {
      // Use a deterministic but more reliable approach
      const j = Math.floor((Math.sin((i + 1) * 9999) * 0.5 + 0.5) * (i + 1));
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
    
    // Store the grid
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
  // Get the stored data with safety checks
  let grid, revealedCells, minesCount, betAmount;
  
  try {
    const gridData = sessionStorage.getItem('landmines_mock_grid');
    grid = gridData ? JSON.parse(gridData) : null;
    
    // Create fallback grid if needed
    if (!grid || !Array.isArray(grid)) {
      grid = Array(5).fill().map(() => Array(5).fill(false));
    }
    
    const revealedData = sessionStorage.getItem('landmines_mock_revealed');
    revealedCells = revealedData ? JSON.parse(revealedData) : [];
    
    minesCount = parseInt(sessionStorage.getItem('landmines_mines_count')) || 5;
    betAmount = parseInt(sessionStorage.getItem('landmines_bet_amount')) || 10;
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
