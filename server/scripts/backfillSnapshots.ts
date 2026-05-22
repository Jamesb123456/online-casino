/**
 * Backfill daily snapshots over a date range.
 *
 * Usage:
 *   npm run backfill:snapshots -- --days=30
 *   npm run backfill:snapshots -- --from=2026-04-01 --to=2026-04-30
 *
 * Runs in series to avoid hammering the DB.
 */

import 'dotenv/config';
import snapshotService from '../src/services/snapshotService.js';
import { closeDB } from '../drizzle/db.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcDateString(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseArgs(argv: string[]): { from: string; to: string } {
  const args: Record<string, string> = {};
  for (const arg of argv) {
    const m = arg.match(/^--([\w-]+)=(.+)$/);
    if (m) args[m[1]] = m[2];
  }

  if (args.from && args.to) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.from) || !/^\d{4}-\d{2}-\d{2}$/.test(args.to)) {
      throw new Error('Invalid --from / --to format. Expected YYYY-MM-DD.');
    }
    return { from: args.from, to: args.to };
  }

  const days = Number(args.days || 30);
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error('--days must be a positive integer');
  }

  // Default: backfill the last N days, ending yesterday (UTC).
  const today = new Date();
  const yesterday = new Date(today.getTime() - DAY_MS);
  const start = new Date(yesterday.getTime() - (days - 1) * DAY_MS);

  return { from: toUtcDateString(start), to: toUtcDateString(yesterday) };
}

function* iterDates(from: string, to: string): Generator<string> {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  for (let t = start; t <= end; t += DAY_MS) {
    yield toUtcDateString(new Date(t));
  }
}

async function main(): Promise<void> {
  const { from, to } = parseArgs(process.argv.slice(2));
  console.log(`Backfilling daily snapshots from ${from} to ${to} (inclusive)...`);

  let okCount = 0;
  let failCount = 0;
  for (const date of iterDates(from, to)) {
    try {
      const row = await snapshotService.saveSnapshot(date);
      okCount++;
      console.log(
        `  ${date}  GGR=${row.ggr}  NGR=${row.ngr}  bets=${row.totalBets}  wins=${row.totalWins}  ` +
        `active=${row.activePlayerCount}  new=${row.newPlayerCount}  houseClose=${row.houseBalanceClose}`
      );
    } catch (err) {
      failCount++;
      console.error(`  ${date}  FAILED: ${(err as Error)?.message}`);
    }
  }

  console.log(`\nDone. ${okCount} succeeded, ${failCount} failed.`);
}

main()
  .then(async () => {
    await closeDB();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Fatal:', err);
    await closeDB().catch(() => undefined);
    process.exit(1);
  });
