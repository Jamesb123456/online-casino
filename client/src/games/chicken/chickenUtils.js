/**
 * Chicken Game Utility Functions
 * 
 * The Chicken game is a risk-versus-reward game where players try to maximize their
 * multiplier by letting it grow, but risk losing everything if they wait too long.
 */

/**
 * Constants for the game
 */
export const GAME_CONSTANTS = {
  MIN_CASH_OUT_MULTIPLIER: 1.1, // Minimum multiplier to cash out
  MAX_THEORETICAL_MULTIPLIER: 100, // Theoretical maximum multiplier (actual crash may occur earlier)
  DEFAULT_DIFFICULTY: 'medium', // Default difficulty level
  BOMB_EXPLOSION_CHANCE: {
    easy: 0.02,    // 2% chance per tick for easy mode
    medium: 0.03,  // 3% chance per tick for medium mode
    hard: 0.05,    // 5% chance per tick for hard mode
  },
  TICK_INTERVAL_MS: 100, // Milliseconds between each tick
  MULTIPLIER_GROWTH_RATE: {
    easy: 0.05,    // Multiplier increases by 0.05 per tick in easy mode
    medium: 0.07,  // Multiplier increases by 0.07 per tick in medium mode
    hard: 0.1,     // Multiplier increases by 0.1 per tick in hard mode
  },
};

/**
 * Difficulty levels with display information
 */
export const DIFFICULTY_LEVELS = [
  { 
    id: 'easy', 
    name: 'Easy', 
    description: 'Lower risk, slower growth. Better for beginners.', 
    maxMultiplier: 15,
    color: 'green' 
  },
  { 
    id: 'medium', 
    name: 'Medium', 
    description: 'Balanced risk and reward.', 
    maxMultiplier: 30,
    color: 'blue' 
  },
  { 
    id: 'hard', 
    name: 'Hard', 
    description: 'High risk, fast growth. For thrill-seekers.', 
    maxMultiplier: 100,
    color: 'red' 
  }
];

/**
 * Generate a predictable but seemingly random result based on seeds
 * This is a simplified implementation. A proper casino should use
 * verifiable random functions for provably fair results.
 * 
 * @param {string} serverSeed - Server generated seed for fairness
 * @param {string} clientSeed - Client seed for additional entropy (optional)
 * @param {string} difficulty - Difficulty level: 'easy', 'medium', 'hard'
 * @returns {Object} The game result with crash point and timeline
 */
export const generateGameResult = (serverSeed, clientSeed = '', difficulty = 'medium') => {
  // In a real implementation, this would use a cryptographic hash function
  // Here we're using a simplified approach for demonstration
  
  // Create a deterministic but seemingly random value from the seeds
  const seedString = `${serverSeed}-${clientSeed}`;
  let hash = 0;
  
  for (let i = 0; i < seedString.length; i++) {
    const char = seedString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Use the hash to determine a random value between 0 and 1
  const randomValue = Math.abs(hash) / 2147483647;
  
  // Simulate game timeline and determine crash point
  const timeline = [];
  const explosionChance = GAME_CONSTANTS.BOMB_EXPLOSION_CHANCE[difficulty];
  const growthRate = GAME_CONSTANTS.MULTIPLIER_GROWTH_RATE[difficulty];
  
  let currentMultiplier = 1;
  let hasCrashed = false;
  let tickCount = 0;
  let crashPoint = 1;
  
  // Simulate the game ticks until crash
  while (!hasCrashed && currentMultiplier < GAME_CONSTANTS.MAX_THEORETICAL_MULTIPLIER) {
    // Record the current state
    timeline.push({
      tick: tickCount,
      multiplier: parseFloat(currentMultiplier.toFixed(2)),
      timeMs: tickCount * GAME_CONSTANTS.TICK_INTERVAL_MS
    });
    
    // Check if the game should crash at this point
    // We use a hash-based random value combined with the explosion chance per tick
    const tickRandomValue = (randomValue + tickCount * 0.01) % 1;
    if (tickRandomValue < explosionChance) {
      hasCrashed = true;
      crashPoint = currentMultiplier;
    }
    
    // Increase multiplier and tick count for next iteration
    currentMultiplier += growthRate;
    tickCount++;
  }
  
  // Add the final crash point to the timeline
  timeline.push({
    tick: tickCount,
    multiplier: parseFloat(crashPoint.toFixed(2)),
    timeMs: tickCount * GAME_CONSTANTS.TICK_INTERVAL_MS,
    crashed: true
  });
  
  return {
    crashPoint: parseFloat(crashPoint.toFixed(2)),
    timeline,
    difficulty,
    timestamp: new Date()
  };
};

/**
 * Calculate the profit from a bet based on the cash out multiplier
 * 
 * @param {number} betAmount - Amount of the bet
 * @param {number} cashOutMultiplier - Multiplier at cash out
 * @returns {number} Profit amount (negative if loss)
 */
export const calculateProfit = (betAmount, cashOutMultiplier) => {
  return parseFloat((betAmount * cashOutMultiplier - betAmount).toFixed(2));
};

/**
 * Format a multiplier for display
 * 
 * @param {number} multiplier - The multiplier to format
 * @returns {string} Formatted multiplier (e.g. "2.35x")
 */
export const formatMultiplier = (multiplier) => {
  return `${multiplier.toFixed(2)}x`;
};

/**
 * Get the appropriate color for a multiplier value
 * 
 * @param {number} multiplier - The multiplier value
 * @returns {string} CSS color value or class name
 */
export const getMultiplierColor = (multiplier) => {
  if (multiplier < 1.5) return 'text-white';
  if (multiplier < 2) return 'text-green-400';
  if (multiplier < 3) return 'text-blue-400';
  if (multiplier < 5) return 'text-purple-400';
  if (multiplier < 10) return 'text-orange-400';
  return 'text-red-500';
};

/**
 * Check if a player cashed out in time or got caught by the crash
 * 
 * @param {number} cashOutMultiplier - Player's cash out multiplier
 * @param {number} crashPoint - Point at which the game crashed
 * @returns {boolean} True if player cashed out successfully
 */
export const didCashOutInTime = (cashOutMultiplier, crashPoint) => {
  return cashOutMultiplier <= crashPoint;
};

/**
 * Get the auto cash out options for quick selection
 * 
 * @returns {Array} Array of auto cash out multiplier options
 */
export const getAutoCashOutOptions = () => {
  return [1.5, 2, 3, 5, 10];
};

/**
 * Generate mock game history for initial display
 * 
 * @param {number} count - Number of history items to generate
 * @returns {Array} Array of mock game results
 */
export const generateMockHistory = (count = 10) => {
  const history = [];
  
  for (let i = 0; i < count; i++) {
    // Generate some variety in the mock results
    const randomBase = Math.random();
    let crashPoint;
    
    if (randomBase < 0.7) {
      // 70% of games crash between 1.0 and 3.0
      crashPoint = 1 + (randomBase * 2);
    } else if (randomBase < 0.9) {
      // 20% of games crash between 3.0 and 10.0
      crashPoint = 3 + (randomBase * 7);
    } else {
      // 10% of games crash between 10.0 and 20.0
      crashPoint = 10 + (randomBase * 10);
    }
    
    history.push({
      id: `mock-${i}`,
      crashPoint: parseFloat(crashPoint.toFixed(2)),
      timestamp: new Date(Date.now() - (i * 30000)), // Games every 30 seconds in the past
    });
  }
  
  return history;
};

export default {
  GAME_CONSTANTS,
  DIFFICULTY_LEVELS,
  generateGameResult,
  calculateProfit,
  formatMultiplier,
  getMultiplierColor,
  didCashOutInTime,
  getAutoCashOutOptions,
  generateMockHistory
};