/**
 * useGameError — unit tests.
 *
 * Locks the B6 contract:
 *   - When `status` transitions to 'error', the connect-failure toast fires
 *     once with a game-name-aware message.
 *   - Re-rendering with the same 'error' status does NOT re-fire the toast.
 *   - If status leaves 'error' and later returns to 'error', the toast fires
 *     again (matches the legacy per-game `useEffect` behaviour).
 *   - `reportError(err, fallback)` toasts `err.message`, the fallback, or the
 *     generic default — in that priority order.
 *   - `reportError` is stable across renders (only changes when `toast`
 *     identity changes — i.e. effectively never under our provider).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Stable toast object — matches the real ToastProvider which memoizes its
// helpers via `useCallback`, so consumers can rely on identity stability.
const { toastError, toastValue } = vi.hoisted(() => {
  const err = vi.fn();
  return {
    toastError: err,
    toastValue: {
      success: vi.fn(),
      error: err,
      info: vi.fn(),
      warning: vi.fn(),
      addToast: vi.fn(),
      removeToast: vi.fn(),
    },
  };
});

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => toastValue,
}));

import useGameError from '@/games/_shared/hooks/useGameError';

describe('useGameError', () => {
  beforeEach(() => {
    toastError.mockClear();
  });

  it('does not fire the connect-failure toast while connecting / connected', () => {
    const { rerender } = renderHook(
      ({ status }) => useGameError({ gameName: 'Plinko', status, lastError: null }),
      { initialProps: { status: 'connecting' } },
    );
    expect(toastError).not.toHaveBeenCalled();

    rerender({ status: 'connected' });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("fires exactly once when status transitions to 'error'", () => {
    const { rerender } = renderHook(
      ({ status }) => useGameError({ gameName: 'Plinko', status, lastError: null }),
      { initialProps: { status: 'connecting' } },
    );

    rerender({ status: 'error' });
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      'Failed to connect to Plinko server. Please refresh.',
    );

    // Re-render with the same error status — should NOT re-fire.
    rerender({ status: 'error' });
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('re-fires after recovery if the socket re-enters the error state', () => {
    const { rerender } = renderHook(
      ({ status }) => useGameError({ gameName: 'Wheel', status, lastError: null }),
      { initialProps: { status: 'error' } },
    );
    expect(toastError).toHaveBeenCalledTimes(1);

    rerender({ status: 'connected' });
    expect(toastError).toHaveBeenCalledTimes(1);

    rerender({ status: 'error' });
    expect(toastError).toHaveBeenCalledTimes(2);
    expect(toastError).toHaveBeenLastCalledWith(
      'Failed to connect to Wheel server. Please refresh.',
    );
  });

  it('does NOT fire the connect-failure toast when gameName is omitted (opt-out)', () => {
    const { rerender } = renderHook(
      ({ status }) => useGameError({ status, lastError: null }),
      { initialProps: { status: 'connecting' } },
    );
    rerender({ status: 'error' });
    expect(toastError).not.toHaveBeenCalled();
  });

  it('reportError uses err.message when available', () => {
    const { result } = renderHook(() =>
      useGameError({ gameName: 'Crash', status: 'connected', lastError: null }),
    );
    act(() => {
      result.current.reportError(new Error('Boom'), 'fallback');
    });
    expect(toastError).toHaveBeenCalledWith('Boom');
  });

  it('reportError falls back to the fallback message when err.message is missing', () => {
    const { result } = renderHook(() =>
      useGameError({ gameName: 'Crash', status: 'connected', lastError: null }),
    );
    act(() => {
      result.current.reportError({}, 'Failed to place bet');
    });
    expect(toastError).toHaveBeenCalledWith('Failed to place bet');
  });

  it('reportError accepts a raw string as the error', () => {
    const { result } = renderHook(() =>
      useGameError({ gameName: 'Crash', status: 'connected', lastError: null }),
    );
    act(() => {
      result.current.reportError('Spin timed out');
    });
    expect(toastError).toHaveBeenCalledWith('Spin timed out');
  });

  it('reportError uses the generic default when neither err.message nor fallback are present', () => {
    const { result } = renderHook(() =>
      useGameError({ gameName: 'Crash', status: 'connected', lastError: null }),
    );
    act(() => {
      result.current.reportError(null);
    });
    expect(toastError).toHaveBeenCalledWith('An error occurred.');
  });

  it('reportError is stable across renders that only change status / lastError', () => {
    const { result, rerender } = renderHook(
      ({ status, lastError }) =>
        useGameError({ gameName: 'Crash', status, lastError }),
      { initialProps: { status: 'connecting', lastError: null } },
    );
    const first = result.current.reportError;

    rerender({ status: 'connected', lastError: null });
    rerender({ status: 'connected', lastError: { source: 'server', message: 'x' } });
    expect(result.current.reportError).toBe(first);
  });
});
