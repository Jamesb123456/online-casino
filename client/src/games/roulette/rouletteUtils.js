/**
 * Utilities for Roulette game logic
 */

/**
 * Standard roulette numbers and their configurations
 * For European roulette (single zero)
 */
export const ROULETTE_NUMBERS = [
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
export const BET_TYPES = {
  STRAIGHT: { name: 'Straight Up', payout: 35, description: 'Bet on a single number' },
  SPLIT: { name: 'Split', payout: 17, description: 'Bet on 2 adjacent numbers' },
  STREET: { name: 'Street', payout: 11, description: 'Bet on 3 numbers in a row' },
  CORNER: { name: 'Corner', payout: 8, description: 'Bet on 4 numbers that form a square' },
  FIVE: { name: 'Five', payout: 6, description: 'Bet on 0, 00, 1, 2, 3 (American roulette only)' },
  LINE: { name: 'Line', payout: 5, description: 'Bet on 6 numbers (2 adjacent rows)' },
  COLUMN: { name: 'Column', payout: 2, description: 'Bet on all 12 numbers in a column' },
  DOZEN: { name: 'Dozen', payout: 2, description: 'Bet on 12 numbers (1-12, 13-24, or 25-36)' },
  RED: { name: 'Red', payout: 1, description: 'Bet on all red numbers' },
  BLACK: { name: 'Black', payout: 1, description: 'Bet on all black numbers' },
  ODD: { name: 'Odd', payout: 1, description: 'Bet on all odd numbers' },
  EVEN: { name: 'Even', payout: 1, description: 'Bet on all even numbers' },
  LOW: { name: 'Low', payout: 1, description: 'Bet on numbers 1-18' },
  HIGH: { name: 'High', payout: 1, description: 'Bet on numbers 19-36' }
};

/**
 * Get all numbers for a specific bet type
 * @param {String} betType - Type of bet from BET_TYPES
 * @param {Number|String} value - Value associated with bet (e.g., number for STRAIGHT)
 * @returns {Array<Number>} - Array of numbers included in this bet
 */
export const getBetNumbers = (betType, value) => {
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
export const isBetWinner = (betType, betValue, winningNumber) => {
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
export const calculateWinnings = (betType, betAmount, isWinner) => {
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
export const generateSpinResult = (serverSeed = '') => {
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

  // Use the hash to select a number
  const index = Math.abs(hash) % ROULETTE_NUMBERS.length;
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
 * @returns {Number} - Rotation angle in degrees
 */
export const calculateRotationAngle = (index) => {
  // Base rotation 
  const baseRotation = 0;
  
  // Calculate pocket angle
  const pocketAngle = 360 / ROULETTE_NUMBERS.length;
  
  // Target angle for the pocket (plus some random offset to make it look natural)
  const targetAngle = baseRotation + (index * pocketAngle);
  
  // Add random offset within the pocket (to make it look more natural)
  const randomOffset = Math.random() * (pocketAngle * 0.6) - (pocketAngle * 0.3);
  
  // Add multiple full rotations to make the wheel spin
  const fullRotations = 6 * 360; // 6 full rotations
  
  return fullRotations - (targetAngle + randomOffset);
};

/**
 * Map a number to its position on a standard roulette layout
 * @returns {Object} - Map of number to grid position {row, col}
 */
export const getBettingTableLayout = () => {
  const layout = {};
  
  // Add zero
  layout[0] = { row: 0, col: 0 };
  
  // Add 1-36 in standard layout
  // First row: 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36
  // Second row: 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35
  // Third row: 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34
  for (let i = 0; i < 12; i++) {
    layout[3 * i + 3] = { row: 1, col: i + 1 }; // First row
    layout[3 * i + 2] = { row: 2, col: i + 1 }; // Second row
    layout[3 * i + 1] = { row: 3, col: i + 1 }; // Third row
  }
  
  return layout;
};

export default {
  ROULETTE_NUMBERS,
  BET_TYPES,
  getBetNumbers,
  isBetWinner,
  calculateWinnings,
  generateSpinResult,
  calculateRotationAngle,
  getBettingTableLayout
};