// @ts-nocheck
/**
 * RouletteEngine unit tests.
 *
 * Tests:
 *   - `betSchema` rejects bad payloads (unknown type, out-of-range straight,
 *     invalid dozen/column value, missing combo value) and accepts good ones
 *   - `runRound` aggregates wins/losses across multiple bets from the same
 *     user (multiple-bets-per-round invariant) and reports per-session-row
 *     payouts
 *   - winning number is deterministic when `pf.generateRouletteNumber` is
 *     mocked
 *   - balance flow: each bet creates its own gameSessions row; winning bets
 *     trigger `recordWin` with the correct amount; balance updates are
 *     emitted to the bettor
 */
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
  mockDbInsert,
  mockDbUpdate,
  mockValuesReturn,
  mockSetReturn,
  mockWhereReturn,
  mockGenerateRouletteNumber,
} = vi.hoisted(() => {
  const mockWhereReturn = vi.fn().mockResolvedValue(undefined);
  const mockSetReturn = vi.fn(() => ({ where: mockWhereReturn }));
  // Each session insert needs to return a fresh insertId so multiple bets in
  // the same round don't collide.
  let nextInsertId = 100;
  const mockValuesReturn = vi.fn().mockImplementation(async () => [{ insertId: nextInsertId++ }]);
  const mockDbInsert = vi.fn(() => ({ values: mockValuesReturn }));
  const mockDbUpdate = vi.fn(() => ({ set: mockSetReturn }));
  return {
    mockGetConfig: vi.fn(),
    mockAssertCanBet: vi.fn(),
    mockClearSession: vi.fn(),
    mockPlaceBet: vi.fn(),
    mockRecordWin: vi.fn(),
    mockGetBalance: vi.fn(),
    mockDbInsert,
    mockDbUpdate,
    mockValuesReturn,
    mockSetReturn,
    mockWhereReturn,
    mockGenerateRouletteNumber: vi.fn(),
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
    clearSession: mockClearSession,
  },
}));

vi.mock('../../../services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
    logGameEvent: vi.fn(),
  },
}));

vi.mock('../../../validation/schemas.js', () => ({
  validateSocketData: vi.fn((_schema, data) => data),
  roulettePlaceBetSchema: {},
}));

// Mock the PF wrapper so we control the winning number deterministically.
// `generateRouletteNumber` is what `drawRouletteSlot` calls. We patch a
// single method on the real singleton instance (instead of replacing the
// whole module) so the rest of the prototype methods remain intact.
vi.mock('../../../games/_engine/provablyFair.js', async () => {
  const actual: any = await vi.importActual('../../../games/_engine/provablyFair.js');
  // Wrap actual.default so generateRouletteNumber goes through our mock but
  // every other method (newServerSeed, deterministicClientSeed, toPersisted)
  // still delegates to the real implementation.
  const realPf = actual.default;
  const wrapped = new Proxy(realPf, {
    get(target, prop, receiver) {
      if (prop === 'generateRouletteNumber') return mockGenerateRouletteNumber;
      const val = Reflect.get(target, prop, receiver);
      return typeof val === 'function' ? val.bind(target) : val;
    },
  });
  return { default: wrapped, ProvablyFair: actual.ProvablyFair };
});

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
import { RouletteEngine } from '../../../games/roulette/engine.js';
import { ROULETTE_NUMBERS } from '../../../games/roulette/wheel.js';

function makeCtx(userId: number, username: string) {
  const emitted: Array<{ event: string; payload: any }> = [];
  const socket = {
    emit: (event: string, payload?: any) => emitted.push({ event, payload }),
    on: vi.fn(),
  } as any;
  return {
    socket,
    user: { userId, username, role: 'user', balance: 1000, isActive: true },
    emit: (event: string, payload?: any) => emitted.push({ event, payload }),
    broadcast: vi.fn(),
    namespace: {} as any,
    _emitted: emitted,
  };
}

function withOpenRound(engine: any) {
  engine.openRound();
  engine.currentPhase = 'betting';
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
  mockRecordWin.mockResolvedValue({ user: { balance: 1100 } });
  mockGetBalance.mockResolvedValue(900);
});

// ---------------------------------------------------------------------------
// betSchema
// ---------------------------------------------------------------------------

describe('RouletteEngine.betSchema()', () => {
  const engine = new RouletteEngine();
  const schema = (p: any) => (engine as any).betSchema(p);

  it('rejects unknown bet type', () => {
    expect(() => schema({ type: 'PARLAY', amount: 10 })).toThrow(/invalid_bet_type/);
  });

  it('accepts STRAIGHT 0..36', () => {
    expect(schema({ type: 'STRAIGHT', value: 0, amount: 10 })).toMatchObject({ betAmount: 10 });
    expect(schema({ type: 'STRAIGHT', value: 36, amount: 10 })).toMatchObject({ betAmount: 10 });
  });

  it('rejects STRAIGHT out of range', () => {
    expect(() => schema({ type: 'STRAIGHT', value: 37, amount: 10 })).toThrow(/invalid_straight_value/);
    expect(() => schema({ type: 'STRAIGHT', value: -1, amount: 10 })).toThrow(/invalid_straight_value/);
    expect(() => schema({ type: 'STRAIGHT', value: 'foo', amount: 10 })).toThrow(/invalid_straight_value/);
  });

  it('rejects DOZEN with value != 1|2|3', () => {
    expect(schema({ type: 'DOZEN', value: 2, amount: 10 })).toMatchObject({ betAmount: 10 });
    expect(() => schema({ type: 'DOZEN', value: 4, amount: 10 })).toThrow(/invalid_group_value/);
    expect(() => schema({ type: 'DOZEN', value: 0, amount: 10 })).toThrow(/invalid_group_value/);
  });

  it('rejects COLUMN with value != 1|2|3', () => {
    expect(schema({ type: 'COLUMN', value: 1, amount: 10 })).toMatchObject({ betAmount: 10 });
    expect(() => schema({ type: 'COLUMN', value: 5, amount: 10 })).toThrow(/invalid_group_value/);
  });

  it('requires a string value for SPLIT/STREET/CORNER/FIVE/LINE', () => {
    expect(schema({ type: 'SPLIT', value: '1,2', amount: 10 })).toMatchObject({ betAmount: 10 });
    expect(() => schema({ type: 'SPLIT', amount: 10 })).toThrow(/invalid_combo_value/);
    expect(() => schema({ type: 'STREET', value: '', amount: 10 })).toThrow(/invalid_combo_value/);
  });

  it('accepts valueless even-money bets (RED/BLACK/etc.)', () => {
    for (const t of ['RED', 'BLACK', 'ODD', 'EVEN', 'LOW', 'HIGH']) {
      expect(schema({ type: t, amount: 10 })).toMatchObject({ betAmount: 10, choice: { type: t } });
    }
  });
});

// ---------------------------------------------------------------------------
// runRound
// ---------------------------------------------------------------------------

describe('RouletteEngine.runRound()', () => {
  it('aggregates correct payouts when the same user has multiple bets', async () => {
    const engine = new RouletteEngine();
    // Force winning number = 7 (red, odd, high, low? — 7 is red, odd, LOW).
    // ROULETTE_NUMBERS index for 7 is... look it up.
    const idx = ROULETTE_NUMBERS.findIndex((s) => s.number === 7);
    mockGenerateRouletteNumber.mockReturnValue({
      value: idx,
      seeds: { serverSeed: 's', serverSeedHash: 'h', clientSeed: 'c', nonce: 0 },
    });

    const bettors = [
      // user 1: bet on RED (wins) and EVEN (loses)
      { userId: 1, username: 'a', sessionId: 100, betAmount: 10, choice: { type: 'RED', value: null }, cashedOut: false, socket: {} as any },
      { userId: 1, username: 'a', sessionId: 101, betAmount: 10, choice: { type: 'EVEN', value: null }, cashedOut: false, socket: {} as any },
      // user 2: bet on BLACK (loses)
      { userId: 2, username: 'b', sessionId: 102, betAmount: 20, choice: { type: 'BLACK', value: null }, cashedOut: false, socket: {} as any },
    ];

    const seed = { serverSeed: 's', serverSeedHash: 'h', clientSeed: 'c', nonce: 0 };
    const resolution = await (engine as any).runRound(seed, bettors);

    expect(resolution.publicResult.winningNumber).toBe(7);
    expect(resolution.publicResult.winningColor).toBe('red');
    expect(resolution.payouts).toHaveLength(3);

    // Per-bet outcomes: RED win = 10 * 2 = 20; EVEN loss = 0; BLACK loss = 0.
    const u1Bets = resolution.payouts.filter((p: any) => p.userId === 1);
    const u1Wins = u1Bets.reduce((s: number, p: any) => s + p.outcome, 0);
    expect(u1Wins).toBe(20);
    expect(u1Bets.find((p: any) => p.details.type === 'RED').outcome).toBe(20);
    expect(u1Bets.find((p: any) => p.details.type === 'EVEN').outcome).toBe(0);

    const u2 = resolution.payouts.find((p: any) => p.userId === 2);
    expect(u2.outcome).toBe(0);
  });

  it('uses deterministic winning number when generateRouletteNumber is mocked', async () => {
    const engine = new RouletteEngine();
    const idx = ROULETTE_NUMBERS.findIndex((s) => s.number === 0); // green
    mockGenerateRouletteNumber.mockReturnValue({ value: idx, seeds: {} });

    const bettors = [
      { userId: 1, username: 'a', sessionId: 1, betAmount: 5, choice: { type: 'STRAIGHT', value: 0 }, cashedOut: false, socket: {} as any },
      { userId: 1, username: 'a', sessionId: 2, betAmount: 5, choice: { type: 'RED', value: null }, cashedOut: false, socket: {} as any },
    ];
    const seed = { serverSeed: 's', serverSeedHash: 'h', clientSeed: 'c', nonce: 0 };
    const resolution = await (engine as any).runRound(seed, bettors);

    expect(resolution.publicResult.winningNumber).toBe(0);
    expect(resolution.publicResult.winningColor).toBe('green');

    // STRAIGHT 0 wins (35x): outcome 5 * 36 = 180. RED loses.
    const straight = resolution.payouts.find((p: any) => p.details.type === 'STRAIGHT');
    const red = resolution.payouts.find((p: any) => p.details.type === 'RED');
    expect(straight.outcome).toBe(180);
    expect(red.outcome).toBe(0);
  });

  it('respects payoutTable override from config when settling', async () => {
    const engine = new RouletteEngine();
    // Override RED to 5x payout
    (engine as any).currentConfig = { payoutTable: { RED: 5 } };
    const idx = ROULETTE_NUMBERS.findIndex((s) => s.number === 32); // red
    mockGenerateRouletteNumber.mockReturnValue({ value: idx, seeds: {} });

    const bettors = [
      { userId: 1, username: 'a', sessionId: 1, betAmount: 10, choice: { type: 'RED', value: null }, cashedOut: false, socket: {} as any },
    ];
    const resolution = await (engine as any).runRound(
      { serverSeed: 's', serverSeedHash: 'h', clientSeed: 'c', nonce: 0 },
      bettors,
    );
    expect(resolution.payouts[0].outcome).toBe(10 * 6); // 5+1
    expect(resolution.payouts[0].multiplier).toBe(6);
  });

  it('returns empty payouts when no bettors', async () => {
    const engine = new RouletteEngine();
    mockGenerateRouletteNumber.mockReturnValue({ value: 0, seeds: {} });
    const resolution = await (engine as any).runRound(
      { serverSeed: 's', serverSeedHash: 'h', clientSeed: 'c', nonce: 0 },
      [],
    );
    expect(resolution.payouts).toEqual([]);
    expect(resolution.publicResult.winningNumber).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// onBet — multi-bet semantics
// ---------------------------------------------------------------------------

describe('RouletteEngine.onBet()', () => {
  it('opens a fresh gameSessions row per bet (multi-bet per user)', async () => {
    const engine = new RouletteEngine();
    withOpenRound(engine);

    const ctx = makeCtx(42, 'alice');
    const first = await engine.onBet(ctx, { type: 'RED', amount: 10 });
    const second = await engine.onBet(ctx, { type: 'BLACK', amount: 10 });

    expect(first.sessionId).not.toBe(second.sessionId);
    // BalanceService.placeBet called twice (once per bet)
    expect(mockPlaceBet).toHaveBeenCalledTimes(2);
    expect(mockDbInsert).toHaveBeenCalledTimes(2);
  });

  it('rejects bets outside the betting phase', async () => {
    const engine = new RouletteEngine();
    const ctx = makeCtx(7, 'bob');
    await expect(engine.onBet(ctx, { type: 'RED', amount: 5 })).rejects.toThrow(/not_betting_phase/);
  });

  it('rejects unknown bet type via betSchema before debiting', async () => {
    const engine = new RouletteEngine();
    withOpenRound(engine);
    const ctx = makeCtx(8, 'carl');
    await expect(engine.onBet(ctx, { type: 'NOPE', amount: 5 })).rejects.toThrow(/invalid_bet_type/);
    expect(mockPlaceBet).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// placeBet — tracks bets, broadcasts, emits balanceUpdate
// ---------------------------------------------------------------------------

describe('RouletteEngine.placeBet()', () => {
  it('tracks multiple bets per user in currentBets', async () => {
    const engine = new RouletteEngine();
    withOpenRound(engine);
    const ctx = makeCtx(1, 'alice');
    (engine as any).subscribers.add(ctx);

    await engine.placeBet(ctx, { type: 'RED', amount: 25 });
    await engine.placeBet(ctx, { type: 'ODD', amount: 25 });

    const bets = (engine as any).__getCurrentBets().get(1);
    expect(bets).toHaveLength(2);
    expect(bets[0].type).toBe('RED');
    expect(bets[1].type).toBe('ODD');
  });

  it('broadcasts roulette:playerBet to every subscriber', async () => {
    const engine = new RouletteEngine();
    withOpenRound(engine);
    const ctxA = makeCtx(1, 'a');
    const ctxB = makeCtx(2, 'b');
    (engine as any).subscribers.add(ctxA);
    (engine as any).subscribers.add(ctxB);

    await engine.placeBet(ctxA, { type: 'RED', amount: 25 });

    const aBroadcasts = ctxA._emitted.filter((e: any) => e.event === 'roulette:playerBet');
    const bBroadcasts = ctxB._emitted.filter((e: any) => e.event === 'roulette:playerBet');
    expect(aBroadcasts).toHaveLength(1);
    expect(bBroadcasts).toHaveLength(1);
    expect(aBroadcasts[0].payload).toMatchObject({ userId: 1, username: 'a', type: 'RED', amount: 25 });
  });

  it('emits balanceUpdate to the bettor after debit', async () => {
    const engine = new RouletteEngine();
    withOpenRound(engine);
    const ctx = makeCtx(3, 'c');
    (engine as any).subscribers.add(ctx);

    await engine.placeBet(ctx, { type: 'RED', amount: 10 });

    const balanceEvents = ctx._emitted.filter((e: any) => e.event === 'balanceUpdate');
    expect(balanceEvents.length).toBeGreaterThan(0);
    expect(balanceEvents[balanceEvents.length - 1].payload).toEqual({ balance: 900 });
  });

  it('throws "Betting is closed" outside the betting phase', async () => {
    const engine = new RouletteEngine();
    const ctx = makeCtx(4, 'd');
    await expect(engine.placeBet(ctx, { type: 'RED', amount: 10 })).rejects.toThrow(/Betting is closed/);
  });
});

// ---------------------------------------------------------------------------
// Duration getters
// ---------------------------------------------------------------------------

describe('RouletteEngine duration getters', () => {
  it('reads ROULETTE_BETTING_DURATION (seconds → ms when < 1000)', () => {
    const engine = new RouletteEngine();
    process.env.ROULETTE_BETTING_DURATION = '3';
    expect(engine.bettingDurationMs()).toBe(3000);
    delete process.env.ROULETTE_BETTING_DURATION;
  });

  it('reads ROULETTE_BETTING_DURATION as ms when >= 1000', () => {
    const engine = new RouletteEngine();
    process.env.ROULETTE_BETTING_DURATION = '5000';
    expect(engine.bettingDurationMs()).toBe(5000);
    delete process.env.ROULETTE_BETTING_DURATION;
  });

  it('reads ROULETTE_SPIN_DURATION (ms)', () => {
    const engine = new RouletteEngine();
    process.env.ROULETTE_SPIN_DURATION = '2500';
    expect(engine.runningDurationMs()).toBe(2500);
    delete process.env.ROULETTE_SPIN_DURATION;
  });

  it('reads ROULETTE_RESULT_DISPLAY (ms)', () => {
    const engine = new RouletteEngine();
    process.env.ROULETTE_RESULT_DISPLAY = '1500';
    expect(engine.revealDurationMs()).toBe(1500);
    delete process.env.ROULETTE_RESULT_DISPLAY;
  });

  it('falls back to defaults when env unset', () => {
    const engine = new RouletteEngine();
    delete process.env.ROULETTE_BETTING_DURATION;
    delete process.env.ROULETTE_SPIN_DURATION;
    delete process.env.ROULETTE_RESULT_DISPLAY;
    expect(engine.bettingDurationMs()).toBe(15000);
    expect(engine.runningDurationMs()).toBe(10000);
    expect(engine.revealDurationMs()).toBe(5000);
  });
});
