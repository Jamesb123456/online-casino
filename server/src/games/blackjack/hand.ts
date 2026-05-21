/**
 * Pure hand helpers for the Blackjack engine.
 *
 * The legacy `gameUtils.ts` exists but uses `card.value` for the rank string
 * AND a separate numeric `value` field on the legacy handler's Card type. The
 * engine sticks to the public Socket.IO contract: `Card = { suit, rank }`, with
 * no numeric value baked in (Aces are 1 or 11 depending on the rest of the
 * hand). Keeping these helpers local means the engine never has to translate
 * between the two card shapes.
 */

export interface Card {
  suit: string;
  rank: string;
}

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

/**
 * Score a hand. Aces start as 11 and demote to 1 as needed to keep the total
 * <= 21. Mirrors `BlackjackHandler.calculateScore` verbatim.
 */
export function calculateHandValue(hand: Card[]): number {
  if (!hand || hand.length === 0) return 0;
  let score = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === 'A') {
      aces += 1;
      score += 11;
    } else if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') {
      score += 10;
    } else {
      score += parseInt(card.rank, 10);
    }
  }
  while (score > 21 && aces > 0) {
    score -= 10;
    aces -= 1;
  }
  return score;
}

export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && calculateHandValue(hand) === 21;
}

export function isBusted(hand: Card[]): boolean {
  return calculateHandValue(hand) > 21;
}

/**
 * `dealer` must already have played to 17+. Returns a payout decision —
 * either a known winning multiplier key (`win` / `blackjack` / `push`) or
 * `'loss'` for a zero payout.
 *
 * Outcome strings mirror the legacy handler so the existing client UI and
 * admin analytics keep working: `'player_win' | 'dealer_win' | 'push' | 'blackjack'`.
 */
export function determineWinner(
  playerScore: number,
  dealerScore: number,
  playerHand: Card[],
): { result: 'player_win' | 'dealer_win' | 'push' | 'blackjack'; multiplierKey: 'win' | 'blackjack' | 'push' | 'loss' } {
  // Natural blackjack (player 21 on opening two cards) — only counts when the
  // dealer doesn't also have 21. Pays 2.5x by default.
  if (playerScore === 21 && playerHand.length === 2 && dealerScore !== 21) {
    return { result: 'blackjack', multiplierKey: 'blackjack' };
  }
  if (playerScore > 21) {
    return { result: 'dealer_win', multiplierKey: 'loss' };
  }
  if (dealerScore > 21) {
    return { result: 'player_win', multiplierKey: 'win' };
  }
  if (playerScore > dealerScore) {
    return { result: 'player_win', multiplierKey: 'win' };
  }
  if (dealerScore > playerScore) {
    return { result: 'dealer_win', multiplierKey: 'loss' };
  }
  return { result: 'push', multiplierKey: 'push' };
}
