/**
 * Deterministic Landmines board generation.
 *
 * The legacy handler (`socket/landminesHandler.ts`) used `crypto.randomInt`,
 * which placed mines randomly but gave us no way to verify a board after the
 * fact. The engine version draws each mine position from `pf.generateInt` so
 * the placement is fully reproducible from the persisted seed bundle.
 *
 * Algorithm: build a flat array of cell indices, then for each mine, draw
 * `pf.generateInt(bundle, remainingCells)`, pick that index, and swap-remove
 * from the candidate pool. This is the standard "reservoir without
 * replacement" pattern — O(mines) draws, no duplicates by construction.
 *
 * Also re-exports `calculateMultiplier` so consumers do not have to reach
 * into the legacy handler for the payout formula.
 */
import pf from '../_engine/provablyFair.js';
import { MAX_PAYOUT_MULTIPLIER } from '../../utils/gameUtils.js';
import type { SeedBundle } from '../_engine/types.js';

/** 5×5 grid — fixed by the public contract. */
export const GRID_SIZE = 5;
export const TOTAL_CELLS = GRID_SIZE * GRID_SIZE; // 25
export const MIN_MINES = 1;
export const MAX_MINES = 24;

/**
 * Place `mineCount` mines on a 5×5 grid using a single rotating seed bundle.
 *
 * Each draw bumps the nonce in `bundle` — the caller passes the same bundle
 * for every mine to keep the entire placement reproducible from one seed.
 * Returns the 2D boolean grid (true = mine) and the flat indices in draw
 * order (useful for verification).
 */
export function placeMines(
  mineCount: number,
  bundle: SeedBundle,
): { mineGrid: boolean[][]; mineIndices: number[] } {
  if (!Number.isInteger(mineCount) || mineCount < MIN_MINES || mineCount > MAX_MINES) {
    throw new Error('invalid_mine_count');
  }

  // Candidate pool: flat indices 0..24.
  const candidates: number[] = [];
  for (let i = 0; i < TOTAL_CELLS; i++) candidates.push(i);

  const mineIndices: number[] = [];

  // Draw without replacement. Each draw uses an incremented nonce on the
  // same seed material so the sequence is deterministic from `bundle`.
  let cursor = { ...bundle };
  for (let drawn = 0; drawn < mineCount; drawn++) {
    const remaining = candidates.length;
    const { value: pickedIdx } = pf.generateInt(cursor, remaining);
    const cellIndex = candidates[pickedIdx];
    mineIndices.push(cellIndex);
    // Swap-remove for O(1) deletion.
    candidates[pickedIdx] = candidates[remaining - 1];
    candidates.pop();
    cursor = { ...cursor, nonce: cursor.nonce + 1 };
  }

  // Build the 2D grid.
  const flat: boolean[] = new Array(TOTAL_CELLS).fill(false);
  for (const idx of mineIndices) flat[idx] = true;

  const mineGrid: boolean[][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    mineGrid.push(flat.slice(r * GRID_SIZE, (r + 1) * GRID_SIZE));
  }

  return { mineGrid, mineIndices };
}

/**
 * Multiplier formula — verbatim from the legacy handler, parameterised on
 * `houseEdge` so the config-driven engine can swap it without recompiling.
 *
 *   P(survive r reveals) = product(i=0..r-1) of (safeCells-i)/(TOTAL_CELLS-i)
 *   fairMultiplier       = (1 - houseEdge) / P(survive)
 *
 * Capped at the global `MAX_PAYOUT_MULTIPLIER` and rounded to 2dp.
 */
export function calculateMultiplier(mines: number, revealed: number, houseEdge: number): number {
  if (revealed <= 0) return 1;
  const safeCells = TOTAL_CELLS - mines;
  let survivalProbability = 1;
  for (let i = 0; i < revealed; i++) {
    survivalProbability *= (safeCells - i) / (TOTAL_CELLS - i);
  }
  const multiplier = (1 - houseEdge) / survivalProbability;
  return Math.min(Math.round(multiplier * 100) / 100, MAX_PAYOUT_MULTIPLIER);
}
