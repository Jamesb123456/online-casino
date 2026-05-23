import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getSocketBaseUrl } from '@/services/socket/socketUtils';

/**
 * useGameSocket
 *
 * One hook per game page. Opens a Socket.IO connection to `/<gameType>`,
 * subscribes to `gameState`, `balanceUpdate`, and `error` automatically, plus
 * whatever extra `events` the caller hands in.
 *
 * Returns:
 *   - `socket` — the live socket instance (or null while connecting)
 *   - `emit(event, payload, ack?)` — fire-and-forget or with ack
 *   - `status` — 'connecting' | 'connected' | 'disconnected' | 'error'
 *   - `lastError` — most recent error payload from the server (or connect error)
 *   - `serverSeedHash` — latest `gameState.serverSeedHash` for the verify panel
 *
 * All event handlers passed in `events` get the rest of the args (no socket
 * exposure). Handlers are kept in a ref so consumers can use `useCallback`s
 * without re-subscribing.
 *
 * Auth is cookie-based (Better Auth session). Reconnection is on by default;
 * the caller doesn't need to manage it.
 */
export function useGameSocket(gameType, { events = {}, autoConnect = true } = {}) {
  const [status, setStatus] = useState('connecting');
  const [lastError, setLastError] = useState(null);
  const [serverSeedHash, setServerSeedHash] = useState(null);

  const socketRef = useRef(null);
  const handlersRef = useRef(events);
  handlersRef.current = events;
  // Consecutive auth-flavored connect_error count. Reset on a successful
  // `connect`. Used to decide when to give up on reconnect (cookie expired,
  // permanent denial, etc.) instead of spinning forever.
  const authErrorCountRef = useRef(0);

  useEffect(() => {
    if (!autoConnect || !gameType) return undefined;

    const url = `${getSocketBaseUrl()}/${gameType}`;
    const socket = io(url, {
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;
    authErrorCountRef.current = 0;

    socket.on('connect', () => {
      // Transient hiccup recovered — clear the auth-error streak so a later
      // single auth error doesn't trip the terminal threshold.
      authErrorCountRef.current = 0;
      setStatus('connected');
    });
    socket.on('disconnect', (reason) => {
      // Socket.IO docs: 'io server disconnect' means the server intentionally
      // dropped us (admin kick, ban, namespace eviction). The client will NOT
      // auto-retry in this case, so reflect that terminality in status.
      if (reason === 'io server disconnect') {
        setStatus('error');
        setLastError({ source: 'server_disconnect', reason });
        // Belt-and-braces: ensure no further attempts.
        try { socket.disconnect(); } catch { /* swallow */ }
        return;
      }
      setStatus('disconnected');
    });
    socket.on('connect_error', (err) => {
      const message = err?.message || 'connect_error';
      // Heuristic: cookie expired / session invalid / forbidden. socketAuth
      // middleware rejects with messages along these lines. If we see this
      // repeatedly we stop retrying so the UI can surface a real error.
      const isAuthLike = /auth|unauthor|forbidden/i.test(message);
      if (isAuthLike) {
        authErrorCountRef.current += 1;
        if (authErrorCountRef.current >= 3) {
          setStatus('error');
          setLastError({ source: 'auth', message });
          // Kill reconnection entirely — we're not going to magically get a
          // fresh cookie by retrying.
          try {
            if (socket.io && socket.io.opts) socket.io.opts.reconnection = false;
            socket.disconnect();
          } catch { /* swallow */ }
          return;
        }
      } else {
        authErrorCountRef.current = 0;
      }
      setStatus('error');
      setLastError({ source: 'connect', message });
    });

    socket.on('error', (payload) => {
      setLastError({ source: 'server', ...(payload || {}) });
      if (handlersRef.current.error) {
        try { handlersRef.current.error(payload); } catch { /* swallow */ }
      }
    });

    socket.on('gameState', (payload) => {
      if (payload?.serverSeedHash) setServerSeedHash(payload.serverSeedHash);
      if (handlersRef.current.gameState) {
        try { handlersRef.current.gameState(payload); } catch { /* swallow */ }
      }
    });

    // Subscribe to whatever extra events the consumer named. Handlers are
    // read via the ref so a re-render with a new closure doesn't tear down
    // the socket.
    const extra = Object.keys(events).filter((k) => k !== 'gameState' && k !== 'error');
    extra.forEach((event) => {
      socket.on(event, (...args) => {
        const handler = handlersRef.current[event];
        if (!handler) return;
        try { handler(...args); } catch { /* swallow */ }
      });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
    // gameType is the only thing that should re-open the socket. `events`
    // changes are absorbed via the ref. Re-binding extra events on `events`
    // identity change would tear down the connection unnecessarily.
  }, [gameType, autoConnect]);

  const emit = useCallback((event, payload, ack) => {
    const socket = socketRef.current;
    if (!socket) return;
    if (ack) socket.emit(event, payload, ack);
    else socket.emit(event, payload);
  }, []);

  return {
    socket: socketRef.current,
    status,
    lastError,
    serverSeedHash,
    emit,
  };
}

export default useGameSocket;
