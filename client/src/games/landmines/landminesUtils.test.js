import { describe, it, expect } from 'vitest';
import {
  calculateMultiplier,
  generateMockGrid,
  getDifficultyLevel,
  calculatePotentialWin,
  formatCurrency,
  formatTime,
  getMultiplierColor,
} from './landminesUtils';

describe('calculateMultiplier()', () => {
  it('returns 1 when no cells revealed', () => {
    expect(calculateMultiplier(5, 0)).toBe(1);
  });

  it('returns 1 for negative revealed', () => {
    expect(calculateMultiplier(5, -1)).toBe(1);
  });

  it('returns >1 multiplier after revealing safe cells', () => {
    const m = calculateMultiplier(5, 1);
    expect(m).toBeGreaterThan(1);
  });

  it('grows multiplier as more cells are revealed', () => {
    const m1 = calculateMultiplier(5, 1);
    const m5 = calculateMultiplier(5, 5);
    expect(m5).toBeGreaterThan(m1);
  });

  it('higher mine count yields higher multipliers for same reveals', () => {
    const lowMines = calculateMultiplier(3, 3);
    const highMines = calculateMultiplier(15, 3);
    expect(highMines).toBeGreaterThan(lowMines);
  });

  it('caps multiplier at 50x', () => {
    // 24 mines means only 1 safe cell — reveal it for huge multiplier
    expect(calculateMultiplier(24, 1)).toBeLessThanOrEqual(50);
  });
});

describe('generateMockGrid()', () => {
  it('creates default 5x5 grid', () => {
    const g = generateMockGrid();
    expect(g).toHaveLength(5);
    expect(g[0]).toHaveLength(5);
  });

  it('places the requested number of mines', () => {
    const g = generateMockGrid(5, 5);
    const mineCount = g.flat().filter(Boolean).length;
    expect(mineCount).toBe(5);
  });

  it('respects custom size', () => {
    const g = generateMockGrid(3, 2);
    expect(g).toHaveLength(3);
    expect(g[0]).toHaveLength(3);
    expect(g.flat().filter(Boolean).length).toBe(2);
  });

  it('places no mines when mines=0', () => {
    const g = generateMockGrid(5, 0);
    expect(g.flat().filter(Boolean).length).toBe(0);
  });
});

describe('getDifficultyLevel()', () => {
  it('returns easy for 1-3 mines', () => {
    expect(getDifficultyLevel(1)).toBe('easy');
    expect(getDifficultyLevel(3)).toBe('easy');
  });

  it('returns medium for 4-8 mines', () => {
    expect(getDifficultyLevel(4)).toBe('medium');
    expect(getDifficultyLevel(8)).toBe('medium');
  });

  it('returns hard for 9-16 mines', () => {
    expect(getDifficultyLevel(9)).toBe('hard');
    expect(getDifficultyLevel(16)).toBe('hard');
  });

  it('returns extreme for >16 mines', () => {
    expect(getDifficultyLevel(17)).toBe('extreme');
    expect(getDifficultyLevel(24)).toBe('extreme');
  });
});

describe('calculatePotentialWin()', () => {
  it('returns bet * multiplier', () => {
    const m = calculateMultiplier(5, 3);
    expect(calculatePotentialWin(100, 5, 3)).toBeCloseTo(100 * m, 5);
  });

  it('returns bet when nothing revealed', () => {
    expect(calculatePotentialWin(100, 5, 0)).toBe(100);
  });
});

describe('formatCurrency()', () => {
  it('formats integer with thousands separator and currency unit', () => {
    expect(formatCurrency(1234)).toMatch(/1,234/);
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toMatch(/0/);
  });
});

describe('formatTime()', () => {
  it('returns empty string for falsy input', () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime(undefined)).toBe('');
    expect(formatTime(0)).toBe('');
    expect(formatTime('')).toBe('');
  });

  it('formats a valid timestamp to HH:MM-ish', () => {
    const result = formatTime(new Date(2024, 0, 1, 13, 5));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('accepts ISO string', () => {
    const result = formatTime('2024-01-01T13:05:00');
    expect(typeof result).toBe('string');
  });
});

describe('getMultiplierColor()', () => {
  it('returns purple for >=10x', () => {
    expect(getMultiplierColor(10)).toBe('text-purple-500');
    expect(getMultiplierColor(25)).toBe('text-purple-500');
  });

  it('returns yellow for 5-10x', () => {
    expect(getMultiplierColor(5)).toBe('text-yellow-500');
  });

  it('returns green for 2-5x', () => {
    expect(getMultiplierColor(2)).toBe('text-green-500');
  });

  it('returns blue for <2x', () => {
    expect(getMultiplierColor(1.5)).toBe('text-blue-500');
    expect(getMultiplierColor(0.5)).toBe('text-blue-500');
  });
});
