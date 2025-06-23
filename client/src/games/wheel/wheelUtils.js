/**
 * Utilities for Wheel game logic
 */

/**
 * Get wheel segments configuration based on difficulty
 * @param {String} difficulty - Difficulty level (easy, medium, hard)
 * @returns {Array<Object>} - Array of wheel segment configurations with multipliers and colors
 */
export const getWheelSegments = (difficulty = 'medium') => {
  // Predefined wheel segments for different difficulty levels
  const wheelSegments = {
    easy: [
      { multiplier: 1.5, color: '#3498db', weight: 3 }, // Blue
      { multiplier: 2, color: '#2ecc71', weight: 2 },   // Green
      { multiplier: 0.5, color: '#e74c3c', weight: 2 }, // Red
      { multiplier: 1, color: '#f1c40f', weight: 4 },   // Yellow
      { multiplier: 0.2, color: '#e67e22', weight: 2 }, // Orange
      { multiplier: 3, color: '#9b59b6', weight: 1 }    // Purple
    ],
    medium: [
      { multiplier: 2, color: '#3498db', weight: 2 },   // Blue
      { multiplier: 3, color: '#2ecc71', weight: 1 },   // Green
      { multiplier: 0.2, color: '#e74c3c', weight: 3 }, // Red
      { multiplier: 1, color: '#f1c40f', weight: 3 },   // Yellow
      { multiplier: 0.5, color: '#e67e22', weight: 2 }, // Orange
      { multiplier: 5, color: '#9b59b6', weight: 1 }    // Purple
    ],
    hard: [
      { multiplier: 3, color: '#3498db', weight: 1 },   // Blue
      { multiplier: 5, color: '#2ecc71', weight: 1 },   // Green
      { multiplier: 0.1, color: '#e74c3c', weight: 4 }, // Red
      { multiplier: 0.5, color: '#f1c40f', weight: 2 }, // Yellow
      { multiplier: 0.2, color: '#e67e22', weight: 2 }, // Orange
      { multiplier: 10, color: '#9b59b6', weight: 1 }   // Purple
    ]
  };

  // Get segments for the selected difficulty
  const segments = wheelSegments[difficulty] || wheelSegments.medium;

  // Expand segments based on weight
  const expandedSegments = [];
  segments.forEach(segment => {
    for (let i = 0; i < segment.weight; i++) {
      expandedSegments.push({ 
        multiplier: segment.multiplier, 
        color: segment.color 
      });
    }
  });

  return expandedSegments;
};

/**
 * Generate a random wheel result using a provably fair algorithm
 * Simplified version for demonstration purposes
 * 
 * @param {String} serverSeed - Server generated seed for fairness
 * @param {Array<Object>} segments - Array of wheel segments
 * @returns {Object} - Selected segment and additional result data
 */
export const generateWheelResult = (serverSeed = '', segments) => {
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

  // Use the hash to select a segment
  const index = Math.abs(hash) % segments.length;
  return {
    segmentIndex: index,
    multiplier: segments[index].multiplier,
    color: segments[index].color,
    timestamp: new Date()
  };
};

/**
 * Calculate the rotation angle for a specific segment
 * 
 * @param {Number} segmentIndex - Index of the segment
 * @param {Number} totalSegments - Total number of segments
 * @returns {Number} - Rotation angle in degrees
 */
export const calculateRotationAngle = (segmentIndex, totalSegments) => {
  // Base rotation to ensure arrow points at the middle of a segment
  const baseRotation = 270; // Arrow at top is 270 degrees (9 o'clock position)
  
  // Calculate segment angle
  const segmentAngle = 360 / totalSegments;
  
  // Target angle for the segment (plus some random offset to make it look natural)
  const targetAngle = baseRotation - (segmentIndex * segmentAngle);
  
  // Add random offset within the segment (to make it look more natural)
  const randomOffset = Math.random() * (segmentAngle * 0.6) - (segmentAngle * 0.3);
  
  // Add multiple full rotations to make the wheel spin
  const fullRotations = 4 * 360; // 4 full rotations
  
  return targetAngle + randomOffset + fullRotations;
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
 * Calculate profit from a bet and multiplier
 * 
 * @param {Number} betAmount - Bet amount
 * @param {Number} multiplier - Winning multiplier
 * @returns {Number} - Profit amount
 */
export const calculateProfit = (betAmount, multiplier) => {
  return betAmount * multiplier - betAmount;
};

export default {
  getWheelSegments,
  generateWheelResult,
  calculateRotationAngle,
  formatMultiplier,
  calculateProfit
};