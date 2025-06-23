/**
 * Utilities for Crash game logic
 */

/**
 * Generate a crash point using a provably fair algorithm
 * This is a simplified version for demonstration purposes
 * In a real implementation, this would use cryptographic methods for fairness
 * 
 * @param {String} serverSeed - Server generated seed for fairness
 * @param {String} clientSeed - Optional client seed for additional randomness
 * @param {Number} houseEdge - House edge percentage (default: 5%)
 * @returns {Number} - The crash point multiplier
 */
export const generateCrashPoint = (serverSeed = '', clientSeed = '', houseEdge = 5) => {
  // In a real implementation, this would use a HMAC or other cryptographic function
  // Here we're using a simplified approach for demonstration
  
  // Create a deterministic but seemingly random value from the seeds
  const seedString = `${serverSeed}-${clientSeed}-${Date.now()}`;
  let hash = 0;
  
  for (let i = 0; i < seedString.length; i++) {
    const char = seedString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Generate a random value between 0 and 1
  const randomValue = Math.abs(hash) / 2147483647;
  
  // Apply house edge (simplified formula)
  const houseEdgeFactor = 1 - (houseEdge / 100);
  
  // Calculate crash point using a distribution that favors lower values
  // This formula creates an exponential distribution typical for crash games
  const crashPoint = 100 / (1 - randomValue * houseEdgeFactor);
  
  // Round to 2 decimal places
  return Math.max(1, Math.floor(crashPoint * 100) / 100);
};

/**
 * Calculate potential profit from a bet
 * 
 * @param {Number} betAmount - Amount bet
 * @param {Number} cashoutMultiplier - Multiplier at cashout
 * @returns {Number} - Profit amount
 */
export const calculateProfit = (betAmount, cashoutMultiplier) => {
  return betAmount * cashoutMultiplier - betAmount;
};

/**
 * Format a multiplier for display
 * 
 * @param {Number} multiplier - The multiplier to format
 * @returns {String} - Formatted multiplier string
 */
export const formatMultiplier = (multiplier) => {
  return `${multiplier.toFixed(2)}x`;
};

/**
 * Convert elapsed time to a current multiplier
 * 
 * @param {Number} elapsedMs - Time elapsed in milliseconds
 * @param {Number} baseSpeed - Base speed factor (higher = faster growth)
 * @returns {Number} - Current multiplier
 */
export const timeToMultiplier = (elapsedMs, baseSpeed = 0.00006) => {
  return Math.pow(Math.E, elapsedMs * baseSpeed);
};

/**
 * Calculate the color gradient for a given multiplier
 * 
 * @param {Number} multiplier - Current multiplier
 * @returns {String} - CSS color string
 */
export const getMultiplierColor = (multiplier) => {
  if (multiplier < 1.5) return 'rgb(255, 177, 60)'; // Amber
  if (multiplier < 2) return 'rgb(255, 152, 0)'; // Orange
  if (multiplier < 3) return 'rgb(255, 87, 34)'; // Deep Orange
  if (multiplier < 5) return 'rgb(244, 67, 54)'; // Red
  if (multiplier < 10) return 'rgb(233, 30, 99)'; // Pink
  if (multiplier < 20) return 'rgb(156, 39, 176)'; // Purple
  return 'rgb(103, 58, 183)'; // Deep Purple
};

export default {
  generateCrashPoint,
  calculateProfit,
  formatMultiplier,
  timeToMultiplier,
  getMultiplierColor
};