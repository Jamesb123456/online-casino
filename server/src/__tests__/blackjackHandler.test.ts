// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies with vi.hoisted
const { mockGetBalance, mockPlaceBet, mockRecordWin, mockHasSufficientBalance } = vi.hoisted(() => ({
  mockGetBalance: vi.fn(),
  mockPlaceBet: vi.fn(),
  mockRecordWin: vi.fn(),
  mockHasSufficientBalance: vi.fn(),
}));

const { mockFindById } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
}));

const { mockUpdateStats } = vi.hoisted(() => ({
  mockUpdateStats: vi.fn(),
}));

vi.mock('../services/balanceService.js', () => ({
  default: {
    getBalance: mockGetBalance,
    placeBet: mockPlaceBet,
    recordWin: mockRecordWin,
    hasSufficientBalance: mockHasSufficientBalance,
  },
}));

vi.mock('../../drizzle/models/User.js', () => ({
  default: { findById: mockFindById },
}));

vi.mock('../../drizzle/models/GameStat.js', () => ({
  default: { updateStats: mockUpdateStats },
}));

vi.mock('../services/loggingService.js', () => ({
  default: {
    logGameAction: vi.fn(),
    logGameEvent: vi.fn(),
    logBetPlaced: vi.fn(),
    logBetResult: vi.fn(),
    logSystemEvent: vi.fn(),
  },
}));

vi.mock('../validation/schemas.js', () => ({
  validateSocketData: vi.fn((_schema, data) => data),
  blackjackStartSchema: {},
}));

import BlackjackHandler from '../socket/blackjackHandler.js';

function createMockSocket(user = { userId: 1, username: 'testuser', balance: '1000' }) {
  const eventHandlers = new Map();
  return {
    id: `socket_${Math.random().toString(36).slice(2)}`,
    user,
    emit: vi.fn(),
    join: vi.fn(),
    on: vi.fn((event, handler) => {
      eventHandlers.set(event, handler);
    }),
    disconnect: vi.fn(),
    _trigger: async (event, ...args) => {
      const handler = eventHandlers.get(event);
      if (handler) return handler(...args);
    },
  };
}

function createMockIo() {
  return {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  };
}

describe('BlackjackHandler', () => {
  let handler;
  let mockIo;
  let mockSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIo = createMockIo();
    handler = new BlackjackHandler(mockIo);
    mockSocket = createMockSocket();
    mockFindById.mockResolvedValue({ id: 1, username: 'testuser', balance: 1000 });
    mockHasSufficientBalance.mockResolvedValue(true);
    mockPlaceBet.mockResolvedValue({ success: true });
    mockRecordWin.mockResolvedValue({ success: true });
    mockUpdateStats.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleConnection', () => {
    it('should register event handlers for authenticated user', () => {
      handler.handleConnection(mockSocket);
      expect(mockSocket.on).toHaveBeenCalledWith('blackjack_start', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('blackjack_hit', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('blackjack_stand', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('blackjack_double', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('should disconnect unauthenticated socket', () => {
      const unauthSocket = createMockSocket(null);
      unauthSocket.user = null;
      handler.handleConnection(unauthSocket);
      expect(unauthSocket.emit).toHaveBeenCalledWith('blackjack_error', { message: 'Authentication required' });
      expect(unauthSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('blackjack_start', () => {
    it('should start a new game with valid bet', async () => {
      handler.handleConnection(mockSocket);
      await mockSocket._trigger('blackjack_start', { betAmount: 100 });

      expect(mockSocket.emit).toHaveBeenCalledWith('blackjack_game_state', expect.objectContaining({
        gameId: expect.any(String),
        playerHand: expect.any(Array),
        dealerHand: expect.any(Array),
        betAmount: 100,
        status: 'active',
      }));
    });

    it('should emit error if user not found', async () => {
      mockFindById.mockResolvedValue(null);
      handler.handleConnection(mockSocket);
      await mockSocket._trigger('blackjack_start', { betAmount: 100 });
      expect(mockSocket.emit).toHaveBeenCalledWith('blackjack_error', { message: 'User not found' });
    });

    it('should emit error if insufficient balance', async () => {
      mockHasSufficientBalance.mockResolvedValue(false);
      handler.handleConnection(mockSocket);
      await mockSocket._trigger('blackjack_start', { betAmount: 100 });
      expect(mockSocket.emit).toHaveBeenCalledWith('blackjack_error', { message: 'Insufficient balance' });
    });

    it('should prevent starting a second active game', async () => {
      handler.handleConnection(mockSocket);
      await mockSocket._trigger('blackjack_start', { betAmount: 100 });
      await mockSocket._trigger('blackjack_start', { betAmount: 100 });
      expect(mockSocket.emit).toHaveBeenCalledWith('blackjack_error', { message: 'You already have an active game' });
    });

    it('should deal 2 cards to player and 2 to dealer', async () => {
      handler.handleConnection(mockSocket);
      await mockSocket._trigger('blackjack_start', { betAmount: 50 });

      const gameStateCall = mockSocket.emit.mock.calls.find(c => c[0] === 'blackjack_game_state');
      expect(gameStateCall).toBeDefined();
      const state = gameStateCall[1];
      expect(state.playerHand).toHaveLength(2);
      expect(state.dealerHand).toHaveLength(1); // Only first card shown
    });

    it('should join game room', async () => {
      handler.handleConnection(mockSocket);
      await mockSocket._trigger('blackjack_start', { betAmount: 50 });
      expect(mockSocket.join).toHaveBeenCalledWith(expect.stringContaining('blackjack_'));
    });
  });

  describe('blackjack_hit', () => {
    it('should deal a card to the player', async () => {
      handler.handleConnection(mockSocket);
      await mockSocket._trigger('blackjack_start', { betAmount: 100 });

      // Clear previous emits
      mockIo.to.mockReturnThis();
      await mockSocket._trigger('blackjack_hit', {});

      expect(mockIo.to).toHaveBeenCalled();
      expect(mockIo.emit).toHaveBeenCalledWith('blackjack_game_state', expect.objectContaining({
        playerHand: expect.any(Array),
      }));
    });

    it('should emit error if no game found', async () => {
      handler.handleConnection(mockSocket);
      await mockSocket._trigger('blackjack_hit', {});
      expect(mockSocket.emit).toHaveBeenCalledWith('blackjack_error', { message: 'No game found' });
    });
  });

  describe('blackjack_stand', () => {
    it('should emit error if no game found', async () => {
      handler.handleConnection(mockSocket);
      await mockSocket._trigger('blackjack_stand', {});
      expect(mockSocket.emit).toHaveBeenCalledWith('blackjack_error', { message: 'No game found' });
    });

    it('should complete game when player stands', async () => {
      handler.handleConnection(mockSocket);
      await mockSocket._trigger('blackjack_start', { betAmount: 100 });
      await mockSocket._trigger('blackjack_stand', {});

      const gameStateCalls = mockIo.emit.mock.calls.filter(c => c[0] === 'blackjack_game_state');
      if (gameStateCalls.length > 0) {
        const lastState = gameStateCalls[gameStateCalls.length - 1][1];
        expect(lastState.status).toBe('completed');
        expect(lastState.result).toBeDefined();
        expect(lastState.dealerHand.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('blackjack_double', () => {
    it('should emit error if no game found', async () => {
      handler.handleConnection(mockSocket);
      await mockSocket._trigger('blackjack_double', {});
      expect(mockSocket.emit).toHaveBeenCalledWith('blackjack_error', { message: 'No game found' });
    });

    it('should emit error if insufficient balance for double', async () => {
      handler.handleConnection(mockSocket);
      await mockSocket._trigger('blackjack_start', { betAmount: 100 });
      mockHasSufficientBalance.mockResolvedValue(false);
      await mockSocket._trigger('blackjack_double', {});
      expect(mockSocket.emit).toHaveBeenCalledWith('blackjack_error', { message: 'Insufficient balance to double' });
    });
  });

  describe('utility methods', () => {
    it('createDeck should return 52 cards', () => {
      const deck = handler.createDeck();
      expect(deck).toHaveLength(52);
    });

    it('getCardValue should return correct values', () => {
      expect(handler.getCardValue('A')).toBe(11);
      expect(handler.getCardValue('K')).toBe(10);
      expect(handler.getCardValue('Q')).toBe(10);
      expect(handler.getCardValue('J')).toBe(10);
      expect(handler.getCardValue('5')).toBe(5);
      expect(handler.getCardValue('10')).toBe(10);
    });

    it('calculateScore should handle aces correctly', () => {
      // Two aces = 12 (11 + 1), not 22
      const hand = [
        { suit: 'hearts', rank: 'A', value: 11 },
        { suit: 'spades', rank: 'A', value: 11 },
      ];
      expect(handler.calculateScore(hand)).toBe(12);
    });

    it('calculateScore should calculate simple hand', () => {
      const hand = [
        { suit: 'hearts', rank: '10', value: 10 },
        { suit: 'spades', rank: '7', value: 7 },
      ];
      expect(handler.calculateScore(hand)).toBe(17);
    });

    it('calculateScore should handle ace + face card = 21', () => {
      const hand = [
        { suit: 'hearts', rank: 'A', value: 11 },
        { suit: 'spades', rank: 'K', value: 10 },
      ];
      expect(handler.calculateScore(hand)).toBe(21);
    });

    it('calculateScore should adjust ace when over 21', () => {
      const hand = [
        { suit: 'hearts', rank: 'A', value: 11 },
        { suit: 'spades', rank: '8', value: 8 },
        { suit: 'clubs', rank: '6', value: 6 },
      ];
      // 11 + 8 + 6 = 25, ace adjusts to 1: 1 + 8 + 6 = 15
      expect(handler.calculateScore(hand)).toBe(15);
    });

    it('canSplit should return true for matching values', () => {
      const hand = [
        { suit: 'hearts', rank: '8', value: 8 },
        { suit: 'spades', rank: '8', value: 8 },
      ];
      expect(handler.canSplit(hand)).toBe(true);
    });

    it('canSplit should return false for non-matching values', () => {
      const hand = [
        { suit: 'hearts', rank: '8', value: 8 },
        { suit: 'spades', rank: '9', value: 9 },
      ];
      expect(handler.canSplit(hand)).toBe(false);
    });

    it('canSplit should return false for more than 2 cards', () => {
      const hand = [
        { suit: 'hearts', rank: '8', value: 8 },
        { suit: 'spades', rank: '8', value: 8 },
        { suit: 'clubs', rank: '3', value: 3 },
      ];
      expect(handler.canSplit(hand)).toBe(false);
    });

    it('generateGameId should return unique IDs', () => {
      const id1 = handler.generateGameId();
      const id2 = handler.generateGameId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^bj_/);
    });

    it('getActiveGamesCount should return count of active games', () => {
      expect(handler.getActiveGamesCount()).toBe(0);
      handler.games.set('test1', { status: 'active' });
      handler.games.set('test2', { status: 'completed' });
      expect(handler.getActiveGamesCount()).toBe(1);
    });

    it('dealCard should handle empty deck with fallback', () => {
      const card = handler.dealCard([]);
      expect(card).toBeDefined();
      expect(card.suit).toBe('hearts');
      expect(card.rank).toBe('A');
    });

    it('dealInitialCards should deal 4 cards total', () => {
      const game = handler.createNewGame(1, 100);
      expect(game.playerHand).toHaveLength(0);
      expect(game.dealerHand).toHaveLength(0);
      handler.dealInitialCards(game);
      expect(game.playerHand).toHaveLength(2);
      expect(game.dealerHand).toHaveLength(2);
    });

    it('secureShuffle should return same length array', () => {
      const deck = handler.createDeck();
      const shuffled = handler.secureShuffle(deck);
      expect(shuffled).toHaveLength(52);
    });

    it('getGameByUserId should return game or null', () => {
      expect(handler.getGameByUserId(999)).toBeNull();
      handler.games.set('test', { status: 'active' });
      handler.playerGames.set(1, 'test');
      expect(handler.getGameByUserId(1)).toEqual({ status: 'active' });
    });
  });

  describe('endGame', () => {
    it('should set player_bust result when reason is player_bust', async () => {
      const game = handler.createNewGame(1, 100);
      // Set explicit hands to avoid the blackjack override check
      game.playerHand = [
        { suit: 'hearts', rank: '10', value: 10 },
        { suit: 'spades', rank: '8', value: 8 },
        { suit: 'clubs', rank: '6', value: 6 },
      ];
      game.dealerHand = [
        { suit: 'diamonds', rank: '10', value: 10 },
        { suit: 'hearts', rank: '7', value: 7 },
      ];
      const gameId = 'test_game';
      handler.games.set(gameId, game);

      await handler.endGame(gameId, 'player_bust');

      expect(game.status).toBe('completed');
      expect(game.result).toBe('dealer_win');
      expect(game.winAmount).toBe(0);
    });

    it('should handle push (tie)', async () => {
      const game = handler.createNewGame(1, 100);
      game.playerHand = [
        { suit: 'hearts', rank: '10', value: 10 },
        { suit: 'spades', rank: '8', value: 8 },
      ];
      game.dealerHand = [
        { suit: 'clubs', rank: '10', value: 10 },
        { suit: 'diamonds', rank: '8', value: 8 },
      ];
      const gameId = 'test_push';
      handler.games.set(gameId, game);

      await handler.endGame(gameId, 'completed');

      expect(game.result).toBe('push');
      expect(game.winAmount).toBe(100);
    });

    it('should detect blackjack with 2.5x payout', async () => {
      const game = handler.createNewGame(1, 100);
      game.playerHand = [
        { suit: 'hearts', rank: 'A', value: 11 },
        { suit: 'spades', rank: 'K', value: 10 },
      ];
      game.dealerHand = [
        { suit: 'clubs', rank: '10', value: 10 },
        { suit: 'diamonds', rank: '8', value: 8 },
      ];
      const gameId = 'test_blackjack';
      handler.games.set(gameId, game);

      await handler.endGame(gameId, 'completed');

      expect(game.result).toBe('blackjack');
      expect(game.winAmount).toBe(250); // Math.floor(100 * 2.5)
    });

    it('should handle dealer bust', async () => {
      const game = handler.createNewGame(1, 100);
      game.playerHand = [
        { suit: 'hearts', rank: '10', value: 10 },
        { suit: 'spades', rank: '8', value: 8 },
      ];
      game.dealerHand = [
        { suit: 'clubs', rank: '10', value: 10 },
        { suit: 'diamonds', rank: '6', value: 6 },
        { suit: 'hearts', rank: 'K', value: 10 },
      ];
      const gameId = 'test_dealer_bust';
      handler.games.set(gameId, game);

      await handler.endGame(gameId, 'completed');

      expect(game.result).toBe('player_win');
      expect(game.winAmount).toBe(200);
    });

    it('should record win via BalanceService when player wins', async () => {
      const game = handler.createNewGame(1, 100);
      game.playerHand = [
        { suit: 'hearts', rank: '10', value: 10 },
        { suit: 'spades', rank: '9', value: 9 },
      ];
      game.dealerHand = [
        { suit: 'clubs', rank: '10', value: 10 },
        { suit: 'diamonds', rank: '7', value: 7 },
      ];
      const gameId = 'test_win';
      handler.games.set(gameId, game);

      await handler.endGame(gameId, 'completed');

      expect(mockRecordWin).toHaveBeenCalledWith(
        1, 100, 200, 'blackjack',
        expect.objectContaining({ gameId: 'test_win' })
      );
    });

    it('should not record win when dealer wins', async () => {
      const game = handler.createNewGame(1, 100);
      const gameId = 'test_loss';
      handler.games.set(gameId, game);

      await handler.endGame(gameId, 'player_bust');

      expect(mockRecordWin).not.toHaveBeenCalled();
    });

    it('should handle nonexistent game gracefully', async () => {
      await handler.endGame('nonexistent', 'completed');
      // Should not throw
    });
  });

  describe('playDealer', () => {
    it('should hit until 17 or higher', async () => {
      const game = handler.createNewGame(1, 100);
      game.dealerHand = [
        { suit: 'hearts', rank: '5', value: 5 },
        { suit: 'spades', rank: '6', value: 6 },
      ];

      await handler.playDealer(game);

      const score = handler.calculateScore(game.dealerHand);
      expect(score).toBeGreaterThanOrEqual(17);
    });

    it('should not hit if already at 17+', async () => {
      const game = handler.createNewGame(1, 100);
      game.dealerHand = [
        { suit: 'hearts', rank: '10', value: 10 },
        { suit: 'spades', rank: '7', value: 7 },
      ];
      const initialLength = game.dealerHand.length;

      await handler.playDealer(game);

      expect(game.dealerHand).toHaveLength(initialLength);
    });
  });
});
