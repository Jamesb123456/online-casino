// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockSelect, mockLogSystemEvent, mockSocketAuth } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockLogSystemEvent: vi.fn(),
  mockSocketAuth: vi.fn((socket, next) => next()),
}));

vi.mock('../../drizzle/db.js', () => {
  const dbObj = { select: mockSelect };
  return { db: dbObj, default: dbObj };
});

vi.mock('../../drizzle/schema.js', () => ({
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

vi.mock('../services/loggingService.js', () => ({
  default: { logSystemEvent: mockLogSystemEvent },
}));

vi.mock('../../middleware/socket/socketAuth.js', () => ({
  socketAuth: mockSocketAuth,
}));

import initLiveGamesHandlers from '../socket/liveGamesHandler.js';

// ---------------------------------------------------------------------------
// Chain helper (drizzle thenable)
// ---------------------------------------------------------------------------
function buildChain(resolvedValue: any) {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
  };
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(resolvedValue).then(resolve, reject);
  chain.catch = (reject: any) => Promise.resolve(resolvedValue).catch(reject);
  return chain;
}

// ---------------------------------------------------------------------------
// Socket / namespace harness
// ---------------------------------------------------------------------------
function buildSocket() {
  const handlers: Record<string, Function> = {};
  const socket = {
    on: vi.fn((evt: string, cb: Function) => {
      handlers[evt] = cb;
    }),
    emit: vi.fn(),
    _trigger: async (evt: string, ...args: any[]) => {
      if (handlers[evt]) await handlers[evt](...args);
    },
    _handlers: handlers,
  };
  return socket;
}

function buildIo() {
  let connectionHandler: Function | null = null;
  const nspUseCalls: Function[] = [];
  const nsp = {
    use: vi.fn((fn: Function) => { nspUseCalls.push(fn); }),
    on: vi.fn((evt: string, cb: Function) => {
      if (evt === 'connection') connectionHandler = cb;
    }),
    _trigger: async (socket: any) => {
      if (connectionHandler) await connectionHandler(socket);
    },
    _useCalls: nspUseCalls,
  };
  const io = {
    of: vi.fn(() => nsp),
  };
  return { io, nsp };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('liveGamesHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers a /live-games namespace with socketAuth middleware', () => {
    const { io, nsp } = buildIo();
    initLiveGamesHandlers(io);

    expect(io.of).toHaveBeenCalledWith('/live-games');
    expect(nsp.use).toHaveBeenCalledWith(mockSocketAuth);
    expect(nsp.on).toHaveBeenCalledWith('connection', expect.any(Function));
  });

  it('returns an entry for every known game type, with grouped counts and recent players', async () => {
    const { io, nsp } = buildIo();
    initLiveGamesHandlers(io);

    const activeSessions = [
      { id: 1, gameType: 'crash',    username: 'alice' },
      { id: 2, gameType: 'crash',    username: 'bob' },
      { id: 3, gameType: 'crash',    username: 'carol' },
      { id: 4, gameType: 'crash',    username: 'dave' }, // 4th player, not in recent list
      { id: 5, gameType: 'roulette', username: 'eve' },
      { id: 6, gameType: 'plinko',   username: null }, // null username should be skipped
    ];
    mockSelect.mockReturnValue(buildChain(activeSessions));

    const socket = buildSocket();
    await nsp._trigger(socket);
    await socket._trigger('get_live_games');

    expect(socket.emit).toHaveBeenCalledTimes(1);
    const [evt, payload] = socket.emit.mock.calls[0];
    expect(evt).toBe('live_games');
    expect(Array.isArray(payload)).toBe(true);
    expect(payload).toHaveLength(8); // crash, roulette, blackjack, plinko, wheel, landmines, dice, slots

    const byType = Object.fromEntries(payload.map((g: any) => [g.type, g]));

    expect(byType.crash.players).toBe(4);
    expect(byType.crash.recentPlayers).toEqual(['alice', 'bob', 'carol']); // capped at 3
    expect(byType.crash.id).toBe('crash_live');

    expect(byType.roulette.players).toBe(1);
    expect(byType.roulette.recentPlayers).toEqual(['eve']);

    expect(byType.plinko.players).toBe(1);
    expect(byType.plinko.recentPlayers).toEqual([]); // null username skipped

    // Untouched game types still appear as placeholders with zero players
    expect(byType.blackjack.players).toBe(0);
    expect(byType.blackjack.recentPlayers).toEqual([]);
    expect(byType.blackjack.id).toBe('blackjack_placeholder');
    expect(byType.wheel.players).toBe(0);
    expect(byType.landmines.players).toBe(0);
    expect(byType.dice.players).toBe(0);
    expect(byType.slots.players).toBe(0);
  });

  it('returns all-zero placeholder entries when there are no active sessions', async () => {
    const { io, nsp } = buildIo();
    initLiveGamesHandlers(io);
    mockSelect.mockReturnValue(buildChain([]));

    const socket = buildSocket();
    await nsp._trigger(socket);
    await socket._trigger('get_live_games');

    const payload = socket.emit.mock.calls[0][1];
    expect(payload).toHaveLength(8);
    for (const game of payload) {
      expect(game.players).toBe(0);
      expect(game.recentPlayers).toEqual([]);
      expect(game.id).toBe(`${game.type}_placeholder`);
    }
  });

  it('emits an empty live_games array and logs an error when the query fails', async () => {
    const { io, nsp } = buildIo();
    initLiveGamesHandlers(io);

    mockSelect.mockImplementation(() => {
      throw new Error('db unavailable');
    });

    const socket = buildSocket();
    await nsp._trigger(socket);
    await socket._trigger('get_live_games');

    expect(socket.emit).toHaveBeenCalledWith('live_games', []);
    expect(mockLogSystemEvent).toHaveBeenCalledWith(
      'live_games_fetch_error',
      expect.objectContaining({ error: 'db unavailable' }),
      'error',
    );
  });
});
