// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockSweep, mockLogSystemEvent } = vi.hoisted(() => ({
  mockSweep: vi.fn(),
  mockLogSystemEvent: vi.fn(),
}));

vi.mock('../../services/tournamentService.js', () => ({
  default: { sweepStatusTransitions: mockSweep },
}));

vi.mock('../../services/loggingService.js', () => ({
  default: { logSystemEvent: mockLogSystemEvent },
}));

import {
  startTournamentSweeperJob,
  stopTournamentSweeperJob,
  _internal,
} from '../../jobs/tournamentSweeper.js';

async function flushMicrotasks(times = 10) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

describe('tournamentSweeper job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSweep.mockResolvedValue(undefined);
  });

  afterEach(() => {
    stopTournamentSweeperJob();
    vi.useRealTimers();
  });

  describe('_internal.runOnce', () => {
    it('invokes tournamentService.sweepStatusTransitions', async () => {
      await _internal.runOnce();
      expect(mockSweep).toHaveBeenCalledTimes(1);
    });

    it('logs an error when sweep throws and does not rethrow', async () => {
      mockSweep.mockRejectedValueOnce(new Error('sweep broke'));

      await expect(_internal.runOnce()).resolves.toBeUndefined();

      expect(mockLogSystemEvent).toHaveBeenCalledWith(
        'tournament_sweeper_run_failed',
        expect.objectContaining({ error: 'sweep broke' }),
        'error',
      );
    });
  });

  describe('SWEEP_INTERVAL_MS', () => {
    it('runs once a minute', () => {
      expect(_internal.SWEEP_INTERVAL_MS).toBe(60_000);
    });
  });

  describe('startTournamentSweeperJob()', () => {
    it('runs once immediately and logs a started event', async () => {
      startTournamentSweeperJob();
      await flushMicrotasks();

      expect(mockSweep).toHaveBeenCalledTimes(1);
      expect(mockLogSystemEvent).toHaveBeenCalledWith(
        'tournament_sweeper_started',
        { intervalMs: 60_000 },
      );
    });

    it('fires sweep again on each 60-second interval', async () => {
      startTournamentSweeperJob();
      await flushMicrotasks();
      expect(mockSweep).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockSweep).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockSweep).toHaveBeenCalledTimes(3);
    });

    it('is idempotent — a second call is a no-op', async () => {
      startTournamentSweeperJob();
      await flushMicrotasks();
      const firstStartCount = mockLogSystemEvent.mock.calls.filter(
        (c) => c[0] === 'tournament_sweeper_started',
      ).length;

      startTournamentSweeperJob();
      await flushMicrotasks();
      const secondStartCount = mockLogSystemEvent.mock.calls.filter(
        (c) => c[0] === 'tournament_sweeper_started',
      ).length;

      expect(firstStartCount).toBe(1);
      expect(secondStartCount).toBe(1);
    });

    it('keeps running even if a sweep call fails (failure is swallowed)', async () => {
      mockSweep.mockRejectedValueOnce(new Error('first fail'));
      startTournamentSweeperJob();
      await flushMicrotasks();

      // Make subsequent sweeps succeed
      mockSweep.mockResolvedValue(undefined);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockSweep).toHaveBeenCalledTimes(2);
    });
  });

  describe('stopTournamentSweeperJob()', () => {
    it('clears the interval', async () => {
      startTournamentSweeperJob();
      await flushMicrotasks();
      expect(mockSweep).toHaveBeenCalledTimes(1);

      stopTournamentSweeperJob();

      await vi.advanceTimersByTimeAsync(5 * 60_000);
      expect(mockSweep).toHaveBeenCalledTimes(1);
    });

    it('is safe to call when the job was never started', () => {
      expect(() => stopTournamentSweeperJob()).not.toThrow();
    });
  });
});
