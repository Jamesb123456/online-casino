import { describe, it, expect } from 'vitest';
import {
  generateCrashPoint,
  calculateProfit,
  formatMultiplier,
  timeToMultiplier,
  getMultiplierColor,
} from './crashUtils';

describe('generateCrashPoint()', () => {
  it('returns a number within [1, 50]', () => {
    const result = generateCrashPoint('seed', 'client', 5);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(50);
  });

  it('returns a number even with empty seeds', () => {
    const result = generateCrashPoint();
    expect(typeof result).toBe('number');
    expect(Number.isNaN(result)).toBe(false);
  });

  it('respects house edge parameter', () => {
    const result = generateCrashPoint('seed', 'client', 10);
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(50);
  });
});

describe('calculateProfit()', () => {
  it('computes profit for winning multiplier', () => {
    expect(calculateProfit(100, 2)).toBe(100);
  });

  it('returns 0 profit when multiplier is 1', () => {
    expect(calculateProfit(100, 1)).toBe(0);
  });

  it('returns negative for sub-1 multiplier', () => {
    expect(calculateProfit(100, 0.5)).toBe(-50);
  });

  it('handles zero bet', () => {
    expect(calculateProfit(0, 5)).toBe(0);
  });
});

describe('formatMultiplier()', () => {
  it('formats integer with 2 decimals and x suffix', () => {
    expect(formatMultiplier(2)).toBe('2.00x');
  });

  it('formats decimal with 2 decimals', () => {
    expect(formatMultiplier(1.234)).toBe('1.23x');
  });

  it('formats zero', () => {
    expect(formatMultiplier(0)).toBe('0.00x');
  });
});

describe('timeToMultiplier()', () => {
  it('returns 1 at time 0', () => {
    expect(timeToMultiplier(0)).toBeCloseTo(1, 5);
  });

  it('returns >1 for positive elapsed time', () => {
    expect(timeToMultiplier(10000)).toBeGreaterThan(1);
  });

  it('respects custom base speed', () => {
    const slow = timeToMultiplier(10000, 0.00001);
    const fast = timeToMultiplier(10000, 0.0001);
    expect(fast).toBeGreaterThan(slow);
  });
});

describe('getMultiplierColor()', () => {
  it('returns amber for very low multipliers', () => {
    expect(getMultiplierColor(1.0)).toBe('rgb(255, 177, 60)');
  });

  it('returns orange for ~1.5-2x', () => {
    expect(getMultiplierColor(1.7)).toBe('rgb(255, 152, 0)');
  });

  it('returns deep orange around 2-3x', () => {
    expect(getMultiplierColor(2.5)).toBe('rgb(255, 87, 34)');
  });

  it('returns red for 3-5x', () => {
    expect(getMultiplierColor(4)).toBe('rgb(244, 67, 54)');
  });

  it('returns pink for 5-10x', () => {
    expect(getMultiplierColor(7)).toBe('rgb(233, 30, 99)');
  });

  it('returns purple for 10-20x', () => {
    expect(getMultiplierColor(15)).toBe('rgb(156, 39, 176)');
  });

  it('returns deep purple for >=20x', () => {
    expect(getMultiplierColor(50)).toBe('rgb(103, 58, 183)');
  });
});
