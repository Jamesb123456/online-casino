const User = require('../models/User');
const balanceService = require('../services/balanceService');
const loggingService = require('../services/loggingService');
const { createDeck, shuffleArray, calculateHandValue, determineWinner, shouldDealerHit } = require('../utils/gameUtils');

/**
 * Blackjack socket handler
 * Manages the blackjack game logic on the server
 */
function handleBlackjackSocket(io, socket) {
  console.log(`User connected to blackjack: ${socket.id}`);
  
  let userId = null;
  let currentGame = null;
  
  /**
   * Initialize the game state for a user
   * @param {String} uid - User ID
   */
  async function initializeGame(uid) {
    try {
      userId = uid;
      
      // Get user from database
      const user = await User.findById(userId);
      
      if (!user) {
        socket.emit('error', { message: 'User not found' });
        return;
      }
      
      // Create a new game state
      currentGame = {
        userId,
        balance: user.balance,
        betAmount: 0,
        deck: shuffleArray(createDeck()),
        playerHands: [[]],
        dealerHand: [],
        currentHandIndex: 0,
        gameState: 'betting',
        result: null,
        payout: 0
      };
      
      // Log game initialization
      loggingService.logGameStart('blackjack', `${userId}_${Date.now()}`, {
        userId,
        initialBalance: user.balance,
        timestamp: new Date()
      });
      
      // Send initial game state
      emitGameState();
    } catch (error) {
      console.error('Error initializing blackjack game:', error);
      socket.emit('error', { message: 'Failed to initialize game' });
    }
  }
  
  /**
   * Emit the current game state to the client
   */
  function emitGameState() {
    if (currentGame) {
      // Don't send the full deck to client
      const { deck, ...gameState } = currentGame;
      socket.emit('gameState', gameState);
    }
  }
  
  /**
   * Update user balance using the balance service
   * @param {Number} amount - Amount to add to balance (negative to subtract)
   * @param {String} type - Transaction type ('bet', 'win', etc.)
   * @param {Object} metadata - Additional transaction metadata
   */
  async function updateUserBalance(amount, type, metadata = {}) {
    try {
      if (!userId) return;
      
      await balanceService.updateBalance(
        userId,
        amount,
        type,
        'blackjack',
        metadata
      );
    } catch (error) {
      console.error('Error updating user balance:', error);
    }
  }
  
  /**
   * Deal a card from the deck
   * @returns {Object} Card object
   */
  function dealCard() {
    if (!currentGame || currentGame.deck.length === 0) {
      // Reshuffle if deck is empty
      currentGame.deck = shuffleArray(createDeck());
    }
    
    return currentGame.deck.pop();
  }
  
  /**
   * Place a bet and start a new round
   * @param {Object} data - Bet data
   * @param {Number} data.amount - Bet amount
   */
  async function placeBet(data) {
    try {
      if (!currentGame || !userId) {
        socket.emit('error', { message: 'Game not initialized' });
        return;
      }
      
      if (currentGame.gameState !== 'betting') {
        socket.emit('error', { message: 'Cannot place bet now' });
        return;
      }
      
      const betAmount = Number(data.amount);
      
      if (isNaN(betAmount) || betAmount <= 0) {
        socket.emit('error', { message: 'Invalid bet amount' });
        return;
      }
      
      if (betAmount > currentGame.balance) {
        socket.emit('error', { message: 'Not enough balance' });
        return;
      }
      
      // Update game state
      currentGame.betAmount = betAmount;
      currentGame.balance -= betAmount;
      
      // Generate a unique hand ID
      const handId = socket.id + Date.now();
      
      // Save updated balance to database and record the bet transaction
      await updateUserBalance(-betAmount, 'bet', { 
        gameType: 'blackjack',
        handId: handId  // Unique identifier for this hand
      });
      
      // Log bet placed
      loggingService.logBetPlaced('blackjack', handId, userId, betAmount, {
        initialCards: {
          player: [dealCard(), dealCard()],
          dealer: [dealCard(), dealCard()]
        },
        timestamp: new Date()
      });
      
      // Deal initial cards
      currentGame.dealerHand = [dealCard(), dealCard()];
      currentGame.playerHands = [[dealCard(), dealCard()]];
      currentGame.currentHandIndex = 0;
      currentGame.gameState = 'playing';
      
      // Check for blackjack
      const playerHand = currentGame.playerHands[0];
      if (calculateHandValue(playerHand) === 21 && playerHand.length === 2) {
        // Player has blackjack, dealer's turn
        dealerTurn();
      } else {
        // Player's turn
        emitGameState();
      }
    } catch (error) {
      console.error('Error placing bet:', error);
      socket.emit('error', { message: 'Failed to place bet' });
    }
  }
  
  /**
   * Hit - draw another card
   */
  function hit() {
    try {
      if (!currentGame || currentGame.gameState !== 'playing') {
        socket.emit('error', { message: 'Cannot hit now' });
        return;
      }
      
      const currentHandIndex = currentGame.currentHandIndex;
      const currentHand = currentGame.playerHands[currentHandIndex];
      
      // Deal a card to the current hand
      currentHand.push(dealCard());
      
      // Check if busted
      if (calculateHandValue(currentHand) > 21) {
        if (currentHandIndex < currentGame.playerHands.length - 1) {
          // Move to next hand
          currentGame.currentHandIndex++;
        } else {
          // All hands complete, dealer's turn
          dealerTurn();
          return;
        }
      }
      
      emitGameState();
    } catch (error) {
      console.error('Error hitting:', error);
      socket.emit('error', { message: 'Failed to hit' });
    }
  }
  
  /**
   * Stand - end current hand
   */
  function stand() {
    try {
      if (!currentGame || currentGame.gameState !== 'playing') {
        socket.emit('error', { message: 'Cannot stand now' });
        return;
      }
      
      if (currentGame.currentHandIndex < currentGame.playerHands.length - 1) {
        // Move to next hand
        currentGame.currentHandIndex++;
        emitGameState();
      } else {
        // All hands complete, dealer's turn
        dealerTurn();
      }
    } catch (error) {
      console.error('Error standing:', error);
      socket.emit('error', { message: 'Failed to stand' });
    }
  }
  
  /**
   * Double down - double bet, get one card, then stand
   */
  async function doubleDown() {
    try {
      if (!currentGame || currentGame.gameState !== 'playing') {
        socket.emit('error', { message: 'Cannot double down now' });
        return;
      }
      
      const currentHandIndex = currentGame.currentHandIndex;
      const currentHand = currentGame.playerHands[currentHandIndex];
      
      // Check if hand has exactly 2 cards
      if (currentHand.length !== 2) {
        socket.emit('error', { message: 'Can only double down on initial two cards' });
        return;
      }
      
      // Check if player has enough balance
      if (currentGame.balance < currentGame.betAmount) {
        socket.emit('error', { message: 'Not enough balance to double down' });
        return;
      }
      
      // Double bet
      currentGame.balance -= currentGame.betAmount;
      const additionalBet = currentGame.betAmount;
      currentGame.betAmount *= 2;
      
      // Save updated balance to database using balance service
      await updateUserBalance(-additionalBet, 'bet', { 
        gameType: 'blackjack',
        betType: 'double-down',
        handId: socket.id + Date.now()
      });
      
      // Deal one more card
      currentHand.push(dealCard());
      
      // Move to dealer's turn
      dealerTurn();
    } catch (error) {
      console.error('Error doubling down:', error);
      socket.emit('error', { message: 'Failed to double down' });
    }
  }
  
  /**
   * Split - split a pair into two hands
   */
  async function split() {
    try {
      if (!currentGame || currentGame.gameState !== 'playing') {
        socket.emit('error', { message: 'Cannot split now' });
        return;
      }
      
      const currentHandIndex = currentGame.currentHandIndex;
      const currentHand = currentGame.playerHands[currentHandIndex];
      
      // Check if hand has exactly 2 cards
      if (currentHand.length !== 2) {
        socket.emit('error', { message: 'Can only split initial two cards' });
        return;
      }
      
      // Check if cards have the same value
      const card1Value = currentHand[0].value;
      const card2Value = currentHand[1].value;
      const isSameValue = 
        card1Value === card2Value ||
        (card1Value === 'J' && card2Value === 'Q') ||
        (card1Value === 'J' && card2Value === 'K') ||
        (card1Value === 'Q' && card2Value === 'J') ||
        (card1Value === 'Q' && card2Value === 'K') ||
        (card1Value === 'K' && card2Value === 'J') ||
        (card1Value === 'K' && card2Value === 'Q');
      
      if (!isSameValue) {
        socket.emit('error', { message: 'Can only split cards of same value' });
        return;
      }
      
      // Check if player has enough balance
      if (currentGame.balance < currentGame.betAmount) {
        socket.emit('error', { message: 'Not enough balance to split' });
        return;
      }
      
      // Update balance
      currentGame.balance -= currentGame.betAmount;
      
      // Save updated balance to database
      await updateUserBalance(-currentGame.betAmount);
      
      // Create two new hands
      const newHand1 = [currentHand[0], dealCard()];
      const newHand2 = [currentHand[1], dealCard()];
      
      // Update player hands
      currentGame.playerHands.splice(currentHandIndex, 1, newHand1, newHand2);
      
      emitGameState();
    } catch (error) {
      console.error('Error splitting:', error);
      socket.emit('error', { message: 'Failed to split' });
    }
  }
  
  /**
   * Dealer's turn - dealer draws cards until reaching at least 17
   */
  async function dealerTurn() {
    try {
      if (!currentGame) return;
      
      currentGame.gameState = 'dealerTurn';
      emitGameState();
      
      // Wait 1 second to show dealer's turn state
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Dealer draws cards until reaching at least 17
      while (shouldDealerHit(currentGame.dealerHand)) {
        currentGame.dealerHand.push(dealCard());
        emitGameState();
        
        // Add a small delay between dealer cards
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      // Calculate results
      let totalPayout = 0;
      
      for (const playerHand of currentGame.playerHands) {
        const result = determineWinner(playerHand, currentGame.dealerHand);
        currentGame.result = result;
        
        let payout = 0;
        switch (result) {
          case 'blackjack':
            payout = currentGame.betAmount * 1.5;
            break;
          case 'player':
            payout = currentGame.betAmount;
            break;
          case 'push':
            payout = 0;
            break;
          case 'dealer':
            payout = -currentGame.betAmount;
            break;
        }
        
        totalPayout += payout;
      }
      
      // Update game state
      currentGame.payout = totalPayout;
      currentGame.balance += currentGame.betAmount + totalPayout;
      currentGame.gameState = 'gameOver';
      
      // Save updated balance to database using balance service
      if (totalPayout >= 0) {
        // Win or push
        await updateUserBalance(currentGame.betAmount + totalPayout, 'win', {
          gameType: 'blackjack',
          betAmount: currentGame.betAmount,
          result: currentGame.result,
          dealerCards: currentGame.dealerHand.map(card => `${card.value} of ${card.suit}`),
          playerCards: currentGame.playerHands.map(hand => hand.map(card => `${card.value} of ${card.suit}`))
        });
        
        // Log win or push results
        loggingService.logBetResult(
          'blackjack',
          `${userId}_${Date.now()}`,
          userId,
          currentGame.betAmount,
          currentGame.betAmount + totalPayout,
          totalPayout > 0, // true if win, false if push
          {
            result: currentGame.result,
            dealerHand: currentGame.dealerHand.map(card => `${card.value} of ${card.suit}`),
            playerHands: currentGame.playerHands.map(hand => hand.map(card => `${card.value} of ${card.suit}`)),
            timestamp: new Date()
          }
        );
      } else {
        // Log loss
        loggingService.logBetResult(
          'blackjack',
          `${userId}_${Date.now()}`,
          userId,
          currentGame.betAmount,
          0,
          false,
          {
            result: currentGame.result,
            dealerHand: currentGame.dealerHand.map(card => `${card.value} of ${card.suit}`),
            playerHands: currentGame.playerHands.map(hand => hand.map(card => `${card.value} of ${card.suit}`)),
            timestamp: new Date()
          }
        );
      }
      
      emitGameState();
    } catch (error) {
      console.error('Error in dealer turn:', error);
      socket.emit('error', { message: 'Error in dealer turn' });
    }
  }
  
  /**
   * Request a card from the server
   */
  function requestCard() {
    try {
      const card = dealCard();
      socket.emit('card', card);
    } catch (error) {
      console.error('Error requesting card:', error);
      socket.emit('error', { message: 'Failed to request card' });
    }
  }
  
  /**
   * Start a new game
   */
  function newGame() {
    try {
      if (!currentGame) return;
      
      currentGame.playerHands = [[]];
      currentGame.dealerHand = [];
      currentGame.currentHandIndex = 0;
      currentGame.gameState = 'betting';
      currentGame.result = null;
      currentGame.payout = 0;
      currentGame.betAmount = 0;
      
      emitGameState();
    } catch (error) {
      console.error('Error starting new game:', error);
      socket.emit('error', { message: 'Failed to start new game' });
    }
  }
  
  // Register event handlers
  socket.on('initialize', initializeGame);
  socket.on('placeBet', placeBet);
  socket.on('hit', hit);
  socket.on('stand', stand);
  socket.on('double', doubleDown);
  socket.on('split', split);
  socket.on('requestCard', requestCard);
  socket.on('newGame', newGame);
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected from blackjack: ${socket.id}`);
  });
}

module.exports = handleBlackjackSocket;