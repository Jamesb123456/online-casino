import type { PlayerCtx } from '../_engine/types.js';
import type { BlackjackEngine } from './engine.js';

/**
 * Wire the Blackjack engine onto a single player connection.
 *
 * Extracted verbatim from `server.ts` (Phase A1). The engine emits
 * `blackjack_game_state` + `balanceUpdate` itself; this layer only routes
 * the four inbound action events into the engine. Engine errors surface as
 * `blackjack_error: { message }` — the legacy outbound contract used by the
 * existing client. Listener order (`start`, `hit`, `stand`, `double`) must
 * be preserved.
 */
export function bindEvents(engine: BlackjackEngine, ctx: PlayerCtx): void {
  const safeEmitError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    ctx.socket.emit('blackjack_error', { message });
  };
  ctx.socket.on('blackjack_start', async (payload: any) => {
    try { await engine.onBet(ctx, payload); } catch (err) { safeEmitError(err); }
  });
  ctx.socket.on('blackjack_hit', async (payload: any) => {
    try { await engine.onAction(ctx, 'hit', payload); } catch (err) { safeEmitError(err); }
  });
  ctx.socket.on('blackjack_stand', async (payload: any) => {
    try { await engine.onAction(ctx, 'stand', payload); } catch (err) { safeEmitError(err); }
  });
  ctx.socket.on('blackjack_double', async (payload: any) => {
    try { await engine.onAction(ctx, 'double', payload); } catch (err) { safeEmitError(err); }
  });
}

export default bindEvents;
