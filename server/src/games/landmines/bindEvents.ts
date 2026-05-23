import type { PlayerCtx } from '../_engine/types.js';
import type { LandminesEngine } from './engine.js';

/**
 * Wire the Landmines engine onto a single player connection.
 *
 * Extracted verbatim from `server.ts` (Phase A1). Multi-step:
 * `landmines:start` opens a session via `onBet`, `landmines:pick` /
 * `landmines:cashout` route to `onAction`. The engine returns rich result
 * objects; we translate to the legacy ack shapes. The hit/no-hit branch on
 * `pick` is load-bearing — keep both ack payload key sets verbatim.
 */
export function bindEvents(engine: LandminesEngine, ctx: PlayerCtx): void {
  ctx.socket.on('landmines:start', async (payload: any, ack?: (resp: any) => void) => {
    try {
      const result = await engine.onBet(ctx, payload);
      const details = (result.resultDetails ?? {}) as any;
      if (ack) ack({
        success: true,
        gameId: details.gameId,
        mines: details.mines,
        gridSize: details.gridSize ?? 5,
        balance: result.balance,
      });
    } catch (err) {
      if (ack) ack({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
  ctx.socket.on('landmines:pick', async (payload: any, ack?: (resp: any) => void) => {
    try {
      const result = await engine.onAction(ctx, 'reveal', payload);
      const details = (result.resultDetails ?? {}) as any;
      if (details.hit === true) {
        if (ack) ack({
          success: true,
          hit: true,
          position: details.position,
          gameOver: true,
          fullGrid: details.fullGrid,
          winAmount: 0,
        });
      } else {
        if (ack) ack({
          success: true,
          hit: false,
          position: details.position,
          multiplier: details.multiplier,
          potentialWin: details.potentialWin,
          winAmount: details.winAmount,
          profit: details.profit,
          gameOver: !!details.gameOver,
          fullGrid: details.fullGrid,
          remainingSafeCells: details.remainingSafeCells,
          autoCashout: details.autoCashout,
        });
      }
    } catch (err) {
      if (ack) ack({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
  ctx.socket.on('landmines:cashout', async (payload: any, ack?: (resp: any) => void) => {
    try {
      const result = await engine.onAction(ctx, 'cashout', payload);
      const details = (result.resultDetails ?? {}) as any;
      if (ack) ack({
        success: true,
        winAmount: details.winAmount,
        multiplier: details.multiplier,
        profit: details.profit,
        cashedOut: !!details.cashedOut,
        balance: result.balance,
        fullGrid: details.fullGrid,
      });
    } catch (err) {
      if (ack) ack({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
}

export default bindEvents;
