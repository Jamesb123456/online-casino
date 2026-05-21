/**
 * Plinko bucket multiplier lookup.
 *
 * Re-exports the canonical `MULTIPLIER_TABLES` from `utils/plinkoUtils.ts` so
 * the engine can share the same tables that the legacy handler uses today.
 * `resolveBucketMultiplier` is the single entry point engines should call —
 * it applies the optional config-sourced override, falls back to the default
 * tables, and caps payouts at `MAX_PAYOUT_MULTIPLIER`.
 */
import { MULTIPLIER_TABLES } from '../../utils/plinkoUtils.js';

export { MULTIPLIER_TABLES };

export type PlinkoRisk = 'low' | 'medium' | 'high';

/** Hard cap on any single Plinko payout multiplier (mirrors legacy 50x ceiling). */
export const MAX_PAYOUT_MULTIPLIER = 50;

/** Fallback multiplier when no table/slot is available — preserves legacy behaviour. */
const FALLBACK_MULTIPLIER = 0.5;

/**
 * Resolve the payout multiplier for a Plinko drop.
 *
 * Lookup order:
 *   1. `override[risk][String(rows)]` (from `GameConfigService.getConfig('plinko').payoutTable`)
 *   2. `MULTIPLIER_TABLES[rows][risk]`
 *   3. `FALLBACK_MULTIPLIER`
 *
 * Result is always clamped to `[0, MAX_PAYOUT_MULTIPLIER]`.
 */
export function resolveBucketMultiplier(
  rows: number,
  risk: PlinkoRisk | string,
  slot: number,
  override?: Record<string, Record<string, number[]>> | null,
): number {
  let table: number[] | undefined;

  if (override && typeof override === 'object' && override[risk]) {
    const byRows = override[risk];
    table = byRows[String(rows)] || (byRows as any)[rows];
  }

  if (!table) {
    table = MULTIPLIER_TABLES[rows]?.[risk as string];
  }

  if (!table || !Number.isInteger(slot) || slot < 0 || slot >= table.length) {
    return FALLBACK_MULTIPLIER;
  }

  const raw = table[slot];
  if (!Number.isFinite(raw) || raw < 0) return FALLBACK_MULTIPLIER;
  return Math.min(raw, MAX_PAYOUT_MULTIPLIER);
}
