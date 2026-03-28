import { describe, it, expect } from 'vitest';
import { generatePath, calculateMultiplier } from '../utils/plinkoUtils.js';

// ---------------------------------------------------------------------------
// generatePath
// ---------------------------------------------------------------------------
describe('generatePath()', () => {
  it('should return an array of length equal to the number of rows', () => {
    const path = generatePath(16, 'test-seed');
    expect(path).toHaveLength(16);
  });

  it('should return deterministic results for the same seed', () => {
    const path1 = generatePath(16, 'my-seed-123');
    const path2 = generatePath(16, 'my-seed-123');
    expect(path1).toEqual(path2);
  });

  it('should return different results for different seeds', () => {
    const path1 = generatePath(16, 'seed-a');
    const path2 = generatePath(16, 'seed-b');
    // Extremely unlikely to be identical
    const isSame = path1.every((val, idx) => val === path2[idx]);
    expect(isSame).toBe(false);
  });

  it('should keep all positions within 0..rows bounds', () => {
    for (let i = 0; i < 50; i++) {
      const seed = `random-seed-${i}`;
      const rows = 16;
      const path = generatePath(rows, seed);
      for (const pos of path) {
        expect(pos).toBeGreaterThanOrEqual(0);
        expect(pos).toBeLessThanOrEqual(rows);
      }
    }
  });

  it('should handle a small number of rows (8)', () => {
    const path = generatePath(8, 'small-rows');
    expect(path).toHaveLength(8);
    for (const pos of path) {
      expect(pos).toBeGreaterThanOrEqual(0);
      expect(pos).toBeLessThanOrEqual(8);
    }
  });

  it('should handle the maximum rows (16)', () => {
    const path = generatePath(16, 'max-rows');
    expect(path).toHaveLength(16);
    for (const pos of path) {
      expect(pos).toBeGreaterThanOrEqual(0);
      expect(pos).toBeLessThanOrEqual(16);
    }
  });

  it('should start from approximately the center position', () => {
    // The starting position is Math.floor((rows + 1) / 2)
    // For 16 rows, center = 8. First move is +/- 1 from there.
    const path = generatePath(16, 'center-test');
    // After first bounce the position should be 7 or 9 (center 8 +/- 1)
    expect([7, 8, 9]).toContain(path[0]);
  });

  it('each step should differ by at most 1 from the previous position', () => {
    const rows = 16;
    const path = generatePath(rows, 'step-check');
    const start = Math.floor((rows + 1) / 2);
    let prev = start;
    for (const pos of path) {
      // Raw diff should be -1 or +1 before clamping
      // After clamping, the difference may be 0 at the boundaries or 1
      expect(Math.abs(pos - prev)).toBeLessThanOrEqual(1);
      prev = pos;
    }
  });
});

// ---------------------------------------------------------------------------
// calculateMultiplier
// ---------------------------------------------------------------------------
describe('calculateMultiplier()', () => {
  describe('center slots (low multiplier)', () => {
    it('should return the base multiplier at the exact center', () => {
      // For 16 rows, center = 8, slotIndex = 8 -> distance 0 -> base value
      const mult = calculateMultiplier(8, 16, 'medium');
      expect(mult).toBe(0.5); // medium base is 0.5
    });

    it('should return low-risk base at center', () => {
      const mult = calculateMultiplier(8, 16, 'low');
      expect(mult).toBe(0.6); // low base is 0.6
    });

    it('should return high-risk base at center', () => {
      const mult = calculateMultiplier(8, 16, 'high');
      expect(mult).toBe(0.4); // high base is 0.4
    });
  });

  describe('edge slots (high multiplier)', () => {
    it('should return the edge multiplier at slot 0 (leftmost)', () => {
      const mult = calculateMultiplier(0, 16, 'medium');
      // distance = 8, norm = 1, mult = 0.5 + (3.5-0.5)*1^1.25 = 3.5
      expect(mult).toBe(3.5);
    });

    it('should return the edge multiplier at slot 16 (rightmost)', () => {
      const mult = calculateMultiplier(16, 16, 'medium');
      // distance = 8, norm = 1, mult = 3.5
      expect(mult).toBe(3.5);
    });

    it('should return high-risk edge multiplier at boundaries', () => {
      const mult = calculateMultiplier(0, 16, 'high');
      // 0.4 + (6.0-0.4)*1^1.25 = 6.0
      expect(mult).toBe(6);
    });

    it('should return low-risk edge multiplier at boundaries', () => {
      const mult = calculateMultiplier(0, 16, 'low');
      // 0.6 + (2.0-0.6)*1^1.25 = 2.0
      expect(mult).toBe(2);
    });
  });

  describe('symmetry', () => {
    it('should return the same multiplier for equidistant slots from center', () => {
      const rows = 16;
      // slotIndex 6 and 10 are both distance 2 from center (8)
      const leftMult = calculateMultiplier(6, rows, 'medium');
      const rightMult = calculateMultiplier(10, rows, 'medium');
      expect(leftMult).toBe(rightMult);
    });

    it('should be symmetric for all positions', () => {
      const rows = 16;
      for (let i = 0; i <= rows; i++) {
        const mirror = rows - i;
        const m1 = calculateMultiplier(i, rows, 'medium');
        const m2 = calculateMultiplier(mirror, rows, 'medium');
        expect(m1).toBe(m2);
      }
    });
  });

  describe('multiplier ordering', () => {
    it('should increase as distance from center increases', () => {
      const rows = 16;
      const center = rows / 2;
      let prevMult = calculateMultiplier(center, rows, 'medium');

      for (let d = 1; d <= center; d++) {
        const mult = calculateMultiplier(center + d, rows, 'medium');
        expect(mult).toBeGreaterThanOrEqual(prevMult);
        prevMult = mult;
      }
    });
  });

  describe('risk levels', () => {
    it('high risk should produce larger edge multipliers than medium', () => {
      const highEdge = calculateMultiplier(0, 16, 'high');
      const medEdge = calculateMultiplier(0, 16, 'medium');
      expect(highEdge).toBeGreaterThan(medEdge);
    });

    it('medium risk should produce larger edge multipliers than low', () => {
      const medEdge = calculateMultiplier(0, 16, 'medium');
      const lowEdge = calculateMultiplier(0, 16, 'low');
      expect(medEdge).toBeGreaterThan(lowEdge);
    });

    it('high risk should produce smaller center multipliers than low', () => {
      const highCenter = calculateMultiplier(8, 16, 'high');
      const lowCenter = calculateMultiplier(8, 16, 'low');
      expect(highCenter).toBeLessThan(lowCenter);
    });
  });

  describe('minimum multiplier floor', () => {
    it('should never return less than 0.1', () => {
      // Test a variety of positions and risk levels
      const risks: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
      for (const risk of risks) {
        for (let slot = 0; slot <= 16; slot++) {
          const mult = calculateMultiplier(slot, 16, risk);
          expect(mult).toBeGreaterThanOrEqual(0.1);
        }
      }
    });
  });

  describe('rounding', () => {
    it('should round to 2 decimal places', () => {
      const rows = 16;
      for (let slot = 0; slot <= rows; slot++) {
        const mult = calculateMultiplier(slot, rows, 'medium');
        const rounded = Math.round(mult * 100) / 100;
        expect(mult).toBe(rounded);
      }
    });
  });

  describe('default risk', () => {
    it('should default to medium when risk is not specified', () => {
      const withDefault = calculateMultiplier(0, 16);
      const withMedium = calculateMultiplier(0, 16, 'medium');
      expect(withDefault).toBe(withMedium);
    });
  });

  describe('different row counts', () => {
    it('should work correctly with 8 rows', () => {
      const center = calculateMultiplier(4, 8, 'medium');
      expect(center).toBe(0.5); // base for medium

      const edge = calculateMultiplier(0, 8, 'medium');
      expect(edge).toBe(3.5); // full norm = 1
    });

    it('should work correctly with 12 rows', () => {
      const center = calculateMultiplier(6, 12, 'medium');
      expect(center).toBe(0.5);
    });
  });
});
