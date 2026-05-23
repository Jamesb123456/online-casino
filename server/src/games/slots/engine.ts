/**
 * Slots engine — instant single-shot 5x3 reel game.
 *
 * Wraps `InstantResolveEngine.oneShot` so the base class owns the session
 * row + balance plumbing. The engine itself validates input, draws 5 reel
 * offsets from one seed bundle (see `rng.ts`), evaluates active paylines
 * against the configured payout table, and returns an OutcomeReport.
 *
 * The handler/namespace layer (C-7) is responsible for translating the
 * `BetResult` back into the legacy ack shape:
 *   `{ ok:true, gameId, reels: visible, hits, totalPayout, multiplier, newBalance }`.
 */
import { InstantResolveEngine } from '../_engine/instant.js';
import type {
  BetResult,
  GameType,
  JoinPayload,
  PlayerCtx,
  SlotsBetPayload,
} from '../_engine/types.js';
import {
  REELS,
  REELS_COUNT,
  MIN_LINES,
  MAX_LINES,
  evaluateSpin,
  type PayoutTable,
} from './paytable.js';
import { drawReels } from './rng.js';

export class SlotsEngine extends InstantResolveEngine {
  readonly gameType: GameType = 'slots';

  override async onJoin(ctx: PlayerCtx): Promise<JoinPayload> {
    // Same handshake as the base; included explicitly so future Slots-specific
    // join state (e.g. last-spin echo) has a clear extension point.
    return super.onJoin(ctx);
  }

  override async onBet(ctx: PlayerCtx, payload: SlotsBetPayload): Promise<BetResult> {
    const { betPerLine, lines } = this.validate(payload);
    const totalBet = Math.round(betPerLine * lines * 100) / 100;

    return this.oneShot(ctx, totalBet, async ({ seed, payoutTable }) => {
      // Legacy parity: a misconfigured payoutTable rejects the spin entirely.
      // We surface this BEFORE consuming any randomness so the player's nonce
      // isn't wasted — but oneShot already started the session, so we throw
      // and let the upstream lock + endSession path roll the row to outcome=0.
      const reels = Array.isArray((payoutTable as PayoutTable)?.reels)
        && (payoutTable as PayoutTable).reels!.length === REELS_COUNT
        ? (payoutTable as PayoutTable).reels!
        : null;
      const payouts = (payoutTable as PayoutTable)?.payouts
        && typeof (payoutTable as PayoutTable).payouts === 'object'
        ? (payoutTable as PayoutTable).payouts
        : null;
      if (!reels || !payouts) {
        throw new Error('payout_table_invalid');
      }

      const { offsets, visible } = drawReels(seed, reels);
      const { hits, totalPayout } = evaluateSpin(
        visible,
        lines,
        payoutTable as PayoutTable,
        betPerLine,
      );

      const multiplier = totalBet > 0 ? totalPayout / totalBet : 0;
      return {
        outcome: totalPayout,
        multiplier,
        details: { reels: visible, offsets, hits, lines, betPerLine },
      };
    });
  }

  // ── Validation ──────────────────────────────────────────────────────

  protected validate(payload: SlotsBetPayload): { betPerLine: number; lines: number } {
    if (!payload || typeof payload !== 'object') {
      throw new Error('invalid_payload');
    }
    const betPerLine = Number(payload.betPerLine);
    const lines = Number(payload.lines);

    if (!Number.isFinite(betPerLine) || betPerLine <= 0) {
      throw new Error('bet_per_line_invalid');
    }
    if (!Number.isInteger(lines) || lines < MIN_LINES || lines > MAX_LINES) {
      throw new Error('lines_out_of_range');
    }
    return { betPerLine, lines };
  }
}

export default SlotsEngine;
export { REELS };
