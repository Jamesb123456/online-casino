/**
 * Utility functions for the Landmines game
 */

/**
 * Calculate the multiplier based on the number of mines and cells revealed
 * @param {Number} mines - Number of mines in the grid
 * @param {Number} revealed - Number of cells successfully revealed
 * @returns {Number} - Current multiplier
 */
export const calculateMultiplier = (mines, revealed) => {
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
 * Generate a client-side representation of the grid (for testing purposes)
 * In the real game, the grid is generated on the server.
 * @param {Number} size - Size of the grid (5 for 5x5)
 * @param {Number} mines - Number of mines to place
 * @returns {Array} - 2D array with mines (true) and diamonds (false)
 */
export const generateMockGrid = (size = 5, mines = 5) => {
  // Create a flat array of 25 cells (5x5 grid)
  const totalCells = size * size;
  let cells = Array(totalCells).fill(false);
  
  // Place mines randomly
  let minesToPlace = mines;
  while (minesToPlace > 0) {
    const index = Math.floor(Math.random() * cells.length);
    
    // If this cell doesn't already have a mine, place one
    if (!cells[index]) {
      cells[index] = true;
      minesToPlace--;
    }
  }
  
  // Convert flat array to 2D grid for easier reference
  const grid = [];
  for (let i = 0; i < size; i++) {
    grid.push(cells.slice(i * size, (i + 1) * size));
  }
  
  return grid;
};

/**
 * Get the difficulty level based on the number of mines
 * @param {Number} mines - Number of mines
 * @returns {String} - Difficulty level (easy, medium, hard, extreme)
 */
export const getDifficultyLevel = (mines) => {
  if (mines <= 3) return 'easy';
  if (mines <= 8) return 'medium';
  if (mines <= 16) return 'hard';
  return 'extreme';
};

/**
 * Calculate potential win based on bet amount, mines and revealed cells
 * @param {Number} betAmount - Amount bet
 * @param {Number} mines - Number of mines
 * @param {Number} revealed - Number of revealed cells
 * @returns {Number} - Potential win amount
 */
export const calculatePotentialWin = (betAmount, mines, revealed) => {
  const multiplier = calculateMultiplier(mines, revealed);
  return betAmount * multiplier;
};

/**
 * Format a number as currency
 * @param {Number} value - Value to format
 * @param {Number} decimals - Number of decimal places
 * @returns {String} - Formatted currency string
 */
export const formatCurrency = (value, decimals = 2) => {
  return value.toFixed(decimals);
};

/**
 * Format a timestamp as a readable time
 * @param {Date|String|Number} timestamp - Timestamp to format
 * @returns {String} - Formatted time string
 */
export const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Get a color for the multiplier value
 * @param {Number} multiplier - Multiplier value
 * @returns {String} - CSS color class
 */
export const getMultiplierColor = (multiplier) => {
  if (multiplier >= 10) return 'text-purple-500';
  if (multiplier >= 5) return 'text-yellow-500';
  if (multiplier >= 2) return 'text-green-500';
  return 'text-blue-500';
};
