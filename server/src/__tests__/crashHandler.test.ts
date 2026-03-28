// @ts-nocheck
/**
 * Crash game handler tests
 *
 * The crash handler is tightly coupled to Socket.IO namespaces and timers,
 * so we test it by:
 *   1. Mocking all external dependencies (BalanceService, LoggingService, crypto)
 *   2. Creating a mock Socket.IO namespace with emittable events
 *   3. Exercising the handler through simulated socket connections and events
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks -- use vi.hoisted for variables referenced inside vi.mock factories
// ---------------------------------------------------------------------------

const {
  mockGetBalance,
  mockPlaceBet,
  mockRecordWin,
} = vi.hoisted(() => ({
  mockGetBalance: vi.fn(),
  mockPlaceBet: vi.fn(),
  mockRecordWin: vi.fn(),
}));

vi.mock('../services/balanceService.js', () => ({
  default: {
    getBalance: mockGetBalance,
    placeBet: mockPlaceBet,
    recordWin: mockRecordWin,
  },
}));

vi.mock('../services/loggingService.js', () => ({
  default: {
    logGameEvent: vi.fn(),
    logBetPlaced: vi.fn(),
    logBetResult: vi.fn(),
    logGameStart: vi.fn(),
    logGameEnd: vi.fn(),
    logSystemEvent: vi.fn(),
  },
}));

vi.mock('../utils/gameUtils.js', () => ({
  calculateHouseEdge: vi.fn().mockReturnValue(0.01),
}));

vi.mock('../validation/schemas.js', () => ({
  validateSocketData: vi.fn((_schema, data) => data),
  crashPlaceBetSchema: {},
}));

// Mock crypto so generateCrashPoint is deterministic
vi.mock('crypto', () => {
  return {
    default: {
      randomBytes: vi.fn().mockReturnValue({
        readUInt32BE: vi.fn().mockReturnValue(2147483648),
      }),
      randomInt: vi.fn((n) => Math.floor(n / 2)),
    },
    randomBytes: vi.fn().mockReturnValue({
      readUInt32BE: vi.fn().mockReturnValue(2147483648),
    }),
    randomInt: vi.fn((n) => Math.floor(n / 2)),
  };
});

// ---------------------------------------------------------------------------
// Import module under test
// ---------------------------------------------------------------------------

import initCrashHandlers from '../socket/crashHandler.js';

// ---------------------------------------------------------------------------
// Helpers to create mock Socket.IO objects
// ---------------------------------------------------------------------------

function createMockSocket(user = { userId: 1, username: 'testplayer', balance: '1000' }) {
  const eventHandlers = new Map();

  const socket = {
    id: `socket_${Math.random().toString(36).slice(2)}`,
    user,
    emit: vi.fn(),
    broadcast: { emit: vi.fn() },
    disconnect: vi.fn(),
    on: vi.fn((event, handler) => {
      eventHandlers.set(event, handler);
    }),
    _trigger: async (event, ...args) => {
      const handler = eventHandlers.get(event);
      if (handler) return handler(...args);
    },
  };

  return socket;
}

function createMockNamespace() {
  const connectionHandlers = [];

  const namespace = {
    emit: vi.fn(),
    on: vi.fn((event, handler) => {
      if (event === 'connection') connectionHandlers.push(handler);
    }),
    _simulateConnection: (socket) => {
      for (const h of connectionHandlers) h(socket);
    },
  };

  return namespace;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Crash game handler', () => {
  let namespace;
  let handler;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    namespace = createMockNamespace();
    handler = initCrashHandlers(namespace);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------
  describe('initialization', () => {
    it('should register a connection handler on the namespace', () => {
      expect(namespace.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should return getGameState and getGameHistory methods', () => {
      expect(typeof handler.getGameState).toBe('function');
      expect(typeof handler.getGameHistory).toBe('function');
    });

    it('should start with isGameStarting = true after init', () => {
      const state = handler.getGameState();
      expect(state.isGameStarting).toBe(true);
    });

    it('should emit gameStarting on the namespace', () => {
      expect(namespace.emit).toHaveBeenCalledWith('gameStarting', expect.objectContaining({
        startingIn: 5,
      }));
    });
  });

  // -----------------------------------------------------------------------
  // Connection handling
  // -----------------------------------------------------------------------
  describe('connection', () => {
    it('should emit initial gameState to the connecting socket', () => {
      const socket = createMockSocket();
      namespace._simulateConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('gameState', expect.objectContaining({
        isGameRunning: expect.any(Boolean),
        isGameStarting: expect.any(Boolean),
        currentMultiplier: expect.any(Number),
      }));
    });

    it('should emit gameHistory to the connecting socket', () => {
      const socket = createMockSocket();
      namespace._simulateConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('gameHistory', expect.any(Array));
    });

    it('should emit currentBets to the connecting socket', () => {
      const socket = createMockSocket();
      namespace._simulateConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('currentBets', expect.any(Array));
    });

    it('should emit activePlayers to the connecting socket', () => {
      const socket = createMockSocket();
      namespace._simulateConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('activePlayers', expect.any(Array));
    });

    it('should broadcast playerJoined to other clients', () => {
      const socket = createMockSocket();
      namespace._simulateConnection(socket);

      expect(socket.broadcast.emit).toHaveBeenCalledWith('playerJoined', expect.objectContaining({
        id: 1,
        username: 'testplayer',
      }));
    });

    it('should disconnect unauthenticated sockets', () => {
      const socket = createMockSocket(null);
      socket.user = undefined;
      namespace._simulateConnection(socket);

      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('should register placeBet, cashOut, and disconnect handlers', () => {
      const socket = createMockSocket();
      namespace._simulateConnection(socket);

      const registeredEvents = socket.on.mock.calls.map(([event]) => event);
      expect(registeredEvents).toContain('placeBet');
      expect(registeredEvents).toContain('cashOut');
      expect(registeredEvents).toContain('disconnect');
    });
  });

  // -----------------------------------------------------------------------
  // placeBet
  // -----------------------------------------------------------------------
  describe('placeBet event', () => {
    it('should reject bets while game is running', async () => {
      vi.advanceTimersByTime(5000);

      const socket = createMockSocket();
      namespace._simulateConnection(socket);

      const callback = vi.fn();
      await socket._trigger('placeBet', { amount: 100 }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
      }));
    });

    it('should reject bets when user has insufficient balance', async () => {
      const socket = createMockSocket();
      namespace._simulateConnection(socket);

      mockGetBalance.mockResolvedValue(50);

      const callback = vi.fn();
      await socket._trigger('placeBet', { amount: 100, autoCashoutAt: 2.0 }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Insufficient balance',
      }));
    });

    it('should successfully place a bet when conditions are met', async () => {
      const state = handler.getGameState();
      expect(state.isGameRunning).toBe(false);

      const socket = createMockSocket();
      namespace._simulateConnection(socket);

      mockGetBalance.mockResolvedValue(1000);
      mockPlaceBet.mockResolvedValue({ user: { balance: '900' }, transaction: {} });

      const callback = vi.fn();
      await socket._trigger('placeBet', { amount: 100, autoCashoutAt: 2.0 }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Bet placed successfully',
      }));

      expect(namespace.emit).toHaveBeenCalledWith('playerBet', expect.objectContaining({
        userId: 1,
        username: 'testplayer',
        amount: 100,
      }));
    });

    it('should reject a second bet from the same user', async () => {
      const socket = createMockSocket();
      namespace._simulateConnection(socket);

      mockGetBalance.mockResolvedValue(1000);
      mockPlaceBet.mockResolvedValue({ user: { balance: '900' }, transaction: {} });

      const callback1 = vi.fn();
      await socket._trigger('placeBet', { amount: 100 }, callback1);
      expect(callback1).toHaveBeenCalledWith(expect.objectContaining({ success: true }));

      const callback2 = vi.fn();
      await socket._trigger('placeBet', { amount: 50 }, callback2);
      expect(callback2).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'You already have an active bet',
      }));
    });

    it('should reject bet when balance check fails', async () => {
      const socket = createMockSocket();
      namespace._simulateConnection(socket);

      mockGetBalance.mockRejectedValue(new Error('DB down'));

      const callback = vi.fn();
      await socket._trigger('placeBet', { amount: 100 }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Could not verify balance',
      }));
    });

    it('should reject bet when placeBet service call fails', async () => {
      const socket = createMockSocket();
      namespace._simulateConnection(socket);

      mockGetBalance.mockResolvedValue(1000);
      mockPlaceBet.mockRejectedValue(new Error('Transaction failed'));

      const callback = vi.fn();
      await socket._trigger('placeBet', { amount: 100 }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Failed to place bet',
      }));
    });
  });

  // -----------------------------------------------------------------------
  // cashOut
  // -----------------------------------------------------------------------
  describe('cashOut event', () => {
    it('should reject cashout when game is not running', async () => {
      const socket = createMockSocket();
      namespace._simulateConnection(socket);

      const callback = vi.fn();
      await socket._trigger('cashOut', {}, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Game is not running',
      }));
    });

    it('should reject cashout when user has no active bet', async () => {
      vi.advanceTimersByTime(5000);

      const socket = createMockSocket();
      namespace._simulateConnection(socket);

      const callback = vi.fn();
      await socket._trigger('cashOut', {}, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'No active bet found',
      }));
    });
  });

  // -----------------------------------------------------------------------
  // disconnect
  // -----------------------------------------------------------------------
  describe('disconnect event', () => {
    it('should broadcast playerLeft when a connected user disconnects', async () => {
      const socket = createMockSocket();
      namespace._simulateConnection(socket);

      namespace.emit.mockClear();

      await socket._trigger('disconnect');

      expect(namespace.emit).toHaveBeenCalledWith('playerLeft', expect.objectContaining({
        id: 1,
        username: 'testplayer',
      }));
    });
  });

  // -----------------------------------------------------------------------
  // getGameState / getGameHistory
  // -----------------------------------------------------------------------
  describe('returned API', () => {
    it('getGameState should return a snapshot of the current state', () => {
      const state = handler.getGameState();
      expect(state).toHaveProperty('isGameRunning');
      expect(state).toHaveProperty('isGameStarting');
      expect(state).toHaveProperty('currentMultiplier');
      expect(state).toHaveProperty('crashPoint');
      expect(state).toHaveProperty('gameId');
    });

    it('getGameHistory should return an array', () => {
      const history = handler.getGameHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('getGameState should return a copy (not a reference to the internal object)', () => {
      const state1 = handler.getGameState();
      const state2 = handler.getGameState();
      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });

    it('getGameHistory should return a copy', () => {
      const h1 = handler.getGameHistory();
      const h2 = handler.getGameHistory();
      expect(h1).not.toBe(h2);
    });
  });

  // -----------------------------------------------------------------------
  // Game lifecycle
  // -----------------------------------------------------------------------
  describe('game lifecycle', () => {
    it('should transition from isGameStarting to isGameRunning after 5 seconds', () => {
      expect(handler.getGameState().isGameStarting).toBe(true);
      expect(handler.getGameState().isGameRunning).toBe(false);

      vi.advanceTimersByTime(5000);

      expect(handler.getGameState().isGameStarting).toBe(false);
      expect(handler.getGameState().isGameRunning).toBe(true);
    });

    it('should emit gameStarted when the game begins', () => {
      namespace.emit.mockClear();

      vi.advanceTimersByTime(5000);

      expect(namespace.emit).toHaveBeenCalledWith('gameStarted', expect.objectContaining({
        gameId: expect.any(String),
      }));
    });

    it('should start multiplier updates via tick interval once running', () => {
      vi.advanceTimersByTime(5000);
      namespace.emit.mockClear();

      vi.advanceTimersByTime(100);

      expect(namespace.emit).toHaveBeenCalledWith('multiplierUpdate', expect.objectContaining({
        multiplier: expect.any(Number),
      }));
    });

    it('multiplier should increase over time', () => {
      vi.advanceTimersByTime(5000);

      vi.advanceTimersByTime(100);
      const state1 = handler.getGameState();

      vi.advanceTimersByTime(1000);
      const state2 = handler.getGameState();

      expect(state2.currentMultiplier).toBeGreaterThan(state1.currentMultiplier);
    });
  });
});
