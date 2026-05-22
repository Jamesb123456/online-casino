import { describe, it, expect } from 'vitest';
import {
  rouletteRtp,
  wheelRtp,
  plinkoRtp,
  blackjackRtp,
  rtpToHouseEdge,
  resolveHouseEdgeFloor,
  MIN_HOUSE_EDGE_FRACTION,
} from '@/lib/payoutMath';

describe('payoutMath', () => {
  describe('rouletteRtp', () => {
    it('returns 0 for empty table', () => {
      expect(rouletteRtp({}, 0)).toBe(0);
    });

    it('computes RTP for a single straight bet', () => {
      // STRAIGHT pays 35: RTP = (1/37) * 36 = 0.9729...
      const rtp = rouletteRtp({ STRAIGHT: 35 }, 0);
      expect(rtp).toBeCloseTo(36 / 37, 5);
    });

    it('computes the average RTP across multiple bet types', () => {
      // RED pays 1 (18/37 * 2 = 36/37). STRAIGHT pays 35 (1/37 * 36 = 36/37).
      // Average is 36/37.
      const rtp = rouletteRtp({ RED: 1, STRAIGHT: 35 }, 0);
      expect(rtp).toBeCloseTo(36 / 37, 5);
    });

    it('ignores non-numeric multipliers', () => {
      const rtp = rouletteRtp({ RED: 1, BAD: NaN }, 0);
      expect(rtp).toBeCloseTo(36 / 37, 5);
    });
  });

  describe('wheelRtp', () => {
    it('returns 0 for missing difficulty', () => {
      expect(wheelRtp({}, 'easy', 0)).toBe(0);
    });

    it('returns mean of segments', () => {
      const table = { easy: [0, 1, 2, 3] };
      expect(wheelRtp(table, 'easy', 0)).toBeCloseTo(1.5, 5);
    });

    it('handles a single-segment array', () => {
      expect(wheelRtp({ easy: [2] }, 'easy', 0)).toBe(2);
    });
  });

  describe('plinkoRtp', () => {
    it('returns 0 for missing buckets', () => {
      expect(plinkoRtp({}, 'low', 8, 0)).toBe(0);
    });

    it('weights buckets by binomial pmf', () => {
      // 2-row plinko has 3 buckets. P(0)=1/4, P(1)=2/4, P(2)=1/4.
      // With multipliers [4, 0, 4] -> RTP = 0.25*4 + 0.5*0 + 0.25*4 = 2.0
      const table = { low: { 2: [4, 0, 4] } };
      expect(plinkoRtp(table, 'low', 2, 0)).toBeCloseTo(2.0, 5);
    });

    it('handles symmetric centre-weighted buckets', () => {
      // 2 rows, multipliers [1, 1, 1] -> RTP = 1 (full pmf sums to 1)
      const table = { medium: { 2: [1, 1, 1] } };
      expect(plinkoRtp(table, 'medium', 2, 0)).toBeCloseTo(1.0, 5);
    });
  });

  describe('blackjackRtp', () => {
    it('returns 0 for empty table', () => {
      expect(blackjackRtp({}, 0)).toBe(0);
    });

    it('applies the heuristic outcome mix', () => {
      // win=2, blackjack=2.5, push=1 -> 0.42*2 + 0.048*2.5 + 0.085*1 = 0.84 + 0.12 + 0.085 = 1.045
      expect(blackjackRtp({ win: 2, blackjack: 2.5, push: 1 }, 0)).toBeCloseTo(1.045, 5);
    });
  });

  describe('MIN_HOUSE_EDGE_FRACTION', () => {
    it('exposes a 1% floor', () => {
      expect(MIN_HOUSE_EDGE_FRACTION).toBeCloseTo(0.01, 5);
    });
  });

  describe('resolveHouseEdgeFloor', () => {
    it('returns the provided value when within [0,1]', () => {
      expect(resolveHouseEdgeFloor(0.05)).toBeCloseTo(0.05, 5);
      expect(resolveHouseEdgeFloor(0)).toBe(0);
      expect(resolveHouseEdgeFloor(1)).toBe(1);
    });

    it('falls back to MIN_HOUSE_EDGE_FRACTION for invalid inputs', () => {
      expect(resolveHouseEdgeFloor(undefined)).toBe(MIN_HOUSE_EDGE_FRACTION);
      // Note: Number(null) === 0, which is finite and in [0,1] -> returns 0 (the valid path).
      expect(resolveHouseEdgeFloor('not-a-number')).toBe(MIN_HOUSE_EDGE_FRACTION);
      expect(resolveHouseEdgeFloor(NaN)).toBe(MIN_HOUSE_EDGE_FRACTION);
      expect(resolveHouseEdgeFloor(-0.1)).toBe(MIN_HOUSE_EDGE_FRACTION);
      expect(resolveHouseEdgeFloor(1.5)).toBe(MIN_HOUSE_EDGE_FRACTION);
      expect(resolveHouseEdgeFloor(Infinity)).toBe(MIN_HOUSE_EDGE_FRACTION);
    });
  });

  describe('rtpToHouseEdge', () => {
    it('returns 1 - rtp', () => {
      expect(rtpToHouseEdge(0.96)).toBeCloseTo(0.04, 5);
      expect(rtpToHouseEdge(1)).toBe(0);
      expect(rtpToHouseEdge(0)).toBe(1);
    });
  });

  describe('rouletteRtp - all known bet types', () => {
    // Exercises each case in betTypeWins() so every branch is covered.
    const cases = [
      ['SPLIT', 17, (2 / 37) * 18],
      ['STREET', 11, (3 / 37) * 12],
      ['CORNER', 8, (4 / 37) * 9],
      ['FIVE', 6, (5 / 37) * 7],
      ['LINE', 5, (6 / 37) * 6],
      ['COLUMN', 2, (12 / 37) * 3],
      ['DOZEN', 2, (12 / 37) * 3],
      ['BLACK', 1, (18 / 37) * 2],
      ['ODD', 1, (18 / 37) * 2],
      ['EVEN', 1, (18 / 37) * 2],
      ['LOW', 1, (18 / 37) * 2],
      ['HIGH', 1, (18 / 37) * 2],
    ];
    it.each(cases)('computes RTP for %s', (bet, mult, expected) => {
      expect(rouletteRtp({ [bet]: mult }, 0)).toBeCloseTo(expected, 5);
    });

    it('uses 1/37 fallback for unknown bet keys', () => {
      // Unknown key 'MYSTERY' returns null from betTypeWins; fallback path uses 1/37.
      // RTP = (1/37) * (mult + 1)
      expect(rouletteRtp({ MYSTERY: 11 }, 0)).toBeCloseTo((1 / 37) * 12, 5);
    });

    it('returns 0 when all multipliers are non-numeric', () => {
      expect(rouletteRtp({ RED: NaN, BLACK: 'oops' }, 0)).toBe(0);
    });

    it('returns 0 when payoutTable is null', () => {
      expect(rouletteRtp(null, 0)).toBe(0);
      expect(rouletteRtp(undefined, 0)).toBe(0);
    });
  });

  describe('wheelRtp - edge cases', () => {
    it('returns 0 when payoutTable is null', () => {
      expect(wheelRtp(null, 'easy', 0)).toBe(0);
      expect(wheelRtp(undefined, 'easy', 0)).toBe(0);
    });

    it('returns 0 when segments array is empty', () => {
      expect(wheelRtp({ easy: [] }, 'easy', 0)).toBe(0);
    });

    it('returns 0 when all segments are non-numeric', () => {
      expect(wheelRtp({ easy: [NaN, 'oops'] }, 'easy', 0)).toBe(0);
    });

    it('skips non-numeric segments but averages the valid ones', () => {
      // [2, NaN, 4] -> valid: [2, 4] -> mean = 3
      expect(wheelRtp({ easy: [2, NaN, 4] }, 'easy', 0)).toBeCloseTo(3, 5);
    });
  });

  describe('plinkoRtp - edge cases', () => {
    it('returns 0 when payoutTable is null', () => {
      expect(plinkoRtp(null, 'low', 8, 0)).toBe(0);
    });

    it('returns 0 when buckets array is empty', () => {
      expect(plinkoRtp({ low: { 8: [] } }, 'low', 8, 0)).toBe(0);
    });

    it('skips non-numeric multipliers in buckets', () => {
      // 2 rows -> 3 buckets, pmf = [0.25, 0.5, 0.25]
      // [4, NaN, 4] -> RTP = 0.25*4 + 0 (NaN skipped) + 0.25*4 = 2
      expect(plinkoRtp({ low: { 2: [4, NaN, 4] } }, 'low', 2, 0)).toBeCloseTo(2, 5);
    });

    it('truncates when buckets array is shorter than rows+1', () => {
      // 2 rows -> expect 3 buckets; provide only 2.
      // RTP = pmf[0]*1 + pmf[1]*1 = 0.25 + 0.5 = 0.75
      expect(plinkoRtp({ low: { 2: [1, 1] } }, 'low', 2, 0)).toBeCloseTo(0.75, 5);
    });
  });
});
