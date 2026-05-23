// @ts-nocheck
/**
 * Unit tests for src/socket/liveGamesHandler.ts
 *
 * These tests capture the *current* behaviour of `initLiveGamesHandlers`
 * so future refactors can be verified against an authoritative spec.
 *
 * Coverage targets:
 *   - Namespace registration (/live-games) + socketAuth middleware
 *   - Connection wiring (registers `get_live_games` listener)
 *   - Grouping of active sessions by gameType
 *   - Recent-players cap at 3 entries per game type
 *   - null/undefined username skipping
 *   - All 8 known GAME_TYPES are always present in the response
 *   - Placeholder vs. live `id` suffix per game type
 *   - Unknown gameType from DB does not appear in the response
 *   - DB query failure -> empty array + system event logged
 *   - Multiple sockets / multiple invocations are independent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks (must be declared before the import under test)
// ---------------------------------------------------------------------------

const { mockSelect, mockLogSystemEvent, mockSocketAuth } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockLogSystemEvent: vi.fn(),
  mockSocketAuth: vi.fn((socket, next) => next()),
}));

vi.mock('../../../drizzle/db.js', () => {
  const dbObj = { select: mockSelect };
  return { db: dbObj, default: dbObj };
});

vi.mock('../../../drizzle/schema.js', () => ({
  gameSessions: {
    id: 'gameSessions.id',
    gameType: 'gameSessions.gameType',
    userId: 'gameSessions.userId',
    isCompleted: 'gameSessions.isCompleted',
    updatedAt: 'gameSessions.updatedAt',
  },
  users: {
    id: 'users.id',
    username: 'users.username',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args) => ({ type: 'eq', args })),
  desc: vi.fn((col) => ({ type: 'desc', col })),
}));

vi.mock('../../services/loggingService.js', () => ({
  default: { logSystemEvent: mockLogSystemEvent },
}));

vi.mock('../../../middleware/socket/socketAuth.js', () => ({
  socketAuth: mockSocketAuth,
}));

import initLiveGamesHandlers from '../../socket/liveGamesHandler.js';

// ---------------------------------------------------------------------------
// Drizzle chain helper — minimum surface that liveGamesHandler chains on.
// ---------------------------------------------------------------------------

function buildChain(resolvedValue) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
  };
  chain.then = (resolve, reject) =>
    Promise.resolve(resolvedValue).then(resolve, reject);
  chain.catch = (reject) => Promise.resolve(resolvedValue).catch(reject);
  return chain;
}

function buildRejectingChain(error) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
  };
  chain.then = (resolve, reject) =>
    Promise.reject(error).then(resolve, reject);
  chain.catch = (reject) => Promise.reject(error).catch(reject);
  return chain;
}

// ---------------------------------------------------------------------------
// Mock socket / namespace / io
// ---------------------------------------------------------------------------

function buildSocket() {
  const handlers = {};
  return {
    on: vi.fn((evt, cb) => { handlers[evt] = cb; }),
    emit: vi.fn(),
    _trigger: async (evt, ...args) => {
      if (handlers[evt]) await handlers[evt](...args);
    },
    _handlers: handlers,
  };
}

function buildIo() {
  let connectionHandler = null;
  const useCalls = [];
  const nsp = {
    use: vi.fn((fn) => { useCalls.push(fn); }),
    on: vi.fn((evt, cb) => {
      if (evt === 'connection') connectionHandler = cb;
    }),
    _trigger: async (socket) => {
      if (connectionHandler) await connectionHandler(socket);
    },
    _useCalls: useCalls,
  };
  const io = { of: vi.fn(() => nsp) };
  return { io, nsp };
}

const KNOWN_TYPES = ['crash', 'roulette', 'blackjack', 'plinko', 'wheel', 'landmines', 'dice', 'slots'];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('liveGamesHandler (socket/)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('namespace registration', () => {
    it('mounts the /live-games namespace exactly once', () => {
      const { io } = buildIo();
      initLiveGamesHandlers(io);
      expect(io.of).toHaveBeenCalledTimes(1);
      expect(io.of).toHaveBeenCalledWith('/live-games');
    });

    it('installs the socketAuth middleware on the namespace', () => {
      const { io, nsp } = buildIo();
      initLiveGamesHandlers(io);
      expect(nsp.use).toHaveBeenCalledTimes(1);
      expect(nsp.use).toHaveBeenCalledWith(mockSocketAuth);
    });

    it('registers a connection listener on the namespace', () => {
      const { io, nsp } = buildIo();
      initLiveGamesHandlers(io);
      expect(nsp.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('connection wiring', () => {
    it('attaches a `get_live_games` handler to each new socket', async () => {
      const { io, nsp } = buildIo();
      initLiveGamesHandlers(io);
      const socket = buildSocket();
      await nsp._trigger(socket);
      expect(socket.on).toHaveBeenCalledWith('get_live_games', expect.any(Function));
    });

    it('does not emit anything until the client requests live games', async () => {
      const { io, nsp } = buildIo();
      initLiveGamesHandlers(io);
      const socket = buildSocket();
      await nsp._trigger(socket);
      expect(socket.emit).not.toHaveBeenCalled();
    });
  });

  describe('get_live_games response shape', () => {
    it('always returns every known GAME_TYPE in the response, even with no data', async () => {
      const { io, nsp } = buildIo();
      initLiveGamesHandlers(io);
      mockSelect.mockReturnValue(buildChain([]));

      const socket = buildSocket();
      await nsp._trigger(socket);
      await socket._trigger('get_live_games');

      const [evt, payload] = socket.emit.mock.calls[0];
      expect(evt).toBe('live_games');
      expect(payload).toHaveLength(KNOWN_TYPES.length);
      expect(payload.map((g) => g.type)).toEqual(KNOWN_TYPES);
    });

    it('uses `<type>_placeholder` id for game types with zero active sessions', async () => {
      const { io, nsp } = buildIo();
      initLiveGamesHandlers(io);
      mockSelect.mockReturnValue(buildChain([]));

      const socket = buildSocket();
      await nsp._trigger(socket);
      await socket._trigger('get_live_games');

      const payload = socket.emit.mock.calls[0][1];
      for (const game of payload) {
        expect(game.id).toBe(`${game.type}_placeholder`);
        expect(game.players).toBe(0);
        expect(game.recentPlayers).toEqual([]);
      }
    });

    it('uses `<type>_live` id for game types with at least one active session', async () => {
      const { io, nsp } = buildIo();
      initLiveGamesHandlers(io);
      mockSelect.mockReturnValue(buildChain([
        { id: 1, gameType: 'crash', username: 'alice' },
        { id: 2, gameType: 'slots', username: 'bob' },
      ]));

      const socket = buildSocket();
      await nsp._trigger(socket);
      await socket._trigger('get_live_games');

      const payload = socket.emit.mock.calls[0][1];
      const byType = Object.fromEntries(payload.map((g) => [g.type, g]));
      expect(byType.crash.id).toBe('crash_live');
      expect(byType.slots.id).toBe('slots_live');
      // Untouched game types remain placeholders.
      expect(byType.roulette.id).toBe('roulette_placeholder');
      expect(byType.dice.id).toBe('dice_placeholder');
    });
  });

  describe('grouping and recent players', () => {
    it('sums player counts per game type', async () => {
      const { io, nsp } = buildIo();
      initLiveGamesHandlers(io);
      mockSelect.mockReturnValue(buildChain([
        { id: 1, gameType: 'crash', username: 'u1' },
        { id: 2, gameType: 'crash', username: 'u2' },
        { id: 3, gameType: 'roulette', username: 'u3' },
      ]));

      const socket = buildSocket();
      await nsp._trigger(socket);
      await socket._trigger('get_live_games');

      const payload = socket.emit.mock.calls[0][1];
      const byType = Object.fromEntries(payload.map((g) => [g.type, g]));
      expect(byType.crash.players).toBe(2);
      expect(byType.roulette.players).toBe(1);
    });

    it('caps recentPlayers at 3 entries per game type while still counting all players', async () => {
      const { io, nsp } = buildIo();
      initLiveGamesHandlers(io);
      mockSelect.mockReturnValue(buildChain([
        { id: 1, gameType: 'crash', username: 'alice' },
        { id: 2, gameType: 'crash', username: 'bob' },
        { id: 3, gameType: 'crash', username: 'carol' },
        { id: 4, gameType: 'crash', username: 'dave' },
        { id: 5, gameType: 'crash', username: 'eve' },
      ]));

      const socket = buildSocket();
      await nsp._trigger(socket);
      await socket._trigger('get_live_games');

      const payload = socket.emit.mock.calls[0][1];
      const crash = payload.find((g) => g.type === 'crash');
      expect(crash.players).toBe(5);
      expect(crash.recentPlayers).toHaveLength(3);
      expect(crash.recentPlayers).toEqual(['alice', 'bob', 'carol']);
    });

    it('skips null/undefined/empty usernames in recentPlayers but still increments the count', async () => {
      const { io, nsp } = buildIo();
      initLiveGamesHandlers(io);
      mockSelect.mockReturnValue(buildChain([
        { id: 1, gameType: 'plinko', username: null },
        { id: 2, gameType: 'plinko', username: undefined },
        { id: 3, gameType: 'plinko', username: '' },
        { id: 4, gameType: 'plinko', username: 'real_user' },
      ]));

      const socket = buildSocket();
      await nsp._trigger(socket);
      await socket._trigger('get_live_games');

      const payload = socket.emit.mock.calls[0][1];
      const plinko = payload.find((g) => g.type === 'plinko');
      // Count includes all 4 rows.
      expect(plinko.players).toBe(4);
      // Only the truthy username makes it into recentPlayers.
      expect(plinko.recentPlayers).toEqual(['real_user']);
    });

    it('preserves DB ordering when populating recentPlayers (first three encountered win)', async () => {
      const { io, nsp } = buildIo();
      initLiveGamesHandlers(io);
      // Order here mirrors what the handler iterates (DESC updatedAt is applied
      // in the query — we feed it pre-ordered).
      mockSelect.mockReturnValue(buildChain([
        { id: 1, gameType: 'wheel', username: 'newest' },
        { id: 2, gameType: 'wheel', username: 'middle' },
        { id: 3, gameType: 'wheel', username: 'older' },
        { id: 4, gameType: 'wheel', username: 'oldest' },
      ]));

      const socket = buildSocket();
      await nsp._trigger(socket);
      await socket._trigger('get_live_games');

      const wheel = socket.emit.mock.calls[0][1].find((g) => g.type === 'wheel');
      expect(wheel.recentPlayers).toEqual(['newest', 'middle', 'older']);
    });

    it('drops sessions whose gameType is not in the known GAME_TYPES list', async () => {
      const { io, nsp } = buildIo();
      initLiveGamesHandlers(io);
      mockSelect.mockReturnValue(buildChain([
        { id: 1, gameType: 'unknown_game', username: 'ghost' },
        { id: 2, gameType: 'crash', username: 'alice' },
      ]));

      const socket = buildSocket();
      await nsp._trigger(socket);
      await socket._trigger('get_live_games');

      const payload = socket.emit.mock.calls[0][1];
      // Only the 8 known types — no `unknown_game` leak.
      expect(payload.map((g) => g.type).sort()).toEqual([...KNOWN_TYPES].sort());
      const crash = payload.find((g) => g.type === 'crash');
      expect(crash.players).toBe(1);
    });
  });

  describe('error handling', () => {
    it('emits an empty live_games array when the query throws synchronously', async () => {
      const { io, nsp } = buildIo();
      initLiveGamesHandlers(io);
      mockSelect.mockImplementation(() => {
        throw new Error('boom');
      });

      const socket = buildSocket();
      await nsp._trigger(socket);
      await socket._trigger('get_live_games');

      expect(socket.emit).toHaveBeenCalledWith('live_games', []);
    });

    it('emits an empty live_games array when the chain rejects asynchronously', async () => {
      const { io, nsp } = buildIo();
      initLiveGamesHandlers(io);
      mockSelect.mockReturnValue(buildRejectingChain(new Error('connection lost')));

      const socket = buildSocket();
      await nsp._trigger(socket);
      await socket._trigger('get_live_games');

      expect(socket.emit).toHaveBeenCalledWith('live_games', []);
    });

    it('logs a system event with the error message and error severity on failure', async () => {
      const { io, nsp } = buildIo();
      initLiveGamesHandlers(io);
      mockSelect.mockImplementation(() => {
        throw new Error('db unavailable');
      });

      const socket = buildSocket();
      await nsp._trigger(socket);
      await socket._trigger('get_live_games');

      expect(mockLogSystemEvent).toHaveBeenCalledTimes(1);
      expect(mockLogSystemEvent).toHaveBeenCalledWith(
        'live_games_fetch_error',
        expect.objectContaining({ error: 'db unavailable' }),
        'error',
      );
    });

    it('does not throw out of the handler when the error is a non-Error object', async () => {
      const { io, nsp } = buildIo();
      initLiveGamesHandlers(io);
      mockSelect.mockImplementation(() => {
        // eslint-disable-next-line no-throw-literal
        throw 'string error';
      });

      const socket = buildSocket();
      await nsp._trigger(socket);
      // Should not throw, even though cast to Error.message is undefined.
      await expect(socket._trigger('get_live_games')).resolves.toBeUndefined();
      expect(socket.emit).toHaveBeenCalledWith('live_games', []);
      expect(mockLogSystemEvent).toHaveBeenCalledWith(
        'live_games_fetch_error',
        expect.any(Object),
        'error',
      );
    });
  });

  describe('multi-socket / multi-invocation isolation', () => {
    it('handles repeated get_live_games calls on the same socket independently', async () => {
      const { io, nsp } = buildIo();
      initLiveGamesHandlers(io);

      mockSelect.mockReturnValueOnce(buildChain([
        { id: 1, gameType: 'crash', username: 'alice' },
      ]));
      mockSelect.mockReturnValueOnce(buildChain([]));

      const socket = buildSocket();
      await nsp._trigger(socket);
      await socket._trigger('get_live_games');
      await socket._trigger('get_live_games');

      expect(socket.emit).toHaveBeenCalledTimes(2);
      const first = socket.emit.mock.calls[0][1].find((g) => g.type === 'crash');
      const second = socket.emit.mock.calls[1][1].find((g) => g.type === 'crash');
      expect(first.players).toBe(1);
      expect(first.id).toBe('crash_live');
      expect(second.players).toBe(0);
      expect(second.id).toBe('crash_placeholder');
    });

    it('serves multiple sockets without cross-contaminating their responses', async () => {
      const { io, nsp } = buildIo();
      initLiveGamesHandlers(io);

      mockSelect.mockReturnValueOnce(buildChain([
        { id: 1, gameType: 'roulette', username: 'a' },
      ]));
      mockSelect.mockReturnValueOnce(buildChain([
        { id: 2, gameType: 'dice', username: 'b' },
        { id: 3, gameType: 'dice', username: 'c' },
      ]));

      const s1 = buildSocket();
      const s2 = buildSocket();
      await nsp._trigger(s1);
      await nsp._trigger(s2);

      await s1._trigger('get_live_games');
      await s2._trigger('get_live_games');

      const s1Payload = s1.emit.mock.calls[0][1];
      const s2Payload = s2.emit.mock.calls[0][1];

      expect(s1Payload.find((g) => g.type === 'roulette').players).toBe(1);
      expect(s1Payload.find((g) => g.type === 'dice').players).toBe(0);
      expect(s2Payload.find((g) => g.type === 'dice').players).toBe(2);
      expect(s2Payload.find((g) => g.type === 'roulette').players).toBe(0);
    });
  });
});
