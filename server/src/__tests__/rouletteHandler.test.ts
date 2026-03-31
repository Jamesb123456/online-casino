// @ts-nocheck
/**
 * Roulette game handler tests (namespace-level pattern)
 *
 * The roulette handler takes a single `namespace` argument, attaches a
 * connection handler, and runs an automated game loop:
 *   betting phase → spin → results → repeat
 *
 * Tests cover:
 *   - Namespace initialization & connection handling
 *   - placeBet during betting phase (valid, invalid, balance errors)
 *   - Automated spin (legacy event is a no-op)
 *   - Game loop: countdown, spin, result, round_complete
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
  roulettePlaceBetSchema: {},
}));

// Mock crypto for deterministic spin results
// crypto.randomInt(37) => 18 → ROULETTE_NUMBERS[18] = { number: 10, color: 'black' }
vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn().mockReturnValue({ readUInt32BE: vi.fn().mockReturnValue(2147483648) }),
    randomInt: vi.fn((n) => Math.floor(n / 2)),
  },
  randomBytes: vi.fn().mockReturnValue({ readUInt32BE: vi.fn().mockReturnValue(2147483648) }),
  randomInt: vi.fn((n) => Math.floor(n / 2)),
}));

// ---------------------------------------------------------------------------
// Import module under test
// ---------------------------------------------------------------------------

import initRouletteHandlers from '../socket/rouletteHandler.js';

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

describe('Roulette game handler', () => {
  let namespace;
  let socket;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    mockGetBalance.mockResolvedValue(1000);
    mockPlaceBet.mockResolvedValue({ user: { balance: '900' }, transaction: {} });
    mockRecordWin.mockResolvedValue({ user: { balance: '1100' }, transaction: {} });

    namespace = createMockNamespace();
    initRouletteHandlers(namespace);
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
      expect(namespace.emit).toHaveBeenCalledWith('bettingStart', expect.objectContaining({
        countdown: expect.any(Number),
        roundId: expect.any(String),
      }));
    });

    it('should register event handlers on connected socket', () => {
      socket = connectUser();
      const events = socket.on.mock.calls.map(([e]) => e);
      expect(events).toContain('roulette:join');
      expect(events).toContain('roulette:place_bet');
      expect(events).toContain('roulette:spin');
      expect(events).toContain('roulette:get_history');
      expect(events).toContain('disconnect');
    });

    it('should emit game state to connecting socket', () => {
      socket = connectUser();
      expect(socket.emit).toHaveBeenCalledWith('roulette:gameState', expect.objectContaining({
        phase: 'betting',
        activePlayers: expect.any(Array),
      }));
    });

    it('should emit active players to connecting socket', () => {
      socket = connectUser();
      expect(socket.emit).toHaveBeenCalledWith('roulette:activePlayers', expect.any(Array));
    });

    it('should broadcast playerJoined to other clients', () => {
      socket = connectUser({ userId: 1, username: 'testplayer' });
      expect(socket.broadcast.emit).toHaveBeenCalledWith('roulette:playerJoined', expect.objectContaining({
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
  // roulette:join
  // -----------------------------------------------------------------------
  describe('roulette:join event', () => {
    it('should return success with history', async () => {
      socket = connectUser();
      const cb = vi.fn();
      await socket._trigger('roulette:join', {}, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        history: expect.any(Array),
      }));
    });
  });

  // -----------------------------------------------------------------------
  // roulette:place_bet
  // -----------------------------------------------------------------------
  describe('roulette:place_bet event', () => {
    it('should successfully place a valid bet during betting phase', async () => {
      socket = connectUser();
      const cb = vi.fn();
      await socket._trigger('roulette:place_bet', { type: 'RED', value: '', amount: 100 }, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        betId: expect.any(String),
        balance: 1000,
      }));
    });

    it('should broadcast bet to all players via namespace', async () => {
      socket = connectUser();
      await socket._trigger('roulette:place_bet', { type: 'RED', value: '', amount: 100 }, vi.fn());
      expect(namespace.emit).toHaveBeenCalledWith('roulette:playerBet', expect.objectContaining({
        userId: 1,
        username: 'testplayer',
        type: 'RED',
        amount: 100,
      }));
    });

    it('should call BalanceService.placeBet', async () => {
      socket = connectUser();
      await socket._trigger('roulette:place_bet', { type: 'RED', value: '', amount: 100 }, vi.fn());
      expect(mockPlaceBet).toHaveBeenCalledWith(1, 100, 'roulette', expect.any(Object));
    });

    it('should reject bet when BalanceService.placeBet fails', async () => {
      mockPlaceBet.mockRejectedValueOnce(new Error('Insufficient balance'));
      socket = connectUser();
      const cb = vi.fn();
      await socket._trigger('roulette:place_bet', { type: 'RED', value: '', amount: 100 }, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Insufficient balance',
      }));
    });

    it('should reject invalid bet type', async () => {
      socket = connectUser();
      const cb = vi.fn();
      await socket._trigger('roulette:place_bet', { type: 'INVALID_TYPE', value: '', amount: 100 }, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Invalid bet type',
      }));
    });

    it('should allow placing a STRAIGHT bet', async () => {
      socket = connectUser();
      const cb = vi.fn();
      await socket._trigger('roulette:place_bet', { type: 'STRAIGHT', value: '17', amount: 50 }, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should allow placing an ODD bet', async () => {
      socket = connectUser();
      const cb = vi.fn();
      await socket._trigger('roulette:place_bet', { type: 'ODD', value: '', amount: 50 }, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should allow placing an EVEN bet', async () => {
      socket = connectUser();
      const cb = vi.fn();
      await socket._trigger('roulette:place_bet', { type: 'EVEN', value: '', amount: 50 }, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should allow placing a DOZEN bet', async () => {
      socket = connectUser();
      const cb = vi.fn();
      await socket._trigger('roulette:place_bet', { type: 'DOZEN', value: '1', amount: 50 }, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should allow placing a COLUMN bet', async () => {
      socket = connectUser();
      const cb = vi.fn();
      await socket._trigger('roulette:place_bet', { type: 'COLUMN', value: '1', amount: 50 }, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should reject bet when not in betting phase', async () => {
      // Advance past the 15s betting countdown
      vi.advanceTimersByTime(16000);
      socket = connectUser();
      const cb = vi.fn();
      await socket._trigger('roulette:place_bet', { type: 'RED', value: '', amount: 100 }, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Betting is closed',
      }));
    });

    it('should handle BalanceService.placeBet failure gracefully', async () => {
      mockPlaceBet.mockRejectedValueOnce(new Error('DB connection lost'));
      socket = connectUser();
      const cb = vi.fn();
      await socket._trigger('roulette:place_bet', { type: 'RED', value: '', amount: 100 }, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('should allow multiple bets from the same user', async () => {
      socket = connectUser();
      const cb1 = vi.fn();
      await socket._trigger('roulette:place_bet', { type: 'RED', value: '', amount: 100 }, cb1);
      expect(cb1).toHaveBeenCalledWith(expect.objectContaining({ success: true }));

      const cb2 = vi.fn();
      await socket._trigger('roulette:place_bet', { type: 'BLACK', value: '', amount: 50 }, cb2);
      expect(cb2).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // -----------------------------------------------------------------------
  // roulette:spin (automated in live mode)
  // -----------------------------------------------------------------------
  describe('roulette:spin event', () => {
    it('should indicate spin is automated in live mode', async () => {
      socket = connectUser();
      const cb = vi.fn();
      await socket._trigger('roulette:spin', {}, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: expect.stringContaining('automated'),
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
      vi.advanceTimersByTime(16000);
      expect(namespace.emit).toHaveBeenCalledWith('bettingEnd', {});
      expect(namespace.emit).toHaveBeenCalledWith('roulette:spin_started', expect.objectContaining({
        roundId: expect.any(String),
        spinData: expect.any(Object),
      }));
    });

    it('should emit spin_result after spin duration', async () => {
      socket = connectUser();
      await socket._trigger('roulette:place_bet', { type: 'BLACK', value: '', amount: 100 }, vi.fn());
      // betting (15s) + spin (10s) = 25s
      await vi.advanceTimersByTimeAsync(26000);
      expect(namespace.emit).toHaveBeenCalledWith('roulette:spin_result', expect.objectContaining({
        winningNumber: expect.any(Number),
        winningColor: expect.any(String),
      }));
    });

    it('should call BalanceService.recordWin when there are winnings', async () => {
      socket = connectUser();
      // crypto.randomInt(37) => 18 → { number: 10, color: 'black' }
      await socket._trigger('roulette:place_bet', { type: 'BLACK', value: '', amount: 100 }, vi.fn());
      await vi.advanceTimersByTimeAsync(26000);
      expect(mockRecordWin).toHaveBeenCalled();
    });

    it('should emit round_complete after result display', async () => {
      // betting (15s) + spin (10s) + result display (5s) = 30s
      await vi.advanceTimersByTimeAsync(31000);
      expect(namespace.emit).toHaveBeenCalledWith('roulette:round_complete', expect.objectContaining({
        message: expect.any(String),
      }));
    });
  });

  // -----------------------------------------------------------------------
  // roulette:get_history
  // -----------------------------------------------------------------------
  describe('roulette:get_history event', () => {
    it('should return global history', async () => {
      socket = connectUser();
      const cb = vi.fn();
      await socket._trigger('roulette:get_history', { limit: 5 }, cb);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        globalHistory: expect.any(Array),
      }));
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
      expect(namespace.emit).toHaveBeenCalledWith('roulette:playerLeft', expect.objectContaining({
        id: 1,
        username: 'testplayer',
      }));
    });
  });
});
