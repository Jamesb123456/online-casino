/**
 * Deterministic Plinko ball path generation.
 *
 * The legacy handler (`socket/plinkoHandler.ts` + `utils/plinkoUtils.ts`) used
 * `crypto.randomBytes(16)` as the path seed — that worked but gave us no way
 * to verify a drop after the fact. The engine version pipes the provably-fair
 * `SeedBundle` through `pf.generate()` to obtain a deterministic float in
 * [0, 1), hashes that into a 32-bit integer to seed `mulberry32`, then walks
 * the same left/right routine the legacy code used. The PRNG and clamping
 * rules are byte-for-byte identical to `utils/plinkoUtils.ts.generatePath`,
 * so any client expecting the legacy path shape still works — the only
 * difference is the entropy source, which is now reproducible.
 */
import pf from '../_engine/provablyFair.js';
import type { SeedBundle } from '../_engine/types.js';

/** Mulberry32 PRNG — matches the legacy implementation in `utils/plinkoUtils.ts`. */
function mulberry32(a: number): () => number {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convert the [0, 1) PF result into a 32-bit unsigned int seed for mulberry32. */
function seedFromBundle(bundle: SeedBundle): number {
  const { raw } = pf.generate(bundle);
  // Spread the 53 bits of float entropy into 32 bits without bias.
  return Math.floor(raw * 0x1_0000_0000) >>> 0;
}

/**
 * Generate a Plinko ball path for the given row count, seeded from the
 * provably-fair bundle. The returned `path` has exactly `rows` entries —
 * each is the slot index the ball sits in after that row's bounce. The
 * `finalSlot` is the last element of `path` and is in `[0, rows]`.
 */
export function generatePath(
  rows: number,
  bundle: SeedBundle,
): { path: number[]; finalSlot: number } {
  const rand = mulberry32(seedFromBundle(bundle));
  const path: number[] = [];
  let position = Math.floor((rows + 1) / 2); // start centered, matches legacy
  for (let r = 0; r < rows; r++) {
    const dir = rand() < 0.5 ? -1 : 1;
    position = Math.min(Math.max(position + dir, 0), rows);
    path.push(position);
  }
  return { path, finalSlot: path[path.length - 1] };
}
