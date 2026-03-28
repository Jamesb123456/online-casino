// Import Drizzle models
import UserModel from '../../drizzle/models/User.js';
import BalanceService from '../services/balanceService.js';
import LoggingService from '../services/loggingService.js';
import GameStat from '../../drizzle/models/GameStat.js';
import { validateSocketData, blackjackStartSchema } from '../validation/schemas.js';
import crypto from 'crypto';

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
  doubled?: boolean;
  createdAt?: Date;
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

  handleConnection(socket: any) {
    // Get authenticated user from socket (set by auth middleware)
    const authenticatedUser = (socket as any).user;
    if (!authenticatedUser) {
      socket.emit('blackjack_error', { message: 'Authentication required' });
      socket.disconnect();
      return;
    }
    const userId = authenticatedUser.userId;
    const userIdNum = Number(userId);

    // Start new game
    socket.on('blackjack_start', async (data) => {
      try {
        // Validate input with Zod
        let validated;
        try {
          validated = validateSocketData(blackjackStartSchema, data);
        } catch (validationError) {
          socket.emit('blackjack_error', { message: (validationError as Error).message });
          return;
        }
        const { betAmount } = validated;

        // Check if user exists
        const user = await UserModel.findById(userIdNum);
        if (!user) {
          socket.emit('blackjack_error', { message: 'User not found' });
          return;
        }

        // Check if user has sufficient balance
        const hasSufficientBalance = await BalanceService.hasSufficientBalance(userIdNum, betAmount);
        if (!hasSufficientBalance) {
          socket.emit('blackjack_error', { message: 'Insufficient balance' });
          return;
        }

        // Check if user already has an active game
        if (this.playerGames.has(userIdNum)) {
          const existingGameId = this.playerGames.get(userIdNum);
          const existingGame = this.games.get(existingGameId);
          if (existingGame && existingGame.status === 'active') {
            socket.emit('blackjack_error', { message: 'You already have an active game' });
            return;
          }
        }

        // Create new game
        const gameId = this.generateGameId();
        const game = this.createNewGame(userIdNum, Number(betAmount));

        // Store game
        this.games.set(gameId, game);
        this.playerGames.set(userIdNum, gameId);

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
          String(userId),
          'blackjack',
          'game_started',
          {
            gameId,
            betAmount,
            playerHand: game.playerHand,
            dealerUpCard: game.dealerHand[0]
          }
        );

        LoggingService.logGameEvent('blackjack', 'game_started', {
          gameId,
          userId,
          betAmount
        }, userId);
      } catch (error) {
        LoggingService.logGameEvent('blackjack', 'error_start', { error: String(error), userId });
        socket.emit('blackjack_error', { message: 'Failed to start game' });
      }
    });

    // Player hits
    socket.on('blackjack_hit', async (data) => {
      try {
        const gameId = this.playerGames.get(userIdNum);
        if (!gameId) {
          socket.emit('blackjack_error', { message: 'No game found' });
          return;
        }
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
          dealerHand: (game.status as string) === 'completed' ? game.dealerHand : [game.dealerHand[0]],
          playerScore,
          // Only show dealer score after game is completed
          dealerScore: (game.status as string) === 'completed' ? this.calculateScore(game.dealerHand) : null,
          betAmount: game.betAmount,
          status: game.status,
          result: game.result,
          winAmount: game.winAmount
        });

        // Log action
        await LoggingService.logGameAction(
          String(userId),
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
        LoggingService.logGameEvent('blackjack', 'error_hit', { error: String(error), userId });
        socket.emit('blackjack_error', { message: 'Failed to process hit' });
      }
    });

    // Player stands
    socket.on('blackjack_stand', async (data) => {
      try {
        const gameId = this.playerGames.get(userIdNum);
        if (!gameId) {
          socket.emit('blackjack_error', { message: 'No game found' });
          return;
        }
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
          String(userId),
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
        LoggingService.logGameEvent('blackjack', 'error_stand', { error: String(error), userId });
        socket.emit('blackjack_error', { message: 'Failed to process stand' });
      }
    });

    // Player doubles down
    socket.on('blackjack_double', async (data) => {
      try {
        const gameId = this.playerGames.get(userIdNum);
        if (!gameId) {
          socket.emit('blackjack_error', { message: 'No game found' });
          return;
        }
        const game = this.games.get(gameId);

        if (!game || game.status !== 'active' || game.playerHand.length !== 2) {
          socket.emit('blackjack_error', { message: 'Cannot double down' });
          return;
        }

        // Check balance for double
        const hasSufficientBalance = await BalanceService.hasSufficientBalance(String(userId), game.betAmount);
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
          String(userId),
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
        LoggingService.logGameEvent('blackjack', 'error_double', { error: String(error), userId });
        socket.emit('blackjack_error', { message: 'Failed to process double down' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      // Clean up any games for this socket
      // This could be enhanced to pause games instead of ending them
    });
  }

  createNewGame(userId: number, betAmount: number): Game {
    // Generate and shuffle a fresh deck for this game
    const freshDeck = this.createDeck();

    // Log deck creation
    LoggingService.logGameEvent('blackjack', 'deck_created', {
      userId,
      deckSize: freshDeck.length
    }, userId);

    return {
      userId,
      betAmount,
      deck: freshDeck,
      playerHand: [],
      dealerHand: [],
      status: 'active' as const,
      result: undefined,
      winAmount: 0,
      doubled: false,
      startTime: Date.now(),
      createdAt: new Date()
    };
  }

  createDeck(): Card[] {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck: Card[] = [];

    // Create a standard deck of 52 cards
    for (const suit of suits) {
      for (const rank of ranks) {
        const card: Card = { suit, rank, value: this.getCardValue(rank) };
        deck.push(card);
      }
    }

    // Use cryptographically secure shuffling
    return this.secureShuffle(deck);
  }

  // Secure Fisher-Yates shuffle with cryptographic random numbers (single pass)
  secureShuffle(deck: Card[]) {
    // Make a copy of the deck to avoid mutations
    const result = [...deck];

    // Fisher-Yates shuffle with crypto secure random numbers
    for (let i = result.length - 1; i > 0; i--) {
      // Generate cryptographically secure random number
      const randomBytes = crypto.randomBytes(4);
      const randomValue = randomBytes.readUInt32BE(0);
      const j = randomValue % (i + 1);

      // Swap elements
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  getCardValue(rank: string): number {
    if (rank === 'A') return 11;
    if (['J', 'Q', 'K'].includes(rank)) return 10;
    return parseInt(rank);
  }

  dealCard(deck: Card[]): Card {
    // Check for empty deck and handle it
    const card = deck.pop();
    if (!card) {
      LoggingService.logGameEvent('blackjack', 'error_empty_deck', {
        message: 'Attempted to deal from an empty deck'
      });
      // Create a fallback card if deck is empty (shouldn't happen in normal gameplay)
      return { suit: 'hearts', rank: 'A', value: 11 };
    }
    return card;
  }

  dealInitialCards(game: Game) {
    // Deal 2 cards to player and dealer
    game.playerHand.push(this.dealCard(game.deck));
    game.dealerHand.push(this.dealCard(game.deck));
    game.playerHand.push(this.dealCard(game.deck));
    game.dealerHand.push(this.dealCard(game.deck));
  }

  calculateScore(hand: Card[]): number {
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

  async playDealer(game: Game) {
    while (this.calculateScore(game.dealerHand) < 17) {
      game.dealerHand.push(this.dealCard(game.deck));
    }
  }

  async endGame(gameId: string, reason: string) {
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
      // Credit winnings if player won (bet was already deducted on placement)
      if (game.winAmount > 0) {
        await BalanceService.recordWin(
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
      }

      // Update game statistics
      await GameStat.updateStats('blackjack', game.betAmount.toString(), game.winAmount || 0);

      // Log game end
      await LoggingService.logGameAction(
        String(game.userId),
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

      // Clean up AFTER balance update succeeds
      this.playerGames.delete(game.userId);
      // Keep game for a short time in case client needs to query it
      setTimeout(() => {
        this.games.delete(gameId);
      }, 60000); // 1 minute

    } catch (error) {
      LoggingService.logGameEvent('blackjack', 'error_end_game', {
        error: String(error),
        gameId,
        userId: game.userId
      }, game.userId);
    }
  }

  canSplit(hand: Card[]) {
    return hand.length === 2 && hand[0].value === hand[1].value;
  }

  generateGameId(): string {
    // Use crypto for more secure game IDs
    const randomBytes = crypto.randomBytes(8);
    const randomHex = randomBytes.toString('hex');
    return `bj_${Date.now()}_${randomHex}`;
  }

  // Get active games count
  getActiveGamesCount(): number {
    return Array.from(this.games.values()).filter(game => game.status === 'active').length;
  }

  // Get game by user ID
  getGameByUserId(userId: number): Game | null {
    const gameId = this.playerGames.get(userId);
    return gameId ? (this.games.get(gameId) || null) : null;
  }
}

export default BlackjackHandler;
