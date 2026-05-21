// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (hoisted so the engine sees them before importing)
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
  mockGenerateInt,
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
    mockGenerateInt: vi.fn(),
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

// Mock the PF wrapper so we control segmentIndex deterministically.
// The default export is a class instance — wrap it with a Proxy so prototype
// methods (newServerSeed, deterministicClientSeed, toPersisted, …) still
// resolve, while `generateInt` is replaced with our mock.
vi.mock('../../../games/_engine/provablyFair.js', async () => {
  const actual: any = await vi.importActual('../../../games/_engine/provablyFair.js');
  const real = actual.default;
  const proxy = new Proxy(real, {
    get(target, prop) {
      if (prop === 'generateInt') return mockGenerateInt;
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
import { WheelEngine } from '../../../games/wheel/engine.js';
import { MAX_PAYOUT_MULTIPLIER } from '../../../utils/gameUtils.js';

function makeCtx(userId: number, username: string) {
  const emitted: Array<{ event: string; payload: any }> = [];
  const socket = {
    emit: (event: string, payload?: any) => {
      emitted.push({ event, payload });
    },
  } as any;
  const ctx: any = {
    socket,
    user: { userId, username, role: 'user', balance: 1000, isActive: true },
    emit: (event: string, payload?: any) => emitted.push({ event, payload }),
    broadcast: vi.fn(),
    namespace: {} as any,
    _emitted: emitted,
  };
  return ctx;
}

function withOpenRound(engine: WheelEngine) {
  // openRound is protected — expose via cast.
  (engine as any).openRound();
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfig.mockResolvedValue({
    enabled: true,
    maxBet: 0,
    houseEdge: 0,
    payoutTable: null,
  });
  mockAssertCanBet.mockResolvedValue({ ok: true });
  mockPlaceBet.mockResolvedValue({ user: { balance: 900 } });
  mockRecordWin.mockResolvedValue({ user: { balance: 950 } });
  mockGetBalance.mockResolvedValue(900);
  mockValuesReturn.mockResolvedValue([{ insertId: 99 }]);
});

describe('WheelEngine.betSchema()', () => {
  const engine = new WheelEngine();
  // betSchema is protected — call via cast.
  const schema = (p: any) => (engine as any).betSchema(p);

  it('rejects null / non-object payload', () => {
    expect(() => schema(null)).toThrow();
    expect(() => schema(undefined)).toThrow();
    expect(() => schema(42)).toThrow();
  });

  it('rejects non-positive bet amount', () => {
    expect(() => schema({ betAmount: 0, difficulty: 'easy' })).toThrow(/invalid_bet/);
    expect(() => schema({ betAmount: -5, difficulty: 'easy' })).toThrow(/invalid_bet/);
    expect(() => schema({ betAmount: 'foo', difficulty: 'easy' })).toThrow(/invalid_bet/);
  });

  it('rejects unknown difficulty', () => {
    expect(() => schema({ betAmount: 10, difficulty: 'extreme' })).toThrow(/invalid_difficulty/);
  });

  it('defaults difficulty to medium when missing', () => {
    expect(schema({ betAmount: 10 })).toEqual({ betAmount: 10, choice: { difficulty: 'medium' } });
  });

  it('accepts each valid difficulty', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      expect(schema({ betAmount: 25, difficulty: d })).toEqual({ betAmount: 25, choice: { difficulty: d } });
    }
  });
});

describe('WheelEngine.runRound()', () => {
  it('produces correct payouts for three players each on a different difficulty', async () => {
    const engine = new WheelEngine();
    // Force segmentIndex = 11 (top slot — 3x easy, 5x medium, 7x hard).
    mockGenerateInt.mockReturnValue({ value: 11, seeds: { serverSeed: 's', serverSeedHash: 'h', clientSeed: 'c', nonce: 0 } });

    const bettors = [
      { userId: 1, username: 'a', sessionId: 1, betAmount: 10, choice: { difficulty: 'easy' }, cashedOut: false, socket: {} as any },
      { userId: 2, username: 'b', sessionId: 2, betAmount: 20, choice: { difficulty: 'medium' }, cashedOut: false, socket: {} as any },
      { userId: 3, username: 'c', sessionId: 3, betAmount: 40, choice: { difficulty: 'hard' }, cashedOut: false, socket: {} as any },
    ];

    const seed = { serverSeed: 's', serverSeedHash: 'h', clientSeed: 'c', nonce: 0 };
    const resolution = await (engine as any).runRound(seed, bettors);

    expect(resolution.publicResult.segmentIndex).toBe(11);
    expect(typeof resolution.publicResult.targetAngle).toBe('number');
    expect(resolution.payouts).toHaveLength(3);

    const byUser = Object.fromEntries(resolution.payouts.map((p: any) => [p.userId, p]));
    expect(byUser[1].outcome).toBe(10 * 3.0);
    expect(byUser[1].multiplier).toBe(3.0);
    expect(byUser[1].details).toEqual({ difficulty: 'easy', segmentIndex: 11 });

    expect(byUser[2].outcome).toBe(20 * 5.0);
    expect(byUser[2].multiplier).toBe(5.0);

    expect(byUser[3].outcome).toBe(40 * 7.0);
    expect(byUser[3].multiplier).toBe(7.0);
  });

  it('returns zero payouts when the drawn segment is a loss slot', async () => {
    const engine = new WheelEngine();
    // segmentIndex = 0 → 0x across all three difficulties.
    mockGenerateInt.mockReturnValue({ value: 0, seeds: {} });
    const bettors = [
      { userId: 1, username: 'a', sessionId: 1, betAmount: 50, choice: { difficulty: 'easy' }, cashedOut: false, socket: {} as any },
      { userId: 2, username: 'b', sessionId: 2, betAmount: 50, choice: { difficulty: 'hard' }, cashedOut: false, socket: {} as any },
    ];
    const resolution = await (engine as any).runRound({ serverSeed: 's', serverSeedHash: 'h', clientSeed: 'c', nonce: 0 }, bettors);
    expect(resolution.payouts[0].outcome).toBe(0);
    expect(resolution.payouts[1].outcome).toBe(0);
  });

  it('uses deterministic segmentIndex when generateInt is mocked', async () => {
    const engine = new WheelEngine();
    mockGenerateInt.mockReturnValue({ value: 7, seeds: {} });
    const resolution = await (engine as any).runRound(
      { serverSeed: 's', serverSeedHash: 'h', clientSeed: 'c', nonce: 0 },
      [],
    );
    expect(resolution.publicResult.segmentIndex).toBe(7);
    expect(resolution.payouts).toEqual([]);
  });

  it('respects payout-table override from config when settling', async () => {
    const engine = new WheelEngine();
    // Inject override directly.
    (engine as any).currentPayoutTable = {
      medium: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, MAX_PAYOUT_MULTIPLIER * 10],
    };
    mockGenerateInt.mockReturnValue({ value: 11, seeds: {} });
    const bettors = [
      { userId: 1, username: 'a', sessionId: 1, betAmount: 10, choice: { difficulty: 'medium' }, cashedOut: false, socket: {} as any },
    ];
    const resolution = await (engine as any).runRound(
      { serverSeed: 's', serverSeedHash: 'h', clientSeed: 'c', nonce: 0 },
      bettors,
    );
    // Capped at MAX_PAYOUT_MULTIPLIER.
    expect(resolution.payouts[0].multiplier).toBe(MAX_PAYOUT_MULTIPLIER);
    expect(resolution.payouts[0].outcome).toBe(10 * MAX_PAYOUT_MULTIPLIER);
  });
});

describe('WheelEngine.onBet()', () => {
  it('rejects a second bet from the same user in the same round', async () => {
    const engine = new WheelEngine();
    withOpenRound(engine);
    const ctx = makeCtx(42, 'alice');

    const first = await engine.onBet(ctx, { betAmount: 10, difficulty: 'easy' });
    expect(first.sessionId).toBe(99);
    expect(first.betAmount).toBe(10);

    await expect(engine.onBet(ctx, { betAmount: 10, difficulty: 'easy' })).rejects.toThrow(/already_placed_bet/);
  });

  it('rejects bets outside the betting phase', async () => {
    const engine = new WheelEngine();
    // Round is idle by default.
    const ctx = makeCtx(7, 'bob');
    await expect(engine.onBet(ctx, { betAmount: 5, difficulty: 'medium' })).rejects.toThrow(/not_betting_phase/);
  });

  it('broadcasts wheel:playerBet to all subscribers when a bet is placed', async () => {
    const engine = new WheelEngine();
    withOpenRound(engine);

    const ctxA = makeCtx(1, 'a');
    const ctxB = makeCtx(2, 'b');
    // Manually register subscribers (onJoin would do this in real use).
    (engine as any).subscribers.add(ctxA);
    (engine as any).subscribers.add(ctxB);

    await engine.onBet(ctxA, { betAmount: 25, difficulty: 'hard' });

    const broadcasts = [...ctxA._emitted, ...ctxB._emitted].filter((e: any) => e.event === 'wheel:playerBet');
    expect(broadcasts.length).toBe(2);
    expect(broadcasts[0].payload).toMatchObject({
      userId: 1,
      username: 'a',
      amount: 25,
      difficulty: 'hard',
    });
  });

  it('emits balanceUpdate to the bettor after debit', async () => {
    const engine = new WheelEngine();
    withOpenRound(engine);
    const ctx = makeCtx(3, 'c');
    await engine.onBet(ctx, { betAmount: 10, difficulty: 'easy' });
    const balanceEvents = ctx._emitted.filter((e: any) => e.event === 'balanceUpdate');
    expect(balanceEvents.length).toBeGreaterThan(0);
    expect(balanceEvents[balanceEvents.length - 1].payload).toEqual({ balance: 900 });
  });
});

describe('WheelEngine duration getters', () => {
  it('reads WHEEL_BETTING_DURATION (seconds → ms)', () => {
    const engine = new WheelEngine();
    process.env.WHEEL_BETTING_DURATION = '3';
    expect(engine.bettingDurationMs()).toBe(3000);
    delete process.env.WHEEL_BETTING_DURATION;
  });

  it('reads WHEEL_SPIN_DURATION (ms)', () => {
    const engine = new WheelEngine();
    process.env.WHEEL_SPIN_DURATION = '1234';
    expect(engine.runningDurationMs()).toBe(1234);
    delete process.env.WHEEL_SPIN_DURATION;
  });

  it('reads WHEEL_RESULT_DISPLAY (ms)', () => {
    const engine = new WheelEngine();
    process.env.WHEEL_RESULT_DISPLAY = '2222';
    expect(engine.revealDurationMs()).toBe(2222);
    delete process.env.WHEEL_RESULT_DISPLAY;
  });

  it('falls back to defaults when env unset or invalid', () => {
    const engine = new WheelEngine();
    delete process.env.WHEEL_BETTING_DURATION;
    delete process.env.WHEEL_SPIN_DURATION;
    delete process.env.WHEEL_RESULT_DISPLAY;
    expect(engine.bettingDurationMs()).toBe(10000);
    expect(engine.runningDurationMs()).toBe(5000);
    expect(engine.revealDurationMs()).toBe(4000);
  });
});
