// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (hoisted)
// ---------------------------------------------------------------------------
const {
  mockGetConfig,
  mockAssertCanBet,
  mockClearSession,
  mockPlaceBet,
  mockRecordWin,
  mockGetBalance,
  mockGenerate,
  mockDbInsert,
  mockDbUpdate,
  mockValuesReturn,
  mockSetReturn,
  mockWhereReturn,
} = vi.hoisted(() => {
  const mockWhereReturn = vi.fn().mockResolvedValue(undefined);
  const mockSetReturn = vi.fn(() => ({ where: mockWhereReturn }));
  const mockValuesReturn = vi.fn().mockResolvedValue([{ insertId: 77 }]);
  const mockDbInsert = vi.fn(() => ({ values: mockValuesReturn }));
  const mockDbUpdate = vi.fn(() => ({ set: mockSetReturn }));
  return {
    mockGetConfig: vi.fn(),
    mockAssertCanBet: vi.fn(),
    mockClearSession: vi.fn(),
    mockPlaceBet: vi.fn(),
    mockRecordWin: vi.fn(),
    mockGetBalance: vi.fn(),
    mockGenerate: vi.fn(),
    mockDbInsert,
    mockDbUpdate,
    mockValuesReturn,
    mockSetReturn,
    mockWhereReturn,
  };
});

vi.mock('../../../../drizzle/db.js', () => ({
  db: {
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
}));

vi.mock('../../../../drizzle/schema.js', () => ({
  gameSessions: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}));

vi.mock('../../../services/balanceService.js', () => ({
  default: {
    placeBet: mockPlaceBet,
    recordWin: mockRecordWin,
    getBalance: mockGetBalance,
  },
}));

vi.mock('../../../services/gameConfigService.js', () => ({
  default: {
    getConfig: mockGetConfig,
  },
}));

vi.mock('../../../services/userLimitsService.js', () => ({
  default: {
    assertCanBet: mockAssertCanBet,
    clearSession: mockClearSession,
  },
}));

vi.mock('../../../services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
    logGameEvent: vi.fn(),
    logBetPlaced: vi.fn(),
    logBetResult: vi.fn(),
  },
}));

// Mock the provably-fair wrapper so we can pin the raw float per test.
vi.mock('../../../games/_engine/provablyFair.js', () => ({
  default: {
    newServerSeed: () => ({
      serverSeed: 'ss_' + Math.random().toString(16).slice(2),
      serverSeedHash: 'h'.repeat(64),
    }),
    normaliseClientSeed: (raw: any) => (typeof raw === 'string' && raw.trim() ? raw.trim() : 'cs_default'),
    generate: (bundle: any) => mockGenerate(bundle),
    toPersisted: (bundle: any, opts: any) => ({
      serverSeedHash: bundle.serverSeedHash,
      serverSeed: opts.reveal ? bundle.serverSeed : null,
      clientSeed: bundle.clientSeed,
      nonce: bundle.nonce,
      roundId: opts.roundId ?? null,
    }),
  },
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
import { DiceEngine, computeMultiplier, betSchema } from '../../../games/dice/engine.js';
import { MAX_PAYOUT_MULTIPLIER } from '../../../utils/gameUtils.js';

function makeCtx(userId = 1) {
  return {
    user: { userId, username: `u${userId}`, role: 'user', balance: 1000, isActive: true },
    socket: { id: `s${userId}`, emit: vi.fn() },
    emit: vi.fn(),
    broadcast: vi.fn(),
    namespace: {},
  };
}

// ---------------------------------------------------------------------------
// computeMultiplier
// ---------------------------------------------------------------------------

describe('computeMultiplier', () => {
  it('under @ target 50 with edge 0.04 -> ~1.92', () => {
    expect(computeMultiplier(50, 'under', 0.04)).toBe(1.92);
  });

  it('over @ target 50 with edge 0.04 -> ~1.92 (symmetric)', () => {
    expect(computeMultiplier(50, 'over', 0.04)).toBe(1.92);
  });

  it('under @ target 1 with edge 0.04 -> tiny winProb gives a high multiplier, capped at MAX', () => {
    // winProb = 1/100 = 0.01 -> raw = 0.96/0.01 = 96 -> capped at MAX_PAYOUT_MULTIPLIER
    const m = computeMultiplier(1, 'under', 0.04);
    expect(m).toBe(MAX_PAYOUT_MULTIPLIER);
  });

  it('over @ target 99 with edge 0.04 -> tiny winProb gives a high multiplier, capped at MAX', () => {
    // winProb = (100-99)/100 = 0.01 -> capped
    const m = computeMultiplier(99, 'over', 0.04);
    expect(m).toBe(MAX_PAYOUT_MULTIPLIER);
  });

  it('returns 0 for degenerate winProb (target 0 -> under)', () => {
    expect(computeMultiplier(0, 'under', 0.04)).toBe(0);
  });

  it('returns 0 for degenerate winProb (target 100 -> over)', () => {
    expect(computeMultiplier(100, 'over', 0.04)).toBe(0);
  });

  it('floors multiplier to 2 dp', () => {
    // arbitrary edge picked so the raw isn't already at 2dp
    const m = computeMultiplier(33, 'under', 0.04);
    // 0.96 / 0.33 = 2.9090... -> floor to 2.90
    expect(m).toBe(2.9);
  });
});

// ---------------------------------------------------------------------------
// betSchema validation
// ---------------------------------------------------------------------------

describe('betSchema', () => {
  it('accepts a valid payload', () => {
    expect(betSchema({ betAmount: 10, target: 50, direction: 'under' })).toEqual({
      betAmount: 10,
      target: 50,
      direction: 'under',
    });
  });

  it('rejects a non-object payload', () => {
    expect(() => betSchema(null)).toThrow('invalid_payload');
    expect(() => betSchema(undefined)).toThrow('invalid_payload');
  });

  it('rejects a negative bet', () => {
    expect(() => betSchema({ betAmount: -1, target: 50, direction: 'under' })).toThrow('invalid_bet');
  });

  it('rejects a zero bet', () => {
    expect(() => betSchema({ betAmount: 0, target: 50, direction: 'under' })).toThrow('invalid_bet');
  });

  it('rejects a non-numeric bet', () => {
    expect(() => betSchema({ betAmount: 'abc', target: 50, direction: 'under' })).toThrow('invalid_bet');
  });

  it('rejects target below 1', () => {
    expect(() => betSchema({ betAmount: 10, target: 0, direction: 'under' })).toThrow('target_out_of_range');
  });

  it('rejects target above 99', () => {
    expect(() => betSchema({ betAmount: 10, target: 100, direction: 'under' })).toThrow('target_out_of_range');
  });

  it('rejects an invalid direction', () => {
    expect(() => betSchema({ betAmount: 10, target: 50, direction: 'sideways' })).toThrow('invalid_direction');
  });
});

// ---------------------------------------------------------------------------
// onBet integration with oneShot
// ---------------------------------------------------------------------------

describe('DiceEngine.onBet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue({
      enabled: true,
      maxBet: 1000,
      houseEdge: 0.04,
      payoutTable: {},
    });
    mockAssertCanBet.mockResolvedValue({ ok: true });
    mockValuesReturn.mockResolvedValue([{ insertId: 77 }]);
    mockPlaceBet.mockResolvedValue({ user: { balance: '900' } });
    mockRecordWin.mockResolvedValue({ user: { balance: '1092' } });
    mockGetBalance.mockResolvedValue(900);
  });

  it('win path: raw=0.4 -> result=39.99, under target=50 -> win', async () => {
    // raw=0.4 -> 0.4*10000 = 4000 -> floor/100 = 40 ... but `Math.floor(0.4 * 10000) / 100`
    // depends on the exact float. Using 0.4 we get 39.99 due to IEEE precision (0.4*10000 = 3999.9999..).
    mockGenerate.mockImplementation((bundle) => ({ raw: 0.4, seeds: bundle }));

    const engine = new DiceEngine();
    const ctx = makeCtx(7);

    const result = await engine.onBet(ctx, { betAmount: 100, target: 50, direction: 'under' });

    // Bet was debited
    expect(mockPlaceBet).toHaveBeenCalledWith(7, 100, 'dice', { gameSessionId: 77 });
    // Win recorded -> 100 * 1.92 = 192
    expect(mockRecordWin).toHaveBeenCalledWith(7, 100, 192, 'dice', { gameSessionId: 77 });

    expect(result.outcome).toBe(192);
    expect(result.finalMultiplier).toBe(1.92);
    expect(result.resultDetails).toMatchObject({
      target: 50,
      direction: 'under',
      win: true,
    });
    // result should be a number in [0, 99.99]
    expect(result.resultDetails!.result).toBeLessThan(50);
    expect(result.sessionId).toBe(77);
    expect(result.completed).toBe(true);
  });

  it('loss path: raw=0.7 -> result=69.99, under target=50 -> loss', async () => {
    mockGenerate.mockImplementation((bundle) => ({ raw: 0.7, seeds: bundle }));

    const engine = new DiceEngine();
    const ctx = makeCtx(7);

    const result = await engine.onBet(ctx, { betAmount: 100, target: 50, direction: 'under' });

    expect(mockPlaceBet).toHaveBeenCalledOnce();
    expect(mockRecordWin).not.toHaveBeenCalled();

    expect(result.outcome).toBe(0);
    expect(result.finalMultiplier).toBe(0);
    expect(result.resultDetails).toMatchObject({
      target: 50,
      direction: 'under',
      win: false,
    });
    expect(result.resultDetails!.result).toBeGreaterThanOrEqual(50);
  });

  it('over direction: raw=0.7 -> result>50 -> win over target=50', async () => {
    mockGenerate.mockImplementation((bundle) => ({ raw: 0.7, seeds: bundle }));

    const engine = new DiceEngine();
    const ctx = makeCtx(8);

    const result = await engine.onBet(ctx, { betAmount: 50, target: 50, direction: 'over' });

    expect(result.resultDetails!.win).toBe(true);
    // 50 * 1.92 = 96
    expect(result.outcome).toBe(96);
    expect(result.finalMultiplier).toBe(1.92);
  });

  it('validation errors propagate before any debit', async () => {
    const engine = new DiceEngine();
    const ctx = makeCtx(7);

    await expect(engine.onBet(ctx, { betAmount: 10, target: 0, direction: 'under' }))
      .rejects.toThrow('target_out_of_range');

    expect(mockPlaceBet).not.toHaveBeenCalled();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('serialises two concurrent rolls for the same user via runExclusive', async () => {
    mockGenerate.mockImplementation((bundle) => ({ raw: 0.1, seeds: bundle }));

    const engine = new DiceEngine();
    const ctx = makeCtx(9);

    // Track ordering: each placeBet/recordWin call should finish before the next starts
    const order: string[] = [];
    mockPlaceBet.mockImplementation(async () => {
      order.push('placeBet:start');
      await new Promise((r) => setTimeout(r, 5));
      order.push('placeBet:end');
      return { user: { balance: '900' } };
    });
    mockRecordWin.mockImplementation(async () => {
      order.push('recordWin');
      return { user: { balance: '1000' } };
    });

    const p1 = engine.onBet(ctx, { betAmount: 10, target: 50, direction: 'under' });
    const p2 = engine.onBet(ctx, { betAmount: 10, target: 50, direction: 'under' });

    await Promise.all([p1, p2]);

    // The first roll's placeBet:end must come before the second roll's placeBet:start.
    expect(order).toEqual([
      'placeBet:start',
      'placeBet:end',
      'recordWin',
      'placeBet:start',
      'placeBet:end',
      'recordWin',
    ]);
  });
});

// ---------------------------------------------------------------------------
// onJoin
// ---------------------------------------------------------------------------

describe('DiceEngine.onJoin', () => {
  it('returns the serverSeedHash and current next-nonce state', async () => {
    const engine = new DiceEngine();
    const ctx = makeCtx(11);
    const payload = await engine.onJoin(ctx);
    expect(payload.serverSeedHash).toBeTruthy();
    expect(typeof payload.state.clientSeed).toBe('string');
    expect(payload.state.nextNonce).toBe(1);
  });
});
