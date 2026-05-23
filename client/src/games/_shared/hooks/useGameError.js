import { useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/contexts/ToastContext';

/**
 * useGameError — centralized socket/API error → toast helper for game pages.
 *
 * Replaces the ad-hoc per-game pattern of:
 *
 *   useEffect(() => {
 *     if (status === 'error') toast.error('Failed to connect to <Game>...');
 *   }, [status, toast]);
 *
 *   ...
 *   toast.error(err?.message || 'Fallback message');
 *
 * Behavior is preserved exactly:
 *   - The connect-failure toast fires the first time `status` becomes 'error'
 *     and stays armed only while in the error state. If the socket recovers
 *     (status leaves 'error') and later re-enters 'error', the toast fires
 *     again — same as the legacy `useEffect(() => { if (status === 'error') ... }, [status])`.
 *   - The toast does NOT re-fire on every render while still in the error
 *     state — the ref guard prevents duplicate fires when the hook re-renders
 *     with the same `status === 'error'` value (e.g. when `lastError` updates
 *     but status stays at 'error').
 *   - `reportError(err, fallback)` is a stable callback that toasts
 *     `err?.message || fallback || 'An error occurred.'` via `toast.error`.
 *
 * The connect-failure toast is only armed when BOTH `gameName` and `status`
 * are provided. Games that historically had no connect-error toast (e.g.
 * Roulette, which relied solely on per-action error toasts) can opt out by
 * omitting `gameName` (or `status`) and still use `reportError`.
 *
 * @param {Object} args
 * @param {string} [args.gameName]   - Human-readable game label used in the
 *                                     default connect-failure toast. Omit to
 *                                     disable the connect-failure effect.
 * @param {string} [args.status]     - Socket status from `useGameSocket`:
 *                                     'connecting' | 'connected' | 'disconnected' | 'error'.
 *                                     Omit to disable the connect-failure effect.
 * @param {Object|null} [args.lastError] - Last error payload from `useGameSocket`
 *                                     (reserved for future use; not currently read).
 * @returns {{ reportError: (err: (Error|string|null|undefined), fallback?: string) => void }}
 */
export function useGameError({ gameName, status, lastError } = {}) {
  const toast = useToast();
  // Track whether we've already fired the connect-failure toast for the
  // current sustained error state. Reset when status leaves 'error'.
  const firedRef = useRef(false);

  useEffect(() => {
    // Opt-out path: games without a legacy connect-error toast pass no
    // gameName — skip the effect entirely so behaviour is preserved.
    if (!gameName) return;
    if (status === 'error') {
      if (!firedRef.current) {
        firedRef.current = true;
        toast.error(`Failed to connect to ${gameName} server. Please refresh.`);
      }
    } else {
      firedRef.current = false;
    }
    // `lastError` is intentionally not a dep — surfacing it would re-fire the
    // toast every time the server sends a new error payload while we're still
    // disconnected. The connect-failure toast is gated on transitions into
    // the error state, not on every payload update.
  }, [status, gameName, toast]);

  // Silence unused-var lint while keeping `lastError` in the public signature
  // for future use (e.g. richer "server says: <code>" toasts).
  void lastError;

  const reportError = useCallback(
    (err, fallback) => {
      const msg =
        (err && typeof err === 'object' && err.message) ||
        (typeof err === 'string' && err) ||
        fallback ||
        'An error occurred.';
      toast.error(msg);
    },
    [toast],
  );

  return { reportError };
}

export default useGameError;
