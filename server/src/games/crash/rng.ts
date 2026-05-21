/**
 * Crash-specific RNG helpers.
 *
 * - `multiplierAt(elapsedMs)` is the multiplier curve from the legacy
 *   `crashHandler.ts` reproduced verbatim. Original used elapsed seconds and
 *   `Math.pow(Math.E, 0.06 * elapsed)`; preserved here unchanged so the
 *   rebuild matches the existing client expectations and visual feel.
 *
 * - `drawCrashPoint(seed, houseEdge)` wraps `pf.generateCrashPoint`. We expose
 *   the cap-and-floor logic the legacy handler applied (max 50x) on top of
 *   the provably-fair result so behaviour is preserved end-to-end.
 */

import pf from '../_engine/provablyFair.js';
import type { SeedBundle } from '../_engine/types.js';

/** Maximum multiplier — matches the legacy 50x cap. */
export const MAX_MULTIPLIER = 50;

/**
 * Exponential growth curve. Copied verbatim from the legacy
 * `crashHandler.ts#tickGame`:
 *
 *   const elapsed = (Date.now() - startTime) / 1000;
 *   currentMultiplier = Math.pow(Math.E, 0.06 * elapsed);
 */
export function multiplierAt(elapsedMs: number): number {
  const elapsed = elapsedMs / 1000;
  return Math.pow(Math.E, 0.06 * elapsed);
}

/**
 * Draw the crash point for a round using the provably-fair wrapper and apply
 * the legacy 50x cap. Returns just the number — the seeds round-trip via the
 * caller's SeedBundle.
 */
export function drawCrashPoint(seed: SeedBundle, houseEdge: number): number {
  const { crashPoint } = pf.generateCrashPoint(seed, houseEdge);
  return Math.min(MAX_MULTIPLIER, Math.max(1.0, crashPoint));
}
