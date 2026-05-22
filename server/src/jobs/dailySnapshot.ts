import snapshotService from '../services/snapshotService.js';
import LoggingService from '../services/loggingService.js';

// 00:05 UTC daily — five minutes after midnight to let any in-flight
// transactions on the boundary commit before we aggregate.
const RUN_HOUR_UTC = 0;
const RUN_MINUTE_UTC = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

let scheduledTimeout: NodeJS.Timeout | null = null;
let runningInterval: NodeJS.Timeout | null = null;

/**
 * Format a Date as a 'YYYY-MM-DD' UTC string.
 */
function toUtcDateString(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Compute 'yesterday UTC' as a YYYY-MM-DD string at the moment of call.
 */
function yesterdayUtc(): string {
  const now = new Date();
  const yesterday = new Date(now.getTime() - DAY_MS);
  return toUtcDateString(yesterday);
}

/**
 * Milliseconds until the next 00:05 UTC.
 */
function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    RUN_HOUR_UTC,
    RUN_MINUTE_UTC,
    0,
    0,
  ));
  if (next.getTime() <= now.getTime()) {
    return next.getTime() + DAY_MS - now.getTime();
  }
  return next.getTime() - now.getTime();
}

/**
 * Run a single snapshot for 'yesterday UTC'.
 */
async function runOnce(): Promise<void> {
  const date = yesterdayUtc();
  try {
    const saved = await snapshotService.saveSnapshot(date);
    LoggingService.logSystemEvent('daily_snapshot_run', {
      date,
      ggr: saved.ggr,
      ngr: saved.ngr,
      houseBalanceClose: saved.houseBalanceClose,
    });
  } catch (err) {
    LoggingService.logSystemEvent('daily_snapshot_run_failed', {
      date,
      error: (err as Error)?.message,
    }, 'error');
  }
}

/**
 * Start the daily-snapshot scheduler. Idempotent — calling twice is a no-op.
 *
 * On boot we also check whether yesterday's snapshot already exists; if not,
 * run it once so server restarts don't leave gaps.
 */
export function startDailySnapshotJob(): void {
  if (scheduledTimeout || runningInterval) return;

  // Catch-up check on boot.
  (async () => {
    try {
      const date = yesterdayUtc();
      const already = await snapshotService.exists(date);
      if (!already) {
        await runOnce();
      }
    } catch (err) {
      LoggingService.logSystemEvent('daily_snapshot_boot_check_failed', {
        error: (err as Error)?.message,
      }, 'error');
    }
  })();

  // Schedule the first real run at the next 00:05 UTC.
  scheduledTimeout = setTimeout(() => {
    runOnce();
    runningInterval = setInterval(() => { runOnce(); }, DAY_MS);
  }, msUntilNextRun());

  LoggingService.logSystemEvent('daily_snapshot_job_started', {
    nextRunInMs: msUntilNextRun(),
  });
}

/**
 * Stop the scheduler. Used by tests and during graceful shutdown.
 */
export function stopDailySnapshotJob(): void {
  if (scheduledTimeout) {
    clearTimeout(scheduledTimeout);
    scheduledTimeout = null;
  }
  if (runningInterval) {
    clearInterval(runningInterval);
    runningInterval = null;
  }
}

// Exposed for tests.
export const _internal = { yesterdayUtc, msUntilNextRun, runOnce, toUtcDateString };
