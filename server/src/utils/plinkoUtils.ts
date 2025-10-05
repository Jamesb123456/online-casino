/**
 * Plinko utilities
 * Provides deterministic path generation and multiplier calculation
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

/**
 * Calculate multiplier for a landing position given rows and risk
 * This is a simplified, symmetric payout curve.
 */
export function calculateMultiplier(slotIndex: number, rows: number, risk: 'low' | 'medium' | 'high' = 'medium'): number {
  const center = rows / 2;
  const distance = Math.abs(slotIndex - center);

  // Base factors by risk (higher extremes for higher risk)
  const factors = {
    low: { base: 0.6, edge: 2.0 },
    medium: { base: 0.5, edge: 3.5 },
    high: { base: 0.4, edge: 6.0 },
  } as const;

  const { base, edge } = factors[risk];

  // Normalized distance 0..1 (edge slots get max multiplier)
  const norm = Math.min(distance / center, 1);

  // Multiplier curve between base and edge
  const mult = base + (edge - base) * Math.pow(norm, 1.25);

  // Ensure minimum 0.1x and round to 2 decimals
  return Math.max(0.1, Math.round(mult * 100) / 100);
}
