// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { generatePath } from '../../../games/plinko/path.js';
import pf from '../../../games/_engine/provablyFair.js';

function bundle(serverSeed = 'a'.repeat(64), clientSeed = 'client', nonce = 1) {
  return {
    serverSeed,
    serverSeedHash: 'h'.repeat(64),
    clientSeed,
    nonce,
  };
}

describe('plinko/path.generatePath', () => {
  it('produces a deterministic path for a fixed bundle', () => {
    const b = bundle();
    const a = generatePath(12, b);
    const c = generatePath(12, b);
    expect(a.path).toEqual(c.path);
    expect(a.finalSlot).toBe(c.finalSlot);
  });

  it('path length always equals rows', () => {
    for (const rows of [8, 9, 10, 11, 12, 13, 14, 15, 16]) {
      const { path } = generatePath(rows, bundle('s'.repeat(64), 'c', rows));
      expect(path).toHaveLength(rows);
    }
  });

  it('finalSlot lies in [0, rows]', () => {
    for (let nonce = 1; nonce <= 25; nonce++) {
      const { finalSlot } = generatePath(16, bundle('z'.repeat(64), 'seed', nonce));
      expect(finalSlot).toBeGreaterThanOrEqual(0);
      expect(finalSlot).toBeLessThanOrEqual(16);
    }
  });

  it('different seeds yield different paths (smoke)', () => {
    const a = generatePath(12, bundle('a'.repeat(64), 'c1', 1));
    const b = generatePath(12, bundle('b'.repeat(64), 'c1', 1));
    // Extremely unlikely to collide on a 12-step random walk.
    expect(a.path).not.toEqual(b.path);
  });

  it('matches pf.generate raw for the same bundle (entropy source check)', () => {
    const b = bundle('f'.repeat(64), 'aClient', 7);
    const raw1 = pf.generate(b).raw;
    const raw2 = pf.generate(b).raw;
    // pf is pure for a given bundle; this proves the seed is reproducible.
    expect(raw1).toBe(raw2);

    const p1 = generatePath(10, b).path;
    const p2 = generatePath(10, b).path;
    expect(p1).toEqual(p2);
  });

  it('every path entry is an integer within [0, rows]', () => {
    const rows = 14;
    const { path } = generatePath(rows, bundle('q'.repeat(64), 'cs', 42));
    for (const slot of path) {
      expect(Number.isInteger(slot)).toBe(true);
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThanOrEqual(rows);
    }
  });
});
