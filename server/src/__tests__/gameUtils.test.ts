import { describe, it, expect } from 'vitest';
import {
  createDeck,
  shuffleArray,
  getRandomInt,
  calculateHandValue,
  isBlackjack,
  isBusted,
  determineWinner,
  shouldDealerHit,
  calculatePayout,
  calculateHouseEdge,
  generateGameStats,
  SUITS,
  VALUES,
} from '../utils/gameUtils.js';

// ---------------------------------------------------------------------------
// Helper: create a card with a specific value (suit is irrelevant for scoring)
// ---------------------------------------------------------------------------
function card(value: string, suit = 'hearts') {
  return { suit, value, image: `/assets/cards/${value}_of_${suit}.png` };
}

// ---------------------------------------------------------------------------
// createDeck
// ---------------------------------------------------------------------------
describe('createDeck()', () => {
  it('should return exactly 52 cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
  });

  it('should contain 4 suits with 13 values each', () => {
    const deck = createDeck();
    for (const suit of SUITS) {
      const suitCards = deck.filter((c) => c.suit === suit);
      expect(suitCards).toHaveLength(13);
    }
  });

  it('should have no duplicate cards', () => {
    const deck = createDeck();
    const keys = deck.map((c) => `${c.suit}-${c.value}`);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(52);
  });

  it('should include correct image path for each card', () => {
    const deck = createDeck();
    for (const c of deck) {
      expect(c.image).toBe(`/assets/cards/${c.value}_of_${c.suit}.png`);
    }
  });

  it('should contain all expected values (A through K)', () => {
    const deck = createDeck();
    const values = new Set(deck.map((c) => c.value));
    expect([...values].sort()).toEqual([...VALUES].sort());
  });
});

// ---------------------------------------------------------------------------
// shuffleArray
// ---------------------------------------------------------------------------
describe('shuffleArray()', () => {
  it('should return an array with the same length', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(arr);
    expect(shuffled).toHaveLength(arr.length);
  });

  it('should contain the same elements', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = shuffleArray(arr);
    expect(shuffled.sort((a, b) => a - b)).toEqual(arr.sort((a, b) => a - b));
  });

  it('should not mutate the original array', () => {
    const arr = [1, 2, 3, 4, 5];
    const original = [...arr];
    shuffleArray(arr);
    expect(arr).toEqual(original);
  });

  it('should produce a different ordering (statistical, may rarely fail)', () => {
    const arr = Array.from({ length: 52 }, (_, i) => i);
    const shuffled = shuffleArray(arr);
    // With 52 items the chance of identical order is astronomically small
    const isSameOrder = arr.every((v, i) => v === shuffled[i]);
    expect(isSameOrder).toBe(false);
  });

  it('should handle an empty array', () => {
    expect(shuffleArray([])).toEqual([]);
  });

  it('should handle a single-element array', () => {
    expect(shuffleArray([42])).toEqual([42]);
  });
});

// ---------------------------------------------------------------------------
// getRandomInt
// ---------------------------------------------------------------------------
describe('getRandomInt()', () => {
  it('should return an integer between min and max inclusive', () => {
    for (let i = 0; i < 100; i++) {
      const val = getRandomInt(1, 10);
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(10);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it('should return the exact value when min equals max', () => {
    expect(getRandomInt(5, 5)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// calculateHandValue
// ---------------------------------------------------------------------------
describe('calculateHandValue()', () => {
  it('should return 0 for an empty hand', () => {
    expect(calculateHandValue([])).toBe(0);
  });

  it('should return 0 for null/undefined input', () => {
    expect(calculateHandValue(null)).toBe(0);
    expect(calculateHandValue(undefined)).toBe(0);
  });

  it('should correctly score number cards', () => {
    const hand = [card('2'), card('5'), card('3')];
    expect(calculateHandValue(hand)).toBe(10);
  });

  it('should score face cards (J, Q, K) as 10 each', () => {
    const hand = [card('J'), card('Q'), card('K')];
    expect(calculateHandValue(hand)).toBe(30);
  });

  it('should score a single Ace as 11', () => {
    const hand = [card('A')];
    expect(calculateHandValue(hand)).toBe(11);
  });

  it('should score Ace as 1 when 11 would cause a bust', () => {
    const hand = [card('A'), card('K'), card('5')];
    // A=11 + K=10 + 5 = 26 -> bust, so A becomes 1 -> 16
    expect(calculateHandValue(hand)).toBe(16);
  });

  it('should handle two Aces correctly', () => {
    const hand = [card('A'), card('A')];
    // Both as 11 = 22, bust. One becomes 1 = 12.
    expect(calculateHandValue(hand)).toBe(12);
  });

  it('should handle three Aces correctly', () => {
    const hand = [card('A'), card('A'), card('A')];
    // All as 11 = 33 -> two become 1 -> 13
    expect(calculateHandValue(hand)).toBe(13);
  });

  it('should score a blackjack hand (A + 10-value) as 21', () => {
    expect(calculateHandValue([card('A'), card('K')])).toBe(21);
    expect(calculateHandValue([card('A'), card('10')])).toBe(21);
    expect(calculateHandValue([card('A'), card('Q')])).toBe(21);
    expect(calculateHandValue([card('A'), card('J')])).toBe(21);
  });

  it('should score a soft 17 (A + 6)', () => {
    expect(calculateHandValue([card('A'), card('6')])).toBe(17);
  });

  it('should correctly handle a complex hand: A, 3, 7, A', () => {
    // A=11 + 3 + 7 + A=11 = 32 -> first A becomes 1 = 22 -> second A becomes 1 = 12
    expect(calculateHandValue([card('A'), card('3'), card('7'), card('A')])).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// isBlackjack
// ---------------------------------------------------------------------------
describe('isBlackjack()', () => {
  it('should return true for Ace + King', () => {
    expect(isBlackjack([card('A'), card('K')])).toBe(true);
  });

  it('should return true for Ace + 10', () => {
    expect(isBlackjack([card('A'), card('10')])).toBe(true);
  });

  it('should return false for three cards that total 21', () => {
    expect(isBlackjack([card('7'), card('7'), card('7')])).toBe(false);
  });

  it('should return false for two cards that do not total 21', () => {
    expect(isBlackjack([card('K'), card('9')])).toBe(false);
  });

  it('should return false for a single card', () => {
    expect(isBlackjack([card('A')])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isBusted
// ---------------------------------------------------------------------------
describe('isBusted()', () => {
  it('should return true when hand value exceeds 21', () => {
    const hand = [card('K'), card('Q'), card('5')];
    expect(isBusted(hand)).toBe(true);
  });

  it('should return false when hand value is exactly 21', () => {
    const hand = [card('A'), card('K')];
    expect(isBusted(hand)).toBe(false);
  });

  it('should return false when hand value is under 21', () => {
    const hand = [card('5'), card('3')];
    expect(isBusted(hand)).toBe(false);
  });

  it('should return false for an empty hand', () => {
    expect(isBusted([])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// determineWinner
// ---------------------------------------------------------------------------
describe('determineWinner()', () => {
  it('should return "blackjack" when only the player has blackjack', () => {
    const player = [card('A'), card('K')];
    const dealer = [card('10'), card('9')];
    expect(determineWinner(player, dealer)).toBe('blackjack');
  });

  it('should return "dealer" when only the dealer has blackjack', () => {
    const player = [card('10'), card('9')];
    const dealer = [card('A'), card('Q')];
    expect(determineWinner(player, dealer)).toBe('dealer');
  });

  it('should return "push" when both have blackjack', () => {
    const player = [card('A'), card('K')];
    const dealer = [card('A'), card('Q')];
    expect(determineWinner(player, dealer)).toBe('push');
  });

  it('should return "dealer" when the player busts', () => {
    const player = [card('K'), card('Q'), card('5')];
    const dealer = [card('10'), card('7')];
    expect(determineWinner(player, dealer)).toBe('dealer');
  });

  it('should return "player" when the dealer busts', () => {
    const player = [card('10'), card('7')];
    const dealer = [card('K'), card('Q'), card('5')];
    expect(determineWinner(player, dealer)).toBe('player');
  });

  it('should return "dealer" even if both bust (player checked first)', () => {
    const player = [card('K'), card('Q'), card('5')];
    const dealer = [card('K'), card('Q'), card('3')];
    // Player value = 25 (bust), so dealer wins immediately
    expect(determineWinner(player, dealer)).toBe('dealer');
  });

  it('should return "player" when player has higher value without busting', () => {
    const player = [card('10'), card('9')]; // 19
    const dealer = [card('10'), card('7')]; // 17
    expect(determineWinner(player, dealer)).toBe('player');
  });

  it('should return "dealer" when dealer has higher value without busting', () => {
    const player = [card('10'), card('6')]; // 16
    const dealer = [card('10'), card('8')]; // 18
    expect(determineWinner(player, dealer)).toBe('dealer');
  });

  it('should return "push" when both have the same value', () => {
    const player = [card('10'), card('8')]; // 18
    const dealer = [card('9'), card('9')]; // 18
    expect(determineWinner(player, dealer)).toBe('push');
  });
});

// ---------------------------------------------------------------------------
// shouldDealerHit
// ---------------------------------------------------------------------------
describe('shouldDealerHit()', () => {
  it('should return true when dealer hand value is 16 or less', () => {
    expect(shouldDealerHit([card('10'), card('6')])).toBe(true);  // 16
    expect(shouldDealerHit([card('5'), card('3')])).toBe(true);   // 8
  });

  it('should return false when dealer hand value is 17 or more', () => {
    expect(shouldDealerHit([card('10'), card('7')])).toBe(false); // 17
    expect(shouldDealerHit([card('10'), card('9')])).toBe(false); // 19
    expect(shouldDealerHit([card('A'), card('K')])).toBe(false);  // 21
  });
});

// ---------------------------------------------------------------------------
// calculatePayout
// ---------------------------------------------------------------------------
describe('calculatePayout()', () => {
  it('should return 1.5x bet for blackjack (3:2 payout)', () => {
    expect(calculatePayout(100, 'blackjack')).toBe(150);
  });

  it('should return 1x bet for a regular player win', () => {
    expect(calculatePayout(100, 'player')).toBe(100);
  });

  it('should return 0 for a push', () => {
    expect(calculatePayout(100, 'push')).toBe(0);
  });

  it('should return negative bet for a dealer win (player loss)', () => {
    expect(calculatePayout(100, 'dealer')).toBe(-100);
  });

  it('should return 0 for an unknown result', () => {
    expect(calculatePayout(100, 'invalid')).toBe(0);
  });

  it('should handle fractional bets correctly', () => {
    expect(calculatePayout(33.33, 'blackjack')).toBeCloseTo(49.995);
    expect(calculatePayout(33.33, 'player')).toBeCloseTo(33.33);
  });
});

// ---------------------------------------------------------------------------
// calculateHouseEdge
// ---------------------------------------------------------------------------
describe('calculateHouseEdge()', () => {
  it('should return 0.005 for blackjack', () => {
    expect(calculateHouseEdge('blackjack')).toBe(0.005);
  });

  it('should return 0.027 for roulette', () => {
    expect(calculateHouseEdge('roulette')).toBe(0.027);
  });

  it('should return 0.01 for crash', () => {
    expect(calculateHouseEdge('crash')).toBe(0.01);
  });

  it('should return 0.04 for wheel', () => {
    expect(calculateHouseEdge('wheel')).toBe(0.04);
  });

  it('should return 0.02 for plinko', () => {
    expect(calculateHouseEdge('plinko')).toBe(0.02);
  });

  it('should return the default 0.02 for unknown game types', () => {
    expect(calculateHouseEdge('slots')).toBe(0.02);
    expect(calculateHouseEdge('')).toBe(0.02);
  });
});

// ---------------------------------------------------------------------------
// generateGameStats
// ---------------------------------------------------------------------------
describe('generateGameStats()', () => {
  it('should return a stats object with all expected fields', () => {
    const input = {
      gameType: 'crash',
      userId: 1,
      betAmount: 100,
      payout: 200,
      result: 'win',
    };

    const stats = generateGameStats(input);

    expect(stats.gameType).toBe('crash');
    expect(stats.userId).toBe(1);
    expect(stats.betAmount).toBe(100);
    expect(stats.payout).toBe(200);
    expect(stats.result).toBe('win');
    expect(stats.isWin).toBe(true);
    expect(stats.timestamp).toBeInstanceOf(Date);
  });

  it('should mark isWin as false when payout is 0 or negative', () => {
    const stats = generateGameStats({
      gameType: 'crash',
      userId: 1,
      betAmount: 100,
      payout: 0,
      result: 'loss',
    });
    expect(stats.isWin).toBe(false);

    const stats2 = generateGameStats({
      gameType: 'crash',
      userId: 1,
      betAmount: 100,
      payout: -100,
      result: 'loss',
    });
    expect(stats2.isWin).toBe(false);
  });
});
