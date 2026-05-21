/**
 * Wheel-specific RNG helpers.
 *
 * - `drawSegment(bundle)` wraps `pf.generateInt(bundle, 12)` so the engine
 *   doesn't reach into the PF wrapper directly.
 * - `spinAngles(segmentIndex)` computes the visual rotation parameters used
 *   in the `wheelSpinning` event payload. Formula matches the legacy
 *   `wheelHandler.ts` verbatim so the client animation is unchanged.
 */
import pf from '../_engine/provablyFair.js';
import type { SeedBundle } from '../_engine/types.js';
import { SEGMENT_COUNT } from './segments.js';

const SEGMENT_ANGLE = 360 / SEGMENT_COUNT; // 30deg per segment
const BASE_ROTATION = 270;
const FULL_ROTATIONS = 4 * 360;

/** Draw a single segment index in [0, 12). */
export function drawSegment(bundle: SeedBundle): { segmentIndex: number; seeds: SeedBundle } {
  const { value, seeds } = pf.generateInt(bundle, SEGMENT_COUNT);
  return { segmentIndex: value, seeds };
}

/**
 * Compute the visual spin target angle for a winning segment.
 *
 * Matches the legacy wheelHandler verbatim:
 *   targetAngle  = BASE_ROTATION - (segmentIndex * SEGMENT_ANGLE)
 *   randomOffset ∈ [-SEGMENT_ANGLE*0.3, SEGMENT_ANGLE*0.3)
 *   finalAngle   = targetAngle + randomOffset + (4 * 360)
 */
export function spinAngles(segmentIndex: number): { targetAngle: number; baseRotation: number } {
  const baseTarget = BASE_ROTATION - (segmentIndex * SEGMENT_ANGLE);
  const randomOffset = Math.random() * (SEGMENT_ANGLE * 0.6) - (SEGMENT_ANGLE * 0.3);
  const targetAngle = baseTarget + randomOffset + FULL_ROTATIONS;
  return { targetAngle, baseRotation: BASE_ROTATION };
}
