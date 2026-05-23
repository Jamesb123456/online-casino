import type { PlayerCtx } from '../_engine/types.js';
import type { WheelEngine } from './engine.js';

/**
 * Wire the Wheel engine onto a single player connection.
 *
 * Extracted verbatim from `server.ts` (Phase A1). The engine owns the round
 * loop and `onBet` logic; this layer wires the legacy ack-callback contract
 * for `wheel:place_bet` and forwards `wheel:get_history`.
 *
 * IMPORTANT: Wheel translates raw engine error strings back to the legacy
 * client-facing strings (`'Betting is closed'`, `'Invalid bet'`, etc.). The
 * mapping is load-bearing — existing client code and integration tests
 * match on those exact strings. Do not change them.
 *
 * The history accessor uses `(engine as any).history` because `history` is
 * not part of the public engine interface. Preserved verbatim.
 */
export function bindEvents(engine: WheelEngine, ctx: PlayerCtx): void {
  ctx.socket.on('wheel:place_bet', async (payload: any, ack?: (resp: any) => void) => {
    try {
      const result = await engine.onBet(ctx, payload);
      ack?.({ success: true, balance: result.balance, sessionId: result.sessionId });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const error = (() => {
        switch (raw) {
          case 'not_betting_phase':
            return 'Betting is closed';
          case 'already_placed_bet':
            return 'You already placed a bet this round';
          case 'invalid_bet':
          case 'invalid_payload':
            return 'Invalid bet';
          case 'invalid_difficulty':
            return 'Invalid difficulty';
          default:
            if (raw.startsWith('limit_')) return `Bet blocked: ${raw.slice(6)}`;
            return raw;
        }
      })();
      ack?.({ success: false, error });
    }
  });
  ctx.socket.on('wheel:get_history', (_data: any, ack?: (resp: any) => void) => {
    // History is engine-internal; expose via a tiny accessor on the engine.
    const history = (engine as any).history ?? [];
    const limit = _data?.limit || 10;
    ack?.({ success: true, globalHistory: history.slice(-limit) });
  });
}

export default bindEvents;
