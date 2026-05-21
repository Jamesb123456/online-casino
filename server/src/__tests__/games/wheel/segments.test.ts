// @ts-nocheck
import { describe, it, expect } from 'vitest';

import {
  DEFAULT_SEGMENT_PAYOUTS,
  resolveMultiplier,
  SEGMENT_COUNT,
} from '../../../games/wheel/segments.js';
import { MAX_PAYOUT_MULTIPLIER } from '../../../utils/gameUtils.js';

describe('wheel/segments', () => {
  describe('DEFAULT_SEGMENT_PAYOUTS', () => {
    it('has 12 segments per difficulty', () => {
      expect(SEGMENT_COUNT).toBe(12);
      expect(DEFAULT_SEGMENT_PAYOUTS.easy).toHaveLength(12);
      expect(DEFAULT_SEGMENT_PAYOUTS.medium).toHaveLength(12);
      expect(DEFAULT_SEGMENT_PAYOUTS.hard).toHaveLength(12);
    });

    it('matches the documented payouts verbatim', () => {
      expect(DEFAULT_SEGMENT_PAYOUTS.easy).toEqual([0, 0.2, 0.3, 0.5, 0.5, 0.8, 1.0, 1.0, 1.2, 1.5, 1.5, 3.0]);
      expect(DEFAULT_SEGMENT_PAYOUTS.medium).toEqual([0, 0, 0, 0.1, 0.2, 0.3, 0.5, 0.5, 1.0, 1.5, 2.0, 5.0]);
      expect(DEFAULT_SEGMENT_PAYOUTS.hard).toEqual([0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.5, 1.0, 2.0, 7.0]);
    });
  });

  describe('resolveMultiplier()', () => {
    it('returns the right default value per difficulty + segmentIndex', () => {
      expect(resolveMultiplier('easy', 11)).toBe(3.0);
      expect(resolveMultiplier('medium', 11)).toBe(5.0);
      expect(resolveMultiplier('hard', 11)).toBe(7.0);
      expect(resolveMultiplier('easy', 0)).toBe(0);
      expect(resolveMultiplier('medium', 3)).toBe(0.1);
      expect(resolveMultiplier('hard', 9)).toBe(1.0);
    });

    it('falls back to defaults when override is missing the difficulty', () => {
      expect(resolveMultiplier('easy', 5, {})).toBe(0.8);
      expect(resolveMultiplier('medium', 6, null)).toBe(0.5);
      expect(resolveMultiplier('easy', 5, { hard: [1, 2, 3] })).toBe(0.8);
    });

    it('falls back to defaults when override array is empty', () => {
      expect(resolveMultiplier('easy', 7, { easy: [] })).toBe(1.0);
    });

    it('uses override value when provided', () => {
      const override = {
        easy: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9.99],
      };
      expect(resolveMultiplier('easy', 11, override)).toBe(9.99);
      expect(resolveMultiplier('easy', 0, override)).toBe(0);
    });

    it('caps result at MAX_PAYOUT_MULTIPLIER', () => {
      const override = {
        medium: Array(12).fill(MAX_PAYOUT_MULTIPLIER * 10),
      };
      const result = resolveMultiplier('medium', 5, override);
      expect(result).toBe(MAX_PAYOUT_MULTIPLIER);
    });

    it('returns 0 for an undefined / non-finite override value', () => {
      const override = { easy: [0, NaN, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
      // NaN is not finite → falls back to default at index 1, which is 0.2.
      expect(resolveMultiplier('easy', 1, override)).toBe(0.2);
    });

    it('clamps negative override values to 0', () => {
      const override = { easy: [-5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
      expect(resolveMultiplier('easy', 0, override)).toBe(0);
    });
  });
});
