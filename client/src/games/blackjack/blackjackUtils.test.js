import { describe, it, expect } from 'vitest';
import {
  calculateHandValue,
  isBlackjack,
  isBust,
  getHandStatus,
  determineWinner,
  getPayoutMultiplier,
  SUITS,
  RANKS,
} from './blackjackUtils';

const c = (rank, suit = 'hearts') => ({ rank, suit });

describe('SUITS / RANKS exports', () => {
  it('exports four suits', () => {
    expect(SUITS).toEqual(['hearts', 'diamonds', 'clubs', 'spades']);
  });

  it('exports 13 ranks', () => {
    expect(RANKS).toHaveLength(13);
    expect(RANKS).toContain('A');
    expect(RANKS).toContain('K');
  });
});

describe('calculateHandValue()', () => {
  it('returns 0 for empty hand', () => {
    expect(calculateHandValue([])).toBe(0);
  });

  it('returns 0 for null/undefined hand', () => {
    expect(calculateHandValue(null)).toBe(0);
    expect(calculateHandValue(undefined)).toBe(0);
  });

  it('sums numeric cards', () => {
    expect(calculateHandValue([c('5'), c('6')])).toBe(11);
  });

  it('treats face cards as 10', () => {
    expect(calculateHandValue([c('J'), c('Q')])).toBe(20);
    expect(calculateHandValue([c('K'), c('10')])).toBe(20);
  });

  it('counts ace as 11 when total stays <= 21', () => {
    expect(calculateHandValue([c('A'), c('9')])).toBe(20);
  });

  it('counts ace as 1 when otherwise busting', () => {
    expect(calculateHandValue([c('A'), c('9'), c('5')])).toBe(15);
  });

  it('handles multiple aces correctly', () => {
    // A + A = 12 (one ace high, one low)
    expect(calculateHandValue([c('A'), c('A')])).toBe(12);
    // A + A + 9 = 21
    expect(calculateHandValue([c('A'), c('A'), c('9')])).toBe(21);
    // A + A + A + A = 14 (one ace high, rest low)
    expect(calculateHandValue([c('A'), c('A'), c('A'), c('A')])).toBe(14);
  });
});

describe('isBlackjack()', () => {
  it('true for ace + 10 with 2 cards', () => {
    expect(isBlackjack([c('A'), c('K')])).toBe(true);
  });

  it('false for 21 with 3+ cards', () => {
    expect(isBlackjack([c('7'), c('7'), c('7')])).toBe(false);
  });

  it('false for non-21 hands', () => {
    expect(isBlackjack([c('A'), c('5')])).toBe(false);
  });
});

describe('isBust()', () => {
  it('true when value > 21', () => {
    expect(isBust([c('K'), c('Q'), c('5')])).toBe(true);
  });

  it('false for exactly 21', () => {
    expect(isBust([c('A'), c('K')])).toBe(false);
  });

  it('false for empty hand', () => {
    expect(isBust([])).toBe(false);
  });
});

describe('getHandStatus()', () => {
  it('returns empty string for empty hand', () => {
    expect(getHandStatus([])).toBe('');
  });

  it('returns "Blackjack!" for natural 21', () => {
    expect(getHandStatus([c('A'), c('Q')])).toBe('Blackjack!');
  });

  it('returns "Bust!" when bust', () => {
    expect(getHandStatus([c('K'), c('Q'), c('5')])).toBe('Bust!');
  });

  it('returns numeric string for ordinary hand', () => {
    expect(getHandStatus([c('5'), c('6')])).toBe('11');
  });
});

describe('determineWinner()', () => {
  it('returns push when both have blackjack', () => {
    expect(determineWinner([c('A'), c('K')], [c('A'), c('Q')])).toBe('push');
  });

  it('returns player when only player has blackjack', () => {
    expect(determineWinner([c('A'), c('K')], [c('10'), c('9')])).toBe('player');
  });

  it('returns dealer when only dealer has blackjack', () => {
    expect(determineWinner([c('10'), c('9')], [c('A'), c('K')])).toBe('dealer');
  });

  it('returns dealer when player busts', () => {
    expect(determineWinner([c('K'), c('Q'), c('5')], [c('10'), c('7')])).toBe('dealer');
  });

  it('returns player when dealer busts', () => {
    expect(determineWinner([c('10'), c('7')], [c('K'), c('Q'), c('5')])).toBe('player');
  });

  it('returns push for tie scores', () => {
    expect(determineWinner([c('10'), c('8')], [c('9'), c('9')])).toBe('push');
  });

  it('returns player when player has higher score', () => {
    expect(determineWinner([c('10'), c('9')], [c('10'), c('7')])).toBe('player');
  });

  it('returns dealer when dealer has higher score', () => {
    expect(determineWinner([c('10'), c('5')], [c('10'), c('8')])).toBe('dealer');
  });
});

describe('getPayoutMultiplier()', () => {
  it('returns 2.5 for player win with blackjack', () => {
    expect(getPayoutMultiplier('player', true)).toBe(2.5);
  });

  it('returns 2.0 for player win without blackjack', () => {
    expect(getPayoutMultiplier('player', false)).toBe(2.0);
  });

  it('returns 1.0 for push', () => {
    expect(getPayoutMultiplier('push')).toBe(1.0);
  });

  it('returns 0 for dealer win', () => {
    expect(getPayoutMultiplier('dealer')).toBe(0);
  });

  it('returns 0 for unknown result', () => {
    expect(getPayoutMultiplier('unknown')).toBe(0);
  });
});
