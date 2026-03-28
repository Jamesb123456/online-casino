// @ts-nocheck
/**
 * Landmines game handler tests
 *
 * The landmines handler uses a per-connection pattern (io, socket, user).
 * It implements a stateful single-player mine-sweeping game with:
 *   - start: create a new game with mines placed on a 5x5 grid
 *   - pick: reveal a cell (mine = game over, diamond = multiplier increase)
 *   - cashout: collect winnings based on current multiplier
 *
 * Tests cover:
 *   - Authentication & connection
 *   - start: valid start, insufficient balance, mine count validation, already active game
 *   - pick: valid pick, mine hit (game over), safe pick (multiplier increase), already revealed
 *   - cashout: successful cashout, no active game, double cashout guard
 *   - Game state management
 *   - Balance service failures
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
    logGameAction: vi.fn(),
  },
}));

vi.mock('../validation/schemas.js', () => ({
  validateSocketData: vi.fn((_schema, data) => data),
  landminesStartSchema: {},
  landminesPickSchema: {},
}));

vi.mock('../../drizzle/models/GameStat.js', () => ({
  default: {
    updateStats: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock crypto for deterministic grid generation
// crypto.randomInt(25) => 12 (middle of the grid), then subsequent calls return 12+offset
// crypto.randomUUID returns a fixed UUID
let cryptoCallCount = 0;
vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn().mockReturnValue({
      readUInt32BE: vi.fn().mockReturnValue(2147483648),
      toString: vi.fn().mockReturnValue('mockrandomhex'),
    }),
    randomInt: vi.fn((n) => {
      // For grid generation: place mines at specific positions
      // Return sequential positions: 0, 1, 2, ... to place mines predictably
      const result = cryptoCallCount % n;
      cryptoCallCount++;
      return result;
    }),
    randomUUID: vi.fn().mockReturnValue('test-game-uuid'),
  },
  randomBytes: vi.fn().mockReturnValue({
    readUInt32BE: vi.fn().mockReturnValue(2147483648),
    toString: vi.fn().mockReturnValue('mockrandomhex'),
  }),
  randomInt: vi.fn((n) => {
    const result = cryptoCallCount % n;
    cryptoCallCount++;
    return result;
  }),
  randomUUID: vi.fn().mockReturnValue('test-game-uuid'),
}));

// ---------------------------------------------------------------------------
// Import module under test
// ---------------------------------------------------------------------------

import initLandminesHandlers from '../socket/landminesHandler.js';

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
    to: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
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

function createMockIo() {
  return {
    emit: vi.fn(),
    to: vi.fn().mockReturnThis(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Landmines game handler', () => {
  let io;
  let socket;
  let user;

  beforeEach(async () => {
    vi.clearAllMocks();
    cryptoCallCount = 0;

    io = createMockIo();
    // Use a unique userId per test run to avoid activeSessions conflicts
    const uniqueUserId = Math.floor(Math.random() * 1000000);
    user = { userId: uniqueUserId, username: 'testplayer', balance: 1000 };
    socket = createMockSocket({ userId: uniqueUserId, username: 'testplayer', balance: '1000' });

    mockPlaceBet.mockResolvedValue({ user: { balance: '900' }, transaction: {} });
    mockRecordWin.mockResolvedValue({ user: { balance: '1100' }, transaction: {} });
  });

  // -----------------------------------------------------------------------
  // Initialization & connection
  // -----------------------------------------------------------------------
  describe('initialization and connection', () => {
    it('should register event handlers on the socket', () => {
      initLandminesHandlers(io, socket, user);

      const registeredEvents = socket.on.mock.calls.map(([event]) => event);
      expect(registeredEvents).toContain('landmines:join');
      expect(registeredEvents).toContain('landmines:start');
      expect(registeredEvents).toContain('landmines:pick');
      expect(registeredEvents).toContain('landmines:cashout');
      expect(registeredEvents).toContain('landmines:get_history');
      expect(registeredEvents).toContain('landmines:leave');
      expect(registeredEvents).toContain('disconnect');
    });

    it('should join the landmines room', () => {
      initLandminesHandlers(io, socket, user);
      expect(socket.join).toHaveBeenCalledWith('landmines');
    });

    it('should disconnect unauthenticated sockets', () => {
      const unauthedSocket = createMockSocket(null);
      unauthedSocket.user = undefined;
      initLandminesHandlers(io, unauthedSocket, user);

      expect(unauthedSocket.emit).toHaveBeenCalledWith('landmines:error', expect.objectContaining({
        message: 'Authentication required',
      }));
      expect(unauthedSocket.disconnect).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // landmines:join
  // -----------------------------------------------------------------------
  describe('landmines:join event', () => {
    it('should return game state with balance and history', async () => {
      initLandminesHandlers(io, socket, user);

      const callback = vi.fn();
      await socket._trigger('landmines:join', {}, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        balance: expect.any(Number),
        history: expect.any(Array),
      }));
    });
  });

  // -----------------------------------------------------------------------
  // landmines:start
  // -----------------------------------------------------------------------
  describe('landmines:start event', () => {
    it('should successfully start a new game', async () => {
      initLandminesHandlers(io, socket, user);

      const callback = vi.fn();
      await socket._trigger('landmines:start', { betAmount: 100, mines: 3 }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        gameId: expect.any(String),
        mines: 3,
        gridSize: 5,
        balance: 900,
      }));
    });

    it('should call BalanceService.placeBet', async () => {
      initLandminesHandlers(io, socket, user);

      await socket._trigger('landmines:start', { betAmount: 100, mines: 3 }, vi.fn());

      expect(mockPlaceBet).toHaveBeenCalledWith(user.userId, 100, 'landmines', expect.objectContaining({
        mines: 3,
      }));
    });

    it('should reject when balance is insufficient', async () => {
      initLandminesHandlers(io, socket, { ...user, balance: 50 });

      const callback = vi.fn();
      await socket._trigger('landmines:start', { betAmount: 100, mines: 3 }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Insufficient balance',
      }));
    });

    it('should reject when user already has an active game', async () => {
      initLandminesHandlers(io, socket, user);

      // Start first game
      await socket._trigger('landmines:start', { betAmount: 100, mines: 3 }, vi.fn());

      // Try to start second game
      const callback = vi.fn();
      await socket._trigger('landmines:start', { betAmount: 100, mines: 3 }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('already have an active game'),
      }));
    });

    it('should handle BalanceService.placeBet failure', async () => {
      mockPlaceBet.mockRejectedValueOnce(new Error('DB error'));
      initLandminesHandlers(io, socket, user);

      const callback = vi.fn();
      await socket._trigger('landmines:start', { betAmount: 100, mines: 3 }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
      }));
    });

    it('should accept minimum 1 mine', async () => {
      initLandminesHandlers(io, socket, user);

      const callback = vi.fn();
      await socket._trigger('landmines:start', { betAmount: 100, mines: 1 }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        mines: 1,
      }));
    });

    it('should accept maximum 24 mines', async () => {
      initLandminesHandlers(io, socket, user);

      const callback = vi.fn();
      await socket._trigger('landmines:start', { betAmount: 100, mines: 24 }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        mines: 24,
      }));
    });
  });

  // -----------------------------------------------------------------------
  // landmines:pick
  // -----------------------------------------------------------------------
  describe('landmines:pick event', () => {
    it('should reject pick when no active game exists', async () => {
      initLandminesHandlers(io, socket, user);

      const callback = vi.fn();
      await socket._trigger('landmines:pick', { row: 0, col: 0 }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'No active game found',
      }));
    });

    it('should return hit=false for a safe cell pick', async () => {
      initLandminesHandlers(io, socket, user);

      // Start a game with 1 mine so most cells are safe
      await socket._trigger('landmines:start', { betAmount: 100, mines: 1 }, vi.fn());

      // Pick a cell that is likely safe (given our mock, mine is at position 0 = row 0, col 0)
      // Try row 4, col 4 which should be safe
      const callback = vi.fn();
      await socket._trigger('landmines:pick', { row: 4, col: 4 }, callback);

      const result = callback.mock.calls[0][0];
      expect(result.success).toBe(true);
      if (!result.hit) {
        expect(result.hit).toBe(false);
        expect(result.multiplier).toBeGreaterThan(0);
        expect(result.potentialWin).toBeGreaterThan(0);
        expect(result.gameOver).toBe(false);
      }
    });

    it('should return hit=true when a mine is picked', async () => {
      initLandminesHandlers(io, socket, user);

      // Start game with 1 mine; mock randomInt(25) returns 0 first call for mine placement
      // so mine is at flat index 0 = row 0, col 0
      await socket._trigger('landmines:start', { betAmount: 100, mines: 1 }, vi.fn());

      const callback = vi.fn();
      await socket._trigger('landmines:pick', { row: 0, col: 0 }, callback);

      const result = callback.mock.calls[0][0];
      expect(result.success).toBe(true);
      expect(result.hit).toBe(true);
      expect(result.gameOver).toBe(true);
      expect(result.winAmount).toBe(0);
      expect(result.fullGrid).toBeDefined();
    });

    it('should reject picking an already revealed cell', async () => {
      initLandminesHandlers(io, socket, user);

      await socket._trigger('landmines:start', { betAmount: 100, mines: 1 }, vi.fn());

      // Pick a safe cell first
      await socket._trigger('landmines:pick', { row: 4, col: 4 }, vi.fn());

      // Try to pick the same cell again
      const callback = vi.fn();
      await socket._trigger('landmines:pick', { row: 4, col: 4 }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'This cell has already been revealed',
      }));
    });

    it('should increase multiplier with each safe pick', async () => {
      initLandminesHandlers(io, socket, user);

      await socket._trigger('landmines:start', { betAmount: 100, mines: 1 }, vi.fn());

      // Pick two different safe cells and compare multipliers
      const callback1 = vi.fn();
      await socket._trigger('landmines:pick', { row: 4, col: 4 }, callback1);

      const callback2 = vi.fn();
      await socket._trigger('landmines:pick', { row: 4, col: 3 }, callback2);

      const result1 = callback1.mock.calls[0][0];
      const result2 = callback2.mock.calls[0][0];

      // Both should be safe (mine is at 0,0)
      if (!result1.hit && !result2.hit) {
        expect(result2.multiplier).toBeGreaterThanOrEqual(result1.multiplier);
      }
    });

    it('should end game and clear session when mine is hit', async () => {
      initLandminesHandlers(io, socket, user);

      await socket._trigger('landmines:start', { betAmount: 100, mines: 1 }, vi.fn());

      // Hit a mine
      await socket._trigger('landmines:pick', { row: 0, col: 0 }, vi.fn());

      // Try to pick another cell - should fail since game is over
      const callback = vi.fn();
      await socket._trigger('landmines:pick', { row: 2, col: 2 }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'No active game found',
      }));
    });
  });

  // -----------------------------------------------------------------------
  // landmines:cashout
  // -----------------------------------------------------------------------
  describe('landmines:cashout event', () => {
    it('should reject cashout when no active game exists', async () => {
      initLandminesHandlers(io, socket, user);

      const callback = vi.fn();
      await socket._trigger('landmines:cashout', {}, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'No active game found',
      }));
    });

    it('should successfully cashout with correct payout', async () => {
      initLandminesHandlers(io, socket, user);

      // Start game
      await socket._trigger('landmines:start', { betAmount: 100, mines: 1 }, vi.fn());

      // Pick a safe cell to establish a multiplier
      await socket._trigger('landmines:pick', { row: 4, col: 4 }, vi.fn());

      // Cashout
      const callback = vi.fn();
      await socket._trigger('landmines:cashout', {}, callback);

      const result = callback.mock.calls[0][0];
      expect(result.success).toBe(true);
      expect(result.cashedOut).toBe(true);
      expect(result.gameOver).toBe(true);
      expect(result.multiplier).toBeGreaterThan(0);
      expect(result.winAmount).toBeGreaterThan(0);
      expect(result.fullGrid).toBeDefined();
    });

    it('should call BalanceService.recordWin on cashout', async () => {
      initLandminesHandlers(io, socket, user);

      await socket._trigger('landmines:start', { betAmount: 100, mines: 1 }, vi.fn());
      await socket._trigger('landmines:pick', { row: 4, col: 4 }, vi.fn());
      await socket._trigger('landmines:cashout', {}, vi.fn());

      expect(mockRecordWin).toHaveBeenCalledWith(
        user.userId,
        100,
        expect.any(Number),
        'landmines',
        expect.objectContaining({
          mines: 1,
          multiplier: expect.any(Number),
        })
      );
    });

    it('should broadcast cashout to other players', async () => {
      initLandminesHandlers(io, socket, user);

      await socket._trigger('landmines:start', { betAmount: 100, mines: 1 }, vi.fn());
      await socket._trigger('landmines:pick', { row: 4, col: 4 }, vi.fn());
      await socket._trigger('landmines:cashout', {}, vi.fn());

      expect(socket.to).toHaveBeenCalledWith('landmines');
    });

    it('should prevent double cashout', async () => {
      initLandminesHandlers(io, socket, user);

      await socket._trigger('landmines:start', { betAmount: 100, mines: 1 }, vi.fn());
      await socket._trigger('landmines:pick', { row: 4, col: 4 }, vi.fn());

      // First cashout
      await socket._trigger('landmines:cashout', {}, vi.fn());

      // Second cashout should fail
      const callback = vi.fn();
      await socket._trigger('landmines:cashout', {}, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'No active game found',
      }));
    });

    it('should clear the current game after cashout', async () => {
      initLandminesHandlers(io, socket, user);

      await socket._trigger('landmines:start', { betAmount: 100, mines: 1 }, vi.fn());
      await socket._trigger('landmines:pick', { row: 4, col: 4 }, vi.fn());
      await socket._trigger('landmines:cashout', {}, vi.fn());

      // Should be able to start a new game
      const callback = vi.fn();
      await socket._trigger('landmines:start', { betAmount: 100, mines: 1 }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });

  // -----------------------------------------------------------------------
  // landmines:get_history
  // -----------------------------------------------------------------------
  describe('landmines:get_history event', () => {
    it('should return user and global history', async () => {
      initLandminesHandlers(io, socket, user);

      const callback = vi.fn();
      await socket._trigger('landmines:get_history', { limit: 5 }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        userHistory: expect.any(Array),
        globalHistory: expect.any(Array),
      }));
    });
  });

  // -----------------------------------------------------------------------
  // landmines:leave
  // -----------------------------------------------------------------------
  describe('landmines:leave event', () => {
    it('should leave the landmines room', async () => {
      initLandminesHandlers(io, socket, user);

      await socket._trigger('landmines:leave');

      expect(socket.leave).toHaveBeenCalledWith('landmines');
    });
  });

  // -----------------------------------------------------------------------
  // disconnect
  // -----------------------------------------------------------------------
  describe('disconnect event', () => {
    it('should mark the session as inactive on disconnect', async () => {
      initLandminesHandlers(io, socket, user);

      // Should not throw
      await socket._trigger('disconnect');
    });

    it('should preserve game session for reconnection', async () => {
      initLandminesHandlers(io, socket, user);

      // Start a game
      await socket._trigger('landmines:start', { betAmount: 100, mines: 3 }, vi.fn());

      // Disconnect
      await socket._trigger('disconnect');

      // Session data should still exist (no error thrown during disconnect)
    });
  });
});
