/**
 * useGameSocket — public API snapshot / tripwire test.
 *
 * Sister test to `_shared/useGameSocket.test.jsx` (which covers behavior).
 * This file's job is narrower and louder: lock the *contract* that five
 * games already depend on (crash, blackjack, dice, slots, landmines) — and
 * that roulette/wheel/plinko/chat are about to migrate onto.
 *
 * If anyone changes the hook's return shape, function arities, accepted
 * options, or socket bootstrap call, one of the assertions below should
 * fail with a clear diff. Behavioral changes belong in the sister file.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// --- Minimal fake socket. We only need enough surface to let the hook
//     finish its `useEffect` without throwing; behavior is asserted in the
//     sister test. ---
function createFakeSocket() {
  return {
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
  };
}

let fakeSocket;

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => fakeSocket),
}));

vi.mock('@/services/socket/socketUtils', () => ({
  getSocketBaseUrl: () => 'http://localhost:5000',
}));

const importHook = async () =>
  (await import('@/games/_shared/useGameSocket')).useGameSocket;

beforeEach(() => {
  fakeSocket = createFakeSocket();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useGameSocket — public API contract', () => {
  // The exact set of keys the hook returns. Adding/removing/renaming any of
  // these is a breaking change for the five current consumers and must be
  // intentional.
  const EXPECTED_RETURN_KEYS = ['emit', 'lastError', 'serverSeedHash', 'socket', 'status'];

  it('returns exactly the documented set of keys', async () => {
    const useGameSocket = await importHook();
    const { result } = renderHook(() => useGameSocket('dice'));

    expect(Object.keys(result.current).sort()).toEqual(EXPECTED_RETURN_KEYS);
  });

  it('returns initial value shapes that consumers rely on', async () => {
    const useGameSocket = await importHook();
    const { result } = renderHook(() => useGameSocket('dice'));

    // status starts as 'connecting' before the socket connects.
    expect(result.current.status).toBe('connecting');
    // lastError and serverSeedHash are null until something sets them.
    expect(result.current.lastError).toBeNull();
    expect(result.current.serverSeedHash).toBeNull();
    // emit is a function (not a thunk-bound socket method).
    expect(typeof result.current.emit).toBe('function');
  });

  it('emit() has arity 3 (event, payload, ack?) and does not throw with minimal args', async () => {
    const useGameSocket = await importHook();
    const { result } = renderHook(() => useGameSocket('dice'));

    // arity = number of declared parameters. The hook documents
    // `emit(event, payload, ack?)` — three params.
    expect(result.current.emit.length).toBe(3);

    // Should be safe to invoke with one arg, two args, or three args.
    expect(() => {
      act(() => {
        result.current.emit('join');
        result.current.emit('placeBet', { amount: 1 });
        result.current.emit('cashout', { id: 1 }, () => {});
      });
    }).not.toThrow();
  });

  it('accepts (gameType, { events, autoConnect }) options and tolerates omitted options', async () => {
    const useGameSocket = await importHook();

    // No options object at all — should not throw.
    expect(() => renderHook(() => useGameSocket('crash'))).not.toThrow();

    // Empty options object.
    expect(() => renderHook(() => useGameSocket('crash', {}))).not.toThrow();

    // events alone.
    expect(() =>
      renderHook(() => useGameSocket('crash', { events: { gameState: () => {} } })),
    ).not.toThrow();

    // autoConnect alone (false short-circuits — no io() call).
    const { io } = await import('socket.io-client');
    io.mockClear();
    renderHook(() => useGameSocket('crash', { autoConnect: false }));
    expect(io).not.toHaveBeenCalled();
  });

  it('bootstraps socket.io-client with the documented URL + options shape', async () => {
    const useGameSocket = await importHook();
    const { io } = await import('socket.io-client');

    renderHook(() => useGameSocket('blackjack'));

    expect(io).toHaveBeenCalledTimes(1);
    const [url, opts] = io.mock.calls[0];

    // Namespace is `/<gameType>` appended to the base URL.
    expect(url).toBe('http://localhost:5000/blackjack');

    // Lock the connection-option shape. Reconnection behavior is part of
    // the contract — consumers assume the hook handles it for them.
    expect(opts).toEqual({
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });
  });

  it('registers the documented baseline socket events on connect', async () => {
    const useGameSocket = await importHook();
    renderHook(() => useGameSocket('dice'));

    // The hook is documented to subscribe to these four events
    // unconditionally, plus any extras the caller passes via `events`.
    const registered = fakeSocket.on.mock.calls.map(([event]) => event);
    expect(registered).toEqual(
      expect.arrayContaining(['connect', 'disconnect', 'connect_error', 'error', 'gameState']),
    );
  });

  it('registers extra caller-provided events in addition to the baseline', async () => {
    const useGameSocket = await importHook();
    renderHook(() =>
      useGameSocket('blackjack', {
        events: {
          gameState: () => {},
          blackjack_state: () => {},
          blackjack_error: () => {},
        },
      }),
    );

    const registered = fakeSocket.on.mock.calls.map(([event]) => event);
    // Baseline is still wired.
    expect(registered).toEqual(
      expect.arrayContaining(['connect', 'disconnect', 'connect_error', 'error', 'gameState']),
    );
    // Extras are wired too. (gameState is handled by the baseline, not
    // re-registered — that's part of the contract.)
    expect(registered).toEqual(
      expect.arrayContaining(['blackjack_state', 'blackjack_error']),
    );
  });

  it('appends the gameType verbatim to the namespace (no transforms)', async () => {
    const useGameSocket = await importHook();
    const { io } = await import('socket.io-client');

    // Sanity check the migration targets get the namespace they expect.
    for (const gameType of ['roulette', 'wheel', 'plinko', 'chat']) {
      io.mockClear();
      renderHook(() => useGameSocket(gameType));
      expect(io.mock.calls[0][0]).toBe(`http://localhost:5000/${gameType}`);
    }
  });
});
