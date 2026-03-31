import { describe, it, expect } from 'vitest';
import { generatePath, calculateMultiplier, MULTIPLIER_TABLES } from '../utils/plinkoUtils.js';

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
// calculateMultiplier  (lookup-table based)
// ---------------------------------------------------------------------------
describe('calculateMultiplier()', () => {
  describe('lookup table values', () => {
    it('should return the correct edge multiplier for 16 rows, medium risk', () => {
      expect(calculateMultiplier(0, 16, 'medium')).toBe(16.0);
      expect(calculateMultiplier(16, 16, 'medium')).toBe(16.0);
    });

    it('should return the correct center multiplier for 16 rows, medium risk', () => {
      expect(calculateMultiplier(8, 16, 'medium')).toBe(0.2);
    });

    it('should return correct values for 8 rows, low risk', () => {
      const expected = [2.5, 1.4, 1.1, 0.9, 0.8, 0.9, 1.1, 1.4, 2.5];
      for (let i = 0; i < expected.length; i++) {
        expect(calculateMultiplier(i, 8, 'low')).toBe(expected[i]);
      }
    });

    it('should return correct values for 8 rows, high risk', () => {
      const expected = [15.0, 4.0, 1.5, 0.5, 0.3, 0.5, 1.5, 4.0, 15.0];
      for (let i = 0; i < expected.length; i++) {
        expect(calculateMultiplier(i, 8, 'high')).toBe(expected[i]);
      }
    });

    it('should return correct values for 16 rows, high risk', () => {
      const expected = [50.0, 10.0, 3.5, 1.2, 0.5, 0.3, 0.1, 0.1, 0.1, 0.1, 0.1, 0.3, 0.5, 1.2, 3.5, 10.0, 50.0];
      for (let i = 0; i < expected.length; i++) {
        expect(calculateMultiplier(i, 16, 'high')).toBe(expected[i]);
      }
    });
  });

  describe('symmetry', () => {
    it('should return the same multiplier for equidistant slots from center', () => {
      const rows = 16;
      // slotIndex 2 and 14 are both equidistant from the edges
      const leftMult = calculateMultiplier(2, rows, 'medium');
      const rightMult = calculateMultiplier(14, rows, 'medium');
      expect(leftMult).toBe(rightMult);
    });

    it('should be symmetric for all positions within each table', () => {
      const risks = ['low', 'medium', 'high'];
      for (const rows of [8, 9, 10, 11, 12, 13, 14, 15, 16]) {
        for (const risk of risks) {
          const table = MULTIPLIER_TABLES[rows][risk];
          const len = table.length;
          for (let i = 0; i < len; i++) {
            const mirror = len - 1 - i;
            expect(table[i]).toBe(table[mirror]);
          }
        }
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

  describe('cap and floor', () => {
    it('should never exceed 50x', () => {
      const risks = ['low', 'medium', 'high'];
      for (const rows of [8, 9, 10, 11, 12, 13, 14, 15, 16]) {
        for (const risk of risks) {
          for (let slot = 0; slot <= rows; slot++) {
            const mult = calculateMultiplier(slot, rows, risk);
            expect(mult).toBeLessThanOrEqual(50);
          }
        }
      }
    });

    it('should never return less than 0.1 for valid table entries', () => {
      const risks = ['low', 'medium', 'high'];
      for (const rows of [8, 9, 10, 11, 12, 13, 14, 15, 16]) {
        for (const risk of risks) {
          for (let slot = 0; slot <= rows; slot++) {
            const mult = calculateMultiplier(slot, rows, risk);
            expect(mult).toBeGreaterThanOrEqual(0.1);
          }
        }
      }
    });
  });

  describe('fallback behavior', () => {
    it('should return 0.5 for unsupported row count', () => {
      expect(calculateMultiplier(0, 5, 'medium')).toBe(0.5);
      expect(calculateMultiplier(0, 20, 'medium')).toBe(0.5);
    });

    it('should return 0.5 for unsupported risk level', () => {
      expect(calculateMultiplier(0, 16, 'extreme')).toBe(0.5);
    });

    it('should return 0.5 for out-of-range slot index', () => {
      expect(calculateMultiplier(-1, 16, 'medium')).toBe(0.5);
      expect(calculateMultiplier(17, 16, 'medium')).toBe(0.5);
      expect(calculateMultiplier(100, 16, 'medium')).toBe(0.5);
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
      // 8 rows has 9 buckets
      const edge = calculateMultiplier(0, 8, 'medium');
      expect(edge).toBe(5.6);

      const center = calculateMultiplier(4, 8, 'medium');
      expect(center).toBe(0.5);
    });

    it('should work correctly with 12 rows', () => {
      // 12 rows has 13 buckets
      const edge = calculateMultiplier(0, 12, 'medium');
      expect(edge).toBe(9.0);
    });
  });

  describe('table integrity', () => {
    it('all supported row counts should have entries for all three risk levels', () => {
      for (let rows = 8; rows <= 16; rows++) {
        expect(MULTIPLIER_TABLES[rows]).toBeDefined();
        expect(MULTIPLIER_TABLES[rows].low).toBeDefined();
        expect(MULTIPLIER_TABLES[rows].medium).toBeDefined();
        expect(MULTIPLIER_TABLES[rows].high).toBeDefined();
      }
    });

    it('each table should have at least rows entries', () => {
      for (let rows = 8; rows <= 16; rows++) {
        for (const risk of ['low', 'medium', 'high']) {
          const table = MULTIPLIER_TABLES[rows][risk];
          expect(table.length).toBeGreaterThanOrEqual(rows);
          expect(table.length).toBeLessThanOrEqual(rows + 1);
        }
      }
    });

    it('default 16-row tables should have exactly 17 entries', () => {
      for (const risk of ['low', 'medium', 'high']) {
        expect(MULTIPLIER_TABLES[16][risk]).toHaveLength(17);
      }
    });
  });
});
