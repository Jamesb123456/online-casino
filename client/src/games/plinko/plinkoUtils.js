/**
 * Utilities for Plinko game logic
 */

/**
 * Calculate the payout multipliers for a given risk level
 * @param {String} risk - Risk level (low, medium, high)
 * @returns {Array<Number>} - Array of multiplier values for each bucket
 */
export const getPlinkoMultipliers = (risk = 'medium') => {
  // Predefined payout multipliers for different risk levels
  const plinkoMultipliers = {
    low: [1.3, 1.1, 1, 0.9, 0.8, 0.7, 0.8, 0.9, 1, 1.1, 1.3],
    medium: [5.6, 2.1, 1.1, 1, 0.5, 0.3, 0.5, 1, 1.1, 2.1, 5.6],
    high: [10, 3, 1.6, 0.7, 0.4, 0.2, 0.4, 0.7, 1.6, 3, 10],
  };

  return plinkoMultipliers[risk] || plinkoMultipliers.medium;
};

/**
 * Get the number of pins rows for the Plinko board
 * @returns {Number} - Number of pin rows
 */
export const getPlinkoRows = () => {
  return 8; // Standard Plinko board has 8 rows
};

/**
 * Generate a path for a Plinko drop using a provably fair algorithm
 * Simplified version for demonstration purposes
 * 
 * @param {String} serverSeed - Server generated seed for fairness
 * @param {Number} rows - Number of rows in the Plinko board
 * @returns {Array<Number>} - Array of pin directions (0 = left, 1 = right)
 */
export const generatePlinkoPath = (serverSeed = '', rows = 8) => {
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

  // Generate path choices based on hash
  const path = [];
  for (let i = 0; i < rows; i++) {
    // Use a different portion of the hash for each row
    const randomBit = ((hash >> i) & 1) === 1;
    path.push(randomBit ? 1 : 0); // 1 for right, 0 for left
  }
  
  return path;
};

/**
 * Determine which bucket the ball lands in based on the path
 * 
 * @param {Array<Number>} path - Array of pin directions (0 = left, 1 = right)
 * @returns {Number} - Bucket index (0-based)
 */
export const getBucketFromPath = (path) => {
  // Sum the number of right bounces to determine final bucket
  const rightBounces = path.reduce((sum, direction) => sum + direction, 0);
  return rightBounces;
};

/**
 * Calculate the number of buckets based on rows
 * 
 * @param {Number} rows - Number of pin rows
 * @returns {Number} - Number of buckets
 */
export const getNumberOfBuckets = (rows) => {
  return rows + 1;
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
 * Get a color for a multiplier value
 * 
 * @param {Number} multiplier - Multiplier value
 * @returns {String} - CSS color based on multiplier value
 */
export const getMultiplierColor = (multiplier) => {
  if (multiplier >= 5) return 'rgb(233, 30, 99)'; // Pink
  if (multiplier >= 2) return 'rgb(156, 39, 176)'; // Purple
  if (multiplier >= 1) return 'rgb(33, 150, 243)'; // Blue
  if (multiplier >= 0.5) return 'rgb(0, 188, 212)'; // Cyan
  return 'rgb(0, 150, 136)'; // Teal
};

export default {
  getPlinkoMultipliers,
  getPlinkoRows,
  generatePlinkoPath,
  getBucketFromPath,
  getNumberOfBuckets,
  formatMultiplier,
  getMultiplierColor
};