// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { evaluateSpin, PAYLINES, REELS_COUNT } from '../../../games/slots/paytable.js';

const PAYOUTS = {
  CHERRY: { '3': 14, '4': 45, '5': 140 },
  LEMON:  { '3': 14, '4': 45, '5': 140 },
  ORANGE: { '3': 22, '4': 70, '5': 210 },
  PLUM:   { '3': 22, '4': 70, '5': 210 },
  BELL:   { '3': 42, '4': 140, '5': 560 },
  BAR:    { '3': 70, '4': 280, '5': 1400 },
  SEVEN:  { '3': 140, '4': 700, '5': 4200 },
};

const TABLE = { lines: PAYLINES as any, payouts: PAYOUTS };

/**
 * Build a 5x3 visible matrix from a sparse spec keyed by `[reel][row]`.
 * Unspecified cells default to 'X' (a symbol that never appears in PAYOUTS,
 * so it cannot accidentally form a payline).
 */
function buildVisible(spec: Record<number, Record<number, string>>): string[][] {
  const out: string[][] = [];
  for (let r = 0; r < REELS_COUNT; r++) {
    const col: string[] = [];
    for (let row = 0; row < 3; row++) {
      col.push(spec[r]?.[row] ?? 'X');
    }
    out.push(col);
  }
  return out;
}

describe('evaluateSpin', () => {
  it('returns zero hits when no payline matches', () => {
    const visible = buildVisible({}); // all 'X'
    const { hits, totalPayout } = evaluateSpin(visible, 5, TABLE, 1);
    expect(hits).toEqual([]);
    expect(totalPayout).toBe(0);
  });

  it('counts a 3-of-a-kind payline (CHERRY mid row on line 0)', () => {
    // Line 0 = [1,1,1,1,1] (middle row across all 5 reels).
    // Place CHERRY on reels 0..2 row 1; reel 3 row 1 different to stop the run.
    const visible = buildVisible({
      0: { 1: 'CHERRY' },
      1: { 1: 'CHERRY' },
      2: { 1: 'CHERRY' },
      3: { 1: 'LEMON' },
      4: { 1: 'LEMON' },
    });
    const { hits, totalPayout } = evaluateSpin(visible, 5, TABLE, 10);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ lineIdx: 0, symbol: 'CHERRY', count: 3, payout: 14 * 10 });
    expect(totalPayout).toBe(140);
  });

  it('counts a 4-of-a-kind payline (BAR top row on line 1)', () => {
    // Line 1 = [0,0,0,0,0] (top row).
    const visible = buildVisible({
      0: { 0: 'BAR' },
      1: { 0: 'BAR' },
      2: { 0: 'BAR' },
      3: { 0: 'BAR' },
      4: { 0: 'CHERRY' },
    });
    const { hits, totalPayout } = evaluateSpin(visible, 5, TABLE, 2);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ lineIdx: 1, symbol: 'BAR', count: 4, payout: 280 * 2 });
    expect(totalPayout).toBe(560);
  });

  it('counts a 5-of-a-kind payline (SEVEN bottom row on line 2)', () => {
    // Line 2 = [2,2,2,2,2] (bottom row).
    const visible = buildVisible({
      0: { 2: 'SEVEN' },
      1: { 2: 'SEVEN' },
      2: { 2: 'SEVEN' },
      3: { 2: 'SEVEN' },
      4: { 2: 'SEVEN' },
    });
    const { hits, totalPayout } = evaluateSpin(visible, 5, TABLE, 1);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ lineIdx: 2, symbol: 'SEVEN', count: 5, payout: 4200 });
    expect(totalPayout).toBe(4200);
  });

  it('only evaluates the first `lines` paylines', () => {
    // 3 CHERRY on line 2 (bottom row) — but caller only activates 1 line.
    // Line 0 (middle) should be checked; line 2 (bottom) should NOT contribute.
    const visible = buildVisible({
      0: { 2: 'CHERRY' },
      1: { 2: 'CHERRY' },
      2: { 2: 'CHERRY' },
    });
    const { hits, totalPayout } = evaluateSpin(visible, 1, TABLE, 5);
    expect(hits).toEqual([]);
    expect(totalPayout).toBe(0);
  });

  it('breaks the run on the first mismatch (no payout for split symbols)', () => {
    // Line 0 middle row: CHERRY, LEMON, CHERRY, CHERRY, CHERRY → only 1 CHERRY in a row.
    const visible = buildVisible({
      0: { 1: 'CHERRY' },
      1: { 1: 'LEMON' },
      2: { 1: 'CHERRY' },
      3: { 1: 'CHERRY' },
      4: { 1: 'CHERRY' },
    });
    const { hits, totalPayout } = evaluateSpin(visible, 5, TABLE, 1);
    expect(hits).toEqual([]);
    expect(totalPayout).toBe(0);
  });

  it('sums multiple hitting paylines', () => {
    // Reels: every row of every reel is CHERRY.
    // Lines 0,1,2 (mid/top/bot) all hit 5-of-a-kind; lines 3,4 (zigzags) also
    // hit since every cell is CHERRY.
    const visible = buildVisible({
      0: { 0: 'CHERRY', 1: 'CHERRY', 2: 'CHERRY' },
      1: { 0: 'CHERRY', 1: 'CHERRY', 2: 'CHERRY' },
      2: { 0: 'CHERRY', 1: 'CHERRY', 2: 'CHERRY' },
      3: { 0: 'CHERRY', 1: 'CHERRY', 2: 'CHERRY' },
      4: { 0: 'CHERRY', 1: 'CHERRY', 2: 'CHERRY' },
    });
    const { hits, totalPayout } = evaluateSpin(visible, 5, TABLE, 1);
    expect(hits).toHaveLength(5);
    // 5 lines × 5-of-a-kind CHERRY × betPerLine=1 → 5 × 140 = 700.
    expect(totalPayout).toBe(700);
  });
});
