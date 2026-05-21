// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (hoisted)
// ---------------------------------------------------------------------------
const { mockSocketAuth, mockGetAuthenticatedUser, mockClearSession } = vi.hoisted(() => ({
  mockSocketAuth: vi.fn(),
  mockGetAuthenticatedUser: vi.fn(),
  mockClearSession: vi.fn(),
}));

vi.mock('../../../../middleware/socket/socketAuth.js', () => ({
  socketAuth: mockSocketAuth,
  getAuthenticatedUser: mockGetAuthenticatedUser,
}));

vi.mock('../../../services/userLimitsService.js', () => ({
  default: {
    clearSession: mockClearSession,
  },
}));

vi.mock('../../../services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
    logGameEvent: vi.fn(),
  },
}));

import { registerGameNamespace, emitError } from '../../../games/_engine/registerNamespace.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createFakeNamespace() {
  const eventHandlers = new Map<string, Function>();
  const namespace = {
    use: vi.fn(),
    on: vi.fn((event: string, handler: Function) => {
      eventHandlers.set(event, handler);
    }),
    emit: vi.fn(),
    _trigger: async (event: string, ...args: any[]) => {
      const h = eventHandlers.get(event);
      if (h) return h(...args);
    },
  };
  return namespace;
}

function createFakeIo(namespace: any) {
  return {
    of: vi.fn().mockReturnValue(namespace),
  };
}

function createFakeSocket() {
  const socketEvents = new Map<string, Function>();
  return {
    id: 'sock-1',
    emit: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn((event: string, handler: Function) => {
      socketEvents.set(event, handler);
    }),
    _trigger: async (event: string, ...args: any[]) => {
      const h = socketEvents.get(event);
      if (h) return h(...args);
    },
  };
}

function makeEngine() {
  return {
    onJoin: vi.fn().mockResolvedValue({ state: { phase: 'idle' } }),
    onBet: vi.fn(),
    onDisconnect: vi.fn().mockResolvedValue(undefined),
    onAction: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerGameNamespace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mounts the namespace at /<gameType> and installs socketAuth middleware', () => {
    const ns = createFakeNamespace();
    const io = createFakeIo(ns);
    const engine = makeEngine();

    registerGameNamespace(io as any, 'dice', () => engine as any, () => {});

    expect(io.of).toHaveBeenCalledWith('/dice');
    expect(ns.use).toHaveBeenCalledWith(mockSocketAuth);
    expect(ns.on).toHaveBeenCalledWith('connection', expect.any(Function));
  });

  it('disconnects unauthenticated sockets', async () => {
    const ns = createFakeNamespace();
    const io = createFakeIo(ns);
    const engine = makeEngine();
    const bindEvents = vi.fn();

    registerGameNamespace(io as any, 'dice', () => engine as any, bindEvents);

    mockGetAuthenticatedUser.mockReturnValue(null);
    const socket = createFakeSocket();
    await ns._trigger('connection', socket);

    expect(socket.disconnect).toHaveBeenCalled();
    expect(engine.onJoin).not.toHaveBeenCalled();
    expect(bindEvents).not.toHaveBeenCalled();
  });

  it('invokes engine.onJoin and emits gameState with joined:true for authed sockets', async () => {
    const ns = createFakeNamespace();
    const io = createFakeIo(ns);
    const engine = makeEngine();
    engine.onJoin.mockResolvedValue({
      serverSeedHash: 'hh',
      state: { phase: 'betting' },
    });

    const bindEvents = vi.fn();
    registerGameNamespace(io as any, 'dice', () => engine as any, bindEvents);

    const user = { userId: 7, username: 'tester', role: 'user', balance: 100, isActive: true };
    mockGetAuthenticatedUser.mockReturnValue(user);

    const socket = createFakeSocket();
    await ns._trigger('connection', socket);

    expect(engine.onJoin).toHaveBeenCalledOnce();
    const ctxArg = engine.onJoin.mock.calls[0][0];
    expect(ctxArg.user).toBe(user);
    expect(ctxArg.socket).toBe(socket);

    expect(socket.emit).toHaveBeenCalledWith('gameState', expect.objectContaining({
      joined: true,
      serverSeedHash: 'hh',
      state: { phase: 'betting' },
    }));

    expect(bindEvents).toHaveBeenCalledOnce();
  });

  it('on socket disconnect, calls engine.onDisconnect and userLimitsService.clearSession', async () => {
    const ns = createFakeNamespace();
    const io = createFakeIo(ns);
    const engine = makeEngine();
    registerGameNamespace(io as any, 'dice', () => engine as any, () => {});

    const user = { userId: 7, username: 'tester', role: 'user', balance: 100, isActive: true };
    mockGetAuthenticatedUser.mockReturnValue(user);

    const socket = createFakeSocket();
    await ns._trigger('connection', socket);

    await socket._trigger('disconnect');

    expect(engine.onDisconnect).toHaveBeenCalledOnce();
    expect(mockClearSession).toHaveBeenCalledWith(7);
  });

  it('emits error and disconnects when engine.onJoin throws', async () => {
    const ns = createFakeNamespace();
    const io = createFakeIo(ns);
    const engine = makeEngine();
    engine.onJoin.mockRejectedValue(new Error('boom'));

    const bindEvents = vi.fn();
    registerGameNamespace(io as any, 'dice', () => engine as any, bindEvents);

    mockGetAuthenticatedUser.mockReturnValue({
      userId: 1, username: 'u', role: 'user', balance: 0, isActive: true,
    });
    const socket = createFakeSocket();
    await ns._trigger('connection', socket);

    expect(socket.emit).toHaveBeenCalledWith('error', { code: 'join_failed' });
    expect(socket.disconnect).toHaveBeenCalled();
    expect(bindEvents).not.toHaveBeenCalled();
  });

  it('uses a single shared engine across connections when mode=shared (default)', async () => {
    const ns = createFakeNamespace();
    const io = createFakeIo(ns);
    const engine = makeEngine();
    const factory = vi.fn(() => engine as any);

    registerGameNamespace(io as any, 'dice', factory, () => {});

    // factory called once at registration (shared mode)
    expect(factory).toHaveBeenCalledTimes(1);

    mockGetAuthenticatedUser.mockReturnValue({ userId: 1, username: 'u', role: 'user', balance: 0, isActive: true });
    await ns._trigger('connection', createFakeSocket());
    await ns._trigger('connection', createFakeSocket());

    // Still only one engine instance
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('creates a fresh engine per connection when mode=per-instance', async () => {
    const ns = createFakeNamespace();
    const io = createFakeIo(ns);
    const factory = vi.fn(() => makeEngine() as any);

    registerGameNamespace(io as any, 'dice', factory, () => {}, { mode: 'per-instance' });

    // No initial factory call in per-instance mode
    expect(factory).toHaveBeenCalledTimes(0);

    mockGetAuthenticatedUser.mockReturnValue({ userId: 1, username: 'u', role: 'user', balance: 0, isActive: true });
    await ns._trigger('connection', createFakeSocket());
    await ns._trigger('connection', createFakeSocket());

    expect(factory).toHaveBeenCalledTimes(2);
  });
});

describe('emitError', () => {
  it('returns a function that swallows errors and emits an error event with the thrown message as code', async () => {
    const ctx: any = {
      emit: vi.fn(),
    };
    const wrapped = emitError(ctx, 'fallback_code', async () => {
      throw new Error('bet_too_large');
    });

    await wrapped();

    expect(ctx.emit).toHaveBeenCalledWith('error', { code: 'bet_too_large' });
  });

  it('uses the fallback code when the error has no message', async () => {
    const ctx: any = { emit: vi.fn() };
    const wrapped = emitError(ctx, 'fallback_code', async () => {
      // throw an Error with empty message -> falls back
      throw new Error('');
    });

    await wrapped();

    expect(ctx.emit).toHaveBeenCalledWith('error', { code: 'fallback_code' });
  });

  it('does not emit when fn resolves normally', async () => {
    const ctx: any = { emit: vi.fn() };
    const wrapped = emitError(ctx, 'fallback', async () => 'ok');
    await wrapped();
    expect(ctx.emit).not.toHaveBeenCalled();
  });
});
