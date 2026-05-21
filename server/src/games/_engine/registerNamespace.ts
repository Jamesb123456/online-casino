import type { Namespace, Server, Socket } from 'socket.io';
import { socketAuth, getAuthenticatedUser } from '../../../middleware/socket/socketAuth.js';
import userLimitsService from '../../services/userLimitsService.js';
import LoggingService from '../../services/loggingService.js';
import type { GameEngine } from './base.js';
import type { EngineFactory, GameType, PlayerCtx } from './types.js';

/**
 * Wire a game engine onto its Socket.IO namespace.
 *
 * Replaces the three different init patterns scattered through `server.ts`
 * (namespace-level, class-based, per-connection) with one helper.
 *
 * For round-based engines, pass `mode: 'shared'` — a single engine instance
 * lives for the lifetime of the namespace and every connection feeds into
 * it. For instant-resolve engines, pass `mode: 'per-instance'` if you'd
 * rather have a fresh engine per connection (rare; the default is shared
 * because the seed map keys by userId and that's how cleanup is bookkept).
 *
 * `bindEvents` is where the engine attaches game-specific socket listeners.
 * Most engines bind one bet event and zero-to-many action events; the
 * helper takes care of `disconnect`, auth checks, error logging, and the
 * `userLimitsService.clearSession` call.
 */
export function registerGameNamespace<E extends GameEngine>(
  io: Server,
  gameType: GameType,
  engineFactory: EngineFactory<E>,
  bindEvents: (engine: E, ctx: PlayerCtx) => void,
  options: { mode?: 'shared' | 'per-instance' } = {},
): { namespace: Namespace; engine: E | null } {
  const mode = options.mode ?? 'shared';
  const namespace = io.of(`/${gameType}`);
  namespace.use(socketAuth);

  // Shared engine for the namespace (most games).
  const sharedEngine: E | null = mode === 'shared' ? engineFactory() : null;

  namespace.on('connection', async (socket: Socket) => {
    const user = getAuthenticatedUser(socket);
    if (!user) {
      LoggingService.logSystemEvent(`unauthenticated_${gameType}_namespace`, { socketId: socket.id }, 'warning');
      socket.disconnect();
      return;
    }

    LoggingService.logGameEvent(gameType, 'namespace_connection', {
      socketId: socket.id,
      username: user.username,
      userId: user.userId,
    });

    const engine = sharedEngine ?? engineFactory();
    const ctx: PlayerCtx = {
      socket,
      user,
      emit: (event, payload) => socket.emit(event, payload),
      broadcast: (event, payload) => namespace.emit(event, payload),
      namespace,
    };

    try {
      const joinPayload = await engine.onJoin(ctx);
      // `gameState` is the canonical join handshake event used by the client.
      // Preserves the public contract — every existing game already listens
      // for this event on join.
      socket.emit('gameState', { joined: true, ...joinPayload });
    } catch (err) {
      LoggingService.logSystemEvent(`${gameType}_join_failed`, {
        userId: user.userId,
        error: err instanceof Error ? err.message : String(err),
      }, 'error');
      socket.emit('error', { code: 'join_failed' });
      socket.disconnect();
      return;
    }

    try {
      bindEvents(engine, ctx);
    } catch (err) {
      LoggingService.logSystemEvent(`${gameType}_bind_failed`, {
        userId: user.userId,
        error: err instanceof Error ? err.message : String(err),
      }, 'error');
      socket.disconnect();
      return;
    }

    socket.on('disconnect', async () => {
      LoggingService.logGameEvent(gameType, 'namespace_disconnected', {
        username: user.username,
        userId: user.userId,
      });
      try {
        await engine.onDisconnect(ctx);
      } catch (err) {
        LoggingService.logSystemEvent(`${gameType}_disconnect_handler_failed`, {
          userId: user.userId,
          error: err instanceof Error ? err.message : String(err),
        }, 'warning');
      }
      userLimitsService.clearSession(user.userId);
    });
  });

  return { namespace, engine: sharedEngine };
}

/**
 * Small helper to wrap an engine method invocation so any thrown error gets
 * turned into a single client `error` event with a stable code. Subclasses
 * can use it directly inside `bindEvents`:
 *
 *   socket.on('placeBet', emitError(ctx, 'bet_failed', () => engine.onBet(ctx, payload)));
 */
export function emitError<T>(
  ctx: PlayerCtx,
  fallbackCode: string,
  fn: () => Promise<T>,
): () => Promise<void> {
  return async () => {
    try {
      await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.emit('error', { code: message || fallbackCode });
    }
  };
}
