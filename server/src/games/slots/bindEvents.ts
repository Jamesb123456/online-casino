import type { PlayerCtx } from '../_engine/types.js';
import type { SlotsEngine } from './engine.js';
import balanceService from '../../services/balanceService.js';

/**
 * Wire the Slots engine onto a single player connection.
 *
 * Extracted verbatim from `server.ts` (Phase A1). Single-shot: `slots:spin`
 * runs `onBet`, translates to `{ ok, gameId, reels, hits, totalPayout,
 * multiplier, newBalance }`. `slots:join` returns the current balance for
 * the lightweight handshake.
 *
 * NOTE: this binder calls `balanceService.getBalance` directly on
 * `slots:join`. That is a side-effect beyond the engine — preserved
 * verbatim from `server.ts`.
 */
export function bindEvents(engine: SlotsEngine, ctx: PlayerCtx): void {
  ctx.socket.on('slots:spin', async (payload: any, ack?: (resp: any) => void) => {
    try {
      const result = await engine.onBet(ctx, payload);
      const details = (result.resultDetails ?? {}) as any;
      if (ack) ack({
        ok: true,
        gameId: String(result.sessionId),
        reels: details.reels,
        hits: details.hits,
        totalPayout: result.outcome,
        multiplier: result.finalMultiplier ?? 0,
        newBalance: result.balance,
      });
    } catch (err) {
      if (ack) ack({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
  ctx.socket.on('slots:join', async (_data: any, ack?: (resp: any) => void) => {
    try {
      const balance = await balanceService.getBalance(ctx.user.userId);
      if (ack) ack({ success: true, balance });
    } catch (err) {
      if (ack) ack({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
  ctx.socket.on('slots:leave', () => { /* no per-connection state */ });
}

export default bindEvents;
