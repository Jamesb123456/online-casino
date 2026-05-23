// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockLogSystemEvent } = vi.hoisted(() => ({
  mockLogSystemEvent: vi.fn(),
}));

vi.mock('../../services/loggingService.js', () => ({
  default: {
    logSystemEvent: mockLogSystemEvent,
  },
}));

import { unwrapRows } from '../../services/_dbHelpers.js';

describe('unwrapRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the inner rows from a mysql2 [rows, fields] tuple', () => {
    const rows = [{ id: 1, name: 'alice' }];
    const result = unwrapRows<{ id: number; name: string }>([rows, []]);
    expect(result).toEqual(rows);
    expect(mockLogSystemEvent).not.toHaveBeenCalled();
  });

  it('returns a plain row array unchanged', () => {
    const rows = [{ id: 1 }, { id: 2 }];
    const result = unwrapRows<{ id: number }>(rows);
    expect(result).toEqual(rows);
    expect(mockLogSystemEvent).not.toHaveBeenCalled();
  });

  it('returns rows from a { rows, fields } object envelope', () => {
    const rows = [{ id: 7, name: 'bob' }];
    const result = unwrapRows<{ id: number; name: string }>({ rows, fields: [] });
    expect(result).toEqual(rows);
    expect(mockLogSystemEvent).not.toHaveBeenCalled();
  });

  it('returns [] for null', () => {
    const result = unwrapRows(null);
    expect(result).toEqual([]);
    expect(mockLogSystemEvent).not.toHaveBeenCalled();
  });

  it('returns [] for undefined', () => {
    const result = unwrapRows(undefined);
    expect(result).toEqual([]);
    expect(mockLogSystemEvent).not.toHaveBeenCalled();
  });

  it('returns [] for an empty array envelope (no rows yet)', () => {
    const result = unwrapRows([]);
    expect(result).toEqual([]);
    expect(mockLogSystemEvent).not.toHaveBeenCalled();
  });

  it('logs a warning and returns [] for an unknown object shape', () => {
    const result = unwrapRows({ unexpected: true, count: 0 });
    expect(result).toEqual([]);
    expect(mockLogSystemEvent).toHaveBeenCalledTimes(1);
    const [event, meta, level] = mockLogSystemEvent.mock.calls[0];
    expect(event).toBe('db_unwrap_rows_unknown_shape');
    expect(level).toBe('warn');
    expect(meta.typeofResult).toBe('object');
    expect(meta.keys).toEqual(['unexpected', 'count']);
  });

  it('logs a warning and returns [] for a non-array, non-object primitive', () => {
    const result = unwrapRows('totally unexpected' as unknown);
    expect(result).toEqual([]);
    expect(mockLogSystemEvent).toHaveBeenCalledTimes(1);
    const [event, meta, level] = mockLogSystemEvent.mock.calls[0];
    expect(event).toBe('db_unwrap_rows_unknown_shape');
    expect(level).toBe('warn');
    expect(meta.typeofResult).toBe('string');
    expect(meta.keys).toBeNull();
  });
});
