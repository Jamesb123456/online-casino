// @ts-nocheck
/**
 * Roulette payout-table tests.
 *
 * Each of the 14 bet types is asserted both ways:
 *   - a winning case → `winAmount = betAmount * (payout + 1)`
 *   - a losing case  → `winAmount = 0`, `profit = -betAmount`
 *
 * The winning numbers were chosen from the European single-zero wheel layout
 * in `wheel.ts`; reds/blacks/odds/evens come straight from the slot table.
 */
import { describe, it, expect } from 'vitest';
import {
  BET_TYPES,
  ALL_BET_TYPES,
  evaluateBet,
  isBetWinner,
  getBetNumbers,
  calculateWinnings,
} from '../../../games/roulette/payouts.js';

describe('BET_TYPES table', () => {
  it('has all 14 bet types with positive payouts', () => {
    expect(ALL_BET_TYPES).toHaveLength(14);
    for (const t of ALL_BET_TYPES) {
      expect(BET_TYPES[t].payout).toBeGreaterThan(0);
    }
  });

  it('matches the legacy payout multipliers', () => {
    expect(BET_TYPES.STRAIGHT.payout).toBe(35);
    expect(BET_TYPES.SPLIT.payout).toBe(17);
    expect(BET_TYPES.STREET.payout).toBe(11);
    expect(BET_TYPES.CORNER.payout).toBe(8);
    expect(BET_TYPES.FIVE.payout).toBe(6);
    expect(BET_TYPES.LINE.payout).toBe(5);
    expect(BET_TYPES.COLUMN.payout).toBe(2);
    expect(BET_TYPES.DOZEN.payout).toBe(2);
    expect(BET_TYPES.RED.payout).toBe(1);
    expect(BET_TYPES.BLACK.payout).toBe(1);
    expect(BET_TYPES.ODD.payout).toBe(1);
    expect(BET_TYPES.EVEN.payout).toBe(1);
    expect(BET_TYPES.LOW.payout).toBe(1);
    expect(BET_TYPES.HIGH.payout).toBe(1);
  });
});

describe('getBetNumbers', () => {
  it('STRAIGHT: returns [n] for valid number', () => {
    expect(getBetNumbers('STRAIGHT', 17)).toEqual([17]);
    expect(getBetNumbers('STRAIGHT', '17')).toEqual([17]);
  });

  it('RED: returns 18 red numbers', () => {
    const reds = getBetNumbers('RED', null);
    expect(reds).toHaveLength(18);
    expect(reds).toContain(32);
    expect(reds).toContain(1);
    expect(reds).not.toContain(0);
  });

  it('BLACK: returns 18 black numbers', () => {
    const blacks = getBetNumbers('BLACK', null);
    expect(blacks).toHaveLength(18);
    expect(blacks).toContain(15);
    expect(blacks).not.toContain(0);
  });

  it('ODD: returns odd numbers 1..35', () => {
    const odds = getBetNumbers('ODD', null);
    expect(odds).toHaveLength(18);
    expect(odds).toContain(1);
    expect(odds).toContain(35);
    expect(odds).not.toContain(0);
    expect(odds).not.toContain(2);
  });

  it('EVEN: returns even numbers 2..36', () => {
    const evens = getBetNumbers('EVEN', null);
    expect(evens).toHaveLength(18);
    expect(evens).toContain(2);
    expect(evens).toContain(36);
    expect(evens).not.toContain(0);
  });

  it('LOW: returns 1..18', () => {
    expect(getBetNumbers('LOW', null)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });

  it('HIGH: returns 19..36', () => {
    expect(getBetNumbers('HIGH', null)).toEqual(Array.from({ length: 18 }, (_, i) => i + 19));
  });

  it('DOZEN: returns the right 12-number set', () => {
    expect(getBetNumbers('DOZEN', 1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(getBetNumbers('DOZEN', 2)).toEqual([13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
    expect(getBetNumbers('DOZEN', 3)).toEqual([25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36]);
    expect(getBetNumbers('DOZEN', 4)).toEqual([]);
  });

  it('COLUMN: returns numbers in the named column', () => {
    expect(getBetNumbers('COLUMN', 1)).toEqual([1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]);
    expect(getBetNumbers('COLUMN', 2)).toEqual([2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35]);
    expect(getBetNumbers('COLUMN', 3)).toEqual([3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]);
  });

  it('SPLIT/STREET/CORNER/FIVE/LINE: parse comma-separated values', () => {
    expect(getBetNumbers('SPLIT', '1,2')).toEqual([1, 2]);
    expect(getBetNumbers('STREET', '1,2,3')).toEqual([1, 2, 3]);
    expect(getBetNumbers('CORNER', '1,2,4,5')).toEqual([1, 2, 4, 5]);
    expect(getBetNumbers('FIVE', '0,1,2,3,4')).toEqual([0, 1, 2, 3, 4]);
    expect(getBetNumbers('LINE', '1,2,3,4,5,6')).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('isBetWinner', () => {
  it('STRAIGHT winning vs losing', () => {
    expect(isBetWinner('STRAIGHT', 7, 7)).toBe(true);
    expect(isBetWinner('STRAIGHT', 7, 8)).toBe(false);
  });
  it('RED winning when the winning number is red (e.g. 32)', () => {
    expect(isBetWinner('RED', null, 32)).toBe(true);
    expect(isBetWinner('RED', null, 15)).toBe(false);
    expect(isBetWinner('RED', null, 0)).toBe(false);
  });
});

describe('evaluateBet — every bet type, win + loss', () => {
  const cases: Array<{
    label: string;
    type: any;
    value: any;
    winningNumber: number;
    losingNumber: number;
    expectedWinAmount: number;
  }> = [
    { label: 'STRAIGHT 17',         type: 'STRAIGHT', value: 17,        winningNumber: 17, losingNumber: 16, expectedWinAmount: 10 * 36 },
    { label: 'SPLIT 1,2',           type: 'SPLIT',    value: '1,2',     winningNumber: 1,  losingNumber: 3,  expectedWinAmount: 10 * 18 },
    { label: 'STREET 1,2,3',        type: 'STREET',   value: '1,2,3',   winningNumber: 2,  losingNumber: 4,  expectedWinAmount: 10 * 12 },
    { label: 'CORNER 1,2,4,5',      type: 'CORNER',   value: '1,2,4,5', winningNumber: 5,  losingNumber: 6,  expectedWinAmount: 10 * 9 },
    { label: 'FIVE 0,1,2,3',        type: 'FIVE',     value: '0,1,2,3', winningNumber: 0,  losingNumber: 5,  expectedWinAmount: 10 * 7 },
    { label: 'LINE 1..6',           type: 'LINE',     value: '1,2,3,4,5,6', winningNumber: 6,  losingNumber: 7,  expectedWinAmount: 10 * 6 },
    { label: 'COLUMN 1',            type: 'COLUMN',   value: 1,         winningNumber: 4,  losingNumber: 5,  expectedWinAmount: 10 * 3 },
    { label: 'DOZEN 2',             type: 'DOZEN',    value: 2,         winningNumber: 15, losingNumber: 5,  expectedWinAmount: 10 * 3 },
    { label: 'RED',                 type: 'RED',      value: null,      winningNumber: 32, losingNumber: 15, expectedWinAmount: 10 * 2 },
    { label: 'BLACK',               type: 'BLACK',    value: null,      winningNumber: 15, losingNumber: 32, expectedWinAmount: 10 * 2 },
    { label: 'ODD',                 type: 'ODD',      value: null,      winningNumber: 7,  losingNumber: 8,  expectedWinAmount: 10 * 2 },
    { label: 'EVEN',                type: 'EVEN',     value: null,      winningNumber: 4,  losingNumber: 7,  expectedWinAmount: 10 * 2 },
    { label: 'LOW',                 type: 'LOW',      value: null,      winningNumber: 5,  losingNumber: 20, expectedWinAmount: 10 * 2 },
    { label: 'HIGH',                type: 'HIGH',     value: null,      winningNumber: 25, losingNumber: 5,  expectedWinAmount: 10 * 2 },
  ];

  for (const tc of cases) {
    it(`${tc.label}: winning case credits bet*(payout+1)`, () => {
      const r = evaluateBet({ type: tc.type, value: tc.value, amount: 10 }, tc.winningNumber);
      expect(r.isWinner).toBe(true);
      expect(r.winAmount).toBe(tc.expectedWinAmount);
      expect(r.profit).toBe(tc.expectedWinAmount - 10);
    });

    it(`${tc.label}: losing case yields 0 win, -bet profit`, () => {
      const r = evaluateBet({ type: tc.type, value: tc.value, amount: 10 }, tc.losingNumber);
      expect(r.isWinner).toBe(false);
      expect(r.winAmount).toBe(0);
      expect(r.profit).toBe(-10);
    });
  }

  it('zero (green) is not red, black, odd, or even', () => {
    expect(evaluateBet({ type: 'RED', value: null, amount: 5 }, 0).isWinner).toBe(false);
    expect(evaluateBet({ type: 'BLACK', value: null, amount: 5 }, 0).isWinner).toBe(false);
    expect(evaluateBet({ type: 'ODD', value: null, amount: 5 }, 0).isWinner).toBe(false);
    expect(evaluateBet({ type: 'EVEN', value: null, amount: 5 }, 0).isWinner).toBe(false);
    expect(evaluateBet({ type: 'LOW', value: null, amount: 5 }, 0).isWinner).toBe(false);
    expect(evaluateBet({ type: 'HIGH', value: null, amount: 5 }, 0).isWinner).toBe(false);
  });
});

describe('calculateWinnings — payout override', () => {
  it('uses payoutsOverride when present', () => {
    const w = calculateWinnings('STRAIGHT', 10, true, { STRAIGHT: 50 });
    expect(w).toBe(10 * 51);
  });

  it('falls back to BET_TYPES when override missing for that type', () => {
    const w = calculateWinnings('RED', 10, true, { STRAIGHT: 50 });
    expect(w).toBe(10 * 2);
  });

  it('returns 0 for losing bets even with override', () => {
    expect(calculateWinnings('STRAIGHT', 10, false, { STRAIGHT: 50 })).toBe(0);
  });
});
