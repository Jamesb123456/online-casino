import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// --- Fake socket factory ---
function createFakeSocket() {
  const listeners = new Map();
  return {
    on: vi.fn((event, cb) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(cb);
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(() => listeners.clear()),
    // helpers for tests:
    __listeners: listeners,
    __fire: (event, ...args) => {
      const cbs = listeners.get(event) || [];
      cbs.forEach((cb) => cb(...args));
    },
  };
}

let fakeSocket;

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => fakeSocket),
}));

vi.mock('@/services/socket/socketUtils', () => ({
  getSocketBaseUrl: () => 'http://localhost:5000',
}));

// Import after mocks are set up
const importHook = async () => (await import('@/games/_shared/useGameSocket')).useGameSocket;

beforeEach(() => {
  fakeSocket = createFakeSocket();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useGameSocket', () => {
  it('calls io() with /<gameType> path and withCredentials: true', async () => {
    const useGameSocket = await importHook();
    const { io } = await import('socket.io-client');

    renderHook(() => useGameSocket('dice'));

    expect(io).toHaveBeenCalledTimes(1);
    const [url, opts] = io.mock.calls[0];
    expect(url).toBe('http://localhost:5000/dice');
    expect(opts.withCredentials).toBe(true);
    expect(opts.reconnection).toBe(true);
  });

  it('transitions status from connecting to connected when "connect" fires', async () => {
    const useGameSocket = await importHook();

    const { result } = renderHook(() => useGameSocket('dice'));
    expect(result.current.status).toBe('connecting');

    act(() => {
      fakeSocket.__fire('connect');
    });

    expect(result.current.status).toBe('connected');
  });

  it('populates lastError when "connect_error" fires', async () => {
    const useGameSocket = await importHook();

    const { result } = renderHook(() => useGameSocket('dice'));

    act(() => {
      fakeSocket.__fire('connect_error', new Error('boom'));
    });

    expect(result.current.status).toBe('error');
    expect(result.current.lastError).toEqual({
      source: 'connect',
      message: 'boom',
    });
  });

  it('sets serverSeedHash when gameState event includes one', async () => {
    const useGameSocket = await importHook();

    const { result } = renderHook(() => useGameSocket('dice'));

    act(() => {
      fakeSocket.__fire('gameState', { serverSeedHash: 'abc123' });
    });

    expect(result.current.serverSeedHash).toBe('abc123');
  });

  it('invokes user-provided event handlers when matching socket event fires', async () => {
    const useGameSocket = await importHook();
    const onRoll = vi.fn();
    const onGameState = vi.fn();
    const onError = vi.fn();

    renderHook(() =>
      useGameSocket('dice', {
        events: { roll: onRoll, gameState: onGameState, error: onError },
      })
    );

    act(() => {
      fakeSocket.__fire('roll', { value: 42 });
      fakeSocket.__fire('gameState', { serverSeedHash: 'h' });
      fakeSocket.__fire('error', { message: 'nope' });
    });

    expect(onRoll).toHaveBeenCalledWith({ value: 42 });
    expect(onGameState).toHaveBeenCalledWith({ serverSeedHash: 'h' });
    expect(onError).toHaveBeenCalledWith({ message: 'nope' });
  });

  it('calls socket.disconnect on unmount', async () => {
    const useGameSocket = await importHook();
    const { unmount } = renderHook(() => useGameSocket('dice'));

    unmount();

    expect(fakeSocket.removeAllListeners).toHaveBeenCalled();
    expect(fakeSocket.disconnect).toHaveBeenCalled();
  });

  it('emit() forwards to socket.emit; ack is passed through when provided', async () => {
    const useGameSocket = await importHook();
    const { result } = renderHook(() => useGameSocket('dice'));

    act(() => {
      result.current.emit('placeBet', { amount: 10 });
    });
    expect(fakeSocket.emit).toHaveBeenCalledWith('placeBet', { amount: 10 });

    const ack = vi.fn();
    act(() => {
      result.current.emit('cashout', { id: 1 }, ack);
    });
    expect(fakeSocket.emit).toHaveBeenLastCalledWith('cashout', { id: 1 }, ack);
  });

  it('does not connect when autoConnect is false', async () => {
    const useGameSocket = await importHook();
    const { io } = await import('socket.io-client');
    io.mockClear();

    renderHook(() => useGameSocket('dice', { autoConnect: false }));

    expect(io).not.toHaveBeenCalled();
  });
});
