import type { PlayerCtx } from '../_engine/types.js';
import type { RouletteEngine } from './engine.js';

/**
 * Wire the Roulette engine onto a single player connection.
 *
 * Extracted verbatim from `server.ts` (Phase A1). Roulette is unusual: the
 * engine binds its own `roulette:join` / `roulette:place_bet` / `roulette:spin`
 * / `roulette:get_history` listeners inside `onJoin`, so this function is a
 * no-op kept for API symmetry with the other games.
 */
export function bindEvents(_engine: RouletteEngine, _ctx: PlayerCtx): void {
  /* event listeners bound in RouletteEngine.onJoin */
}

export default bindEvents;
