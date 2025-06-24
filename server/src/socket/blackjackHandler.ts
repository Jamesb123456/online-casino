// Import Drizzle models
import UserModel from '../../drizzle/models/User.js';
import BalanceService from '../services/balanceService.js';
import LoggingService from '../services/loggingService.js';
import GameStat from '../../drizzle/models/GameStat.js';

interface Card {
  suit: string;
  rank: string;
  value: number;
}

interface Game {
  userId: number;
  betAmount: number;
  playerHand: Card[];
  dealerHand: Card[];
  deck: Card[];
  status: 'active' | 'completed';
  result?: string;
  winAmount?: number;
  startTime: number;
}

class BlackjackHandler {
  public io: any;
  public games: Map<string, Game>;
  public playerGames: Map<number, string>;

  constructor(io: any) {
    this.io = io;
    this.games = new Map(); // gameId -> game state
    this.playerGames = new Map(); // userId -> gameId
  }

  handleConnection(socket) {
    // Start new game
    socket.on('blackjack_start', async (data) => {
      try {
        const { userId, betAmount } = data;
        
        if (!userId || !betAmount || betAmount <= 0) {
          socket.emit('blackjack_error', { message: 'Invalid game parameters' });
          return;
        }

        // Check if user exists
        const user = await UserModel.findById(userId);
        if (!user) {
          socket.emit('blackjack_error', { message: 'User not found' });
          return;
        }

        // Check if user has sufficient balance
        const hasSufficientBalance = await BalanceService.hasSufficientBalance(userId, betAmount);
        if (!hasSufficientBalance) {
          socket.emit('blackjack_error', { message: 'Insufficient balance' });
          return;
        }

        // Check if user already has an active game
        if (this.playerGames.has(userId)) {
          const existingGameId = this.playerGames.get(userId);
          const existingGame = this.games.get(existingGameId);
          if (existingGame && existingGame.status === 'active') {
            socket.emit('blackjack_error', { message: 'You already have an active game' });
            return;
          }
        }

        // Create new game
        const gameId = this.generateGameId();
        const game = this.createNewGame(userId, betAmount);
        
        // Store game
        this.games.set(gameId, game);
        this.playerGames.set(userId, gameId);
        
        // Join game room
        socket.join(`blackjack_${gameId}`);
        
        // Deal initial cards
        this.dealInitialCards(game);
        
        // Send game state
        socket.emit('blackjack_game_state', {
          gameId,
          playerHand: game.playerHand,
          dealerHand: [game.dealerHand[0]], // Only show first dealer card
          playerScore: this.calculateScore(game.playerHand),
          betAmount: game.betAmount,
          status: game.status,
          canDouble: game.playerHand.length === 2,
          canSplit: this.canSplit(game.playerHand)
        });

        // Log game start
        await LoggingService.logGameAction(
          userId, 
          'blackjack', 
          'game_started', 
          { 
            gameId, 
            betAmount,
            playerHand: game.playerHand,
            dealerUpCard: game.dealerHand[0]
          }
        );

        console.log(`Blackjack game ${gameId} started for user ${userId} with bet ${betAmount}`);
      } catch (error) {
        console.error('Error starting blackjack game:', error);
        socket.emit('blackjack_error', { message: 'Failed to start game' });
      }
    });

    // Player hits
    socket.on('blackjack_hit', async (data) => {
      try {
        const { userId } = data;
        const gameId = this.playerGames.get(userId);
        const game = this.games.get(gameId);

        if (!game || game.status !== 'active') {
          socket.emit('blackjack_error', { message: 'No active game found' });
          return;
        }

        // Deal card to player
        const card = this.dealCard(game.deck);
        game.playerHand.push(card);

        const playerScore = this.calculateScore(game.playerHand);

        // Check for bust
        if (playerScore > 21) {
          await this.endGame(gameId, 'player_bust');
        }

        // Send updated game state
        this.io.to(`blackjack_${gameId}`).emit('blackjack_game_state', {
          gameId,
          playerHand: game.playerHand,
          dealerHand: game.status === 'completed' ? game.dealerHand : [game.dealerHand[0]],
          playerScore,
          dealerScore: game.status === 'completed' ? this.calculateScore(game.dealerHand) : null,
          betAmount: game.betAmount,
          status: game.status,
          result: game.result,
          winAmount: game.winAmount
        });

        // Log action
        await LoggingService.logGameAction(
          userId, 
          'blackjack', 
          'hit', 
          { 
            gameId, 
            card,
            playerHand: game.playerHand,
            playerScore
          }
        );
      } catch (error) {
        console.error('Error handling blackjack hit:', error);
        socket.emit('blackjack_error', { message: 'Failed to process hit' });
      }
    });

    // Player stands
    socket.on('blackjack_stand', async (data) => {
      try {
        const { userId } = data;
        const gameId = this.playerGames.get(userId);
        const game = this.games.get(gameId);

        if (!game || game.status !== 'active') {
          socket.emit('blackjack_error', { message: 'No active game found' });
          return;
        }

        // Dealer plays
        await this.playDealer(game);
        
        // Determine winner
        await this.endGame(gameId, 'completed');

        // Send final game state
        this.io.to(`blackjack_${gameId}`).emit('blackjack_game_state', {
          gameId,
          playerHand: game.playerHand,
          dealerHand: game.dealerHand,
          playerScore: this.calculateScore(game.playerHand),
          dealerScore: this.calculateScore(game.dealerHand),
          betAmount: game.betAmount,
          status: game.status,
          result: game.result,
          winAmount: game.winAmount
        });

        // Log action
        await LoggingService.logGameAction(
          userId, 
          'blackjack', 
          'stand', 
          { 
            gameId, 
            playerScore: this.calculateScore(game.playerHand),
            dealerScore: this.calculateScore(game.dealerHand),
            result: game.result,
            winAmount: game.winAmount
          }
        );
      } catch (error) {
        console.error('Error handling blackjack stand:', error);
        socket.emit('blackjack_error', { message: 'Failed to process stand' });
      }
    });

    // Player doubles down
    socket.on('blackjack_double', async (data) => {
      try {
        const { userId } = data;
        const gameId = this.playerGames.get(userId);
        const game = this.games.get(gameId);

        if (!game || game.status !== 'active' || game.playerHand.length !== 2) {
          socket.emit('blackjack_error', { message: 'Cannot double down' });
          return;
        }

        // Check balance for double
        const hasSufficientBalance = await BalanceService.hasSufficientBalance(userId, game.betAmount);
        if (!hasSufficientBalance) {
          socket.emit('blackjack_error', { message: 'Insufficient balance to double' });
          return;
        }

        // Double the bet
        game.betAmount *= 2;
        game.doubled = true;

        // Deal one card
        const card = this.dealCard(game.deck);
        game.playerHand.push(card);

        const playerScore = this.calculateScore(game.playerHand);

        // Check for bust
        if (playerScore > 21) {
          await this.endGame(gameId, 'player_bust');
        } else {
          // Dealer plays
          await this.playDealer(game);
          await this.endGame(gameId, 'completed');
        }

        // Send final game state
        this.io.to(`blackjack_${gameId}`).emit('blackjack_game_state', {
          gameId,
          playerHand: game.playerHand,
          dealerHand: game.dealerHand,
          playerScore,
          dealerScore: this.calculateScore(game.dealerHand),
          betAmount: game.betAmount,
          status: game.status,
          result: game.result,
          winAmount: game.winAmount
        });

        // Log action
        await LoggingService.logGameAction(
          userId, 
          'blackjack', 
          'double_down', 
          { 
            gameId, 
            finalBetAmount: game.betAmount,
            result: game.result,
            winAmount: game.winAmount
          }
        );
      } catch (error) {
        console.error('Error handling blackjack double:', error);
        socket.emit('blackjack_error', { message: 'Failed to process double down' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      // Clean up any games for this socket
      // This could be enhanced to pause games instead of ending them
    });
  }

  createNewGame(userId, betAmount) {
    return {
      userId,
      betAmount,
      deck: this.createDeck(),
      playerHand: [],
      dealerHand: [],
      status: 'active',
      result: null,
      winAmount: 0,
      doubled: false,
      createdAt: new Date()
    };
  }

  createDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];

    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ suit, rank, value: this.getCardValue(rank) });
      }
    }

    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
  }

  getCardValue(rank) {
    if (rank === 'A') return 11;
    if (['J', 'Q', 'K'].includes(rank)) return 10;
    return parseInt(rank);
  }

  dealCard(deck) {
    return deck.pop();
  }

  dealInitialCards(game) {
    // Deal 2 cards to player and dealer
    game.playerHand.push(this.dealCard(game.deck));
    game.dealerHand.push(this.dealCard(game.deck));
    game.playerHand.push(this.dealCard(game.deck));
    game.dealerHand.push(this.dealCard(game.deck));
  }

  calculateScore(hand) {
    let score = 0;
    let aces = 0;

    for (const card of hand) {
      if (card.rank === 'A') {
        aces++;
        score += 11;
      } else {
        score += card.value;
      }
    }

    // Adjust for aces
    while (score > 21 && aces > 0) {
      score -= 10;
      aces--;
    }

    return score;
  }

  async playDealer(game) {
    while (this.calculateScore(game.dealerHand) < 17) {
      game.dealerHand.push(this.dealCard(game.deck));
    }
  }

  async endGame(gameId, reason) {
    const game = this.games.get(gameId);
    if (!game) return;

    game.status = 'completed';

    const playerScore = this.calculateScore(game.playerHand);
    const dealerScore = this.calculateScore(game.dealerHand);

    // Determine result
    if (reason === 'player_bust') {
      game.result = 'dealer_win';
      game.winAmount = 0;
    } else if (dealerScore > 21) {
      game.result = 'player_win';
      game.winAmount = game.betAmount * 2;
    } else if (playerScore > dealerScore) {
      game.result = 'player_win';
      game.winAmount = game.betAmount * 2;
    } else if (dealerScore > playerScore) {
      game.result = 'dealer_win';
      game.winAmount = 0;
    } else {
      game.result = 'push';
      game.winAmount = game.betAmount; // Return bet
    }

    // Check for blackjack
    if (playerScore === 21 && game.playerHand.length === 2 && dealerScore !== 21) {
      game.result = 'blackjack';
      game.winAmount = Math.floor(game.betAmount * 2.5);
    }

    try {
      // Update user balance
      await BalanceService.updateGameBalance(
        game.userId,
        game.betAmount,
        game.winAmount,
        'blackjack',
        {
          gameId,
          playerScore,
          dealerScore,
          result: game.result,
          playerHand: game.playerHand,
          dealerHand: game.dealerHand
        }
      );

      // Update game statistics
      await GameStat.updateStats('blackjack', game.betAmount, game.winAmount);

      // Log game end
      await LoggingService.logGameAction(
        game.userId, 
        'blackjack', 
        'game_ended', 
        { 
          gameId, 
          result: game.result,
          playerScore,
          dealerScore,
          betAmount: game.betAmount,
          winAmount: game.winAmount
        }
      );

      // Clean up
      this.playerGames.delete(game.userId);
      // Keep game for a short time in case client needs to query it
      setTimeout(() => {
        this.games.delete(gameId);
      }, 60000); // 1 minute

    } catch (error) {
      console.error('Error ending blackjack game:', error);
    }
  }

  canSplit(hand) {
    return hand.length === 2 && hand[0].value === hand[1].value;
  }

  generateGameId() {
    return `bj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get active games count
  getActiveGamesCount() {
    return Array.from(this.games.values()).filter(game => game.status === 'active').length;
  }

  // Get game by user ID
  getGameByUserId(userId) {
    const gameId = this.playerGames.get(userId);
    return gameId ? this.games.get(gameId) : null;
  }
}

export default BlackjackHandler;