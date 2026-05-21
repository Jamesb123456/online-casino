/**
 * Wheel segment payouts per difficulty.
 *
 * 12 segments per difficulty. House edge varies by difficulty:
 *   easy   → ~4.2% edge, max 3x
 *   medium → ~7.5% edge, max 5x
 *   hard   → ~10%  edge, max 7x
 *
 * Multipliers can be overridden by `GameConfigService.getConfig('wheel').payoutTable`.
 * All resolved multipliers are clamped to `MAX_PAYOUT_MULTIPLIER`.
 */
import { MAX_PAYOUT_MULTIPLIER } from '../../utils/gameUtils.js';

export type WheelDifficulty = 'easy' | 'medium' | 'hard';

export const DEFAULT_SEGMENT_PAYOUTS: Record<WheelDifficulty, number[]> = {
  easy: [0, 0.2, 0.3, 0.5, 0.5, 0.8, 1.0, 1.0, 1.2, 1.5, 1.5, 3.0],
  medium: [0, 0, 0, 0.1, 0.2, 0.3, 0.5, 0.5, 1.0, 1.5, 2.0, 5.0],
  hard: [0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.5, 1.0, 2.0, 7.0],
};

export const SEGMENT_COUNT = 12;

/**
 * Resolve the payout multiplier for a given difficulty + segment index.
 *
 * Lookup order:
 *   1. `payoutsOverride[difficulty][segmentIndex]` when it's a finite number.
 *   2. `DEFAULT_SEGMENT_PAYOUTS[difficulty][segmentIndex]`.
 *
 * Result is clamped to `MAX_PAYOUT_MULTIPLIER`.
 */
export function resolveMultiplier(
  difficulty: WheelDifficulty,
  segmentIndex: number,
  payoutsOverride?: Record<string, number[]> | null,
): number {
  const defaults = DEFAULT_SEGMENT_PAYOUTS[difficulty] || DEFAULT_SEGMENT_PAYOUTS.medium;

  let raw: number | undefined;
  if (
    payoutsOverride &&
    typeof payoutsOverride === 'object' &&
    Array.isArray(payoutsOverride[difficulty]) &&
    payoutsOverride[difficulty].length > 0
  ) {
    const candidate = payoutsOverride[difficulty][segmentIndex];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      raw = candidate;
    }
  }
  if (raw == null) {
    raw = defaults[segmentIndex];
  }
  if (raw == null || !Number.isFinite(raw)) {
    raw = 0;
  }
  return Math.min(Math.max(0, raw), MAX_PAYOUT_MULTIPLIER);
}
