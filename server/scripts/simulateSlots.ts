/**
 * Slots RTP simulator.
 *
 * Reads the live `game_config.payoutTable` for 'slots' from MySQL and replays
 * `resolveSpin` against it. Reports realised RTP at several active-line counts.
 *
 * Run from server/:
 *   npm install --no-audit --no-fund   # if not already installed
 *   npx ts-node --transpile-only scripts/simulateSlots.ts [SPINS]
 *
 * Default SPINS is 1_000_000. Each line is independently evaluated so the
 * realised RTP should converge to the same value regardless of `activeLines`
 * (the math is symmetric per-line).
 */

import crypto from 'crypto';
import { db, connectDB, closeDB } from '../drizzle/db.js';
import { sql } from 'drizzle-orm';
import { evaluateSpin, REELS_COUNT, ROWS_COUNT } from '../src/games/slots/paytable.js';

interface Paytable {
  reels: string[][];
  lines: number[][];
  payouts: Record<string, Record<string, number>>;
  symbols: string[];
}

/**
 * Local reel-drawing helper for simulation purposes only. Mirrors the legacy
 * `socket/slotsHandler.ts` non-deterministic offset draw (uses `crypto.randomInt`)
 * so realised RTP is comparable to production runs. The live engine uses an
 * HMAC-derived offset under `games/slots/rng.ts`, but that requires a seed
 * bundle per spin; for a million-spin Monte Carlo we just need a uniform draw.
 */
function drawVisible(reels: string[][]): string[][] {
  const visible: string[][] = [];
  for (let r = 0; r < REELS_COUNT; r++) {
    const strip = reels[r];
    const offset = crypto.randomInt(0, strip.length);
    const col: string[] = [];
    for (let row = 0; row < ROWS_COUNT; row++) {
      col.push(strip[(offset + row) % strip.length]);
    }
    visible.push(col);
  }
  return visible;
}

async function readSlotsPaytable(): Promise<Paytable> {
  const result = await db.execute(
    sql`SELECT payout_table FROM game_config WHERE game_type = 'slots' LIMIT 1`,
  );
  const row = (result as any)[0]?.[0];
  if (!row) {
    throw new Error('slots row not found in game_config');
  }
  const raw = row.payout_table;
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!parsed?.reels || !parsed?.lines || !parsed?.payouts) {
    throw new Error('slots payoutTable missing reels / lines / payouts');
  }
  return parsed as Paytable;
}

function simulate(paytable: Paytable, spins: number, activeLines: number, betPerLine: number) {
  const totalBet = betPerLine * activeLines;
  let totalWagered = 0;
  let totalReturned = 0;
  let winningSpins = 0;
  const hitsBySymbol: Record<string, number> = {};
  const hitsByCount: Record<string, number> = { '3': 0, '4': 0, '5': 0 };
  let biggestWin = 0;

  for (let i = 0; i < spins; i++) {
    totalWagered += totalBet;
    const visible = drawVisible(paytable.reels);
    const { hits, totalPayout } = evaluateSpin(
      visible,
      activeLines,
      { reels: paytable.reels, lines: paytable.lines, payouts: paytable.payouts },
      betPerLine,
    );
    if (totalPayout > 0) {
      winningSpins++;
      totalReturned += totalPayout;
      if (totalPayout > biggestWin) biggestWin = totalPayout;
      for (const h of hits) {
        hitsBySymbol[h.symbol] = (hitsBySymbol[h.symbol] ?? 0) + 1;
        hitsByCount[String(h.count)] = (hitsByCount[String(h.count)] ?? 0) + 1;
      }
    }
  }

  const rtp = totalReturned / totalWagered;
  return { totalWagered, totalReturned, winningSpins, hitsBySymbol, hitsByCount, biggestWin, rtp };
}

async function main() {
  const spins = Number(process.argv[2] || 1_000_000);
  if (!Number.isFinite(spins) || spins <= 0) {
    console.error('Invalid spins count');
    process.exit(1);
  }

  await connectDB();
  const paytable = await readSlotsPaytable();
  console.log(`Loaded slots paytable: ${paytable.symbols?.length ?? 0} symbols, ${paytable.lines.length} lines, reel length ${paytable.reels[0].length}`);

  const scenarios = [
    { activeLines: 1, betPerLine: 1 },
    { activeLines: 3, betPerLine: 1 },
    { activeLines: 5, betPerLine: 1 },
  ];

  console.log(`Running ${spins.toLocaleString()} spins per scenario...\n`);
  for (const { activeLines, betPerLine } of scenarios) {
    const t0 = Date.now();
    const r = simulate(paytable, spins, activeLines, betPerLine);
    const ms = Date.now() - t0;
    console.log(`--- ${activeLines} line(s) @ ${betPerLine} per line (${ms} ms) ---`);
    console.log(`  Wagered:        ${r.totalWagered.toLocaleString()}`);
    console.log(`  Returned:       ${r.totalReturned.toFixed(2)}`);
    console.log(`  RTP:            ${(r.rtp * 100).toFixed(3)}%`);
    console.log(`  House edge:     ${((1 - r.rtp) * 100).toFixed(3)}%`);
    console.log(`  Winning spins:  ${r.winningSpins.toLocaleString()} (${((r.winningSpins / spins) * 100).toFixed(2)}%)`);
    console.log(`  Biggest win:    ${r.biggestWin.toFixed(2)}x betPerLine`);
    console.log(`  Hits by count:  3=${r.hitsByCount['3']}  4=${r.hitsByCount['4']}  5=${r.hitsByCount['5']}`);
    console.log(`  Hits by symbol:`, r.hitsBySymbol);
    console.log();
  }

  await closeDB();
}

main().catch(async (err) => {
  console.error('Simulation failed:', err);
  try { await closeDB(); } catch {}
  process.exit(1);
});
