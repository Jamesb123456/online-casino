import type { PlayerCtx } from '../_engine/types.js';
import type { DiceEngine } from './engine.js';
import balanceService from '../../services/balanceService.js';

/**
 * Wire the Dice engine onto a single player connection.
 *
 * Extracted verbatim from `server.ts` (Phase A1). Single-shot: `dice:roll`
 * runs `onBet`, translates to `{ ok, gameId, result, target, direction,
 * win, multiplier, winAmount, newBalance }`. `dice:join` returns the
 * player's current balance for the lightweight client-mount handshake.
 *
 * NOTE: this binder calls `balanceService.getBalance` directly on `dice:join`.
 * That is a side-effect beyond the engine — it was already inline in
 * `server.ts` so it is preserved verbatim here.
 */
export function bindEvents(engine: DiceEngine, ctx: PlayerCtx): void {
  ctx.socket.on('dice:roll', async (payload: any, ack?: (resp: any) => void) => {
    try {
      const result = await engine.onBet(ctx, payload);
      const details = (result.resultDetails ?? {}) as any;
      if (ack) ack({
        ok: true,
        gameId: String(result.sessionId),
        result: details.result,
        target: details.target,
        direction: details.direction,
        win: details.win,
        multiplier: result.finalMultiplier ?? 0,
        winAmount: result.outcome,
        newBalance: result.balance,
      });
    } catch (err) {
      if (ack) ack({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
  ctx.socket.on('dice:join', async (_data: any, ack?: (resp: any) => void) => {
    try {
      const balance = await balanceService.getBalance(ctx.user.userId);
      if (ack) ack({ success: true, balance, history: [] });
    } catch (err) {
      if (ack) ack({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
  ctx.socket.on('dice:leave', () => { /* per-user state lives in seed cache only */ });
}

export default bindEvents;
