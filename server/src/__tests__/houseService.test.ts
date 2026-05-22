// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks -- use vi.hoisted so variables are available in vi.mock factories
// ---------------------------------------------------------------------------

const {
  mockTransaction,
  mockExecute,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockExecute: vi.fn(),
}));

vi.mock('../../drizzle/db.js', () => ({
  db: {
    execute: mockExecute,
    transaction: mockTransaction,
  },
}));

vi.mock('drizzle-orm', () => ({
  sql: vi.fn((...args) => args),
  eq: vi.fn((...args) => args),
  and: vi.fn((...args) => args),
  desc: vi.fn((...args) => args),
  relations: vi.fn(() => ({})),
}));

vi.mock('../services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  },
}));

const {
  mockCheckHouseLow,
} = vi.hoisted(() => ({
  mockCheckHouseLow: vi.fn(),
}));

vi.mock('../services/alertService.js', () => ({
  default: {
    checkHouseLow: mockCheckHouseLow,
    checkBigWin: vi.fn(),
    checkRapidBets: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import module under test (after mocks)
// ---------------------------------------------------------------------------

import HouseService from '../services/houseService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a tx mock whose `execute` returns the supplied results in order.
 * Each item is whatever `execute` should resolve to.
 */
function buildTx(execResults: any[]) {
  const exec = vi.fn();
  for (const r of execResults) {
    exec.mockResolvedValueOnce(r);
  }
  return { execute: exec };
}

// Force the cap cache to be fresh per-test.
function resetCapCache() {
  (HouseService as any)._capCache = null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HouseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCapCache();
    // Default: alert check resolves silently so fire-and-forget doesn't reject.
    mockCheckHouseLow.mockResolvedValue(undefined);
  });

  // -----------------------------------------------------------------------
  // getHouseBalance
  // -----------------------------------------------------------------------
  describe('getHouseBalance()', () => {
    it('returns 0 when no house_account row exists', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const bal = await HouseService.getHouseBalance();
      expect(bal).toBe(0);
    });

    it('returns the row balance as a number', async () => {
      mockExecute.mockResolvedValueOnce([[{ balance: '1234.56' }]]);
      const bal = await HouseService.getHouseBalance();
      expect(bal).toBe(1234.56);
    });
  });

  // -----------------------------------------------------------------------
  // setHouseBalance (admin top-up)
  // -----------------------------------------------------------------------
  describe('setHouseBalance()', () => {
    it('sets the balance to the target value and writes an admin_topup audit row', async () => {
      // Inside the tx: SELECT FOR UPDATE -> empty -> INSERT row -> SELECT FOR UPDATE -> row, then UPDATE, then INSERT audit
      const tx = buildTx([
        [[]],                              // initial SELECT FOR UPDATE -> empty
        undefined,                          // INSERT house_account
        [[{ id: 1, balance: '0' }]],       // SELECT FOR UPDATE again -> the new row
        undefined,                          // UPDATE house_account
        undefined,                          // INSERT house_transactions
      ]);
      mockTransaction.mockImplementation(async (cb) => cb(tx));

      const result = await HouseService.setHouseBalance(1000000, 99, 'initial');

      expect(result.balanceAfter).toBe(1000000);
      // 5 execute calls inside the tx
      expect(tx.execute).toHaveBeenCalledTimes(5);
      // Last call is the audit INSERT — verify the SQL fragments contain admin_topup
      const lastCallArgs = tx.execute.mock.calls[4][0];
      const flat = JSON.stringify(lastCallArgs);
      expect(flat).toContain('admin_topup');
    });
  });

  // -----------------------------------------------------------------------
  // creditHouse
  // -----------------------------------------------------------------------
  describe('creditHouse()', () => {
    it('adds the amount to the house balance and writes a bet_credit audit row', async () => {
      const tx = buildTx([
        [[{ id: 1, balance: '500.00' }]],  // SELECT FOR UPDATE
        undefined,                          // UPDATE
        undefined,                          // INSERT audit
      ]);
      mockTransaction.mockImplementation(async (cb) => cb(tx));

      const result = await HouseService.creditHouse(100, {
        userId: 7,
        gameType: 'crash',
        transactionId: 42,
        reason: 'bet',
      });

      expect(result.balanceAfter).toBe(600);
      const lastCallArgs = tx.execute.mock.calls[2][0];
      const flat = JSON.stringify(lastCallArgs);
      expect(flat).toContain('bet_credit');
    });
  });

  // -----------------------------------------------------------------------
  // debitHouse
  // -----------------------------------------------------------------------
  describe('debitHouse()', () => {
    it('subtracts the amount from the house balance and writes a payout_debit audit row', async () => {
      const tx = buildTx([
        [[{ id: 1, balance: '500.00' }]],
        undefined,
        undefined,
      ]);
      mockTransaction.mockImplementation(async (cb) => cb(tx));

      const result = await HouseService.debitHouse(100, {
        userId: 7,
        gameType: 'crash',
        transactionId: 43,
        reason: 'win',
      });

      expect(result.balanceAfter).toBe(400);
      const lastCallArgs = tx.execute.mock.calls[2][0];
      const flat = JSON.stringify(lastCallArgs);
      expect(flat).toContain('payout_debit');
    });

    it('reuses the caller-provided tx without opening a new transaction', async () => {
      const tx = buildTx([
        [[{ id: 1, balance: '500.00' }]],
        undefined,
        undefined,
      ]);

      const result = await HouseService.debitHouse(50, { userId: 1 }, tx);

      expect(result.balanceAfter).toBe(450);
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // canPayout
  // -----------------------------------------------------------------------
  describe('canPayout()', () => {
    it('returns { ok: false, reason: "cap_round" } when amount exceeds the per-round cap', async () => {
      // First execute: settings lookup -> empty (use defaults: perRound = 1_000_000)
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await HouseService.canPayout(5_000_000, 1, 'crash');

      expect(result).toEqual({ ok: false, reason: 'cap_round' });
    });

    it('returns { ok: false, reason: "house_insufficient" } when house balance < amount', async () => {
      // 1. settings lookup -> empty (defaults)
      mockExecute.mockResolvedValueOnce([[]]);
      // 2. per-user daily sum
      mockExecute.mockResolvedValueOnce([[{ total: '0' }]]);
      // 3. getHouseBalance -> only 50
      mockExecute.mockResolvedValueOnce([[{ balance: '50.00' }]]);

      const result = await HouseService.canPayout(100, 1, 'crash');

      expect(result).toEqual({ ok: false, reason: 'house_insufficient' });
    });

    it('returns { ok: true } for a valid small payout under all caps', async () => {
      // 1. settings lookup -> empty (defaults)
      mockExecute.mockResolvedValueOnce([[]]);
      // 2. per-user daily sum -> 0
      mockExecute.mockResolvedValueOnce([[{ total: '0' }]]);
      // 3. getHouseBalance -> plenty
      mockExecute.mockResolvedValueOnce([[{ balance: '10000.00' }]]);

      const result = await HouseService.canPayout(100, 1, 'crash');

      expect(result).toEqual({ ok: true });
    });
  });

  // -----------------------------------------------------------------------
  // Sanity: initial balance is 0
  // -----------------------------------------------------------------------
  describe('initial state', () => {
    it('treats a missing house_account row as a 0 balance', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      const bal = await HouseService.getHouseBalance();
      expect(bal).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // canPayout — cap / house-insufficient path with alert mock verified
  // -----------------------------------------------------------------------
  describe('canPayout() cap/alert path', () => {
    it('returns ok:false reason:house_insufficient when payout exceeds house balance', async () => {
      // 1. settings lookup -> empty (use default caps)
      mockExecute.mockResolvedValueOnce([[]]);
      // 2. per-user daily sum -> 0
      mockExecute.mockResolvedValueOnce([[{ total: '0' }]]);
      // 3. getHouseBalance -> too low to cover payout
      mockExecute.mockResolvedValueOnce([[{ balance: '10.00' }]]);

      const result = await HouseService.canPayout(500, 1, 'crash');

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('house_insufficient');
      // canPayout is a pure preflight — it should NOT fire the alert pipeline.
      // The alert is fired only when an actual debit/credit lands via _applyDelta.
      expect(mockCheckHouseLow).not.toHaveBeenCalled();
    });

    it('still flags cap_round before reaching the house-balance check (alert pipeline untouched)', async () => {
      // settings lookup -> empty (defaults: perRound = 1_000_000)
      mockExecute.mockResolvedValueOnce([[]]);

      const result = await HouseService.canPayout(2_000_000, 42, 'wheel');

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('cap_round');
      expect(mockCheckHouseLow).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // debitHouse — solvency floor + alert
  // -----------------------------------------------------------------------
  describe('debitHouse() floor + alert', () => {
    it('rejects when debit would drive the house balance below the zero floor', async () => {
      // SELECT FOR UPDATE returns a balance smaller than the requested debit.
      // _applyDelta should throw payout_blocked:house_insufficient.
      const tx = buildTx([
        [[{ id: 1, balance: '50.00' }]], // SELECT FOR UPDATE
      ]);
      mockTransaction.mockImplementation(async (cb) => cb(tx));

      await expect(
        HouseService.debitHouse(100, { userId: 7, gameType: 'crash' }),
      ).rejects.toThrow(/house_insufficient/);

      // Because exec threw inside the transaction, the post-commit alert
      // hook must not have fired (no result to inspect).
      expect(mockCheckHouseLow).not.toHaveBeenCalled();
    });

    it('fires the house-low alert hook after a successful debit lands', async () => {
      const tx = buildTx([
        [[{ id: 1, balance: '1000.00' }]], // SELECT FOR UPDATE
        undefined,                          // UPDATE
        undefined,                          // INSERT audit
      ]);
      mockTransaction.mockImplementation(async (cb) => cb(tx));

      const result = await HouseService.debitHouse(250, { userId: 7, gameType: 'crash' });

      expect(result.balanceAfter).toBe(750);
      // Fire-and-forget alert hook is invoked with the post-debit balance.
      expect(mockCheckHouseLow).toHaveBeenCalledTimes(1);
      expect(mockCheckHouseLow).toHaveBeenCalledWith(750);
    });
  });

  // -----------------------------------------------------------------------
  // Concurrent credit + debit ordering
  // -----------------------------------------------------------------------
  describe('credit + debit ordering preserves final balance', () => {
    it('final balance after credit then debit equals starting + credit - debit', async () => {
      // First transaction: credit 200 onto a starting balance of 500.
      const creditTx = buildTx([
        [[{ id: 1, balance: '500.00' }]], // SELECT FOR UPDATE
        undefined,                          // UPDATE -> 700
        undefined,                          // INSERT audit
      ]);
      // Second transaction: debit 150 from 700.
      const debitTx = buildTx([
        [[{ id: 1, balance: '700.00' }]], // SELECT FOR UPDATE
        undefined,                          // UPDATE -> 550
        undefined,                          // INSERT audit
      ]);

      mockTransaction
        .mockImplementationOnce(async (cb) => cb(creditTx))
        .mockImplementationOnce(async (cb) => cb(debitTx));

      // Fire both "concurrently" — because each transaction takes a row lock,
      // their effects must apply in a defined order. The mock above models
      // credit-first, debit-second; the assertion below proves the final
      // balance equals 500 + 200 - 150 = 550.
      const [creditResult, debitResult] = await Promise.all([
        HouseService.creditHouse(200, { userId: 1, gameType: 'crash' }),
        HouseService.debitHouse(150, { userId: 1, gameType: 'crash' }),
      ]);

      expect(creditResult.balanceAfter).toBe(700);
      expect(debitResult.balanceAfter).toBe(550);
      // 500 + 200 - 150 = 550 — final balance == sum of signed deltas
      expect(debitResult.balanceAfter).toBe(500 + 200 - 150);
      // Alert hook fired once per landed movement.
      expect(mockCheckHouseLow).toHaveBeenCalledTimes(2);
    });

    it('reversed order (debit first, then credit) yields the same algebraic sum', async () => {
      const debitTx = buildTx([
        [[{ id: 1, balance: '500.00' }]],
        undefined,
        undefined,
      ]);
      const creditTx = buildTx([
        [[{ id: 1, balance: '350.00' }]],
        undefined,
        undefined,
      ]);

      mockTransaction
        .mockImplementationOnce(async (cb) => cb(debitTx))
        .mockImplementationOnce(async (cb) => cb(creditTx));

      const debitResult = await HouseService.debitHouse(150, { userId: 1, gameType: 'crash' });
      const creditResult = await HouseService.creditHouse(200, { userId: 1, gameType: 'crash' });

      expect(debitResult.balanceAfter).toBe(350);
      expect(creditResult.balanceAfter).toBe(550);
      // Order-independent: starting 500 with deltas (+200, -150) == 550.
      expect(creditResult.balanceAfter).toBe(500 + 200 - 150);
    });
  });

  // -----------------------------------------------------------------------
  // Coverage extensions
  // -----------------------------------------------------------------------
  describe('alert hook failure tolerance', () => {
    it('logs but never throws when checkHouseLow rejects after a credit', async () => {
      const tx = buildTx([
        [[{ id: 1, balance: '500.00' }]],
        undefined,
        undefined,
      ]);
      mockTransaction.mockImplementation(async (cb) => cb(tx));
      mockCheckHouseLow.mockRejectedValueOnce(new Error('alert_pipeline_down'));

      const result = await HouseService.creditHouse(100, { userId: 1, gameType: 'crash' });

      expect(result.balanceAfter).toBe(600);
      // Give the fire-and-forget catch a tick to run.
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  describe('topUp()', () => {
    it('rejects non-positive amounts', async () => {
      await expect(HouseService.topUp(0, 1)).rejects.toThrow('topup_amount_must_be_positive');
      await expect(HouseService.topUp(-50, 1)).rejects.toThrow('topup_amount_must_be_positive');
    });

    it('rejects non-finite amounts', async () => {
      await expect(HouseService.topUp(NaN, 1)).rejects.toThrow('topup_amount_must_be_positive');
    });

    it('applies a positive delta via _applyDelta and writes an admin_topup audit row', async () => {
      const tx = buildTx([
        [[{ id: 1, balance: '500.00' }]],
        undefined,
        undefined,
      ]);
      mockTransaction.mockImplementation(async (cb) => cb(tx));

      const result = await HouseService.topUp(250, 99, 'refill');

      expect(result.balanceAfter).toBe(750);
      const lastCallArgs = tx.execute.mock.calls[2][0];
      expect(JSON.stringify(lastCallArgs)).toContain('admin_topup');
    });
  });

  describe('setHouseBalance() — caller-provided tx', () => {
    it('reuses caller tx without opening a new transaction', async () => {
      const tx = buildTx([
        [[{ id: 1, balance: '500.00' }]], // SELECT FOR UPDATE
        undefined,                          // UPDATE
        undefined,                          // INSERT audit
      ]);
      const result = await HouseService.setHouseBalance(1000, 99, 'reset', tx);
      expect(result.balanceAfter).toBe(1000);
      expect(result.balanceBefore).toBe(500);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('writes admin_withdraw audit when delta is negative', async () => {
      const tx = buildTx([
        [[{ id: 1, balance: '1000.00' }]],
        undefined,
        undefined,
      ]);
      mockTransaction.mockImplementation(async (cb) => cb(tx));
      await HouseService.setHouseBalance(400, 99, 'partial drain');
      const auditCallArgs = tx.execute.mock.calls[2][0];
      expect(JSON.stringify(auditCallArgs)).toContain('admin_withdraw');
    });
  });

  describe('getCaps() caching and parsing', () => {
    it('returns the cached value on a second call within TTL', async () => {
      mockExecute.mockResolvedValueOnce([[
        { key: 'max_payout_per_round', value: '2000000' },
      ]]);
      const a = await HouseService.getCaps();
      const b = await HouseService.getCaps();
      expect(a.perRound).toBe(2000000);
      expect(a).toBe(b); // identity: same object reference returned from cache
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('passes through JSON-parsed string values', async () => {
      mockExecute.mockResolvedValueOnce([[
        { key: 'max_payout_per_round', value: '"7777"' },
      ]]);
      const caps = await HouseService.getCaps();
      expect(caps.perRound).toBe(7777);
    });

    it('falls back to the perDay default when neither row nor default is set', async () => {
      mockExecute.mockResolvedValueOnce([[]]); // no settings rows
      const caps = await HouseService.getCaps();
      // perDay default is null in the service, so we expect null.
      expect(caps.perDay).toBeNull();
    });

    it('honours a non-null perDay setting value', async () => {
      mockExecute.mockResolvedValueOnce([[
        { key: 'max_payout_per_day_global', value: '500000' },
      ]]);
      const caps = await HouseService.getCaps();
      expect(caps.perDay).toBe(500000);
    });
  });

  describe('setCap()', () => {
    it('rejects an unknown cap key', async () => {
      await expect(HouseService.setCap('bogus_key', 100, 1)).rejects.toThrow('invalid_cap_key');
    });

    it('writes the new value and clears the cap cache', async () => {
      // Pre-populate the cache so we can verify it gets cleared.
      mockExecute.mockResolvedValueOnce([[]]);
      await HouseService.getCaps();
      expect((HouseService as any)._capCache).not.toBeNull();

      mockExecute.mockResolvedValueOnce(undefined);
      await HouseService.setCap('max_payout_per_round', 12345, 99);
      expect((HouseService as any)._capCache).toBeNull();
    });
  });

  describe('canPayout() — additional branches', () => {
    it('returns cap_user_day when the user has already won close to their per-day cap', async () => {
      // Use a small per-user cap so we can blow it out with a modest payout.
      mockExecute.mockResolvedValueOnce([[
        { key: 'max_payout_per_user_per_day', value: '1000' },
      ]]);
      // Per-user daily sum already at 950 — adding 100 -> 1050 > 1000.
      mockExecute.mockResolvedValueOnce([[{ total: '950' }]]);

      const result = await HouseService.canPayout(100, 1, 'crash');
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('cap_user_day');
    });

    it('returns cap_day when the global per-day cap is exceeded', async () => {
      mockExecute.mockResolvedValueOnce([[
        { key: 'max_payout_per_day_global', value: '1000' },
      ]]);
      mockExecute.mockResolvedValueOnce([[{ total: '0' }]]);   // user daily sum
      mockExecute.mockResolvedValueOnce([[{ total: '950' }]]); // global daily sum

      const result = await HouseService.canPayout(100, 1, 'crash');
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('cap_day');
    });

    it('returns ok:true when global per-day cap is configured but well under limit', async () => {
      mockExecute.mockResolvedValueOnce([[
        { key: 'max_payout_per_day_global', value: '1000000' },
      ]]);
      mockExecute.mockResolvedValueOnce([[{ total: '0' }]]); // user daily
      mockExecute.mockResolvedValueOnce([[{ total: '0' }]]); // global daily
      mockExecute.mockResolvedValueOnce([[{ balance: '5000000' }]]); // house balance

      const result = await HouseService.canPayout(100, 1, 'crash');
      expect(result.ok).toBe(true);
    });

    it('rethrows + logs when underlying DB read throws', async () => {
      // settings lookup throws -> canPayout catches, logs error, rethrows.
      mockExecute.mockRejectedValueOnce(new Error('settings_db_down'));
      await expect(HouseService.canPayout(100, 1, 'crash')).rejects.toThrow('settings_db_down');
    });
  });
});
