/**
 * Utility functions for the Blackjack game
 */

// Card values for scoring
const CARD_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 10, 'Q': 10, 'K': 10, 'A': 11
};

// Card suits
export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];

// Card ranks
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/**
 * Calculate the score of a blackjack hand
 * @param {Array} hand - Array of card objects with rank property
 * @returns {Number} The calculated score
 */
export const calculateHandValue = (hand) => {
  if (!hand || hand.length === 0) return 0;
  
  let score = 0;
  let aces = 0;

  // Sum up all card values
  for (const card of hand) {
    const value = CARD_VALUES[card.rank];
    score += value;
    
    // Count aces
    if (card.rank === 'A') {
      aces++;
    }
  }

  // Adjust for aces if needed
  while (score > 21 && aces > 0) {
    score -= 10; // Change ace from 11 to 1
    aces--;
  }

  return score;
};

/**
 * Check if the hand is a blackjack (21 with 2 cards)
 * @param {Array} hand - Array of card objects
 * @returns {Boolean} True if hand is blackjack
 */
export const isBlackjack = (hand) => {
  return hand.length === 2 && calculateHandValue(hand) === 21;
};

/**
 * Check if the hand is bust (over 21)
 * @param {Array} hand - Array of card objects
 * @returns {Boolean} True if hand is bust
 */
export const isBust = (hand) => {
  return calculateHandValue(hand) > 21;
};

/**
 * Get the appropriate status text for the current hand
 * @param {Array} hand - Array of card objects
 * @returns {String} Status text
 */
export const getHandStatus = (hand) => {
  const value = calculateHandValue(hand);
  
  if (value === 0) return '';
  if (isBlackjack(hand)) return 'Blackjack!';
  if (isBust(hand)) return 'Bust!';
  return `${value}`;
};

/**
 * Determine the winner between player and dealer
 * @param {Array} playerHand - Player's cards
 * @param {Array} dealerHand - Dealer's cards
 * @returns {String} 'player', 'dealer', or 'push'
 */
export const determineWinner = (playerHand, dealerHand) => {
  const playerValue = calculateHandValue(playerHand);
  const dealerValue = calculateHandValue(dealerHand);
  const playerBlackjack = isBlackjack(playerHand);
  const dealerBlackjack = isBlackjack(dealerHand);
  
  // Both have blackjack or same score
  if ((playerBlackjack && dealerBlackjack) || playerValue === dealerValue) {
    return 'push';
  }
  
  // Player has blackjack
  if (playerBlackjack) {
    return 'player';
  }
  
  // Dealer has blackjack
  if (dealerBlackjack) {
    return 'dealer';
  }
  
  // Player busts
  if (playerValue > 21) {
    return 'dealer';
  }
  
  // Dealer busts
  if (dealerValue > 21) {
    return 'player';
  }
  
  // Higher score wins
  return playerValue > dealerValue ? 'player' : 'dealer';
};

/**
 * Get the payout multiplier for the given result
 * @param {String} result - 'player', 'dealer', or 'push'
 * @param {Boolean} isBlackjack - Whether the player has blackjack
 * @returns {Number} The multiplier for the bet
 */
export const getPayoutMultiplier = (result, isBlackjack = false) => {
  if (result === 'player') {
    return isBlackjack ? 2.5 : 2.0; // Blackjack usually pays 3:2
  } else if (result === 'push') {
    return 1.0; // Return the original bet
  } else {
    return 0; // Lose the bet
  }
};

export default {
  calculateHandValue,
  isBlackjack,
  isBust,
  getHandStatus,
  determineWinner,
  getPayoutMultiplier,
  SUITS,
  RANKS
};