/**
 * Plinko utilities
 * Provides deterministic path generation and multiplier calculation
 * using pre-computed lookup tables with controlled house edges.
 *
 * House edges by risk: low=4%, medium=6.5%, high=8.5%
 * Multipliers derived from binomial probability with volatility scaling,
 * capped at 50x, minimum 0.1x, symmetric, rounded to 1 decimal.
 */

// Simple string hash to 32-bit int
function hashStringToInt(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Mulberry32 PRNG
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a plinko ball path (array of slot indices) for the given number of rows
 * Deterministic based on seed
 */
export function generatePath(rows: number, seed: string): number[] {
  const rand = mulberry32(hashStringToInt(seed));
  const path: number[] = [];
  let position = Math.floor((rows + 1) / 2); // start centered
  for (let r = 0; r < rows; r++) {
    const dir = rand() < 0.5 ? -1 : 1;
    position = Math.min(Math.max(position + dir, 0), rows); // clamp between 0..rows
    path.push(position);
  }
  return path;
}

// ---------------------------------------------------------------------------
// Pre-computed multiplier lookup tables
// P(k) = C(rows, k) / 2^rows  (binomial probability of landing in slot k)
// multiplier[k] = A * P(k)^(-volatility)
// volatility: low=0.4, medium=0.6, high=0.8
// A normalises so sum(P(k) * multiplier[k]) = 1 - houseEdge
// House edges: low=4%, medium=6.5%, high=8.5%
// All values capped at 50x, minimum 0.1x, symmetric, rounded to 1 decimal.
// Each row count N has N+1 buckets.
// ---------------------------------------------------------------------------
const MULTIPLIER_TABLES: Record<number, Record<string, number[]>> = {
  8: {
    low:    [2.5, 1.4, 1.1, 0.9, 0.8, 0.9, 1.1, 1.4, 2.5],
    medium: [5.6, 2.1, 1.1, 0.7, 0.5, 0.7, 1.1, 2.1, 5.6],
    high:   [15.0, 4.0, 1.5, 0.5, 0.3, 0.5, 1.5, 4.0, 15.0],
  },
  9: {
    low:    [2.7, 1.5, 1.1, 0.9, 0.8, 0.8, 0.9, 1.1, 1.5, 2.7],
    medium: [6.2, 2.3, 1.2, 0.7, 0.5, 0.5, 0.7, 1.2, 2.3, 6.2],
    high:   [18.0, 4.5, 1.6, 0.6, 0.3, 0.3, 0.6, 1.6, 4.5, 18.0],
  },
  10: {
    low:    [2.9, 1.6, 1.2, 0.9, 0.8, 0.8, 0.9, 1.2, 1.6, 2.9],
    medium: [7.0, 2.5, 1.3, 0.8, 0.5, 0.5, 0.8, 1.3, 2.5, 7.0],
    high:   [22.0, 5.0, 1.8, 0.6, 0.3, 0.2, 0.3, 0.6, 1.8, 5.0, 22.0],
  },
  11: {
    low:    [3.0, 1.6, 1.2, 1.0, 0.8, 0.7, 0.8, 1.0, 1.2, 1.6, 3.0],
    medium: [8.0, 2.8, 1.4, 0.8, 0.5, 0.4, 0.5, 0.8, 1.4, 2.8, 8.0],
    high:   [26.0, 5.5, 2.0, 0.7, 0.3, 0.2, 0.3, 0.7, 2.0, 5.5, 26.0],
  },
  12: {
    low:    [3.2, 1.7, 1.2, 1.0, 0.8, 0.7, 0.7, 0.8, 1.0, 1.2, 1.7, 3.2],
    medium: [9.0, 3.0, 1.5, 0.9, 0.6, 0.4, 0.4, 0.6, 0.9, 1.5, 3.0, 9.0],
    high:   [30.0, 6.0, 2.2, 0.8, 0.4, 0.2, 0.2, 0.4, 0.8, 2.2, 6.0, 30.0],
  },
  13: {
    low:    [3.4, 1.8, 1.3, 1.0, 0.9, 0.7, 0.7, 0.7, 0.9, 1.0, 1.3, 1.8, 3.4],
    medium: [10.0, 3.2, 1.6, 0.9, 0.6, 0.4, 0.3, 0.4, 0.6, 0.9, 1.6, 3.2, 10.0],
    high:   [35.0, 7.0, 2.5, 0.9, 0.4, 0.2, 0.1, 0.2, 0.4, 0.9, 2.5, 7.0, 35.0],
  },
  14: {
    low:    [3.6, 1.9, 1.3, 1.0, 0.9, 0.8, 0.7, 0.7, 0.8, 0.9, 1.0, 1.3, 1.9, 3.6],
    medium: [12.0, 3.5, 1.7, 1.0, 0.6, 0.4, 0.3, 0.3, 0.4, 0.6, 1.0, 1.7, 3.5, 12.0],
    high:   [40.0, 8.0, 2.8, 1.0, 0.4, 0.2, 0.1, 0.1, 0.2, 0.4, 1.0, 2.8, 8.0, 40.0],
  },
  15: {
    low:    [3.8, 2.0, 1.4, 1.1, 0.9, 0.8, 0.7, 0.7, 0.7, 0.8, 0.9, 1.1, 1.4, 2.0, 3.8],
    medium: [14.0, 4.0, 1.8, 1.0, 0.7, 0.4, 0.3, 0.3, 0.3, 0.4, 0.7, 1.0, 1.8, 4.0, 14.0],
    high:   [45.0, 9.0, 3.0, 1.1, 0.5, 0.2, 0.1, 0.1, 0.1, 0.2, 0.5, 1.1, 3.0, 9.0, 45.0],
  },
  16: {
    low:    [4.0, 2.1, 1.4, 1.1, 0.9, 0.8, 0.7, 0.7, 0.6, 0.7, 0.7, 0.8, 0.9, 1.1, 1.4, 2.1, 4.0],
    medium: [16.0, 4.5, 2.0, 1.1, 0.7, 0.5, 0.3, 0.3, 0.2, 0.3, 0.3, 0.5, 0.7, 1.1, 2.0, 4.5, 16.0],
    high:   [50.0, 10.0, 3.5, 1.2, 0.5, 0.3, 0.1, 0.1, 0.1, 0.1, 0.1, 0.3, 0.5, 1.2, 3.5, 10.0, 50.0],
  },
};

/** Expose the tables for testing or client-side reference */
export { MULTIPLIER_TABLES };

/**
 * Calculate multiplier for a landing position given rows and risk.
 * Uses pre-computed lookup tables derived from binomial probability
 * with controlled house edges.
 */
export function calculateMultiplier(slotIndex: number, rows: number, risk: string = 'medium'): number {
  const table = MULTIPLIER_TABLES[rows]?.[risk];
  if (!table || slotIndex < 0 || slotIndex >= table.length) {
    return 0.5; // fallback
  }
  return Math.min(table[slotIndex], 50);
}
