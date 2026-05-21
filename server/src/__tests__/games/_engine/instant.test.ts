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
  mockDbInsert,
  mockDbUpdate,
  mockValuesReturn,
  mockSetReturn,
  mockWhereReturn,
} = vi.hoisted(() => {
  const mockWhereReturn = vi.fn().mockResolvedValue(undefined);
  const mockSetReturn = vi.fn(() => ({ where: mockWhereReturn }));
  const mockValuesReturn = vi.fn().mockResolvedValue([{ insertId: 99 }]);
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
  },
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
import { InstantResolveEngine } from '../../../games/_engine/instant.js';

// Subclass that exposes the protected helpers for testing.
class OneShotEngine extends InstantResolveEngine {
  readonly gameType = 'dice';
  protected readonly rotateAfterDraws = 3;

  // Hooks for inspecting abandon calls
  public abandonCalls: number[] = [];

  protected async onAbandon(userId: number) {
    this.abandonCalls.push(userId);
  }

  // Required abstract — minimal stub; we test via oneShot directly
  async onBet() {
    return { sessionId: 0, betAmount: 0, balance: 0, outcome: 0, completed: false };
  }

  // Expose protected helpers
  public ensureS(userId: number) {
    return this.ensureSeeds(userId);
  }
  public nextBundle(userId: number, onRotate?: (b: any) => void) {
    return this.nextSeedBundle(userId, onRotate);
  }
  public runOneShot(ctx: any, betAmount: number, compute: any) {
    return this.oneShot(ctx, betAmount, compute);
  }
}

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
// Tests
// ---------------------------------------------------------------------------

describe('InstantResolveEngine.ensureSeeds', () => {
  it('mints on first call; returns same state on subsequent calls', () => {
    const engine = new OneShotEngine();
    const a = engine.ensureS(1);
    const b = engine.ensureS(1);
    expect(a).toBe(b);
    expect(a.serverSeed).toMatch(/^[0-9a-f]+$/);
    expect(a.serverSeedHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.nextNonce).toBe(1);
  });

  it('different users get different seed states', () => {
    const engine = new OneShotEngine();
    const a = engine.ensureS(1);
    const b = engine.ensureS(2);
    expect(a).not.toBe(b);
    expect(a.serverSeed).not.toBe(b.serverSeed);
  });
});

describe('InstantResolveEngine.nextSeedBundle', () => {
  it('increments nonce on each call', () => {
    const engine = new OneShotEngine();
    const b1 = engine.nextBundle(1);
    const b2 = engine.nextBundle(1);
    const b3 = engine.nextBundle(1);
    expect(b1.nonce).toBe(1);
    expect(b2.nonce).toBe(2);
    expect(b3.nonce).toBe(3);
  });

  it('rotates after rotateAfterDraws (=3) and resets nonce to 1', () => {
    const engine = new OneShotEngine();
    const onRotate = vi.fn();

    // Consume nonces 1, 2, 3
    const b1 = engine.nextBundle(1, onRotate);
    const b2 = engine.nextBundle(1, onRotate);
    const b3 = engine.nextBundle(1, onRotate);

    expect(b1.serverSeed).toBe(b2.serverSeed);
    expect(b2.serverSeed).toBe(b3.serverSeed);
    expect(onRotate).not.toHaveBeenCalled();

    // 4th call: nextNonce=4 > rotateAfterDraws=3 -> rotates BEFORE drawing
    const b4 = engine.nextBundle(1, onRotate);

    expect(onRotate).toHaveBeenCalledTimes(1);
    const revealed = onRotate.mock.calls[0][0];
    expect(revealed.serverSeed).toBe(b3.serverSeed); // old seed
    expect(revealed.nonce).toBe(3);

    // New seed material on b4
    expect(b4.serverSeed).not.toBe(b3.serverSeed);
    expect(b4.nonce).toBe(1);
  });
});

describe('InstantResolveEngine.rotateForNewClientSeed', () => {
  it('returns the revealed bundle and new hash+seed; new seed is normalised', () => {
    const engine = new OneShotEngine();
    const before = engine.ensureS(1);
    const beforeSeed = before.serverSeed;
    engine.nextBundle(1); // bump nonce to 2

    const { revealed, next } = engine.rotateForNewClientSeed(1, '  my_seed_1  ');

    expect(revealed.serverSeed).toBe(beforeSeed);
    expect(next.clientSeed).toBe('my_seed_1');
    expect(next.serverSeedHash).toMatch(/^[0-9a-f]{64}$/);

    // Subsequent draw uses new state with nonce 1
    const b = engine.nextBundle(1);
    expect(b.nonce).toBe(1);
    expect(b.clientSeed).toBe('my_seed_1');
  });

  it('normalises a malformed seed to a hex fallback', () => {
    const engine = new OneShotEngine();
    const { next } = engine.rotateForNewClientSeed(1, "'; DROP TABLE --");
    expect(next.clientSeed).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('InstantResolveEngine.onDisconnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onAbandon when a session is open and clears seed cache', async () => {
    const engine = new OneShotEngine();
    const ctx = makeCtx(5);

    // Seed the user and open a fake session
    engine.ensureS(5);
    (engine as any).sessions.set(5, { sessionId: 1, betAmount: 10, seeds: {}, startedAt: 0 });

    await engine.onDisconnect(ctx);

    expect(engine.abandonCalls).toEqual([5]);
    expect((engine as any).sessions.has(5)).toBe(false);
    expect((engine as any).userSeeds.has(5)).toBe(false);
  });

  it('always clears userSeeds even when no session is open', async () => {
    const engine = new OneShotEngine();
    const ctx = makeCtx(5);
    engine.ensureS(5);

    await engine.onDisconnect(ctx);

    expect(engine.abandonCalls).toEqual([]);
    expect((engine as any).userSeeds.has(5)).toBe(false);
  });
});

describe('InstantResolveEngine.oneShot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue({
      enabled: true,
      maxBet: 1000,
      houseEdge: 0.01,
      payoutTable: { multiplier: 2 },
    });
    mockAssertCanBet.mockResolvedValue({ ok: true });
    mockValuesReturn.mockResolvedValue([{ insertId: 99 }]);
    mockPlaceBet.mockResolvedValue({ user: { balance: '900' } });
    mockRecordWin.mockResolvedValue({ user: { balance: '1100' } });
    mockGetBalance.mockResolvedValue(900);
  });

  it('runs the full flow: startSession, compute callback, endSession, returns BetResult', async () => {
    const engine = new OneShotEngine();
    const ctx = makeCtx(7);

    const compute = vi.fn().mockResolvedValue({
      outcome: 200,
      multiplier: 2,
      details: { foo: 'bar' },
    });

    const result = await engine.runOneShot(ctx, 100, compute);

    // startSession path
    expect(mockDbInsert).toHaveBeenCalled();
    expect(mockPlaceBet).toHaveBeenCalledWith(7, 100, 'dice', { gameSessionId: 99 });

    // compute called with seed bundle + config
    expect(compute).toHaveBeenCalledOnce();
    const computeArgs = compute.mock.calls[0][0];
    expect(computeArgs.seed).toMatchObject({
      serverSeed: expect.any(String),
      serverSeedHash: expect.any(String),
      clientSeed: expect.any(String),
      nonce: 1,
    });
    expect(computeArgs.houseEdge).toBe(0.01);
    expect(computeArgs.payoutTable).toEqual({ multiplier: 2 });

    // endSession path
    expect(mockRecordWin).toHaveBeenCalledWith(7, 100, 200, 'dice', { gameSessionId: 99 });

    // BetResult shape
    expect(result).toMatchObject({
      sessionId: 99,
      betAmount: 100,
      outcome: 200,
      finalMultiplier: 2,
      resultDetails: { foo: 'bar' },
      completed: true,
    });
    expect(result.balance).toBe(1100);
    expect(result.seeds.serverSeed).toBeTruthy();
  });

  it('falls back to post-debit balance when endSession returns 0', async () => {
    // outcome=0 -> getBalance is used; mock it to 0 so we fall back to postDebit
    mockGetBalance.mockResolvedValue(0);

    const engine = new OneShotEngine();
    const ctx = makeCtx(7);

    const compute = vi.fn().mockResolvedValue({ outcome: 0 });

    const result = await engine.runOneShot(ctx, 100, compute);

    // postDebit was 900 from placeBet mock
    expect(result.balance).toBe(900);
    expect(result.outcome).toBe(0);
  });

  it('emits seedRotated when nonce exceeds rotateAfterDraws', async () => {
    const engine = new OneShotEngine();
    const ctx = makeCtx(7);

    // Consume nonces 1, 2, 3 directly
    engine.nextBundle(7);
    engine.nextBundle(7);
    engine.nextBundle(7);

    const compute = vi.fn().mockResolvedValue({ outcome: 0 });
    await engine.runOneShot(ctx, 100, compute);

    // ctx.emit should have been called with seedRotated
    const rotatedCall = ctx.emit.mock.calls.find((c: any[]) => c[0] === 'seedRotated');
    expect(rotatedCall).toBeDefined();
    expect(rotatedCall[1].revealed.serverSeed).toBeTruthy();
  });

  it('propagates errors thrown by assertCanBet (e.g. game_disabled)', async () => {
    mockGetConfig.mockResolvedValue({
      enabled: false,
      maxBet: 1000,
      houseEdge: 0.01,
      payoutTable: {},
    });
    const engine = new OneShotEngine();
    const ctx = makeCtx(7);

    await expect(
      engine.runOneShot(ctx, 100, vi.fn()),
    ).rejects.toThrow('game_disabled');

    expect(mockPlaceBet).not.toHaveBeenCalled();
  });
});

describe('InstantResolveEngine.onJoin', () => {
  it('returns the serverSeedHash and the next nonce state', async () => {
    const engine = new OneShotEngine();
    const ctx = makeCtx(7);
    const payload = await engine.onJoin(ctx);
    expect(payload.serverSeedHash).toMatch(/^[0-9a-f]{64}$/);
    expect(payload.state.nextNonce).toBe(1);
    expect(payload.state.hasActiveSession).toBe(false);
  });
});
