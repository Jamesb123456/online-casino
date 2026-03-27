/**
 * Game Utilities
 * Common functions used across different game types
 */
import crypto from 'crypto';

// Card deck constants
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/**
 * Create a new deck of cards
 * @returns {Array} A full deck of 52 cards
 */
function createDeck() {
  const deck: Array<{suit: string, value: string, image: string}> = [];
  
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({
        suit,
        value,
        image: `/assets/cards/${value}_of_${suit}.png`
      });
    }
  }
  
  return deck;
}

/**
 * Shuffle an array using the Fisher-Yates algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
function shuffleArray(array) {
  const newArray = [...array];

  for (let i = newArray.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }

  return newArray;
}

/**
 * Generate a random integer between min and max (inclusive)
 * @param {Number} min - Minimum value
 * @param {Number} max - Maximum value
 * @returns {Number} Random integer
 */
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return crypto.randomInt(min, max + 1);
}

/**
 * Calculate the score of a hand in blackjack
 * @param {Array} cards - Array of card objects
 * @returns {Number} Score of the hand
 */
function calculateHandValue(cards) {
  if (!cards || cards.length === 0) return 0;
  
  let value = 0;
  let aces = 0;
  
  for (const card of cards) {
    if (card.value === 'A') {
      aces += 1;
      value += 11;
    } else if (['J', 'Q', 'K'].includes(card.value)) {
      value += 10;
    } else {
      value += parseInt(card.value);
    }
  }
  
  // Adjust for aces if needed
  while (value > 21 && aces > 0) {
    value -= 10; // Convert Ace from 11 to 1
    aces -= 1;
  }
  
  return value;
}

/**
 * Determine if a hand is a blackjack (21 with 2 cards)
 * @param {Array} cards - Array of card objects
 * @returns {Boolean} True if hand is a blackjack
 */
function isBlackjack(cards) {
  return cards.length === 2 && calculateHandValue(cards) === 21;
}

/**
 * Determine if a hand is busted (over 21)
 * @param {Array} cards - Array of card objects
 * @returns {Boolean} True if hand is busted
 */
function isBusted(cards) {
  return calculateHandValue(cards) > 21;
}

/**
 * Determine the winner of a blackjack game
 * @param {Array} playerHand - Player's hand of cards
 * @param {Array} dealerHand - Dealer's hand of cards
 * @returns {String} 'player', 'dealer', 'push' (tie), or 'blackjack'
 */
function determineWinner(playerHand, dealerHand) {
  const playerValue = calculateHandValue(playerHand);
  const dealerValue = calculateHandValue(dealerHand);
  
  // Check for blackjack
  const playerBlackjack = isBlackjack(playerHand);
  const dealerBlackjack = isBlackjack(dealerHand);
  
  if (playerBlackjack && dealerBlackjack) {
    return 'push'; // Both have blackjack, it's a tie
  }
  
  if (playerBlackjack) {
    return 'blackjack'; // Player wins with blackjack (pays 3:2)
  }
  
  if (dealerBlackjack) {
    return 'dealer'; // Dealer wins with blackjack
  }
  
  // Check for busts
  if (isBusted(playerHand)) {
    return 'dealer'; // Player busted, dealer wins
  }
  
  if (isBusted(dealerHand)) {
    return 'player'; // Dealer busted, player wins
  }
  
  // Compare values
  if (playerValue > dealerValue) {
    return 'player';
  } else if (dealerValue > playerValue) {
    return 'dealer';
  } else {
    return 'push'; // Same value, it's a tie
  }
}

/**
 * Should the dealer hit (take another card)?
 * Follows the standard rule: dealer hits on 16 or less, stands on 17 or more
 * @param {Array} dealerHand - Dealer's hand of cards
 * @returns {Boolean} True if dealer should hit
 */
function shouldDealerHit(dealerHand) {
  return calculateHandValue(dealerHand) < 17;
}

/**
 * Calculate the payout based on bet and game outcome
 * @param {Number} bet - The bet amount
 * @param {String} result - The game result ('player', 'dealer', 'push', or 'blackjack')
 * @returns {Number} The payout amount (negative if player loses)
 */
function calculatePayout(bet, result) {
  switch (result) {
    case 'blackjack':
      return bet * 1.5; // Blackjack typically pays 3:2
    case 'player':
      return bet; // Player wins 1:1
    case 'push':
      return 0; // Push (tie), player gets bet back
    case 'dealer':
      return -bet; // Player loses bet
    default:
      return 0;
  }
}

/**
 * Calculate house edge for various games
 * @param {String} gameType - Type of game
 * @returns {Number} House edge as a decimal (e.g., 0.05 = 5%)
 */
function calculateHouseEdge(gameType: any) {
  switch (gameType) {
    case 'blackjack':
      return 0.005; // ~0.5% with perfect strategy
    case 'roulette':
      return 0.027; // ~2.7% for European roulette
    case 'crash':
      return 0.01; // ~1%
    case 'wheel':
      return 0.04; // ~4%
    case 'plinko':
      return 0.02; // ~2%
    default:
      return 0.02; // Default house edge
  }
}

/**
 * Generate game statistics to be stored
 * @param {Object} gameData - Information about the game
 * @returns {Object} Statistics object
 */
function generateGameStats(gameData) {
  const { gameType, userId, betAmount, payout, result } = gameData;
  
  return {
    gameType,
    userId,
    betAmount,
    payout,
    result,
    timestamp: new Date(),
    isWin: payout > 0
  };
}

export {
  SUITS,
  VALUES,
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
  generateGameStats
};