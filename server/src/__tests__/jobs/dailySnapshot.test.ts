// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks for the snapshotService and LoggingService
// ---------------------------------------------------------------------------
const { mockSaveSnapshot, mockExists, mockLogSystemEvent } = vi.hoisted(() => ({
  mockSaveSnapshot: vi.fn(),
  mockExists: vi.fn(),
  mockLogSystemEvent: vi.fn(),
}));

vi.mock('../../services/snapshotService.js', () => ({
  default: {
    saveSnapshot: mockSaveSnapshot,
    exists: mockExists,
  },
}));

vi.mock('../../services/loggingService.js', () => ({
  default: { logSystemEvent: mockLogSystemEvent },
}));

import {
  startDailySnapshotJob,
  stopDailySnapshotJob,
  _internal,
} from '../../jobs/dailySnapshot.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const SAVED_SNAPSHOT = {
  ggr: '500.00',
  ngr: '450.00',
  houseBalanceClose: '500000.00',
};

async function flushMicrotasks(times = 10) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('dailySnapshot job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSaveSnapshot.mockResolvedValue(SAVED_SNAPSHOT);
    mockExists.mockResolvedValue(true); // default: don't run catch-up
  });

  afterEach(() => {
    stopDailySnapshotJob();
    vi.useRealTimers();
  });

  describe('_internal.toUtcDateString / yesterdayUtc', () => {
    it('formats a Date as YYYY-MM-DD in UTC', () => {
      const d = new Date(Date.UTC(2026, 4, 19, 23, 59, 59)); // 2026-05-19 23:59:59 UTC
      expect(_internal.toUtcDateString(d)).toBe('2026-05-19');
    });

    it('yesterdayUtc returns the UTC date 24h before now', () => {
      vi.setSystemTime(new Date(Date.UTC(2026, 4, 20, 12, 0, 0))); // 2026-05-20 12:00 UTC
      expect(_internal.yesterdayUtc()).toBe('2026-05-19');
    });
  });

  describe('_internal.msUntilNextRun', () => {
    it('returns ms until today 00:05 UTC if it has not happened yet', () => {
      vi.setSystemTime(new Date(Date.UTC(2026, 4, 20, 0, 0, 0))); // 2026-05-20 00:00 UTC
      // Expected: 5 minutes
      expect(_internal.msUntilNextRun()).toBe(5 * 60 * 1000);
    });

    it('rolls forward to tomorrow 00:05 UTC if we are already past it', () => {
      vi.setSystemTime(new Date(Date.UTC(2026, 4, 20, 1, 0, 0))); // 2026-05-20 01:00 UTC
      // Next run: 2026-05-21 00:05 UTC = 23h 5m away
      expect(_internal.msUntilNextRun()).toBe((23 * 60 + 5) * 60 * 1000);
    });
  });

  describe('_internal.runOnce', () => {
    it('saves a snapshot for yesterday and logs success', async () => {
      vi.setSystemTime(new Date(Date.UTC(2026, 4, 20, 0, 6, 0)));
      await _internal.runOnce();

      expect(mockSaveSnapshot).toHaveBeenCalledWith('2026-05-19');
      expect(mockLogSystemEvent).toHaveBeenCalledWith(
        'daily_snapshot_run',
        expect.objectContaining({
          date: '2026-05-19',
          ggr: '500.00',
          ngr: '450.00',
        }),
      );
    });

    it('logs failure when saveSnapshot throws', async () => {
      vi.setSystemTime(new Date(Date.UTC(2026, 4, 20, 0, 6, 0)));
      mockSaveSnapshot.mockRejectedValueOnce(new Error('save broken'));

      await _internal.runOnce();

      expect(mockLogSystemEvent).toHaveBeenCalledWith(
        'daily_snapshot_run_failed',
        expect.objectContaining({ date: '2026-05-19', error: 'save broken' }),
        'error',
      );
    });
  });

  describe('startDailySnapshotJob()', () => {
    it('logs a job_started event with the scheduled offset', async () => {
      vi.setSystemTime(new Date(Date.UTC(2026, 4, 20, 0, 0, 0)));
      startDailySnapshotJob();
      await flushMicrotasks();

      expect(mockLogSystemEvent).toHaveBeenCalledWith(
        'daily_snapshot_job_started',
        expect.objectContaining({ nextRunInMs: expect.any(Number) }),
      );
    });

    it('skips the catch-up run when yesterday already has a snapshot', async () => {
      mockExists.mockResolvedValue(true);
      vi.setSystemTime(new Date(Date.UTC(2026, 4, 20, 0, 0, 0)));

      startDailySnapshotJob();
      await flushMicrotasks();

      expect(mockExists).toHaveBeenCalledWith('2026-05-19');
      expect(mockSaveSnapshot).not.toHaveBeenCalled();
    });

    it('runs a catch-up snapshot when yesterday has no snapshot', async () => {
      mockExists.mockResolvedValue(false);
      vi.setSystemTime(new Date(Date.UTC(2026, 4, 20, 0, 0, 0)));

      startDailySnapshotJob();
      await flushMicrotasks();

      expect(mockSaveSnapshot).toHaveBeenCalledWith('2026-05-19');
    });

    it('logs an error when the boot catch-up check itself fails', async () => {
      mockExists.mockRejectedValue(new Error('exists broke'));
      vi.setSystemTime(new Date(Date.UTC(2026, 4, 20, 0, 0, 0)));

      startDailySnapshotJob();
      await flushMicrotasks();

      expect(mockLogSystemEvent).toHaveBeenCalledWith(
        'daily_snapshot_boot_check_failed',
        expect.objectContaining({ error: 'exists broke' }),
        'error',
      );
    });

    it('is idempotent — a second call is a no-op', async () => {
      vi.setSystemTime(new Date(Date.UTC(2026, 4, 20, 0, 0, 0)));

      startDailySnapshotJob();
      await flushMicrotasks();
      const firstCount = mockLogSystemEvent.mock.calls.filter(
        (c) => c[0] === 'daily_snapshot_job_started',
      ).length;

      startDailySnapshotJob();
      await flushMicrotasks();
      const secondCount = mockLogSystemEvent.mock.calls.filter(
        (c) => c[0] === 'daily_snapshot_job_started',
      ).length;

      expect(firstCount).toBe(1);
      expect(secondCount).toBe(1);
    });

    it('fires runOnce at the scheduled timeout and then on every daily interval', async () => {
      vi.setSystemTime(new Date(Date.UTC(2026, 4, 20, 0, 0, 0)));
      startDailySnapshotJob();
      await flushMicrotasks();

      // The boot catch-up already exists, so saveSnapshot starts at 0 calls.
      expect(mockSaveSnapshot).not.toHaveBeenCalled();

      // Advance to the scheduled fire time (5 minutes later).
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      // First scheduled run
      expect(mockSaveSnapshot).toHaveBeenCalledTimes(1);

      // Advance one full day to fire the interval once
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(mockSaveSnapshot).toHaveBeenCalledTimes(2);
    });
  });

  describe('stopDailySnapshotJob()', () => {
    it('clears both the timeout and the interval', async () => {
      vi.setSystemTime(new Date(Date.UTC(2026, 4, 20, 0, 0, 0)));
      startDailySnapshotJob();
      await flushMicrotasks();

      // Advance to fire the scheduled timeout (so interval gets set)
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
      expect(mockSaveSnapshot).toHaveBeenCalledTimes(1);

      stopDailySnapshotJob();

      // After stop, advancing further should NOT trigger more saves
      await vi.advanceTimersByTimeAsync(48 * 60 * 60 * 1000);
      expect(mockSaveSnapshot).toHaveBeenCalledTimes(1);
    });

    it('is safe to call when the job was never started', () => {
      expect(() => stopDailySnapshotJob()).not.toThrow();
    });
  });
});
