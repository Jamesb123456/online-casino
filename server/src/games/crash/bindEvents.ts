import type { PlayerCtx } from '../_engine/types.js';
import type { CrashEngine } from './engine.js';

/**
 * Wire the Crash engine onto a single player connection.
 *
 * Extracted verbatim from `server.ts` (Phase A1). Ack payload shape is
 * `{ success, ... }` on success and `{ success: false, error }` on failure.
 * Do not change the event names or ack keys — they are part of the public
 * Socket.IO contract.
 */
export function bindEvents(engine: CrashEngine, ctx: PlayerCtx): void {
  ctx.socket.on('placeBet', async (payload: any, ack?: (resp: any) => void) => {
    try {
      const result = await engine.onBet(ctx, payload);
      ack?.({ success: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ack?.({ success: false, error: message });
    }
  });
  ctx.socket.on('cashOut', async (_payload: any, ack?: (resp: any) => void) => {
    try {
      const result = await engine.cashOut(ctx);
      ack?.({ success: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ack?.({ success: false, error: message });
    }
  });
}

export default bindEvents;
