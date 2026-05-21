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
} = vi.hoisted(() => {
  const mockWhereReturn = vi.fn().mockResolvedValue(undefined);
  const mockSetReturn = vi.fn(() => ({ where: mockWhereReturn }));
  const mockValuesReturn = vi.fn().mockResolvedValue([{ insertId: 77 }]);
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
    logBetPlaced: vi.fn(),
    logBetResult: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
import { LandminesEngine } from '../../../games/landmines/engine.js';

function makeCtx(userId = 1) {
  const emitted: Array<{ event: string; payload: any }> = [];
  const broadcasted: Array<{ event: string; payload: any }> = [];
  const ctx: any = {
    user: { userId, username: `u${userId}`, role: 'user', balance: 1000, isActive: true },
    socket: { id: `s${userId}`, emit: vi.fn() },
    emit: (event: string, payload?: any) => emitted.push({ event, payload }),
    broadcast: (event: string, payload?: any) => broadcasted.push({ event, payload }),
    namespace: {},
    _emitted: emitted,
    _broadcasted: broadcasted,
  };
  return ctx;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfig.mockResolvedValue({
    enabled: true,
    maxBet: 0,
    houseEdge: 0.05,
    payoutTable: null,
  });
  mockAssertCanBet.mockResolvedValue({ ok: true });
  mockPlaceBet.mockResolvedValue({ user: { balance: 900 } });
  mockRecordWin.mockResolvedValue({ user: { balance: 1050 } });
  mockGetBalance.mockResolvedValue(900);
  mockValuesReturn.mockResolvedValue([{ insertId: 77 }]);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Force-set a deterministic mine grid on the active session. */
function setGrid(engine: LandminesEngine, userId: number, minePositions: Array<[number, number]>) {
  const session = (engine as any).sessions.get(userId);
  const grid: boolean[][] = [];
  for (let r = 0; r < 5; r++) grid.push(new Array(5).fill(false));
  for (const [r, c] of minePositions) grid[r][c] = true;
  session.mineGrid = grid;
  session.mines = minePositions.length;
}

// ---------------------------------------------------------------------------
// onBet
// ---------------------------------------------------------------------------

describe('LandminesEngine.onBet', () => {
  it('rejects an invalid bet amount', async () => {
    const engine = new LandminesEngine();
    const ctx = makeCtx(1);
    await expect(engine.onBet(ctx, { betAmount: 0, mines: 3 })).rejects.toThrow(/invalid_bet/);
    await expect(engine.onBet(ctx, { betAmount: -10, mines: 3 })).rejects.toThrow(/invalid_bet/);
  });

  it('rejects mines outside 1..24', async () => {
    const engine = new LandminesEngine();
    const ctx = makeCtx(1);
    await expect(engine.onBet(ctx, { betAmount: 10, mines: 0 })).rejects.toThrow(/invalid_mines/);
    await expect(engine.onBet(ctx, { betAmount: 10, mines: 25 })).rejects.toThrow(/invalid_mines/);
    await expect(engine.onBet(ctx, { betAmount: 10, mines: 2.5 })).rejects.toThrow(/invalid_mines/);
  });

  it('opens a session, debits, returns BetResult with completed:false', async () => {
    const engine = new LandminesEngine();
    const ctx = makeCtx(1);
    const result = await engine.onBet(ctx, { betAmount: 100, mines: 3 });

    expect(result.sessionId).toBe(77);
    expect(result.betAmount).toBe(100);
    expect(result.outcome).toBe(0);
    expect(result.completed).toBe(false);
    expect(result.balance).toBe(900);
    expect(result.resultDetails?.gridSize).toBe(5);
    expect(result.resultDetails?.mines).toBe(3);

    // BalanceService.placeBet wired through.
    expect(mockPlaceBet).toHaveBeenCalledWith(1, 100, 'landmines', { gameSessionId: 77 });
    // Session stored.
    expect((engine as any).sessions.has(1)).toBe(true);
    // Balance update emitted to the player.
    expect(ctx._emitted.find((e: any) => e.event === 'balanceUpdate')?.payload).toEqual({ balance: 900 });
  });

  it('rejects starting a second game while one is active', async () => {
    const engine = new LandminesEngine();
    const ctx = makeCtx(2);
    await engine.onBet(ctx, { betAmount: 50, mines: 3 });
    await expect(engine.onBet(ctx, { betAmount: 50, mines: 3 })).rejects.toThrow(/game_in_progress/);
  });

  it('propagates config errors (game disabled)', async () => {
    mockGetConfig.mockResolvedValueOnce({ enabled: false, maxBet: 0, houseEdge: 0.05, payoutTable: null });
    const engine = new LandminesEngine();
    const ctx = makeCtx(3);
    await expect(engine.onBet(ctx, { betAmount: 10, mines: 3 })).rejects.toThrow(/game_disabled/);
    expect(mockPlaceBet).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// onAction: reveal
// ---------------------------------------------------------------------------

describe('LandminesEngine reveal', () => {
  it('rejects reveal with no active game', async () => {
    const engine = new LandminesEngine();
    const ctx = makeCtx(1);
    await expect(engine.onAction(ctx, 'reveal', { row: 0, col: 0 })).rejects.toThrow(/no_active_game/);
  });

  it('rejects invalid coordinates', async () => {
    const engine = new LandminesEngine();
    const ctx = makeCtx(1);
    await engine.onBet(ctx, { betAmount: 100, mines: 3 });
    await expect(engine.onAction(ctx, 'reveal', { row: -1, col: 0 })).rejects.toThrow(/invalid_cell/);
    await expect(engine.onAction(ctx, 'reveal', { row: 5, col: 0 })).rejects.toThrow(/invalid_cell/);
    await expect(engine.onAction(ctx, 'reveal', { row: 0, col: 5 })).rejects.toThrow(/invalid_cell/);
    await expect(engine.onAction(ctx, 'reveal', { row: 0.5, col: 0 })).rejects.toThrow(/invalid_cell/);
  });

  it('rejects revealing the same cell twice', async () => {
    const engine = new LandminesEngine();
    const ctx = makeCtx(1);
    await engine.onBet(ctx, { betAmount: 100, mines: 3 });
    // Force a known board where (0,0) is safe.
    setGrid(engine, 1, [[4, 4], [4, 3], [4, 2]]);
    await engine.onAction(ctx, 'reveal', { row: 0, col: 0 });
    await expect(engine.onAction(ctx, 'reveal', { row: 0, col: 0 })).rejects.toThrow(/cell_already_revealed/);
  });

  it('safe reveal returns multiplier and potentialWin, leaves session open', async () => {
    const engine = new LandminesEngine();
    const ctx = makeCtx(1);
    await engine.onBet(ctx, { betAmount: 100, mines: 3 });
    setGrid(engine, 1, [[4, 4], [4, 3], [4, 2]]); // mines in bottom-right corner

    const r1 = await engine.onAction(ctx, 'reveal', { row: 0, col: 0 });
    expect(r1.completed).toBe(false);
    expect(r1.resultDetails?.hit).toBe(false);
    expect(r1.resultDetails?.gameOver).toBe(false);
    expect(r1.resultDetails?.multiplier).toBeGreaterThan(1);
    expect(r1.resultDetails?.potentialWin).toBeGreaterThan(100);

    // Multiplier should rise with each reveal.
    const r2 = await engine.onAction(ctx, 'reveal', { row: 0, col: 1 });
    expect(r2.resultDetails?.multiplier).toBeGreaterThan(r1.resultDetails?.multiplier);
    expect((engine as any).sessions.has(1)).toBe(true);
  });

  it('revealing a mine ends the game, returns fullGrid, outcome=0', async () => {
    const engine = new LandminesEngine();
    const ctx = makeCtx(1);
    await engine.onBet(ctx, { betAmount: 100, mines: 3 });
    setGrid(engine, 1, [[2, 2], [4, 4], [0, 4]]);

    const r = await engine.onAction(ctx, 'reveal', { row: 2, col: 2 });
    expect(r.completed).toBe(true);
    expect(r.outcome).toBe(0);
    expect(r.resultDetails?.hit).toBe(true);
    expect(r.resultDetails?.gameOver).toBe(true);
    expect(r.resultDetails?.position).toBe('2,2');
    expect(Array.isArray(r.resultDetails?.fullGrid)).toBe(true);
    expect((engine as any).sessions.has(1)).toBe(false);
    // No recordWin on a loss.
    expect(mockRecordWin).not.toHaveBeenCalled();
  });

  it('auto-cashes out when all safe cells are revealed', async () => {
    const engine = new LandminesEngine();
    const ctx = makeCtx(1);
    // 24 mines = 1 safe cell.
    await engine.onBet(ctx, { betAmount: 100, mines: 24 });
    // Force a board where exactly (0,0) is safe.
    const grid: boolean[][] = [];
    for (let r = 0; r < 5; r++) grid.push(new Array(5).fill(true));
    grid[0][0] = false;
    (engine as any).sessions.get(1).mineGrid = grid;
    (engine as any).sessions.get(1).mines = 24;

    const r = await engine.onAction(ctx, 'reveal', { row: 0, col: 0 });
    expect(r.completed).toBe(true);
    expect(r.outcome).toBeGreaterThan(0);
    expect(r.resultDetails?.autoCashout).toBe(true);
    expect(r.resultDetails?.cashedOut).toBe(true);
    expect((engine as any).sessions.has(1)).toBe(false);
    expect(mockRecordWin).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// onAction: cashout
// ---------------------------------------------------------------------------

describe('LandminesEngine cashout', () => {
  it('rejects cashout with no active game', async () => {
    const engine = new LandminesEngine();
    const ctx = makeCtx(1);
    await expect(engine.onAction(ctx, 'cashout', {})).rejects.toThrow(/no_active_game/);
  });

  it('rejects cashout before any reveals', async () => {
    const engine = new LandminesEngine();
    const ctx = makeCtx(1);
    await engine.onBet(ctx, { betAmount: 100, mines: 3 });
    await expect(engine.onAction(ctx, 'cashout', {})).rejects.toThrow(/no_reveals_yet/);
  });

  it('credits winnings, broadcasts cashout, clears session', async () => {
    const engine = new LandminesEngine();
    const ctx = makeCtx(1);
    await engine.onBet(ctx, { betAmount: 100, mines: 3 });
    setGrid(engine, 1, [[4, 4], [4, 3], [4, 2]]);
    await engine.onAction(ctx, 'reveal', { row: 0, col: 0 });

    const r = await engine.onAction(ctx, 'cashout', {});
    expect(r.completed).toBe(true);
    expect(r.outcome).toBeGreaterThan(0);
    expect(r.resultDetails?.cashedOut).toBe(true);
    expect(r.resultDetails?.gameOver).toBe(true);
    expect((engine as any).sessions.has(1)).toBe(false);

    // Broadcasted to namespace.
    const broadcast = ctx._broadcasted.find((e: any) => e.event === 'landmines:player_cashout');
    expect(broadcast).toBeDefined();
    expect(broadcast.payload.userId).toBe(1);
    expect(broadcast.payload.mines).toBe(3);

    // Final balance update emitted.
    const balanceUpdates = ctx._emitted.filter((e: any) => e.event === 'balanceUpdate');
    expect(balanceUpdates.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// onAbandon
// ---------------------------------------------------------------------------

describe('LandminesEngine.onAbandon', () => {
  it('settles an active session as a loss on disconnect', async () => {
    const engine = new LandminesEngine();
    const ctx = makeCtx(1);
    await engine.onBet(ctx, { betAmount: 100, mines: 3 });
    expect((engine as any).sessions.has(1)).toBe(true);

    await engine.onDisconnect(ctx);

    // Session and seeds cleared.
    expect((engine as any).sessions.has(1)).toBe(false);
    expect((engine as any).userSeeds.has(1)).toBe(false);
    // No recordWin — abandonment is a loss.
    expect(mockRecordWin).not.toHaveBeenCalled();
    // Session row updated.
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('is a no-op on disconnect with no open session', async () => {
    const engine = new LandminesEngine();
    const ctx = makeCtx(1);
    await engine.onDisconnect(ctx);
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// onAction: unknown
// ---------------------------------------------------------------------------

describe('LandminesEngine unknown action', () => {
  it('rejects unknown action verbs', async () => {
    const engine = new LandminesEngine();
    const ctx = makeCtx(1);
    await expect(engine.onAction(ctx, 'nuke', {})).rejects.toThrow(/unknown_action/);
  });
});
