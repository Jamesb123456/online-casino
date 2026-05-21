import { describe, it, expect } from 'vitest';
import {
  getPlinkoMultipliers,
  getPlinkoRows,
  generatePlinkoPath,
  getBucketFromPath,
  getNumberOfBuckets,
  formatMultiplier,
  getMultiplierColor,
} from './plinkoUtils';

describe('getPlinkoMultipliers()', () => {
  it('returns 17-element table for default (16 rows, medium)', () => {
    const m = getPlinkoMultipliers();
    expect(m).toHaveLength(17);
  });

  it('returns a non-empty multiplier array for each supported row count', () => {
    for (const rows of [8, 9, 10, 11, 12, 13, 14, 15, 16]) {
      const table = getPlinkoMultipliers('high', rows);
      expect(Array.isArray(table)).toBe(true);
      expect(table.length).toBeGreaterThan(0);
    }
  });

  it('low risk returns smaller edges than high risk', () => {
    const low = getPlinkoMultipliers('low', 16);
    const high = getPlinkoMultipliers('high', 16);
    expect(high[0]).toBeGreaterThan(low[0]);
  });

  it('falls back to 16-row medium for invalid rows', () => {
    const m = getPlinkoMultipliers('medium', 999);
    expect(m).toHaveLength(17);
  });

  it('falls back to 16-row medium for invalid risk', () => {
    const m = getPlinkoMultipliers('insane', 8);
    expect(m).toHaveLength(17);
  });

  it('returns symmetric arrays', () => {
    const m = getPlinkoMultipliers('medium', 12);
    for (let i = 0; i < m.length; i++) {
      expect(m[i]).toBe(m[m.length - 1 - i]);
    }
  });
});

describe('getPlinkoRows()', () => {
  it('returns 16 as default row count', () => {
    expect(getPlinkoRows()).toBe(16);
  });
});

describe('generatePlinkoPath()', () => {
  it('returns array with one entry per row', () => {
    const path = generatePlinkoPath('seed', 8);
    expect(path).toHaveLength(8);
  });

  it('entries are 0 or 1', () => {
    const path = generatePlinkoPath('seed', 10);
    for (const step of path) {
      expect([0, 1]).toContain(step);
    }
  });

  it('default rows = 8 when not supplied', () => {
    expect(generatePlinkoPath()).toHaveLength(8);
  });

  it('returns 16 entries for 16 rows', () => {
    expect(generatePlinkoPath('seed', 16)).toHaveLength(16);
  });
});

describe('getBucketFromPath()', () => {
  it('returns 0 for all-left path', () => {
    expect(getBucketFromPath([0, 0, 0, 0])).toBe(0);
  });

  it('returns length for all-right path', () => {
    expect(getBucketFromPath([1, 1, 1, 1])).toBe(4);
  });

  it('returns mixed bucket index', () => {
    expect(getBucketFromPath([1, 0, 1, 0, 1])).toBe(3);
  });

  it('returns 0 for empty path', () => {
    expect(getBucketFromPath([])).toBe(0);
  });
});

describe('getNumberOfBuckets()', () => {
  it('returns rows + 1', () => {
    expect(getNumberOfBuckets(8)).toBe(9);
    expect(getNumberOfBuckets(16)).toBe(17);
  });

  it('handles zero rows', () => {
    expect(getNumberOfBuckets(0)).toBe(1);
  });
});

describe('formatMultiplier()', () => {
  it('formats as Nx with 2 decimals', () => {
    expect(formatMultiplier(2.5)).toBe('2.50x');
  });

  it('formats integer multiplier', () => {
    expect(formatMultiplier(10)).toBe('10.00x');
  });
});

describe('getMultiplierColor()', () => {
  it('pink for >=5', () => {
    expect(getMultiplierColor(5)).toBe('rgb(233, 30, 99)');
  });

  it('purple for 2-5', () => {
    expect(getMultiplierColor(3)).toBe('rgb(156, 39, 176)');
  });

  it('blue for 1-2', () => {
    expect(getMultiplierColor(1.2)).toBe('rgb(33, 150, 243)');
  });

  it('cyan for 0.5-1', () => {
    expect(getMultiplierColor(0.7)).toBe('rgb(0, 188, 212)');
  });

  it('teal for <0.5', () => {
    expect(getMultiplierColor(0.2)).toBe('rgb(0, 150, 136)');
  });
});
