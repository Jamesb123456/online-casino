import type { PlayerCtx } from '../_engine/types.js';
import type { PlinkoEngine } from './engine.js';

/**
 * Wire the Plinko engine onto a single player connection.
 *
 * Extracted verbatim from `server.ts` (Phase A1). Single-shot:
 * `plinko:drop_ball` runs `onBet`, which packages the legacy ack-shape onto
 * `resultDetails.ack`. If `resultDetails.ack` is absent we fall back to a
 * generic `{ success, gameId, balance }` envelope. `plinko:get_history`
 * reads the engine's in-memory ring buffer. `plinko:join` / `plinko:leave`
 * remain as no-ops for backwards compatibility with old clients.
 */
export function bindEvents(engine: PlinkoEngine, ctx: PlayerCtx): void {
  ctx.socket.on('plinko:drop_ball', async (payload: any, ack?: (resp: any) => void) => {
    try {
      const result = await engine.onBet(ctx, payload);
      const ackPayload = (result.resultDetails as any)?.ack ?? null;
      if (ack) {
        if (ackPayload) ack(ackPayload);
        else ack({ success: true, gameId: String(result.sessionId), balance: result.balance });
      }
    } catch (err) {
      if (ack) ack({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
  ctx.socket.on('plinko:get_history', (data: any, ack?: (resp: any) => void) => {
    try {
      const limit = data?.limit || 10;
      const history = engine.getHistory(limit);
      if (ack) ack({ success: true, userHistory: [], globalHistory: history });
    } catch (err) {
      if (ack) ack({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
  // Legacy no-op events kept for backwards compatibility with old clients.
  ctx.socket.on('plinko:join', (_data: any, ack?: (resp: any) => void) => {
    if (ack) ack({ success: true });
  });
  ctx.socket.on('plinko:leave', () => { /* state cleared by base.onDisconnect */ });
}

export default bindEvents;
