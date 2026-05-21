// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (hoisted)
// ---------------------------------------------------------------------------
const {
  mockGetConfig,
  mockAssertCanBet,
  mockPlaceBet,
  mockRecordWin,
  mockGetBalance,
  mockDbInsert,
  mockDbUpdate,
  mockValuesReturn,
  mockSetReturn,
  mockWhereReturn,
  mockPfGenerate,
} = vi.hoisted(() => {
  const mockWhereReturn = vi.fn().mockResolvedValue(undefined);
  const mockSetReturn = vi.fn(() => ({ where: mockWhereReturn }));
  const mockValuesReturn = vi.fn().mockResolvedValue([{ insertId: 99 }]);
  const mockDbInsert = vi.fn(() => ({ values: mockValuesReturn }));
  const mockDbUpdate = vi.fn(() => ({ set: mockSetReturn }));
  return {
    mockGetConfig: vi.fn(),
    mockAssertCanBet: vi.fn(),
    mockPlaceBet: vi.fn(),
    mockRecordWin: vi.fn(),
    mockGetBalance: vi.fn(),
    mockDbInsert,
    mockDbUpdate,
    mockValuesReturn,
    mockSetReturn,
    mockWhereReturn,
    mockPfGenerate: vi.fn(),
  };
});

vi.mock('../../../../drizzle/db.js', () => ({
  db: { insert: mockDbInsert, update: mockDbUpdate },
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
  default: { getConfig: mockGetConfig },
}));

vi.mock('../../../services/userLimitsService.js', () => ({
  default: {
    assertCanBet: mockAssertCanBet,
    clearSession: vi.fn(),
  },
}));

vi.mock('../../../services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
    logGameEvent: vi.fn(),
  },
}));

// Mock pf wrapper so `generatePath` consumes a controllable [0, 1) value.
// Need a Proxy because path.ts uses default-export `pf` (instance), while
// instant.ts uses prototype methods like `toPersisted`, `newServerSeed`,
// `normaliseClientSeed`. We pass through everything except `generate`.
vi.mock('../../../games/_engine/provablyFair.js', async () => {
  const actual: any = await vi.importActual('../../../games/_engine/provablyFair.js');
  const real = actual.default;
  const proxy = new Proxy(real, {
    get(target, prop) {
      if (prop === 'generate') return mockPfGenerate;
      const v = target[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  return {
    default: proxy,
    ProvablyFair: actual.ProvablyFair,
  };
});

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
import { PlinkoEngine } from '../../../games/plinko/engine.js';

function makeCtx(userId = 1) {
  const emitted: Array<{ event: string; payload: any }> = [];
  const broadcasted: Array<{ event: string; payload: any }> = [];
  return {
    socket: { id: `s${userId}`, emit: vi.fn() },
    user: { userId, username: `u${userId}`, role: 'user', balance: 1000, isActive: true },
    emit: (event: string, payload?: any) => emitted.push({ event, payload }),
    broadcast: (event: string, payload?: any) => broadcasted.push({ event, payload }),
    namespace: {},
    _emitted: emitted,
    _broadcasted: broadcasted,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfig.mockResolvedValue({
    enabled: true,
    maxBet: 0,
    houseEdge: 0,
    payoutTable: {},
  });
  mockAssertCanBet.mockResolvedValue({ ok: true });
  mockPlaceBet.mockResolvedValue({ user: { balance: 900 } });
  mockRecordWin.mockResolvedValue({ user: { balance: 1100 } });
  mockGetBalance.mockResolvedValue(900);
  mockValuesReturn.mockResolvedValue([{ insertId: 99 }]);
  // Default: raw = 0.5 → seeds mulberry32 deterministically.
  mockPfGenerate.mockImplementation((bundle: any) => ({ raw: 0.5, seeds: bundle }));
});

describe('PlinkoEngine.validatePayload', () => {
  const engine = new PlinkoEngine();
  const validate = (p: any) => (engine as any).validatePayload(p);

  it('rejects null / non-object payload', () => {
    expect(() => validate(null)).toThrow(/invalid_payload/);
    expect(() => validate(undefined)).toThrow(/invalid_payload/);
    expect(() => validate(42)).toThrow(/invalid_payload/);
  });

  it('rejects non-positive bet amount', () => {
    expect(() => validate({ betAmount: 0, risk: 'medium', rows: 12 })).toThrow(/invalid_bet/);
    expect(() => validate({ betAmount: -5, risk: 'medium', rows: 12 })).toThrow(/invalid_bet/);
    expect(() => validate({ betAmount: 'foo', risk: 'medium', rows: 12 })).toThrow(/invalid_bet/);
  });

  it('rejects unknown risk', () => {
    expect(() => validate({ betAmount: 10, risk: 'insane', rows: 12 })).toThrow(/invalid_risk/);
    expect(() => validate({ betAmount: 10, rows: 12 })).toThrow(/invalid_risk/);
  });

  it('rejects rows out of [8, 16]', () => {
    expect(() => validate({ betAmount: 10, risk: 'medium', rows: 7 })).toThrow(/invalid_rows/);
    expect(() => validate({ betAmount: 10, risk: 'medium', rows: 17 })).toThrow(/invalid_rows/);
    expect(() => validate({ betAmount: 10, risk: 'medium', rows: 12.5 })).toThrow(/invalid_rows/);
  });

  it('accepts a valid payload', () => {
    for (const risk of ['low', 'medium', 'high']) {
      expect(validate({ betAmount: 5, risk, rows: 10 })).toEqual({
        betAmount: 5,
        risk,
        rows: 10,
      });
    }
  });
});

describe('PlinkoEngine.onBet', () => {
  it('runs the oneShot flow and returns a BetResult with path+multiplier', async () => {
    const engine = new PlinkoEngine();
    const ctx = makeCtx(7);

    const result = await engine.onBet(ctx, { betAmount: 100, risk: 'medium', rows: 12 });

    // Session created and bet debited
    expect(mockDbInsert).toHaveBeenCalled();
    expect(mockPlaceBet).toHaveBeenCalledWith(7, 100, 'plinko', { gameSessionId: 99 });

    // BetResult shape
    expect(result.sessionId).toBe(99);
    expect(result.betAmount).toBe(100);
    expect(result.completed).toBe(true);
    expect(typeof result.outcome).toBe('number');
    expect(typeof result.finalMultiplier).toBe('number');

    // Path is the right length
    const details = result.resultDetails as any;
    expect(Array.isArray(details.path)).toBe(true);
    expect(details.path).toHaveLength(12);
    expect(details.rows).toBe(12);
    expect(details.risk).toBe('medium');
    expect(typeof details.finalSlot).toBe('number');

    // Ack shape stashed for the namespace wiring (#25)
    expect(details.ack).toMatchObject({
      success: true,
      gameId: '99',
      path: details.path,
      multiplier: result.finalMultiplier,
      winAmount: result.outcome,
      profit: result.outcome - 100,
    });
  });

  it('emits balanceUpdate to the bettor and broadcasts plinko:game_result', async () => {
    const engine = new PlinkoEngine();
    const ctx = makeCtx(7);
    await engine.onBet(ctx, { betAmount: 10, risk: 'low', rows: 8 });

    const balanceEvents = ctx._emitted.filter((e: any) => e.event === 'balanceUpdate');
    expect(balanceEvents.length).toBeGreaterThan(0);

    const gameResult = ctx._broadcasted.find((e: any) => e.event === 'plinko:game_result');
    expect(gameResult).toBeDefined();
    expect(gameResult.payload).toMatchObject({ userId: 7, betAmount: 10 });
    expect(typeof gameResult.payload.multiplier).toBe('number');
    expect(typeof gameResult.payload.profit).toBe('number');
  });

  it('is deterministic when pf.generate is mocked to the same raw', async () => {
    const engine1 = new PlinkoEngine();
    const engine2 = new PlinkoEngine();
    mockPfGenerate.mockImplementation((bundle: any) => ({ raw: 0.42, seeds: bundle }));

    const r1 = await engine1.onBet(makeCtx(1), { betAmount: 5, risk: 'medium', rows: 16 });
    const r2 = await engine2.onBet(makeCtx(2), { betAmount: 5, risk: 'medium', rows: 16 });

    expect((r1.resultDetails as any).path).toEqual((r2.resultDetails as any).path);
    expect(r1.finalMultiplier).toBe(r2.finalMultiplier);
  });

  it('rejects invalid risk before doing any DB work', async () => {
    const engine = new PlinkoEngine();
    const ctx = makeCtx(7);
    await expect(
      engine.onBet(ctx, { betAmount: 10, risk: 'extreme', rows: 12 }),
    ).rejects.toThrow(/invalid_risk/);
    expect(mockDbInsert).not.toHaveBeenCalled();
    expect(mockPlaceBet).not.toHaveBeenCalled();
  });

  it('rejects invalid rows before doing any DB work', async () => {
    const engine = new PlinkoEngine();
    const ctx = makeCtx(7);
    await expect(
      engine.onBet(ctx, { betAmount: 10, risk: 'medium', rows: 4 }),
    ).rejects.toThrow(/invalid_rows/);
    expect(mockDbInsert).not.toHaveBeenCalled();
    expect(mockPlaceBet).not.toHaveBeenCalled();
  });

  it('respects the config payoutTable override on the multiplier lookup', async () => {
    mockGetConfig.mockResolvedValue({
      enabled: true,
      maxBet: 0,
      houseEdge: 0,
      payoutTable: {
        // Every bucket on (medium, 12) pays 3x.
        medium: { '12': new Array(13).fill(3) },
      },
    });
    const engine = new PlinkoEngine();
    const ctx = makeCtx(7);
    const result = await engine.onBet(ctx, { betAmount: 10, risk: 'medium', rows: 12 });
    expect(result.finalMultiplier).toBe(3);
    expect(result.outcome).toBe(30);
  });
});

describe('PlinkoEngine.onJoin / history', () => {
  it('includes recent history in the join payload state', async () => {
    const engine = new PlinkoEngine();
    const ctx = makeCtx(7);
    await engine.onBet(ctx, { betAmount: 10, risk: 'medium', rows: 12 });

    const payload = await engine.onJoin(ctx);
    expect(payload.state?.history).toBeDefined();
    expect(Array.isArray(payload.state.history)).toBe(true);
    expect(payload.state.history.length).toBeGreaterThanOrEqual(1);
  });

  it('getHistory respects the limit', () => {
    const engine = new PlinkoEngine();
    // Manually push history entries
    for (let i = 0; i < 5; i++) {
      (engine as any).history.push({
        gameId: String(i),
        userId: 1,
        betAmount: 1,
        risk: 'medium',
        rows: 12,
        multiplier: 1,
        profit: 0,
        timestamp: i,
      });
    }
    expect(engine.getHistory(3)).toHaveLength(3);
    expect(engine.getHistory(10)).toHaveLength(5);
  });
});
