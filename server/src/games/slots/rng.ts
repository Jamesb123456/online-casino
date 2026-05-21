/**
 * Slots-specific RNG: derive 5 independent reel offsets from one seed bundle.
 *
 * WHY a custom HMAC instead of `pf.generateInt` five times: a Slots spin is
 * conceptually ONE draw (one nonce per spin), but we need 5 sub-results. We
 * therefore HMAC the seed bundle's `serverSeed` against `clientSeed:nonce:r`
 * for r ∈ [0, 5) — same primitive as `ProvablyFairService.generateResult`,
 * just with a per-reel suffix. Replay tooling can verify by recomputing the
 * same HMAC. Keeping one nonce per spin also matches the rotateAfterDraws
 * accounting in `InstantResolveEngine`.
 */
import crypto from 'crypto';
import type { SeedBundle } from '../_engine/types.js';
import { REELS_COUNT, ROWS_COUNT } from './paytable.js';

/**
 * Pick a uniform offset on the given reel strip from a HMAC suffix.
 * Uses 32 bits of the digest divided by 0xFFFFFFFF to get a float in [0, 1].
 */
function offsetFromHmac(serverSeed: string, clientSeed: string, nonce: number, reelIndex: number, stripLength: number): number {
  const hmac = crypto.createHmac('sha256', serverSeed)
    .update(`${clientSeed}:${nonce}:${reelIndex}`)
    .digest('hex');
  const intValue = parseInt(hmac.substring(0, 8), 16);
  // Divide by 0xFFFFFFFF (inclusive) — if the digest happens to be all-ones
  // we'd get exactly 1.0; the Math.floor below then yields `stripLength`,
  // which would wrap. Clamp via Math.min to keep the offset in-range.
  const float = intValue / 0xFFFFFFFF;
  return Math.min(stripLength - 1, Math.floor(float * stripLength));
}

/**
 * Draw all 5 reel offsets and build the visible 5x3 matrix for one spin.
 * `reels[r][offset+row]` with wrap-around on each strip.
 */
export function drawReels(
  bundle: SeedBundle,
  reels: ReadonlyArray<ReadonlyArray<string>>,
): { offsets: number[]; visible: string[][] } {
  if (reels.length !== REELS_COUNT) {
    throw new Error('reels_length_invalid');
  }

  const offsets: number[] = [];
  const visible: string[][] = [];
  for (let r = 0; r < REELS_COUNT; r++) {
    const strip = reels[r];
    if (!Array.isArray(strip) || strip.length === 0) {
      throw new Error('reel_strip_empty');
    }
    const offset = offsetFromHmac(bundle.serverSeed, bundle.clientSeed, bundle.nonce, r, strip.length);
    offsets.push(offset);
    const col: string[] = [];
    for (let row = 0; row < ROWS_COUNT; row++) {
      col.push(strip[(offset + row) % strip.length]);
    }
    visible.push(col);
  }
  return { offsets, visible };
}
