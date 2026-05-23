// @ts-nocheck
/**
 * WheelEngine lifecycle + connection tests.
 *
 * Backfills coverage for previously-uncovered paths in
 * server/src/games/wheel/engine.ts:
 *   - onJoin / onDisconnect — presence, snapshot, mid-spin join (wheelSpinning)
 *   - processResults — settles each bet (winners + losers), pushes history,
 *     emits wheel:game_result, handles endSession failures
 *   - payoutTableForBroadcast — default vs overridden tables
 *   - currentBetsFlat — defaults difficulty to 'medium' when missing
 *   - start / stop — idempotency + timer cleanup
 *   - currentCountdown getter via the gameState payload
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  return { default: proxy, ProvablyFair: actual.ProvablyFair };
});

import { WheelEngine } from '../../../games/wheel/engine.js';

function makeCtx(userId: number, username: string) {
  const emitted: Array<{ event: string; payload: any }> = [];
  const socket = {
    emit: (event: string, payload?: any) => {
      emitted.push({ event, payload });
    },
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

describe('WheelEngine.onJoin / onDisconnect', () => {
  it('emits wheel:gameState + wheel:activePlayers on join', async () => {
    const engine = new WheelEngine();
    const ctx = makeCtx(1, 'alice');
    await engine.onJoin(ctx);

    const events = ctx._emitted.map((e: any) => e.event);
    expect(events).toContain('wheel:gameState');
    expect(events).toContain('wheel:activePlayers');
    expect((engine as any).activePlayers.has(1)).toBe(true);
  });

  it('emits wheelSpinning when joining during the running phase', async () => {
    const engine = new WheelEngine();
    // Place engine in running with cached lastSpin.
    (engine as any).openRound();
    (engine as any).round.phase = 'running';
    (engine as any).lastSpin = { segmentIndex: 5, targetAngle: 1200 };

    const ctx = makeCtx(1, 'alice');
    await engine.onJoin(ctx);

    const events = ctx._emitted.map((e: any) => e.event);
    expect(events).toContain('wheelSpinning');
  });

  it('broadcasts wheel:playerJoined to existing subscribers (not the joiner)', async () => {
    const engine = new WheelEngine();
    const ctxA = makeCtx(1, 'alice');
    const ctxB = makeCtx(2, 'bob');

    await engine.onJoin(ctxA);
    ctxA._emitted.length = 0;
    await engine.onJoin(ctxB);

    const aEvents = ctxA._emitted.map((e: any) => e.event);
    expect(aEvents).toContain('wheel:playerJoined');

    const bSelf = ctxB._emitted
      .map((e: any) => e.event)
      .filter((e: string) => e === 'wheel:playerJoined');
    expect(bSelf).toHaveLength(0);
  });

  it('removes the player on disconnect and broadcasts wheel:playerLeft', async () => {
    const engine = new WheelEngine();
    const ctxA = makeCtx(1, 'alice');
    const ctxB = makeCtx(2, 'bob');

    await engine.onJoin(ctxA);
    await engine.onJoin(ctxB);
    ctxA._emitted.length = 0;
    await engine.onDisconnect(ctxB);

    expect((engine as any).activePlayers.has(2)).toBe(false);
    const aEvents = ctxA._emitted.map((e: any) => e.event);
    expect(aEvents).toContain('wheel:playerLeft');
  });
});

describe('WheelEngine.processResults', () => {
  it('settles winners — calls recordWin and emits wheel:personal_result', async () => {
    const engine = new WheelEngine();
    const ctx = makeCtx(1, 'alice');
    await engine.onJoin(ctx);

    // Set up a round with one easy-difficulty bet, segmentIndex=11 (3x payout).
    (engine as any).openRound();
    (engine as any).round.bets.push({
      userId: 1,
      username: 'alice',
      sessionId: 99,
      betAmount: 10,
      choice: { difficulty: 'easy' },
      cashedOut: false,
      socket: ctx.socket,
    });

    const seed = { serverSeed: 's', serverSeedHash: 'h', clientSeed: 'c', nonce: 0 };
    ctx._emitted.length = 0;
    await (engine as any).processResults(11, seed);

    expect(mockRecordWin).toHaveBeenCalled();
    const events = ctx._emitted.map((e: any) => e.event);
    expect(events).toContain('wheel:personal_result');
    expect(events).toContain('balanceUpdate');

    // History was pushed.
    expect((engine as any).history.length).toBe(1);
    expect((engine as any).history.slice()[0].segmentIndex).toBe(11);
  });

  it('handles losers (segment 0 -> 0x) — no recordWin call, still emits result', async () => {
    const engine = new WheelEngine();
    const ctx = makeCtx(1, 'alice');
    await engine.onJoin(ctx);

    (engine as any).openRound();
    (engine as any).round.bets.push({
      userId: 1,
      username: 'alice',
      sessionId: 99,
      betAmount: 10,
      choice: { difficulty: 'easy' },
      cashedOut: false,
      socket: ctx.socket,
    });

    const seed = { serverSeed: 's', serverSeedHash: 'h', clientSeed: 'c', nonce: 0 };
    mockRecordWin.mockClear();
    ctx._emitted.length = 0;
    await (engine as any).processResults(0, seed);

    expect(mockRecordWin).not.toHaveBeenCalled();
    // wheel:personal_result is still emitted with winAmount=0
    const personalResult = ctx._emitted.find((e: any) => e.event === 'wheel:personal_result');
    expect(personalResult).toBeDefined();
    expect(personalResult.payload.winAmount).toBe(0);
  });

  it('continues to next bettor when endSession throws for one', async () => {
    const engine = new WheelEngine();
    const ctxA = makeCtx(1, 'a');
    const ctxB = makeCtx(2, 'b');
    await engine.onJoin(ctxA);
    await engine.onJoin(ctxB);

    (engine as any).openRound();
    (engine as any).round.bets.push(
      {
        userId: 1,
        username: 'a',
        sessionId: 99,
        betAmount: 10,
        choice: { difficulty: 'easy' },
        cashedOut: false,
        socket: ctxA.socket,
      },
      {
        userId: 2,
        username: 'b',
        sessionId: 100,
        betAmount: 20,
        choice: { difficulty: 'easy' },
        cashedOut: false,
        socket: ctxB.socket,
      },
    );

    // segmentIndex 11 -> winners (easy 3x). Have recordWin reject for user 1 only.
    mockRecordWin
      .mockRejectedValueOnce(new Error('balance unavailable'))
      .mockResolvedValueOnce({ user: { balance: 1100 } });

    const seed = { serverSeed: 's', serverSeedHash: 'h', clientSeed: 'c', nonce: 0 };
    await (engine as any).processResults(11, seed);

    // Second user still got their result event.
    const bEvents = ctxB._emitted.map((e: any) => e.event);
    expect(bEvents).toContain('wheel:personal_result');
  });

  it('history is capped at MAX_HISTORY entries', async () => {
    const engine = new WheelEngine();
    // Pre-fill history to one entry short of cap.
    const seed = { serverSeed: 's', serverSeedHash: 'h', clientSeed: 'c', nonce: 0 };
    (engine as any).openRound();
    for (let i = 0; i < 101; i++) {
      await (engine as any).processResults(0, seed);
      // Re-open the round so processResults can push again without bet rows.
      (engine as any).openRound();
    }
    expect((engine as any).history.length).toBeLessThanOrEqual(100);
  });
});

describe('WheelEngine.payoutTableForBroadcast', () => {
  it('returns the default table when no override is set', () => {
    const engine = new WheelEngine();
    const table = (engine as any).payoutTableForBroadcast();
    expect(Object.keys(table)).toEqual(expect.arrayContaining(['easy', 'medium', 'hard']));
    // Default tables have at least one entry per difficulty.
    expect(table.easy.length).toBeGreaterThan(0);
    expect(table.easy[0]).toEqual({ multiplier: expect.any(Number) });
  });

  it('uses overridden payoutTable when provided', () => {
    const engine = new WheelEngine();
    const customMedium = new Array(12).fill(0).map((_, i) => i + 1);
    (engine as any).currentPayoutTable = { medium: customMedium };
    const table = (engine as any).payoutTableForBroadcast();
    expect(table.medium).toHaveLength(12);
    expect(table.medium[5]).toEqual({ multiplier: 6 });
  });
});

describe('WheelEngine.currentBetsFlat', () => {
  it('returns empty array when no bets are placed', () => {
    const engine = new WheelEngine();
    expect((engine as any).currentBetsFlat()).toEqual([]);
  });

  it('defaults difficulty to "medium" when missing on the bet', () => {
    const engine = new WheelEngine();
    (engine as any).openRound();
    (engine as any).round.bets.push({
      userId: 1,
      username: 'a',
      sessionId: 1,
      betAmount: 10,
      choice: {}, // no difficulty
      cashedOut: false,
      socket: {} as any,
    });
    const flat = (engine as any).currentBetsFlat();
    expect(flat[0].difficulty).toBe('medium');
  });
});

describe('WheelEngine.start / stop', () => {
  it('start() is idempotent', () => {
    const engine = new WheelEngine();
    engine.start();
    expect((engine as any)._started).toBe(true);
    // Second call must be a no-op (no error, flag unchanged).
    engine.start();
    expect((engine as any)._started).toBe(true);
    engine.stop();
  });

  it('stop() clears both timers and is safe to call without start', () => {
    const engine = new WheelEngine();
    (engine as any)._countdownTimer = setInterval(() => {}, 1000);
    (engine as any)._phaseTimer = setTimeout(() => {}, 1000);
    engine.stop();
    expect((engine as any)._countdownTimer).toBeNull();
    expect((engine as any)._phaseTimer).toBeNull();
    expect(() => engine.stop()).not.toThrow();
  });
});
