import { describe, it, expect } from 'vitest';
import {
  getWheelSegments,
  generateWheelResult,
  calculateRotationAngle,
  formatMultiplier,
  calculateProfit,
} from './wheelUtils';

describe('getWheelSegments()', () => {
  it('returns 12-segment array for easy', () => {
    expect(getWheelSegments('easy')).toHaveLength(12);
  });

  it('returns 12-segment array for medium (default)', () => {
    expect(getWheelSegments()).toHaveLength(12);
    expect(getWheelSegments('medium')).toHaveLength(12);
  });

  it('returns 12-segment array for hard', () => {
    expect(getWheelSegments('hard')).toHaveLength(12);
  });

  it('falls back to medium for unknown difficulty', () => {
    expect(getWheelSegments('insane')).toEqual(getWheelSegments('medium'));
  });

  it('each segment has multiplier and color', () => {
    for (const seg of getWheelSegments('medium')) {
      expect(typeof seg.multiplier).toBe('number');
      expect(typeof seg.color).toBe('string');
    }
  });

  it('hard has more zero-multiplier segments than easy', () => {
    const easyZeros = getWheelSegments('easy').filter((s) => s.multiplier === 0).length;
    const hardZeros = getWheelSegments('hard').filter((s) => s.multiplier === 0).length;
    expect(hardZeros).toBeGreaterThan(easyZeros);
  });
});

describe('generateWheelResult()', () => {
  it('returns object with segmentIndex, multiplier, color, timestamp', () => {
    const segs = getWheelSegments('medium');
    const r = generateWheelResult('seed', segs);
    expect(r).toHaveProperty('segmentIndex');
    expect(r).toHaveProperty('multiplier');
    expect(r).toHaveProperty('color');
    expect(r).toHaveProperty('timestamp');
  });

  it('returns segmentIndex within bounds', () => {
    const segs = getWheelSegments('medium');
    const r = generateWheelResult('seed', segs);
    expect(r.segmentIndex).toBeGreaterThanOrEqual(0);
    expect(r.segmentIndex).toBeLessThan(segs.length);
  });

  it('works with empty seed', () => {
    const segs = getWheelSegments('easy');
    const r = generateWheelResult('', segs);
    expect(typeof r.multiplier).toBe('number');
  });
});

describe('calculateRotationAngle()', () => {
  it('returns a number', () => {
    expect(typeof calculateRotationAngle(0, 12)).toBe('number');
  });

  it('includes at least 4 full rotations (1440deg base)', () => {
    const angle = calculateRotationAngle(0, 12);
    // Random offset within +/- 9 degrees, then add 1440. Lower bound ~1440-9
    expect(angle).toBeGreaterThan(1400);
  });
});

describe('formatMultiplier()', () => {
  it('formats as Nx with 2 decimals', () => {
    expect(formatMultiplier(2)).toBe('2.00x');
  });

  it('formats decimal', () => {
    expect(formatMultiplier(1.5)).toBe('1.50x');
  });

  it('formats zero', () => {
    expect(formatMultiplier(0)).toBe('0.00x');
  });
});

describe('calculateProfit()', () => {
  it('returns bet*(multiplier-1)', () => {
    expect(calculateProfit(100, 2)).toBe(100);
    expect(calculateProfit(50, 3)).toBe(100);
  });

  it('returns negative for losing multiplier (<1)', () => {
    expect(calculateProfit(100, 0.5)).toBe(-50);
  });

  it('returns -bet for zero multiplier', () => {
    expect(calculateProfit(100, 0)).toBe(-100);
  });
});
