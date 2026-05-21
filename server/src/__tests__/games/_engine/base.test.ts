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
  // chainable update().set().where()
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
import { GameEngine } from '../../../games/_engine/base.js';

// Minimal concrete subclass exposing protected helpers as public
class TestEngine extends GameEngine {
  readonly gameType = 'dice';

  async onJoin() {
    return {};
  }
  async onBet() {
    return { sessionId: 0, betAmount: 0, balance: 0, outcome: 0, completed: false };
  }
  async onDisconnect() {}

  // Expose protected helpers
  public runEx(userId: number, fn: () => Promise<any>) {
    return this.runExclusive(userId, fn);
  }
  public canBet(userId: number, betAmount: number) {
    return this.assertCanBet(userId, betAmount);
  }
  public startS(userId: number, betAmount: number, seeds: any, initialState?: any) {
    return this.startSession(userId, betAmount, seeds, initialState);
  }
  public endS(userId: number, sessionId: number, betAmount: number, report: any) {
    return this.endSession(userId, sessionId, betAmount, report);
  }
  public updateS(sessionId: number, patch: Record<string, any>) {
    return this.updateSessionState(sessionId, patch);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GameEngine.runExclusive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serialises two concurrent calls for the same userId', async () => {
    const engine = new TestEngine();
    const order: string[] = [];

    const makeFn = (label: string, delayMs: number) => async () => {
      order.push(`${label}:start`);
      await new Promise((r) => setTimeout(r, delayMs));
      order.push(`${label}:end`);
      return label;
    };

    const p1 = engine.runEx(1, makeFn('A', 30));
    const p2 = engine.runEx(1, makeFn('B', 5));

    await Promise.all([p1, p2]);

    // B must not start until A has ended
    expect(order).toEqual(['A:start', 'A:end', 'B:start', 'B:end']);
  });

  it('runs in parallel for different userIds', async () => {
    const engine = new TestEngine();
    const order: string[] = [];

    const makeFn = (label: string, delayMs: number) => async () => {
      order.push(`${label}:start`);
      await new Promise((r) => setTimeout(r, delayMs));
      order.push(`${label}:end`);
      return label;
    };

    const p1 = engine.runEx(1, makeFn('A', 30));
    const p2 = engine.runEx(2, makeFn('B', 5));

    await Promise.all([p1, p2]);

    // B should finish before A (parallel)
    expect(order.indexOf('B:end')).toBeLessThan(order.indexOf('A:end'));
    expect(order.indexOf('B:start')).toBeLessThan(order.indexOf('A:end'));
  });

  it('does not permanently break the lock after a rejected fn', async () => {
    const engine = new TestEngine();

    await expect(
      engine.runEx(1, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    // Subsequent call must still execute
    const result = await engine.runEx(1, async () => 'ok');
    expect(result).toBe('ok');
  });
});

describe('GameEngine.assertCanBet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue({
      enabled: true,
      maxBet: 1000,
      houseEdge: 0.01,
      payoutTable: { x: 1 },
    });
    mockAssertCanBet.mockResolvedValue({ ok: true });
  });

  it('throws invalid_bet for zero', async () => {
    const engine = new TestEngine();
    await expect(engine.canBet(1, 0)).rejects.toThrow('invalid_bet');
  });

  it('throws invalid_bet for negative', async () => {
    const engine = new TestEngine();
    await expect(engine.canBet(1, -5)).rejects.toThrow('invalid_bet');
  });

  it('throws invalid_bet for NaN', async () => {
    const engine = new TestEngine();
    await expect(engine.canBet(1, NaN)).rejects.toThrow('invalid_bet');
  });

  it('throws game_disabled when config.enabled is false', async () => {
    mockGetConfig.mockResolvedValue({
      enabled: false,
      maxBet: 1000,
      houseEdge: 0.01,
      payoutTable: {},
    });
    const engine = new TestEngine();
    await expect(engine.canBet(1, 100)).rejects.toThrow('game_disabled');
  });

  it('throws bet_too_large when bet exceeds maxBet', async () => {
    mockGetConfig.mockResolvedValue({
      enabled: true,
      maxBet: 100,
      houseEdge: 0.01,
      payoutTable: {},
    });
    const engine = new TestEngine();
    await expect(engine.canBet(1, 500)).rejects.toThrow('bet_too_large');
  });

  it('throws limit_<reason> when userLimits.assertCanBet returns ok:false', async () => {
    mockAssertCanBet.mockResolvedValue({ ok: false, reason: 'daily_loss_cap' });
    const engine = new TestEngine();
    await expect(engine.canBet(1, 100)).rejects.toThrow('limit_daily_loss_cap');
  });

  it('returns config snapshot on success', async () => {
    const engine = new TestEngine();
    const out = await engine.canBet(1, 100);
    expect(out).toEqual({
      houseEdge: 0.01,
      maxBet: 1000,
      payoutTable: { x: 1 },
    });
  });
});

describe('GameEngine.startSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValuesReturn.mockResolvedValue([{ insertId: 42 }]);
    mockPlaceBet.mockResolvedValue({ user: { balance: '900' } });
  });

  it('inserts a gameSessions row with the correct shape', async () => {
    const engine = new TestEngine();
    const seeds = {
      serverSeedHash: 'h',
      serverSeed: null,
      clientSeed: 'cs',
      nonce: 1,
      roundId: null,
    };

    await engine.startS(7, 100, seeds, { phase: 'betting' });

    expect(mockDbInsert).toHaveBeenCalled();
    const inserted = mockValuesReturn.mock.calls[0][0];
    expect(inserted.userId).toBe(7);
    expect(inserted.gameType).toBe('dice');
    expect(inserted.initialBet).toBe('100');
    expect(inserted.totalBet).toBe('100');
    expect(inserted.outcome).toBe('0');
    expect(inserted.isCompleted).toBe(false);
    expect(inserted.gameState).toMatchObject({ seeds, phase: 'betting' });
  });

  it('calls balanceService.placeBet with the session id', async () => {
    const engine = new TestEngine();
    await engine.startS(7, 100, { serverSeedHash: 'h', serverSeed: null, clientSeed: 'cs', nonce: 1 });

    expect(mockPlaceBet).toHaveBeenCalledWith(7, 100, 'dice', { gameSessionId: 42 });
  });

  it('returns sessionId and post-debit balance', async () => {
    const engine = new TestEngine();
    const out = await engine.startS(7, 100, { serverSeedHash: 'h', serverSeed: null, clientSeed: 'cs', nonce: 1 });
    expect(out).toEqual({ sessionId: 42, balance: 900 });
  });

  it('throws session_insert_failed when insert returns no id', async () => {
    mockValuesReturn.mockResolvedValue([{ insertId: 0 }]);
    const engine = new TestEngine();
    await expect(
      engine.startS(7, 100, { serverSeedHash: 'h', serverSeed: null, clientSeed: 'cs', nonce: 1 }),
    ).rejects.toThrow('session_insert_failed');
  });
});

describe('GameEngine.endSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordWin.mockResolvedValue({ user: { balance: '1500' } });
    mockGetBalance.mockResolvedValue(800);
  });

  it('calls recordWin when outcome > 0 and uses returned balance', async () => {
    const engine = new TestEngine();
    const balance = await engine.endS(7, 42, 100, {
      outcome: 200,
      finalMultiplier: 2,
      seeds: { serverSeedHash: 'h', serverSeed: 'ss', clientSeed: 'cs', nonce: 1 },
      completed: true,
    });

    expect(mockRecordWin).toHaveBeenCalledWith(7, 100, 200, 'dice', { gameSessionId: 42 });
    expect(mockGetBalance).not.toHaveBeenCalled();
    expect(balance).toBe(1500);
  });

  it('calls getBalance when outcome is 0 (loss)', async () => {
    const engine = new TestEngine();
    const balance = await engine.endS(7, 42, 100, {
      outcome: 0,
      completed: true,
    });

    expect(mockRecordWin).not.toHaveBeenCalled();
    expect(mockGetBalance).toHaveBeenCalledWith(7);
    expect(balance).toBe(800);
  });

  it('updates the gameSessions row with the seeds and completed:true', async () => {
    const engine = new TestEngine();
    const seeds = { serverSeedHash: 'h', serverSeed: 'ss', clientSeed: 'cs', nonce: 1 };
    await engine.endS(7, 42, 100, {
      outcome: 200,
      finalMultiplier: 2,
      seeds,
      resultDetails: { foo: 'bar' },
      completed: true,
    });

    expect(mockDbUpdate).toHaveBeenCalled();
    const setArg = mockSetReturn.mock.calls[0][0];
    expect(setArg.outcome).toBe('200');
    expect(setArg.finalMultiplier).toBe('2');
    expect(setArg.gameState).toEqual({ seeds });
    expect(setArg.resultDetails).toEqual({ foo: 'bar' });
    expect(setArg.isCompleted).toBe(true);
    expect(setArg.endTime).toBeInstanceOf(Date);
  });

  it('leaves endTime null when not completed', async () => {
    const engine = new TestEngine();
    await engine.endS(7, 42, 100, {
      outcome: 0,
      completed: false,
    });
    const setArg = mockSetReturn.mock.calls[0][0];
    expect(setArg.isCompleted).toBe(false);
    expect(setArg.endTime).toBeNull();
  });
});

describe('GameEngine.updateSessionState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes the patch into gameState column', async () => {
    const engine = new TestEngine();
    await engine.updateS(42, { revealed: [1, 2] });
    const setArg = mockSetReturn.mock.calls[0][0];
    expect(setArg.gameState).toEqual({ revealed: [1, 2] });
  });
});
