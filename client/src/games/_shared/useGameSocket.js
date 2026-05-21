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

    socket.on('connect', () => setStatus('connected'));
    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('connect_error', (err) => {
      setStatus('error');
      setLastError({ source: 'connect', message: err?.message || 'connect_error' });
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
