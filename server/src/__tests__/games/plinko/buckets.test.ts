// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
  resolveBucketMultiplier,
  MULTIPLIER_TABLES,
  MAX_PAYOUT_MULTIPLIER,
} from '../../../games/plinko/buckets.js';

describe('plinko/buckets.resolveBucketMultiplier', () => {
  it('returns the expected default multiplier for known (rows, risk, slot)', () => {
    // 16 rows, medium risk, edge bucket (slot 0) → 16.0 in MULTIPLIER_TABLES.
    expect(resolveBucketMultiplier(16, 'medium', 0)).toBe(16);
    // 16 rows, medium risk, centre bucket (slot 8) → 0.2.
    expect(resolveBucketMultiplier(16, 'medium', 8)).toBe(0.2);
    // 8 rows, high risk, edge (slot 0) → 15.
    expect(resolveBucketMultiplier(8, 'high', 0)).toBe(15);
    // 8 rows, low risk, centre (slot 4) → 0.8.
    expect(resolveBucketMultiplier(8, 'low', 4)).toBe(0.8);
  });

  it('uses the config override when provided', () => {
    const override = {
      medium: {
        '12': [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
      },
    };
    expect(resolveBucketMultiplier(12, 'medium', 0, override)).toBe(9);
    expect(resolveBucketMultiplier(12, 'medium', 6, override)).toBe(9);
  });

  it('falls back to defaults when override does not cover (rows, risk)', () => {
    const override = { medium: { '8': [1, 1, 1, 1, 1, 1, 1, 1, 1] } };
    // rows=10/medium has no override entry → defaults
    expect(resolveBucketMultiplier(10, 'medium', 0, override)).toBe(
      MULTIPLIER_TABLES[10].medium[0],
    );
  });

  it('caps any payout at MAX_PAYOUT_MULTIPLIER', () => {
    const override = {
      high: {
        '16': new Array(17).fill(9999),
      },
    };
    expect(resolveBucketMultiplier(16, 'high', 8, override)).toBe(MAX_PAYOUT_MULTIPLIER);
  });

  it('returns the fallback when the slot is out of range', () => {
    // slot = rows + 5 → out of range → fallback 0.5
    const m = resolveBucketMultiplier(8, 'medium', 99);
    expect(m).toBe(0.5);
  });

  it('returns the fallback when the table is missing entirely', () => {
    // unknown risk → no table → fallback
    expect(resolveBucketMultiplier(8, 'unknown' as any, 0)).toBe(0.5);
    // unknown rows → no table → fallback
    expect(resolveBucketMultiplier(99, 'medium', 0)).toBe(0.5);
  });

  it('returns the same multiplier for repeated lookups (purity)', () => {
    const a = resolveBucketMultiplier(12, 'medium', 6);
    const b = resolveBucketMultiplier(12, 'medium', 6);
    expect(a).toBe(b);
  });
});
