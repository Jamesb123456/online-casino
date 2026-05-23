/**
 * Dice engine — single-shot instant-resolve game.
 *
 * The player picks a target in [1, 99] and a direction ('under' | 'over').
 * A uniform random number in [0.00, 99.99] (2-decimal resolution) is drawn
 * via the provably-fair wrapper. The player wins if the roll lands on their
 * side of the target.
 *
 *   winProbability = direction === 'under' ? target / 100 : (100 - target) / 100
 *   multiplier     = (1 - houseEdge) / winProbability, capped at MAX_PAYOUT_MULTIPLIER
 *   winAmount      = bet * multiplier   (total payout incl. original bet)
 *
 * Public socket contract (handled by the bindEvents wiring in C-7) — note
 * that the ack shape is `{ ok: true, gameId, result, target, direction, win,
 * multiplier, winAmount, newBalance }` and is built by translating the
 * `BetResult` returned from `oneShot`.
 */
import Decimal from 'decimal.js';
import { InstantResolveEngine } from '../_engine/instant.js';
import pf from '../_engine/provablyFair.js';
import { capMultiplier, MAX_PAYOUT_MULTIPLIER } from '../../utils/gameUtils.js';
import type {
  BetResult,
  DiceBetPayload,
  GameType,
  JoinPayload,
  PlayerCtx,
} from '../_engine/types.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type DiceDirection = 'under' | 'over';

const MIN_TARGET = 1;
const MAX_TARGET = 99;
const VALID_DIRECTIONS: ReadonlyArray<DiceDirection> = ['under', 'over'];

/**
 * Compute the dice multiplier for a target/direction at the given house edge.
 * Mirrors the legacy `socket/diceHandler.ts` formula verbatim. Returns 0 if
 * the win probability is degenerate (target outside legal range).
 */
export function computeMultiplier(target: number, direction: DiceDirection, houseEdge: number): number {
  const winProb = direction === 'under' ? target / 100 : (100 - target) / 100;
  if (winProb <= 0 || winProb >= 1) return 0;
  const raw = new Decimal(1).minus(houseEdge).div(winProb);
  const m = Math.floor(raw.toNumber() * 100) / 100;
  return capMultiplier(m);
}

/**
 * Validate the inbound `dice:roll` payload. Throws an Error with a
 * `code-string` message that the socket bridge maps onto the ack
 * `{ ok: false, error }` shape.
 */
export function betSchema(payload: DiceBetPayload): {
  betAmount: number;
  target: number;
  direction: DiceDirection;
} {
  if (!payload || typeof payload !== 'object') {
    throw new Error('invalid_payload');
  }
  const betAmount = Number(payload.betAmount);
  if (!Number.isFinite(betAmount) || betAmount <= 0) {
    throw new Error('invalid_bet');
  }
  const target = Number(payload.target);
  if (!Number.isFinite(target) || target < MIN_TARGET || target > MAX_TARGET) {
    throw new Error('target_out_of_range');
  }
  const direction = payload.direction as DiceDirection;
  if (!VALID_DIRECTIONS.includes(direction)) {
    throw new Error('invalid_direction');
  }
  return { betAmount, target, direction };
}

export class DiceEngine extends InstantResolveEngine {
  readonly gameType: GameType = 'dice';

  /**
   * Lightweight join: ensure the user has a seed pair so the client can
   * display the provably-fair status. Dice is stateless between rolls, so
   * `hasActiveSession` is always false here (overridden field comes from base).
   */
  override async onJoin(ctx: PlayerCtx): Promise<JoinPayload> {
    const seeds = this.ensureSeeds(ctx.user.userId);
    return {
      serverSeedHash: seeds.serverSeedHash,
      state: {
        clientSeed: seeds.clientSeed,
        nextNonce: seeds.nextNonce,
      },
    };
  }

  /**
   * Roll a dice round in one shot: validate, lock per-user, draw, settle.
   * The bindEvents caller (C-7) translates the returned `BetResult` into the
   * legacy ack shape.
   */
  override async onBet(ctx: PlayerCtx, payload: DiceBetPayload): Promise<BetResult> {
    const { betAmount, target, direction } = betSchema(payload);

    return this.oneShot(ctx, betAmount, async ({ seed, houseEdge }) => {
      const multiplier = computeMultiplier(target, direction, houseEdge);
      const result = Math.floor(pf.generate(seed).raw * 10000) / 100;
      const win = direction === 'under' ? result < target : result > target;

      const outcome = win && multiplier > 0
        ? new Decimal(betAmount).times(multiplier).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
        : 0;

      return {
        outcome,
        multiplier: win ? multiplier : 0,
        details: { result, target, direction, win },
      };
    });
  }
}

export default DiceEngine;
export { MAX_PAYOUT_MULTIPLIER };
