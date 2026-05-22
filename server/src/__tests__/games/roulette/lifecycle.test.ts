// @ts-nocheck
/**
 * RouletteEngine lifecycle + connection tests.
 *
 * Backfills coverage for previously-uncovered paths in
 * server/src/games/roulette/engine.ts:
 *   - onJoin / onDisconnect — presence tracking, snapshot emit, mid-spin join,
 *     legacy socket.on shims
 *   - processResults — history push, per-user `roulette:personal_result`
 *     aggregate, balance refresh failure path
 *   - formatClientError — every code branch
 *   - start / stop — idempotency + timer cleanup
 *   - allBetsFlat / countdownRemainingSeconds helpers
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  let nextInsertId = 200;
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

vi.mock('../../../games/_engine/provablyFair.js', async () => {
  const actual: any = await vi.importActual('../../../games/_engine/provablyFair.js');
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

import { RouletteEngine } from '../../../games/roulette/engine.js';
import { ROULETTE_NUMBERS } from '../../../games/roulette/wheel.js';

function makeCtx(userId: number, username: string) {
  const emitted: Array<{ event: string; payload: any }> = [];
  const socketHandlers: Record<string, Function> = {};
  const socket = {
    emit: (event: string, payload?: any) => emitted.push({ event, payload }),
    on: vi.fn((evt: string, fn: Function) => {
      socketHandlers[evt] = fn;
    }),
  } as any;
  return {
    socket,
    user: { userId, username, role: 'user', balance: 1000, isActive: true },
    emit: (event: string, payload?: any) => emitted.push({ event, payload }),
    broadcast: vi.fn(),
    namespace: {} as any,
    _emitted: emitted,
    _socketHandlers: socketHandlers,
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
  mockRecordWin.mockResolvedValue({ user: { balance: 1100 } });
  mockGetBalance.mockResolvedValue(900);
});

describe('RouletteEngine.onJoin / onDisconnect', () => {
  it('emits roulette:gameState + roulette:activePlayers on join', async () => {
    const engine = new RouletteEngine();
    const ctx = makeCtx(1, 'alice');
    await engine.onJoin(ctx);

    const events = ctx._emitted.map((e: any) => e.event);
    expect(events).toContain('roulette:gameState');
    expect(events).toContain('roulette:activePlayers');
    expect((engine as any).activePlayers.has(1)).toBe(true);
  });

  it('emits roulette:spin_started when joining mid-spin', async () => {
    const engine = new RouletteEngine();
    // Simulate the engine being in spinning phase with cached spinAngles.
    (engine as any).currentPhase = 'spinning';
    (engine as any).currentSpinAngles = { phases: [], totalDuration: 5000 };
    (engine as any).openRound();

    const ctx = makeCtx(1, 'alice');
    await engine.onJoin(ctx);

    const events = ctx._emitted.map((e: any) => e.event);
    expect(events).toContain('roulette:spin_started');
  });

  it('broadcasts roulette:playerJoined to other subscribers (not the joiner)', async () => {
    const engine = new RouletteEngine();
    const ctxA = makeCtx(1, 'alice');
    const ctxB = makeCtx(2, 'bob');

    await engine.onJoin(ctxA);
    ctxA._emitted.length = 0;
    await engine.onJoin(ctxB);

    const aEvents = ctxA._emitted.map((e: any) => e.event);
    expect(aEvents).toContain('roulette:playerJoined');

    // Bob himself should not see his own playerJoined broadcast.
    const bEvents = ctxB._emitted.map((e: any) => e.event);
    const bSelf = bEvents.filter((e: string) => e === 'roulette:playerJoined');
    expect(bSelf).toHaveLength(0);
  });

  it('removes the player on disconnect and broadcasts roulette:playerLeft', async () => {
    const engine = new RouletteEngine();
    const ctxA = makeCtx(1, 'alice');
    const ctxB = makeCtx(2, 'bob');

    await engine.onJoin(ctxA);
    await engine.onJoin(ctxB);
    ctxA._emitted.length = 0;
    await engine.onDisconnect(ctxB);

    expect((engine as any).activePlayers.has(2)).toBe(false);
    const aEvents = ctxA._emitted.map((e: any) => e.event);
    expect(aEvents).toContain('roulette:playerLeft');
  });

  it('binds legacy socket events (roulette:join / get_history / spin)', async () => {
    const engine = new RouletteEngine();
    const ctx = makeCtx(1, 'alice');
    await engine.onJoin(ctx);

    // socket.on should have been called for these legacy events.
    const events = Object.keys(ctx._socketHandlers);
    expect(events).toContain('roulette:join');
    expect(events).toContain('roulette:place_bet');
    expect(events).toContain('roulette:spin');
    expect(events).toContain('roulette:get_history');

    // Drive the `roulette:join` shim — it should reply via callback.
    const cb1 = vi.fn();
    ctx._socketHandlers['roulette:join']({}, cb1);
    expect(cb1).toHaveBeenCalledWith({ success: true, history: expect.any(Array) });

    // Drive `roulette:spin` — automated reply.
    const cb2 = vi.fn();
    ctx._socketHandlers['roulette:spin']({}, cb2);
    expect(cb2).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: expect.stringMatching(/automated/i) }),
    );

    // Drive `roulette:get_history` with a custom limit.
    const cb3 = vi.fn();
    ctx._socketHandlers['roulette:get_history']({ limit: 3 }, cb3);
    expect(cb3).toHaveBeenCalledWith({ success: true, globalHistory: expect.any(Array) });
  });

  it('socket place_bet shim translates engine errors via formatClientError', async () => {
    const engine = new RouletteEngine();
    const ctx = makeCtx(1, 'alice');
    await engine.onJoin(ctx);
    // currentPhase is 'waiting' — placeBet should throw 'Betting is closed'.
    const cb = vi.fn();
    await ctx._socketHandlers['roulette:place_bet']({ type: 'RED', amount: 10 }, cb);
    expect(cb).toHaveBeenCalledWith({ success: false, error: 'Betting is closed' });
  });
});

describe('RouletteEngine.formatClientError', () => {
  const engine = new RouletteEngine();
  const fmt = (code: string) => (engine as any).formatClientError(code);

  it.each([
    ['not_betting_phase', 'Betting is closed'],
    ['Betting is closed', 'Betting is closed'],
    ['game_disabled', 'Game is currently disabled'],
    ['bet_too_large', 'Bet exceeds maximum'],
    ['invalid_bet', 'Invalid bet'],
    ['invalid_bet_type', 'Invalid bet type'],
    ['invalid_straight_value', 'Invalid straight bet (must be 0-36)'],
    ['invalid_group_value', 'Invalid dozen/column value (must be 1, 2, or 3)'],
    ['invalid_combo_value', 'Invalid combination bet value'],
  ])('maps %s -> %s', (code, expected) => {
    expect(fmt(code)).toBe(expected);
  });

  it('formats limit_* codes', () => {
    expect(fmt('limit_session_limit_exceeded')).toBe('Bet blocked: session_limit_exceeded');
  });

  it('passes through unknown codes verbatim', () => {
    expect(fmt('something_weird')).toBe('something_weird');
  });
});

describe('RouletteEngine.processResults', () => {
  it('pushes a history entry and broadcasts roulette:spin_result', async () => {
    const engine = new RouletteEngine();
    const ctx = makeCtx(1, 'alice');
    await engine.onJoin(ctx);

    // Force engine into running phase with a placed bet so resolveRound has
    // something to settle.
    const idx = ROULETTE_NUMBERS.findIndex((s) => s.number === 7);
    mockGenerateRouletteNumber.mockReturnValue({
      value: idx,
      seeds: { serverSeed: 's', serverSeedHash: 'h', clientSeed: 'c', nonce: 0 },
    });

    (engine as any).openRound();
    (engine as any).currentPhase = 'betting';
    await engine.placeBet(ctx, { type: 'RED', amount: 10 });
    // Move to running so resolveRound is reachable.
    (engine as any).lockBetting();
    (engine as any).currentPhase = 'spinning';

    ctx._emitted.length = 0;
    await (engine as any).processResults(7, 'red');

    // History was pushed.
    expect((engine as any).__getHistory()).toHaveLength(1);
    expect((engine as any).__getHistory()[0].winningNumber).toBe(7);

    // Public broadcasts.
    const events = ctx._emitted.map((e: any) => e.event);
    expect(events).toContain('roulette:spin_result');
    expect(events).toContain('roulette:personal_result');
  });

  it('continues even when getBalance throws (best-effort balance broadcast)', async () => {
    const engine = new RouletteEngine();
    const ctx = makeCtx(1, 'alice');
    await engine.onJoin(ctx);

    const idx = ROULETTE_NUMBERS.findIndex((s) => s.number === 5);
    mockGenerateRouletteNumber.mockReturnValue({
      value: idx,
      seeds: { serverSeed: 's', serverSeedHash: 'h', clientSeed: 'c', nonce: 0 },
    });

    (engine as any).openRound();
    (engine as any).currentPhase = 'betting';
    await engine.placeBet(ctx, { type: 'BLACK', amount: 10 });
    (engine as any).lockBetting();
    (engine as any).currentPhase = 'spinning';

    mockGetBalance.mockRejectedValue(new Error('db down'));

    // Should not throw despite the balance failure.
    await expect((engine as any).processResults(5, 'red')).resolves.toBeUndefined();
  });

  it('stop() halts the loop — processResults early-returns when stopped', async () => {
    const engine = new RouletteEngine();
    const ctx = makeCtx(1, 'alice');
    await engine.onJoin(ctx);
    (engine as any).stopped = true;
    ctx._emitted.length = 0;

    await (engine as any).processResults(7, 'red');
    const events = ctx._emitted.map((e: any) => e.event);
    expect(events).not.toContain('roulette:spin_result');
  });
});

describe('RouletteEngine.start / stop', () => {
  it('start() is a no-op when phase is not "waiting"', () => {
    const engine = new RouletteEngine();
    (engine as any).currentPhase = 'betting';
    // No throw, no state change.
    expect(() => engine.start()).not.toThrow();
    expect((engine as any).currentPhase).toBe('betting');
  });

  it('stop() clears countdown + phase timers and is safe to call repeatedly', () => {
    const engine = new RouletteEngine();
    // Manually set timers so stop() exercises both clear branches.
    (engine as any).countdownTimer = setInterval(() => {}, 1000);
    (engine as any).phaseTimer = setTimeout(() => {}, 1000);
    engine.stop();
    expect((engine as any).countdownTimer).toBeNull();
    expect((engine as any).phaseTimer).toBeNull();
    // Calling again is safe.
    expect(() => engine.stop()).not.toThrow();
  });
});

describe('RouletteEngine.allBetsFlat / countdownRemainingSeconds', () => {
  it('allBetsFlat returns 0 entries when no bets', () => {
    const engine = new RouletteEngine();
    expect((engine as any).allBetsFlat()).toEqual([]);
  });

  it('countdownRemainingSeconds returns 0 outside betting phase', () => {
    const engine = new RouletteEngine();
    (engine as any).currentPhase = 'spinning';
    expect((engine as any).countdownRemainingSeconds()).toBe(0);
  });

  it('countdownRemainingSeconds reports seconds remaining during betting', () => {
    const engine = new RouletteEngine();
    (engine as any).currentPhase = 'betting';
    (engine as any).openRound();
    // openRound sets round.endsAt = Date.now() + bettingDurationMs(), which is
    // at least 15 seconds in the future for the default config.
    const remaining = (engine as any).countdownRemainingSeconds();
    expect(remaining).toBeGreaterThanOrEqual(1);
  });
});
