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
  mockGenerateCrashPoint,
  mockNewServerSeed,
  mockDbInsert,
  mockDbUpdate,
  mockValuesReturn,
  mockSetReturn,
  mockWhereReturn,
} = vi.hoisted(() => {
  const mockWhereReturn = vi.fn().mockResolvedValue(undefined);
  const mockSetReturn = vi.fn(() => ({ where: mockWhereReturn }));
  const mockValuesReturn = vi.fn().mockResolvedValue([{ insertId: 42 }]);
  const mockDbInsert = vi.fn(() => ({ values: mockValuesReturn }));
  const mockDbUpdate = vi.fn(() => ({ set: mockSetReturn }));
  return {
    mockGetConfig: vi.fn(),
    mockAssertCanBet: vi.fn(),
    mockClearSession: vi.fn(),
    mockPlaceBet: vi.fn(),
    mockRecordWin: vi.fn(),
    mockGetBalance: vi.fn(),
    mockGenerateCrashPoint: vi.fn(),
    mockNewServerSeed: vi.fn(),
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
    logGameStart: vi.fn(),
    logGameEnd: vi.fn(),
  },
}));

// Mock the provably-fair wrapper so we can pin the crash point in tests.
vi.mock('../../../games/_engine/provablyFair.js', () => ({
  default: {
    newServerSeed: () => mockNewServerSeed(),
    deterministicClientSeed: (roundId: any, userIds: any[]) => `cs_${roundId}_${userIds.join(',')}`,
    generateCrashPoint: (bundle: any, edge: number) => mockGenerateCrashPoint(bundle, edge),
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
import { CrashEngine } from '../../../games/crash/engine.js';

// Helper: build a minimal ctx for a user.
function makeCtx(userId: number, username: string) {
  const emit = vi.fn();
  return {
    socket: { id: `sock_${userId}`, emit } as any,
    user: { userId, username, role: 'user', balance: 1000, isActive: true },
    emit,
    broadcast: vi.fn(),
    namespace: {} as any,
    _emit: emit,
  };
}

// Helper: open a round on the engine manually (no timers).
function openRound(engine: CrashEngine, roundId = 'r1', crashPoint = 5) {
  mockNewServerSeed.mockReturnValueOnce({ serverSeed: 'ss', serverSeedHash: 'hh' });
  engine.__test.setRound({
    id: roundId,
    phase: 'betting',
    bets: [],
    seed: { serverSeed: 'ss', serverSeedHash: 'hh', clientSeed: '', nonce: 0 },
    endsAt: Date.now() + 5000,
  });
  engine.__test.setCrashPoint(crashPoint);
}

describe('CrashEngine.betSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a valid bet amount', () => {
    const engine = new CrashEngine();
    const result = engine.betSchema({ amount: 100, autoCashoutAt: 2 });
    expect(result.betAmount).toBe(100);
    expect(result.choice).toEqual({ autoCashoutAt: 2 });
  });

  it('accepts a bet without autoCashoutAt', () => {
    const engine = new CrashEngine();
    const result = engine.betSchema({ amount: 50 });
    expect(result.betAmount).toBe(50);
    expect(result.choice.autoCashoutAt).toBeUndefined();
  });

  it('rejects amount below minimum (0.10)', () => {
    const engine = new CrashEngine();
    expect(() => engine.betSchema({ amount: 0.05 })).toThrow();
  });

  it('rejects amount above maximum (5000)', () => {
    const engine = new CrashEngine();
    expect(() => engine.betSchema({ amount: 10000 })).toThrow();
  });

  it('rejects autoCashoutAt below 1.01', () => {
    const engine = new CrashEngine();
    expect(() => engine.betSchema({ amount: 10, autoCashoutAt: 1.0 })).toThrow();
  });

  it('rejects non-numeric amount', () => {
    const engine = new CrashEngine();
    expect(() => engine.betSchema({ amount: 'big' })).toThrow();
  });
});

describe('CrashEngine.runRound', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns outcome=0 for a non-cashed-out bet (lost)', async () => {
    const engine = new CrashEngine();
    engine.__test.setCrashPoint(3.5);
    const bettors = [
      {
        userId: 1,
        username: 'a',
        sessionId: 10,
        betAmount: 100,
        choice: {},
        cashedOut: false,
        cashedOutAt: null,
        profit: 0,
        socket: {} as any,
      },
    ];
    const result = await engine.__test.runRound(
      { serverSeed: 'ss', serverSeedHash: 'hh', clientSeed: 'cs', nonce: 0 },
      bettors,
    );
    expect(result.payouts).toHaveLength(1);
    expect(result.payouts[0].outcome).toBe(0);
    expect(result.publicResult.crashPoint).toBe(3.5);
  });

  it('returns outcome = bet * cashedOutAt for cashed-out bets', async () => {
    const engine = new CrashEngine();
    engine.__test.setCrashPoint(5);
    const bettors = [
      {
        userId: 1,
        username: 'a',
        sessionId: 10,
        betAmount: 100,
        choice: {},
        cashedOut: true,
        cashedOutAt: 2.5,
        profit: 150,
        socket: {} as any,
      },
    ];
    const result = await engine.__test.runRound(
      { serverSeed: 'ss', serverSeedHash: 'hh', clientSeed: 'cs', nonce: 0 },
      bettors,
    );
    expect(result.payouts[0].outcome).toBe(250);
    expect(result.payouts[0].multiplier).toBe(2.5);
  });

  it('draws crash point from pf when not pre-set (deterministic for fixed seed)', async () => {
    mockGenerateCrashPoint.mockReturnValue({
      crashPoint: 4.2,
      seeds: { serverSeed: 'ss', serverSeedHash: 'hh', clientSeed: 'cs', nonce: 0 },
    });
    const engine = new CrashEngine();
    engine.__test.setCrashPoint(null);
    engine.__test.setHouseEdge(0.04);

    const result = await engine.__test.runRound(
      { serverSeed: 'ss', serverSeedHash: 'hh', clientSeed: 'cs', nonce: 0 },
      [],
    );
    expect(mockGenerateCrashPoint).toHaveBeenCalledWith(
      { serverSeed: 'ss', serverSeedHash: 'hh', clientSeed: 'cs', nonce: 0 },
      0.04,
    );
    expect(result.publicResult.crashPoint).toBe(4.2);
  });

  it('is deterministic — same seed + edge yields same crash point', async () => {
    mockGenerateCrashPoint.mockImplementation(() => ({
      crashPoint: 7.77,
      seeds: { serverSeed: 'ss', serverSeedHash: 'hh', clientSeed: 'cs', nonce: 0 },
    }));
    const engine = new CrashEngine();
    engine.__test.setCrashPoint(null);

    const r1 = await engine.__test.runRound(
      { serverSeed: 'ss', serverSeedHash: 'hh', clientSeed: 'cs', nonce: 0 },
      [],
    );
    const r2 = await engine.__test.runRound(
      { serverSeed: 'ss', serverSeedHash: 'hh', clientSeed: 'cs', nonce: 0 },
      [],
    );
    expect(r1.publicResult.crashPoint).toBe(r2.publicResult.crashPoint);
  });
});

describe('CrashEngine.cashOut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue({
      enabled: true,
      maxBet: 5000,
      houseEdge: 0.04,
      payoutTable: {},
    });
    mockAssertCanBet.mockResolvedValue({ ok: true });
    mockPlaceBet.mockResolvedValue({ user: { balance: '900' } });
    mockRecordWin.mockResolvedValue({ user: { balance: '1200' } });
    mockGetBalance.mockResolvedValue(900);
  });

  it('rejects when game is not running', async () => {
    const engine = new CrashEngine();
    openRound(engine);
    engine.__test.setGameRunning(false);
    const ctx = makeCtx(1, 'alice');
    await expect(engine.cashOut(ctx)).rejects.toThrow(/not running/i);
  });

  it('rejects cashout when there is no active bet for the user', async () => {
    const engine = new CrashEngine();
    openRound(engine);
    engine.__test.setGameRunning(true);
    engine.__test.setMultiplier(2);
    const ctx = makeCtx(1, 'alice');
    await expect(engine.cashOut(ctx)).rejects.toThrow(/No active bet/i);
  });

  it('rejects when already cashed out', async () => {
    const engine = new CrashEngine();
    openRound(engine);
    engine.__test.setGameRunning(true);
    engine.__test.setMultiplier(2);
    const round = engine.__test.getRound();
    round.bets.push({
      userId: 1,
      username: 'alice',
      sessionId: 1,
      betAmount: 100,
      choice: {},
      cashedOut: true,
      cashedOutAt: 1.5,
      profit: 50,
      socket: {} as any,
    });
    const ctx = makeCtx(1, 'alice');
    await expect(engine.cashOut(ctx)).rejects.toThrow(/Already cashed/i);
  });

  it('rejects cashout AFTER crash (game no longer running)', async () => {
    const engine = new CrashEngine();
    openRound(engine, 'r1', 2);
    engine.__test.setGameRunning(false); // post-crash
    engine.__test.setMultiplier(2);
    const round = engine.__test.getRound();
    round.bets.push({
      userId: 1,
      username: 'alice',
      sessionId: 1,
      betAmount: 100,
      choice: {},
      cashedOut: false,
      cashedOutAt: null,
      profit: 0,
      socket: {} as any,
    });
    const ctx = makeCtx(1, 'alice');
    await expect(engine.cashOut(ctx)).rejects.toThrow(/not running/i);
  });

  it('credits winAmount = bet * currentMultiplier and broadcasts playerCashout', async () => {
    const engine = new CrashEngine();
    openRound(engine, 'r1', 5);
    engine.__test.setGameRunning(true);
    engine.__test.setMultiplier(2);
    const ctx = makeCtx(1, 'alice');

    // Register the player + an active bet manually.
    const round = engine.__test.getRound();
    round.bets.push({
      userId: 1,
      username: 'alice',
      sessionId: 99,
      betAmount: 100,
      choice: {},
      cashedOut: false,
      cashedOutAt: null,
      profit: 0,
      autoCashoutAt: undefined,
      avatar: null,
      socket: ctx.socket,
    });
    // Register a subscriber so we can verify the broadcast.
    (engine as any).subscribers.add(ctx);
    (engine as any).userSockets.set(1, ctx);

    const result = await engine.cashOut(ctx);

    expect(mockRecordWin).toHaveBeenCalledWith(1, 100, 200, 'crash', { gameSessionId: 99 });
    expect(result.outcome).toBe(200);
    expect(result.finalMultiplier).toBe(2);

    // Bet was marked cashed out.
    const bet = round.bets[0];
    expect(bet.cashedOut).toBe(true);
    expect(bet.cashedOutAt).toBe(2);
    expect(bet.profit).toBe(100);

    // playerCashout was broadcast.
    const calls = ctx._emit.mock.calls.map((c: any[]) => c[0]);
    expect(calls).toContain('playerCashout');
    expect(calls).toContain('balanceUpdate');
  });
});

describe('CrashEngine.processAutoCashouts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordWin.mockResolvedValue({ user: { balance: '1500' } });
  });

  it('fires auto-cashout when multiplier crosses threshold', async () => {
    const engine = new CrashEngine();
    openRound(engine, 'r1', 10);
    engine.__test.setGameRunning(true);
    engine.__test.setMultiplier(2.5);
    const ctx = makeCtx(1, 'alice');
    const round = engine.__test.getRound();
    round.bets.push({
      userId: 1,
      username: 'alice',
      sessionId: 99,
      betAmount: 100,
      choice: { autoCashoutAt: 2 },
      cashedOut: false,
      cashedOutAt: null,
      profit: 0,
      autoCashoutAt: 2,
      avatar: null,
      socket: ctx.socket,
    });
    (engine as any).subscribers.add(ctx);
    (engine as any).userSockets.set(1, ctx);

    await engine.__test.processAutoCashouts();

    const bet = round.bets[0];
    expect(bet.cashedOut).toBe(true);
    expect(bet.cashedOutAt).toBe(2.5);
    expect(mockRecordWin).toHaveBeenCalledWith(1, 100, 250, 'crash', { gameSessionId: 99 });

    // Player gets autoCashoutSuccess event.
    const events = ctx._emit.mock.calls.map((c: any[]) => c[0]);
    expect(events).toContain('autoCashoutSuccess');
    expect(events).toContain('playerCashout');
  });

  it('does NOT fire when multiplier is below threshold', async () => {
    const engine = new CrashEngine();
    openRound(engine, 'r1', 10);
    engine.__test.setGameRunning(true);
    engine.__test.setMultiplier(1.5);
    const ctx = makeCtx(1, 'alice');
    const round = engine.__test.getRound();
    round.bets.push({
      userId: 1,
      username: 'alice',
      sessionId: 99,
      betAmount: 100,
      choice: { autoCashoutAt: 2 },
      cashedOut: false,
      cashedOutAt: null,
      profit: 0,
      autoCashoutAt: 2,
      avatar: null,
      socket: ctx.socket,
    });
    (engine as any).userSockets.set(1, ctx);

    await engine.__test.processAutoCashouts();

    expect(round.bets[0].cashedOut).toBe(false);
    expect(mockRecordWin).not.toHaveBeenCalled();
  });

  it('skips bets without autoCashoutAt', async () => {
    const engine = new CrashEngine();
    openRound(engine, 'r1', 10);
    engine.__test.setGameRunning(true);
    engine.__test.setMultiplier(5);
    const ctx = makeCtx(1, 'alice');
    const round = engine.__test.getRound();
    round.bets.push({
      userId: 1,
      username: 'alice',
      sessionId: 99,
      betAmount: 100,
      choice: {},
      cashedOut: false,
      cashedOutAt: null,
      profit: 0,
      autoCashoutAt: undefined,
      avatar: null,
      socket: ctx.socket,
    });
    (engine as any).userSockets.set(1, ctx);

    await engine.__test.processAutoCashouts();
    expect(round.bets[0].cashedOut).toBe(false);
    expect(mockRecordWin).not.toHaveBeenCalled();
  });
});

describe('CrashEngine.onBet (runExclusive smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue({
      enabled: true,
      maxBet: 5000,
      houseEdge: 0.04,
      payoutTable: {},
    });
    mockAssertCanBet.mockResolvedValue({ ok: true });
    mockPlaceBet.mockResolvedValue({ user: { balance: '900' } });
    mockValuesReturn.mockResolvedValue([{ insertId: 42 }]);
  });

  it('serialises concurrent placeBet from the same user (only first wins, second is rejected as duplicate)', async () => {
    const engine = new CrashEngine();
    openRound(engine, 'r1', 5);
    const ctx = makeCtx(1, 'alice');
    (engine as any).subscribers.add(ctx);

    // Fire two concurrent bets. The base's runExclusive serialises them; the
    // second one runs after the first has pushed to round.bets and should be
    // rejected with the legacy duplicate-bet error.
    const p1 = engine.onBet(ctx, { amount: 100 });
    const p2 = engine.onBet(ctx, { amount: 100 });

    const r1 = await p1.catch((e) => ({ error: e.message }));
    const r2 = await p2.catch((e) => ({ error: e.message }));

    // Exactly one succeeds; the other is rejected with the duplicate message.
    const successes = [r1, r2].filter((r: any) => !('error' in r));
    const failures = [r1, r2].filter((r: any) => 'error' in r);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect((failures[0] as any).error).toMatch(/already have an active bet/i);

    // Only one session row was actually created (one debit).
    expect(mockPlaceBet).toHaveBeenCalledTimes(1);
    expect(engine.__test.getRound().bets).toHaveLength(1);
  });

  it('rejects bets placed outside the betting phase', async () => {
    const engine = new CrashEngine();
    openRound(engine, 'r1', 5);
    engine.__test.getRound().phase = 'running';
    const ctx = makeCtx(1, 'alice');
    await expect(engine.onBet(ctx, { amount: 100 })).rejects.toThrow(/Cannot bet while game is running/i);
    expect(mockPlaceBet).not.toHaveBeenCalled();
  });
});

describe('CrashEngine.bettingDurationMs / revealDurationMs (env vars)', () => {
  it('defaults to 5000ms / 3000ms when env is unset', () => {
    const prevCountdown = process.env.CRASH_COUNTDOWN_MS;
    const prevNext = process.env.CRASH_NEXT_GAME_MS;
    delete process.env.CRASH_COUNTDOWN_MS;
    delete process.env.CRASH_NEXT_GAME_MS;
    try {
      const engine = new CrashEngine();
      expect(engine.bettingDurationMs()).toBe(5000);
      expect(engine.revealDurationMs()).toBe(3000);
    } finally {
      if (prevCountdown !== undefined) process.env.CRASH_COUNTDOWN_MS = prevCountdown;
      if (prevNext !== undefined) process.env.CRASH_NEXT_GAME_MS = prevNext;
    }
  });

  it('respects CRASH_COUNTDOWN_MS env var', () => {
    const prev = process.env.CRASH_COUNTDOWN_MS;
    process.env.CRASH_COUNTDOWN_MS = '500';
    try {
      const engine = new CrashEngine();
      expect(engine.bettingDurationMs()).toBe(500);
    } finally {
      if (prev !== undefined) process.env.CRASH_COUNTDOWN_MS = prev;
      else delete process.env.CRASH_COUNTDOWN_MS;
    }
  });
});
