// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { placeMines, calculateMultiplier, GRID_SIZE, TOTAL_CELLS } from '../../../games/landmines/board.js';
import pf from '../../../games/_engine/provablyFair.js';

function fixedBundle() {
  // Use a real seed bundle so the underlying PF math runs end-to-end.
  const { serverSeed, serverSeedHash } = pf.newServerSeed();
  return { serverSeed, serverSeedHash, clientSeed: 'fixed_client_seed', nonce: 1 };
}

describe('placeMines', () => {
  it('places exactly mineCount mines on a 5×5 grid', () => {
    const bundle = fixedBundle();
    const { mineGrid, mineIndices } = placeMines(7, bundle);

    expect(mineGrid).toHaveLength(GRID_SIZE);
    for (const row of mineGrid) expect(row).toHaveLength(GRID_SIZE);

    let count = 0;
    for (const row of mineGrid) for (const cell of row) if (cell) count++;
    expect(count).toBe(7);
    expect(mineIndices).toHaveLength(7);
  });

  it('produces no duplicate positions', () => {
    const bundle = fixedBundle();
    const { mineIndices } = placeMines(20, bundle);
    const unique = new Set(mineIndices);
    expect(unique.size).toBe(mineIndices.length);
    for (const idx of mineIndices) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(TOTAL_CELLS);
    }
  });

  it('is deterministic for a fixed seed bundle', () => {
    const bundle = {
      serverSeed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      serverSeedHash: 'h',
      clientSeed: 'c',
      nonce: 1,
    };
    const a = placeMines(5, bundle);
    const b = placeMines(5, bundle);
    expect(a.mineIndices).toEqual(b.mineIndices);
    expect(a.mineGrid).toEqual(b.mineGrid);
  });

  it('rejects out-of-range mine counts', () => {
    const bundle = fixedBundle();
    expect(() => placeMines(0, bundle)).toThrow(/invalid_mine_count/);
    expect(() => placeMines(25, bundle)).toThrow(/invalid_mine_count/);
    expect(() => placeMines(-1, bundle)).toThrow(/invalid_mine_count/);
  });

  it('different nonces produce different placements', () => {
    const base = fixedBundle();
    const a = placeMines(5, { ...base, nonce: 1 });
    const b = placeMines(5, { ...base, nonce: 2 });
    // Probabilistically certain to differ for 5 mines drawn from 25.
    expect(a.mineIndices).not.toEqual(b.mineIndices);
  });

  it('can place the maximum 24 mines without infinite loop', () => {
    const bundle = fixedBundle();
    const { mineIndices } = placeMines(24, bundle);
    expect(mineIndices).toHaveLength(24);
    expect(new Set(mineIndices).size).toBe(24);
  });
});

describe('calculateMultiplier', () => {
  it('returns 1 for zero reveals', () => {
    expect(calculateMultiplier(3, 0, 0.05)).toBe(1);
  });

  it('monotonically increases with each successful reveal', () => {
    const m1 = calculateMultiplier(3, 1, 0.05);
    const m2 = calculateMultiplier(3, 2, 0.05);
    const m3 = calculateMultiplier(3, 3, 0.05);
    expect(m2).toBeGreaterThan(m1);
    expect(m3).toBeGreaterThan(m2);
  });

  it('caps at the global MAX_PAYOUT_MULTIPLIER', () => {
    // Extreme case: 24 mines, reveal the lone safe cell.
    const m = calculateMultiplier(24, 1, 0.05);
    expect(m).toBeLessThanOrEqual(50);
  });

  it('matches the legacy formula for a known case (3 mines, 1 reveal, 5% edge)', () => {
    // Survival prob = 22/25 = 0.88. Multiplier = 0.95 / 0.88 = 1.0795... → 1.08.
    const m = calculateMultiplier(3, 1, 0.05);
    expect(m).toBeCloseTo(1.08, 2);
  });

  it('rounds to two decimal places', () => {
    const m = calculateMultiplier(5, 3, 0.05);
    expect(Math.round(m * 100) / 100).toBe(m);
  });
});
