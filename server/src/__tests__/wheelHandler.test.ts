// @ts-nocheck
/**
 * Wheel game handler tests
 *
 * The wheel handler uses a per-connection pattern (io, socket, user).
 * It combines bet placement and spin into a single event (wheel:place_bet).
 * Tests cover:
 *   - Authentication & connection
 *   - place_bet: valid bet, insufficient balance, difficulty levels (easy/medium/hard)
 *   - Win/loss resolution with correct multipliers
 *   - Player disconnect and cleanup
 *   - Balance service failures
 *   - Multiplayer broadcasts
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
  wheelPlaceBetSchema: {},
}));

// Mock crypto for deterministic results
// crypto.randomInt(n) => Math.floor(n/2) returns the middle segment
// crypto.randomUUID returns a fixed UUID
vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn().mockReturnValue({
      readUInt32BE: vi.fn().mockReturnValue(2147483648),
      toString: vi.fn().mockReturnValue('mockrandomhex'),
    }),
    randomInt: vi.fn((n) => Math.floor(n / 2)),
    randomUUID: vi.fn().mockReturnValue('test-uuid-1234'),
  },
  randomBytes: vi.fn().mockReturnValue({
    readUInt32BE: vi.fn().mockReturnValue(2147483648),
    toString: vi.fn().mockReturnValue('mockrandomhex'),
  }),
  randomInt: vi.fn((n) => Math.floor(n / 2)),
  randomUUID: vi.fn().mockReturnValue('test-uuid-1234'),
}));

// ---------------------------------------------------------------------------
// Import module under test
// ---------------------------------------------------------------------------

import initWheelHandlers from '../socket/wheelHandler.js';

// ---------------------------------------------------------------------------
// Helpers to create mock Socket.IO objects
// ---------------------------------------------------------------------------

function createMockSocket(user = { userId: 1, username: 'testplayer', balance: '1000', avatar: null }) {
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

let wheelTestCounter = 200000;

describe('Wheel game handler', () => {
  let io;
  let socket;
  let user;

  beforeEach(() => {
    vi.clearAllMocks();

    io = createMockIo();
    // Use a monotonically increasing userId per test to avoid module-scoped state conflicts
    wheelTestCounter++;
    const uniqueUserId = wheelTestCounter;
    user = { userId: uniqueUserId, username: 'testplayer', balance: 1000, avatar: null };
    socket = createMockSocket({ userId: uniqueUserId, username: 'testplayer', balance: '1000' });

    mockPlaceBet.mockResolvedValue({ user: { balance: '900' }, transaction: {} });
    mockRecordWin.mockResolvedValue({ user: { balance: '1100' }, transaction: {} });
  });

  // -----------------------------------------------------------------------
  // Initialization & connection
  // -----------------------------------------------------------------------
  describe('initialization and connection', () => {
    it('should register event handlers on the socket', () => {
      initWheelHandlers(io, socket, user);

      const registeredEvents = socket.on.mock.calls.map(([event]) => event);
      expect(registeredEvents).toContain('wheel:join');
      expect(registeredEvents).toContain('wheel:place_bet');
      expect(registeredEvents).toContain('wheel:get_history');
      expect(registeredEvents).toContain('wheel:leave');
      expect(registeredEvents).toContain('disconnect');
    });

    it('should join the wheel room', () => {
      initWheelHandlers(io, socket, user);
      expect(socket.join).toHaveBeenCalledWith('wheel');
    });

    it('should emit active players to the connecting socket', () => {
      initWheelHandlers(io, socket, user);
      expect(socket.emit).toHaveBeenCalledWith('wheel:activePlayers', expect.any(Array));
    });

    it('should emit current bets to the connecting socket', () => {
      initWheelHandlers(io, socket, user);
      expect(socket.emit).toHaveBeenCalledWith('wheel:currentBets', expect.any(Array));
    });

    it('should broadcast playerJoined to other clients', () => {
      initWheelHandlers(io, socket, user);
      expect(socket.broadcast.emit).toHaveBeenCalledWith('wheel:playerJoined', expect.objectContaining({
        id: user.userId,
        username: 'testplayer',
      }));
    });

    it('should disconnect unauthenticated sockets', () => {
      const unauthedSocket = createMockSocket(null);
      unauthedSocket.user = undefined;
      initWheelHandlers(io, unauthedSocket, user);

      expect(unauthedSocket.emit).toHaveBeenCalledWith('wheel:error', expect.objectContaining({
        message: 'Authentication required',
      }));
      expect(unauthedSocket.disconnect).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // wheel:join
  // -----------------------------------------------------------------------
  describe('wheel:join event', () => {
    it('should return game state with balance and history', async () => {
      initWheelHandlers(io, socket, user);

      const callback = vi.fn();
      await socket._trigger('wheel:join', {}, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        balance: expect.any(Number),
        history: expect.any(Array),
      }));
    });
  });

  // -----------------------------------------------------------------------
  // wheel:place_bet
  // -----------------------------------------------------------------------
  describe('wheel:place_bet event', () => {
    it('should successfully place a bet and return result', async () => {
      initWheelHandlers(io, socket, user);

      const callback = vi.fn();
      await socket._trigger('wheel:place_bet', { betAmount: 100, difficulty: 'medium' }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        gameId: expect.any(String),
        segmentIndex: expect.any(Number),
        multiplier: expect.any(Number),
        winAmount: expect.any(Number),
        profit: expect.any(Number),
        balance: expect.any(Number),
      }));
    });

    it('should call BalanceService.placeBet with correct arguments', async () => {
      initWheelHandlers(io, socket, user);

      await socket._trigger('wheel:place_bet', { betAmount: 100, difficulty: 'medium' }, vi.fn());

      expect(mockPlaceBet).toHaveBeenCalledWith(user.userId, 100, 'wheel', expect.objectContaining({
        difficulty: 'medium',
      }));
    });

    it('should call BalanceService.recordWin when winAmount > 0', async () => {
      initWheelHandlers(io, socket, user);

      await socket._trigger('wheel:place_bet', { betAmount: 100, difficulty: 'medium' }, vi.fn());

      // All segments have multiplier > 0 so winAmount is always > 0
      expect(mockRecordWin).toHaveBeenCalled();
    });

    it('should reject bet when balance is insufficient', async () => {
      // Use a fresh unique userId so the session gets initialized with balance 50
      const lowBalanceUserId = Math.floor(Math.random() * 1000000) + 2000000;
      const lowBalanceSocket = createMockSocket({ userId: lowBalanceUserId, username: 'testplayer', balance: '50' });
      initWheelHandlers(io, lowBalanceSocket, { userId: lowBalanceUserId, username: 'testplayer', balance: 50, avatar: null });

      const callback = vi.fn();
      await lowBalanceSocket._trigger('wheel:place_bet', { betAmount: 100, difficulty: 'medium' }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Insufficient balance',
      }));
    });

    it('should work with easy difficulty', async () => {
      initWheelHandlers(io, socket, user);

      const callback = vi.fn();
      await socket._trigger('wheel:place_bet', { betAmount: 100, difficulty: 'easy' }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        multiplier: expect.any(Number),
      }));
    });

    it('should work with hard difficulty', async () => {
      initWheelHandlers(io, socket, user);

      const callback = vi.fn();
      await socket._trigger('wheel:place_bet', { betAmount: 100, difficulty: 'hard' }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        multiplier: expect.any(Number),
      }));
    });

    it('should default to medium difficulty when not specified', async () => {
      initWheelHandlers(io, socket, user);

      const callback = vi.fn();
      await socket._trigger('wheel:place_bet', { betAmount: 100 }, callback);

      // validateSocketData is mocked to pass through, so difficulty will be undefined
      // getWheelSegments defaults to 'medium' when not found
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });

    it('should broadcast bet to other players', async () => {
      initWheelHandlers(io, socket, user);

      await socket._trigger('wheel:place_bet', { betAmount: 100, difficulty: 'medium' }, vi.fn());

      expect(socket.broadcast.emit).toHaveBeenCalledWith('wheel:playerBet', expect.objectContaining({
        userId: user.userId,
        username: 'testplayer',
        betAmount: 100,
      }));
    });

    it('should broadcast game result to room', async () => {
      initWheelHandlers(io, socket, user);

      await socket._trigger('wheel:place_bet', { betAmount: 100, difficulty: 'medium' }, vi.fn());

      expect(socket.to).toHaveBeenCalledWith('wheel');
    });

    it('should handle BalanceService.placeBet failure', async () => {
      mockPlaceBet.mockRejectedValueOnce(new Error('DB error'));
      initWheelHandlers(io, socket, user);

      const callback = vi.fn();
      await socket._trigger('wheel:place_bet', { betAmount: 100, difficulty: 'medium' }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
      }));
    });

    it('should handle BalanceService.recordWin failure', async () => {
      mockRecordWin.mockRejectedValueOnce(new Error('DB error'));
      initWheelHandlers(io, socket, user);

      const callback = vi.fn();
      await socket._trigger('wheel:place_bet', { betAmount: 100, difficulty: 'medium' }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
      }));
    });

    it('should correctly deduct and add balance for a bet', async () => {
      initWheelHandlers(io, socket, user);

      const callback = vi.fn();
      await socket._trigger('wheel:place_bet', { betAmount: 100, difficulty: 'medium' }, callback);

      const result = callback.mock.calls[0][0];
      expect(result.success).toBe(true);
      // Balance should be: 1000 - 100 + winAmount
      expect(result.balance).toBe(1000 - 100 + result.winAmount);
    });
  });

  // -----------------------------------------------------------------------
  // wheel:get_history
  // -----------------------------------------------------------------------
  describe('wheel:get_history event', () => {
    it('should return user and global history', async () => {
      initWheelHandlers(io, socket, user);

      const callback = vi.fn();
      await socket._trigger('wheel:get_history', { limit: 5 }, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        userHistory: expect.any(Array),
        globalHistory: expect.any(Array),
      }));
    });

    it('should default to 10 items when no limit specified', async () => {
      initWheelHandlers(io, socket, user);

      const callback = vi.fn();
      await socket._trigger('wheel:get_history', {}, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });

  // -----------------------------------------------------------------------
  // wheel:leave
  // -----------------------------------------------------------------------
  describe('wheel:leave event', () => {
    it('should leave the wheel room', async () => {
      initWheelHandlers(io, socket, user);

      await socket._trigger('wheel:leave');

      expect(socket.leave).toHaveBeenCalledWith('wheel');
    });
  });

  // -----------------------------------------------------------------------
  // disconnect
  // -----------------------------------------------------------------------
  describe('disconnect event', () => {
    it('should broadcast playerLeft when a connected user disconnects', async () => {
      initWheelHandlers(io, socket, user);

      // Clear mocks from initialization
      socket.broadcast.emit.mockClear();

      await socket._trigger('disconnect');

      expect(socket.broadcast.emit).toHaveBeenCalledWith('wheel:playerLeft', expect.objectContaining({
        id: user.userId,
        username: 'testplayer',
      }));
    });

    it('should mark the session as inactive on disconnect', async () => {
      initWheelHandlers(io, socket, user);

      // Disconnect should not throw
      await socket._trigger('disconnect');

      // Verify cleanup happened (playerLeft broadcast is evidence)
      expect(socket.broadcast.emit).toHaveBeenCalledWith('wheel:playerLeft', expect.any(Object));
    });
  });
});
