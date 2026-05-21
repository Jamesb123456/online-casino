/**
 * Roulette RNG + spin-animation helpers.
 *
 * The actual draw goes through `pf.generateRouletteNumber` (provably-fair,
 * deterministic from the round's seed bundle). The animation maths is copied
 * verbatim from `socket/rouletteHandler.ts` so the wheel UI keeps spinning
 * with the same multi-phase choreography.
 */
import pf from '../_engine/provablyFair.js';
import { ROULETTE_NUMBERS, slotForNumber } from './wheel.js';
import type { SeedBundle } from '../_engine/types.js';

export interface SpinAngles {
  phase1Angle: number;
  phase2Angle: number;
  phase3Angle: number;
  finalAngle: number;
  durations: { phase1: number; phase2: number; phase3: number; total: number };
}

export interface RouletteDraw {
  /** Winning number 0..36. */
  number: number;
  /** Color of the winning slot. */
  color: 'red' | 'black' | 'green';
  /** Wheel segment index (position in `ROULETTE_NUMBERS`). */
  segmentIndex: number;
}

/**
 * Draw a winning slot via the provably-fair wrapper.
 *
 * `pf.generateRouletteNumber(bundle)` yields a value in [0, 37) — that maps
 * 1:1 to a segment in `ROULETTE_NUMBERS`. We then resolve the wheel layout
 * to extract the displayed number + color.
 */
export function drawRouletteSlot(bundle: SeedBundle): RouletteDraw {
  const { value: segmentIndex } = pf.generateRouletteNumber(bundle);
  const slot = ROULETTE_NUMBERS[segmentIndex];
  return { number: slot.number, color: slot.color, segmentIndex };
}

/**
 * Map a winning number to a `RouletteDraw` (used when the draw is
 * pre-computed, e.g. in tests).
 */
export function drawFromNumber(winningNumber: number): RouletteDraw {
  const slot = slotForNumber(winningNumber);
  const segmentIndex = ROULETTE_NUMBERS.findIndex((s) => s.number === winningNumber);
  return { number: slot.number, color: slot.color, segmentIndex };
}

/**
 * Compute multi-phase rotation angles for the wheel animation.
 *
 * Mirrors `calculateRotationAngles` in the legacy handler. `totalDurationMs`
 * is the total spin duration (default 10s, but the engine reads it from
 * `ROULETTE_SPIN_DURATION`).
 */
export function spinAngles(segmentIndex: number, totalDurationMs = 10000): SpinAngles {
  const pocketAngle = 360 / ROULETTE_NUMBERS.length;
  const targetAngle = segmentIndex * pocketAngle;
  const randomOffset = Math.random() * (pocketAngle * 0.6) - (pocketAngle * 0.3);
  return {
    phase1Angle: 10 * 360,
    phase2Angle: 6 * 360,
    phase3Angle: 2 * 360,
    finalAngle: targetAngle + randomOffset,
    durations: { phase1: 3000, phase2: 4000, phase3: 3000, total: totalDurationMs },
  };
}
