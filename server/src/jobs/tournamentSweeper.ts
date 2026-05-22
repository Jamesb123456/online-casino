import tournamentService from '../services/tournamentService.js';
import LoggingService from '../services/loggingService.js';

const SWEEP_INTERVAL_MS = 60_000;

let sweepInterval: NodeJS.Timeout | null = null;

async function runOnce(): Promise<void> {
  try {
    await tournamentService.sweepStatusTransitions();
  } catch (err) {
    LoggingService.logSystemEvent('tournament_sweeper_run_failed', {
      error: (err as Error)?.message,
    }, 'error');
  }
}

/**
 * Start the tournament status-transition sweeper. Idempotent — calling twice
 * is a no-op. Runs immediately on start and then every 60s.
 */
export function startTournamentSweeperJob(): void {
  if (sweepInterval) return;
  runOnce();
  sweepInterval = setInterval(() => { runOnce(); }, SWEEP_INTERVAL_MS);
  LoggingService.logSystemEvent('tournament_sweeper_started', { intervalMs: SWEEP_INTERVAL_MS });
}

export function stopTournamentSweeperJob(): void {
  if (sweepInterval) {
    clearInterval(sweepInterval);
    sweepInterval = null;
  }
}

// Exposed for tests.
export const _internal = { runOnce, SWEEP_INTERVAL_MS };
