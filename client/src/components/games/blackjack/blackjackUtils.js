/**
 * Blackjack Game Utilities
 * Contains all the utility functions for blackjack game logic
 */

// Card suits and values
export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
export const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/**
 * Create a new deck of cards
 * @returns {Array} A full deck of 52 cards
 */
export const createDeck = () => {
  const deck = [];
  
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
};

/**
 * Shuffle an array using the Fisher-Yates algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
export const shuffleArray = (array) => {
  const newArray = [...array];
  
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  
  return newArray;
};

/**
 * Calculate the score of a hand in blackjack
 * @param {Array} cards - Array of card objects
 * @returns {Number} Score of the hand
 */
export const calculateHandValue = (cards) => {
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
};

/**
 * Determine if a hand is a blackjack (21 with 2 cards)
 * @param {Array} cards - Array of card objects
 * @returns {Boolean} True if hand is a blackjack
 */
export const isBlackjack = (cards) => {
  return cards.length === 2 && calculateHandValue(cards) === 21;
};

/**
 * Determine if a hand is busted (over 21)
 * @param {Array} cards - Array of card objects
 * @returns {Boolean} True if hand is busted
 */
export const isBusted = (cards) => {
  return calculateHandValue(cards) > 21;
};

/**
 * Determine the winner of a blackjack game
 * @param {Array} playerHand - Player's hand of cards
 * @param {Array} dealerHand - Dealer's hand of cards
 * @returns {String} 'player', 'dealer', 'push' (tie), or 'blackjack'
 */
export const determineWinner = (playerHand, dealerHand) => {
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
};

/**
 * Should the dealer hit (take another card)?
 * Follows the standard rule: dealer hits on 16 or less, stands on 17 or more
 * @param {Array} dealerHand - Dealer's hand of cards
 * @returns {Boolean} True if dealer should hit
 */
export const shouldDealerHit = (dealerHand) => {
  return calculateHandValue(dealerHand) < 17;
};

/**
 * Calculate the payout based on bet and game outcome
 * @param {Number} bet - The bet amount
 * @param {String} result - The game result ('player', 'dealer', 'push', or 'blackjack')
 * @returns {Number} The payout amount (negative if player loses)
 */
export const calculatePayout = (bet, result) => {
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
};

/**
 * Format currency values
 * @param {Number} value - Value to format
 * @returns {String} Formatted currency string
 */
export const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};