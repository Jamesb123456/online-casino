/**
 * Slots paytable / evaluator.
 *
 * Constants below mirror the integration-test payout table (and the legacy
 * `socket/slotsHandler.ts` defaults) verbatim: 5 reels of 20 symbols, 5 master
 * paylines, payouts keyed by symbol / match-count (3, 4, 5).
 *
 * `evaluateSpin` walks the active subset of paylines left-to-right counting
 * consecutive matches from reel 0 and sums the per-line payouts (using
 * `Decimal.js` for currency-safe multiplication, matching the legacy handler).
 */
import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export const REELS_COUNT = 5;
export const ROWS_COUNT = 3;
export const MIN_LINES = 1;
export const MAX_LINES = 5;

/**
 * Default reel strips. Each inner array is a single reel, read top-to-bottom
 * with wrap-around. Source: `migrations/0013_slots_game.sql` /
 * `slots.integration.test.ts`.
 */
export const REELS: ReadonlyArray<ReadonlyArray<string>> = [
  ['CHERRY','CHERRY','LEMON','ORANGE','PLUM','BELL','CHERRY','LEMON','BAR','ORANGE','CHERRY','LEMON','SEVEN','PLUM','BELL','ORANGE','LEMON','CHERRY','BAR','PLUM'],
  ['LEMON','ORANGE','PLUM','BELL','CHERRY','LEMON','BAR','ORANGE','CHERRY','PLUM','BELL','ORANGE','LEMON','CHERRY','SEVEN','PLUM','BELL','CHERRY','LEMON','BAR'],
  ['ORANGE','PLUM','BELL','CHERRY','LEMON','BAR','ORANGE','CHERRY','PLUM','BELL','CHERRY','LEMON','SEVEN','PLUM','ORANGE','LEMON','CHERRY','BAR','BELL','CHERRY'],
  ['PLUM','BELL','CHERRY','LEMON','ORANGE','CHERRY','BAR','PLUM','BELL','ORANGE','LEMON','CHERRY','SEVEN','BAR','ORANGE','CHERRY','LEMON','BELL','PLUM','CHERRY'],
  ['BELL','CHERRY','LEMON','BAR','ORANGE','PLUM','CHERRY','BELL','ORANGE','LEMON','BAR','CHERRY','SEVEN','PLUM','ORANGE','LEMON','CHERRY','BELL','BAR','PLUM'],
];

/**
 * Master payline table — each entry is the row index per reel.
 * The active subset is the first `lines` entries (legacy behaviour).
 */
export const PAYLINES: ReadonlyArray<ReadonlyArray<number>> = [
  [1,1,1,1,1],
  [0,0,0,0,0],
  [2,2,2,2,2],
  [0,1,2,1,0],
  [2,1,0,1,2],
];

export interface SlotsHit {
  lineIdx: number;
  symbol: string;
  count: number;
  payout: number;
}

export type PayoutTable = {
  reels?: string[][];
  lines?: number[][];
  payouts: Record<string, Record<string, number>>;
};

/**
 * Walk each active line left-to-right; count consecutive matches starting at
 * reel 0. Returns hits for any line that reaches >=3 matches with a positive
 * payout in the table. `visible[reel][row]`.
 */
export function evaluateSpin(
  visible: string[][],
  activeLines: number,
  payoutTable: PayoutTable,
  betPerLine: number,
): { hits: SlotsHit[]; totalPayout: number } {
  const lines = Array.isArray(payoutTable?.lines) && payoutTable.lines.length > 0
    ? payoutTable.lines
    : (PAYLINES as unknown as number[][]);
  const payouts = payoutTable?.payouts ?? {};

  const hits: SlotsHit[] = [];
  let totalPayout = new Decimal(0);
  const limit = Math.min(activeLines, lines.length);

  for (let i = 0; i < limit; i++) {
    const line = lines[i];
    if (!Array.isArray(line) || line.length === 0) continue;
    const first = visible[0]?.[line[0]];
    if (!first) continue;

    let count = 1;
    for (let r = 1; r < REELS_COUNT && r < line.length; r++) {
      const sym = visible[r]?.[line[r]];
      if (sym === first) count++;
      else break;
    }

    if (count >= 3) {
      const tier = payouts[first]?.[String(count)];
      if (typeof tier === 'number' && tier > 0) {
        const payout = new Decimal(tier).times(betPerLine)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
        if (payout > 0) {
          hits.push({ lineIdx: i, symbol: first, count, payout });
          totalPayout = totalPayout.plus(payout);
        }
      }
    }
  }

  return {
    hits,
    totalPayout: totalPayout.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
  };
}
