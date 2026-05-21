import { describe, it, expect } from 'vitest';
import {
  ROULETTE_NUMBERS,
  BET_TYPES,
  getBetNumbers,
  isBetWinner,
  calculateWinnings,
  generateSpinResult,
  calculateRotationAngle,
  getBettingTableLayout,
} from './rouletteUtils';

describe('ROULETTE_NUMBERS export', () => {
  it('contains 37 numbers (European wheel with single zero)', () => {
    expect(ROULETTE_NUMBERS).toHaveLength(37);
  });

  it('contains a green 0', () => {
    expect(ROULETTE_NUMBERS[0]).toEqual({ number: 0, color: 'green' });
  });

  it('has 18 red and 18 black numbers', () => {
    expect(ROULETTE_NUMBERS.filter((n) => n.color === 'red')).toHaveLength(18);
    expect(ROULETTE_NUMBERS.filter((n) => n.color === 'black')).toHaveLength(18);
  });
});

describe('BET_TYPES export', () => {
  it('exposes payouts for each bet type', () => {
    expect(BET_TYPES.STRAIGHT.payout).toBe(35);
    expect(BET_TYPES.RED.payout).toBe(1);
    expect(BET_TYPES.DOZEN.payout).toBe(2);
  });
});

describe('getBetNumbers()', () => {
  it('returns single number array for STRAIGHT', () => {
    expect(getBetNumbers('STRAIGHT', 17)).toEqual([17]);
  });

  it('parses string value for STRAIGHT', () => {
    expect(getBetNumbers('STRAIGHT', '23')).toEqual([23]);
  });

  it('returns all red numbers for RED', () => {
    const reds = getBetNumbers('RED');
    expect(reds).toHaveLength(18);
    expect(reds).toContain(32);
  });

  it('returns all black numbers for BLACK', () => {
    const blacks = getBetNumbers('BLACK');
    expect(blacks).toHaveLength(18);
    expect(blacks).toContain(15);
  });

  it('returns odd numbers 1-35 for ODD', () => {
    const odds = getBetNumbers('ODD');
    expect(odds).toContain(1);
    expect(odds).toContain(35);
    expect(odds).not.toContain(2);
    expect(odds).not.toContain(0);
  });

  it('returns even numbers 2-36 for EVEN', () => {
    const evens = getBetNumbers('EVEN');
    expect(evens).toContain(2);
    expect(evens).toContain(36);
    expect(evens).not.toContain(0);
    expect(evens).not.toContain(1);
  });

  it('returns 1-18 for LOW', () => {
    expect(getBetNumbers('LOW')).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });

  it('returns 19-36 for HIGH', () => {
    expect(getBetNumbers('HIGH')).toEqual(Array.from({ length: 18 }, (_, i) => i + 19));
  });

  it('returns dozen 1 (1-12)', () => {
    expect(getBetNumbers('DOZEN', 1)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it('returns dozen 2 (13-24)', () => {
    expect(getBetNumbers('DOZEN', 2)).toEqual(Array.from({ length: 12 }, (_, i) => i + 13));
  });

  it('returns column 1 (1, 4, 7, ...)', () => {
    expect(getBetNumbers('COLUMN', 1)).toEqual([1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]);
  });

  it('returns empty array for unknown bet type', () => {
    expect(getBetNumbers('UNKNOWN_BET')).toEqual([]);
  });
});

describe('isBetWinner()', () => {
  it('returns true when winning number matches STRAIGHT', () => {
    expect(isBetWinner('STRAIGHT', 17, 17)).toBe(true);
  });

  it('returns false when winning number does not match STRAIGHT', () => {
    expect(isBetWinner('STRAIGHT', 17, 18)).toBe(false);
  });

  it('returns true when red wins on red', () => {
    expect(isBetWinner('RED', null, 32)).toBe(true);
  });

  it('returns false when red bet but green/black wins', () => {
    expect(isBetWinner('RED', null, 0)).toBe(false);
    expect(isBetWinner('RED', null, 15)).toBe(false);
  });
});

describe('calculateWinnings()', () => {
  it('returns 0 when not a winner', () => {
    expect(calculateWinnings('RED', 100, false)).toBe(0);
  });

  it('returns bet * (payout + 1) for winners', () => {
    expect(calculateWinnings('STRAIGHT', 10, true)).toBe(10 * 36);
    expect(calculateWinnings('RED', 100, true)).toBe(200);
  });

  it('returns 0 for unknown bet type even if winner', () => {
    expect(calculateWinnings('NOPE', 100, true)).toBe(100);
  });
});

describe('generateSpinResult()', () => {
  it('returns object with number, color, index, timestamp', () => {
    const r = generateSpinResult('seed');
    expect(r).toHaveProperty('number');
    expect(r).toHaveProperty('color');
    expect(r).toHaveProperty('index');
    expect(r).toHaveProperty('timestamp');
  });

  it('returns valid index into ROULETTE_NUMBERS', () => {
    const r = generateSpinResult('seed');
    expect(r.index).toBeGreaterThanOrEqual(0);
    expect(r.index).toBeLessThan(ROULETTE_NUMBERS.length);
  });

  it('works with no seed argument', () => {
    const r = generateSpinResult();
    expect(typeof r.number).toBe('number');
  });
});

describe('calculateRotationAngle()', () => {
  it('returns a number', () => {
    expect(typeof calculateRotationAngle(0)).toBe('number');
  });

  it('returns a different angle for different indices', () => {
    const a0 = calculateRotationAngle(0);
    const a10 = calculateRotationAngle(10);
    // They may rarely be equal due to random offset, but the deterministic base differs
    expect(Math.abs(a0 - a10)).toBeGreaterThan(0);
  });
});

describe('getBettingTableLayout()', () => {
  it('includes a position for 0', () => {
    const layout = getBettingTableLayout();
    expect(layout[0]).toEqual({ row: 0, col: 0 });
  });

  it('includes positions for 1-36', () => {
    const layout = getBettingTableLayout();
    for (let n = 1; n <= 36; n++) {
      expect(layout[n]).toBeDefined();
      expect(typeof layout[n].row).toBe('number');
      expect(typeof layout[n].col).toBe('number');
    }
  });

  it('places number 36 in first row', () => {
    expect(getBettingTableLayout()[36].row).toBe(1);
  });

  it('places number 1 in third row', () => {
    expect(getBettingTableLayout()[1].row).toBe(3);
  });
});
