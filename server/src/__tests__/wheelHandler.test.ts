// @ts-nocheck
/**
 * Wheel game handler tests (namespace-level pattern)
 *
 * The wheel handler takes a single `namespace` argument, attaches a
 * connection handler, and runs an automated game loop:
 *   betting phase → spin → results → repeat
 *
 * Tests cover:
 *   - Namespace initialization & connection handling
 *   - placeBet during betting phase (valid, duplicate, phase check, errors)
 *   - Automated game loop: countdown, spin, result, round_complete
 *   - get_history
 *   - Player disconnect
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
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
// Helpers
// ---------------------------------------------------------------------------

function createMockSocket(user) {
  const eventHandlers = new Map();
  return {
    id: `socket_${Math.random().toString(36).slice(2)}`,
    user,
    emit: vi.fn(),
    broadcast: { emit: vi.fn() },
    to: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    on: vi.fn((event, handler) => { eventHandlers.set(event, handler); }),
    _trigger: async (event, ...args) => {
      const h = eventHandlers.get(event);
      if (h) return h(...args);
    },
  };
}

function createMockNamespace() {
  const handlers = new Map();
  return {
    emit: vi.fn(),
    on: vi.fn((event, handler) => { handlers.set(event, handler); }),
    _connect: (socket) => { handlers.get('connection')?.(socket); },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Wheel game handler', () => {
  let namespace;
  let socket;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    mockGetBalance.mockResolvedValue(1000);
    mockPlaceBet.mockResolvedValue({ user: { balance: '900' }, transaction: {} });
    mockRecordWin.mockResolvedValue({ user: { balance: '1100' }, transaction: {} });

    namespace = createMockNamespace();
    initWheelHandlers(namespace);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function connectUser(user = { userId: 1, username: 'testplayer' }) {
    const s = createMockSocket(user);
    namespace._connect(s);
    return s;
  }

  // -----------------------------------------------------------------------
  // Initialization & connection
  // -----------------------------------------------------------------------
  describe('initialization and connection', () => {
    it('should register connection handler on namespace', () => {
      expect(namespace.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should start the game loop in betting phase', () => {
      expect(namespace.emit).toHaveBeenCalledWith('gameStarting', expect.objectContaining({
        countdown: expect.any(Number),
        roundId: expect.any(String),
      }));
    });

    it('should register event handlers on connected socket', () => {
      socket = connectUser();
      const events = socket.on.mock.calls.map(([e]) => e);
      expect(events).toContain('wheel:join');
      expect(events).toContain('wheel:place_bet');
      expect(events).toContain('wheel:get_history');
      expect(events).toContain('disconnect');
    });

    it('should emit game state to connecting socket', () => {
      socket = connectUser();
      expect(socket.emit).toHaveBeenCalledWith('wheel:gameState', expect.objectContaining({
        phase: 'betting',
        segmentsByDifficulty: expect.any(Object),
        activePlayers: expect.any(Array),
      }));
    });

    it('should emit active players to connecting socket', () => {
      socket = connectUser();
      expect(socket.emit).toHaveBeenCalledWith('wheel:activePlayers', expect.any(Array));
    });

    it('should broadcast playerJoined to other clients', () => {
      socket = connectUser({ userId: 1, username: 'testplayer' });
      expect(socket.broadcast.emit).toHaveBeenCalledWith('wheel:playerJoined', expect.objectContaining({
        id: 1,
        username: 'testplayer',
      }));
    });

    it('should disconnect unauthenticated sockets', () => {
      const unauthed = createMockSocket(undefined);
      namespace._connect(unauthed);
      expect(unauthed.disconnect).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // wheel:join
  // -----------------------------------------------------------------------
  describe('wheel:join event', () => {
    it('should return success with segments and history', async () => {
      socket = connectUser();
      const cb = vi.fn();
      await socket._trigger('wheel:join', {}, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        segmentsByDifficulty: expect.any(Object),
        history: expect.any(Array),
      }));
    });
  });

  // -----------------------------------------------------------------------
  // wheel:place_bet
  // -----------------------------------------------------------------------
  describe('wheel:place_bet event', () => {
    it('should successfully place a bet during betting phase', async () => {
      socket = connectUser();
      const cb = vi.fn();
      await socket._trigger('wheel:place_bet', { betAmount: 100 }, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        balance: 1000,
      }));
    });

    it('should call BalanceService.placeBet with correct arguments', async () => {
      socket = connectUser();
      await socket._trigger('wheel:place_bet', { betAmount: 100 }, vi.fn());
      expect(mockPlaceBet).toHaveBeenCalledWith(1, 100, 'wheel', expect.objectContaining({
        roundId: expect.any(String),
      }));
    });

    it('should broadcast bet to all players via namespace', async () => {
      socket = connectUser();
      await socket._trigger('wheel:place_bet', { betAmount: 100 }, vi.fn());
      expect(namespace.emit).toHaveBeenCalledWith('wheel:playerBet', expect.objectContaining({
        userId: 1,
        username: 'testplayer',
        amount: 100,
      }));
    });

    it('should reject duplicate bet in same round', async () => {
      socket = connectUser();
      await socket._trigger('wheel:place_bet', { betAmount: 100 }, vi.fn());

      const cb2 = vi.fn();
      await socket._trigger('wheel:place_bet', { betAmount: 50 }, cb2);
      expect(cb2).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'You already placed a bet this round',
      }));
    });

    it('should reject bet when not in betting phase', async () => {
      // Advance past the 10s betting countdown
      vi.advanceTimersByTime(11000);
      socket = connectUser();
      const cb = vi.fn();
      await socket._trigger('wheel:place_bet', { betAmount: 100 }, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Betting is closed',
      }));
    });

    it('should handle BalanceService.placeBet failure', async () => {
      mockPlaceBet.mockRejectedValueOnce(new Error('Insufficient balance'));
      socket = connectUser();
      const cb = vi.fn();
      await socket._trigger('wheel:place_bet', { betAmount: 100 }, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Insufficient balance',
      }));
    });

    it('should emit balanceUpdate to the player after placing bet', async () => {
      socket = connectUser();
      await socket._trigger('wheel:place_bet', { betAmount: 100 }, vi.fn());
      expect(socket.emit).toHaveBeenCalledWith('balanceUpdate', expect.objectContaining({
        balance: 1000,
      }));
    });
  });

  // -----------------------------------------------------------------------
  // Automated game loop
  // -----------------------------------------------------------------------
  describe('automated game loop', () => {
    it('should emit countdown during betting phase', () => {
      vi.advanceTimersByTime(1000);
      expect(namespace.emit).toHaveBeenCalledWith('countdown', expect.objectContaining({
        countdown: expect.any(Number),
      }));
    });

    it('should transition to spinning after betting countdown', () => {
      // Betting duration is 10s
      vi.advanceTimersByTime(11000);
      expect(namespace.emit).toHaveBeenCalledWith('wheelSpinning', expect.objectContaining({
        roundId: expect.any(String),
        targetAngle: expect.any(Number),
        segmentIndex: expect.any(Number),
      }));
    });

    it('should emit game result after spin duration', async () => {
      socket = connectUser();
      await socket._trigger('wheel:place_bet', { betAmount: 100 }, vi.fn());
      // betting (10s) + spin (5s) = 15s
      await vi.advanceTimersByTimeAsync(16000);
      expect(namespace.emit).toHaveBeenCalledWith('wheel:game_result', expect.objectContaining({
        roundId: expect.any(String),
        segmentIndex: expect.any(Number),
      }));
    });

    it('should call BalanceService.recordWin for winning bets', async () => {
      socket = connectUser();
      await socket._trigger('wheel:place_bet', { betAmount: 100 }, vi.fn());
      // All segments have multiplier > 0, so every bet wins
      await vi.advanceTimersByTimeAsync(16000);
      expect(mockRecordWin).toHaveBeenCalled();
    });

    it('should emit round_complete after result display', async () => {
      // betting (10s) + spin (5s) + result display (4s) = 19s
      await vi.advanceTimersByTimeAsync(20000);
      expect(namespace.emit).toHaveBeenCalledWith('wheel:round_complete', expect.objectContaining({
        message: expect.any(String),
      }));
    });

    it('should start next betting phase after round_complete', async () => {
      namespace.emit.mockClear();
      await vi.advanceTimersByTimeAsync(20000);
      // After round_complete, startBettingPhase fires again
      expect(namespace.emit).toHaveBeenCalledWith('gameStarting', expect.objectContaining({
        countdown: expect.any(Number),
      }));
    });
  });

  // -----------------------------------------------------------------------
  // wheel:get_history
  // -----------------------------------------------------------------------
  describe('wheel:get_history event', () => {
    it('should return global history', async () => {
      socket = connectUser();
      const cb = vi.fn();
      await socket._trigger('wheel:get_history', { limit: 5 }, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        globalHistory: expect.any(Array),
      }));
    });

    it('should default to 10 items when no limit specified', async () => {
      socket = connectUser();
      const cb = vi.fn();
      await socket._trigger('wheel:get_history', {}, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // -----------------------------------------------------------------------
  // disconnect
  // -----------------------------------------------------------------------
  describe('disconnect event', () => {
    it('should broadcast playerLeft via namespace', async () => {
      socket = connectUser({ userId: 1, username: 'testplayer' });
      namespace.emit.mockClear();
      await socket._trigger('disconnect');
      expect(namespace.emit).toHaveBeenCalledWith('wheel:playerLeft', expect.objectContaining({
        id: 1,
        username: 'testplayer',
      }));
    });

    it('should handle cleanup without errors', async () => {
      socket = connectUser();
      await socket._trigger('disconnect');
      expect(namespace.emit).toHaveBeenCalledWith('wheel:playerLeft', expect.any(Object));
    });
  });
});
