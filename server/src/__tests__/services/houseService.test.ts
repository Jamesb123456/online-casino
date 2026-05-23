// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock('../../../drizzle/db.js', () => ({
  db: {
    execute: mockExecute,
  },
}));

// Pass-through sql tag so the service can build queries unaltered.
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    sql: Object.assign(
      (...args: any[]) => args,
      { join: (...args: any[]) => args },
    ),
  };
});

vi.mock('./loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  },
}));

vi.mock('./alertService.js', () => ({
  default: {
    checkHouseLow: vi.fn().mockResolvedValue(undefined),
  },
}));

import HouseService from '../../services/houseService.js';

describe('HouseService.getTransactions()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { rawRows, total } with no filters applied', async () => {
    const sampleRow = {
      id: 1,
      type: 'admin_topup',
      amount: '500000.00',
      balance_before: '0.00',
      balance_after: '500000.00',
      user_id: null,
      user_username: null,
      admin_id: 1,
      admin_username: 'admin',
      game_type: null,
      game_session_id: null,
      transaction_id: null,
      reason: 'Initial',
      metadata: null,
      created_at: '2026-05-19T00:00:00.000Z',
    };

    mockExecute
      .mockResolvedValueOnce([[sampleRow]])    // rows query
      .mockResolvedValueOnce([[{ total: 1 }]]); // count query

    const result = await HouseService.getTransactions({ limit: 50, offset: 0 });

    expect(result).toEqual({ rawRows: [sampleRow], total: 1 });
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it('falls back to empty array and total=0 when DB returns nothing', async () => {
    mockExecute
      .mockResolvedValueOnce([undefined])   // [0] is undefined → fallback to []
      .mockResolvedValueOnce([[]]);          // empty count rows → coerces to 0

    const result = await HouseService.getTransactions({ limit: 50, offset: 0 });

    expect(result.rawRows).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('coerces total from string to number', async () => {
    mockExecute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ total: '42' }]]);

    const result = await HouseService.getTransactions({ limit: 50, offset: 0 });

    expect(result.total).toBe(42);
    expect(typeof result.total).toBe('number');
  });

  it('passes type/from/to filters through to the SQL builder without throwing', async () => {
    mockExecute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ total: 0 }]]);

    const result = await HouseService.getTransactions({
      limit: 10,
      offset: 5,
      type: 'admin_topup',
      from: '2026-05-01',
      to: '2026-05-31',
    });

    expect(result).toEqual({ rawRows: [], total: 0 });
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it('treats null filters as absent (no extra WHERE conditions)', async () => {
    mockExecute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ total: 0 }]]);

    const result = await HouseService.getTransactions({
      limit: 50,
      offset: 0,
      type: null,
      from: null,
      to: null,
    });

    expect(result).toEqual({ rawRows: [], total: 0 });
  });

  it('propagates DB errors from the rows query', async () => {
    mockExecute.mockRejectedValueOnce(new Error('rows boom'));

    await expect(
      HouseService.getTransactions({ limit: 50, offset: 0 }),
    ).rejects.toThrow('rows boom');
  });

  it('propagates DB errors from the count query', async () => {
    mockExecute
      .mockResolvedValueOnce([[]])
      .mockRejectedValueOnce(new Error('count boom'));

    await expect(
      HouseService.getTransactions({ limit: 50, offset: 0 }),
    ).rejects.toThrow('count boom');
  });
});
