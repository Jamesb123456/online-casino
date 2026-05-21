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
  },
}));

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
import { SlotsEngine } from '../../../games/slots/engine.js';
import { drawReels } from '../../../games/slots/rng.js';
import { REELS } from '../../../games/slots/paytable.js';

const FULL_PAYOUTS = {
  CHERRY: { '3': 14, '4': 45, '5': 140 },
  LEMON:  { '3': 14, '4': 45, '5': 140 },
  ORANGE: { '3': 22, '4': 70, '5': 210 },
  PLUM:   { '3': 22, '4': 70, '5': 210 },
  BELL:   { '3': 42, '4': 140, '5': 560 },
  BAR:    { '3': 70, '4': 280, '5': 1400 },
  SEVEN:  { '3': 140, '4': 700, '5': 4200 },
};

const FULL_LINES = [
  [1,1,1,1,1],
  [0,0,0,0,0],
  [2,2,2,2,2],
  [0,1,2,1,0],
  [2,1,0,1,2],
];

function makeCtx(userId = 1) {
  const emitted: Array<{ event: string; payload: any }> = [];
  return {
    user: { userId, username: `u${userId}`, role: 'user', balance: 1000, isActive: true },
    socket: { id: `s${userId}`, emit: vi.fn() },
    emit: (event: string, payload?: any) => emitted.push({ event, payload }),
    broadcast: vi.fn(),
    namespace: {},
    _emitted: emitted,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfig.mockResolvedValue({
    enabled: true,
    maxBet: 0,
    houseEdge: 0.05,
    payoutTable: {
      reels: REELS as any,
      lines: FULL_LINES,
      payouts: FULL_PAYOUTS,
    },
  });
  mockAssertCanBet.mockResolvedValue({ ok: true });
  mockValuesReturn.mockResolvedValue([{ insertId: 77 }]);
  mockPlaceBet.mockResolvedValue({ user: { balance: '950' } });
  mockRecordWin.mockResolvedValue({ user: { balance: '1100' } });
  mockGetBalance.mockResolvedValue(950);
});

describe('SlotsEngine.validate', () => {
  const engine = new SlotsEngine();
  const v = (p: any) => (engine as any).validate(p);

  it('rejects non-object payloads', () => {
    expect(() => v(null)).toThrow(/invalid_payload/);
    expect(() => v(42)).toThrow(/invalid_payload/);
  });

  it('rejects bet_per_line <= 0 or NaN', () => {
    expect(() => v({ betPerLine: 0, lines: 1 })).toThrow(/bet_per_line_invalid/);
    expect(() => v({ betPerLine: -5, lines: 1 })).toThrow(/bet_per_line_invalid/);
    expect(() => v({ betPerLine: 'x', lines: 1 })).toThrow(/bet_per_line_invalid/);
  });

  it('rejects lines outside [1, 5]', () => {
    expect(() => v({ betPerLine: 1, lines: 0 })).toThrow(/lines_out_of_range/);
    expect(() => v({ betPerLine: 1, lines: 6 })).toThrow(/lines_out_of_range/);
    expect(() => v({ betPerLine: 1, lines: 1.5 })).toThrow(/lines_out_of_range/);
  });

  it('accepts valid input across the legal range', () => {
    for (const lines of [1, 2, 3, 4, 5]) {
      expect(v({ betPerLine: 10, lines })).toEqual({ betPerLine: 10, lines });
    }
  });
});

describe('SlotsEngine.onBet — invalid input', () => {
  it('rejects lines out of range before consuming any seed/session', async () => {
    const engine = new SlotsEngine();
    const ctx = makeCtx(1);
    await expect(engine.onBet(ctx, { betPerLine: 10, lines: 99 } as any))
      .rejects.toThrow(/lines_out_of_range/);
    expect(mockPlaceBet).not.toHaveBeenCalled();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('rejects bet_per_line <= 0 before any side effect', async () => {
    const engine = new SlotsEngine();
    const ctx = makeCtx(1);
    await expect(engine.onBet(ctx, { betPerLine: 0, lines: 1 } as any))
      .rejects.toThrow(/bet_per_line_invalid/);
    expect(mockPlaceBet).not.toHaveBeenCalled();
  });
});

describe('SlotsEngine.onBet — payout table validation', () => {
  it('throws payout_table_invalid when reels missing', async () => {
    mockGetConfig.mockResolvedValue({
      enabled: true,
      maxBet: 0,
      houseEdge: 0.05,
      payoutTable: { lines: FULL_LINES, payouts: FULL_PAYOUTS },
    });
    const engine = new SlotsEngine();
    const ctx = makeCtx(2);
    await expect(engine.onBet(ctx, { betPerLine: 1, lines: 1 } as any))
      .rejects.toThrow(/payout_table_invalid/);
  });

  it('throws payout_table_invalid when payouts missing', async () => {
    mockGetConfig.mockResolvedValue({
      enabled: true,
      maxBet: 0,
      houseEdge: 0.05,
      payoutTable: { reels: REELS as any, lines: FULL_LINES },
    });
    const engine = new SlotsEngine();
    const ctx = makeCtx(2);
    await expect(engine.onBet(ctx, { betPerLine: 1, lines: 1 } as any))
      .rejects.toThrow(/payout_table_invalid/);
  });

  it('throws payout_table_invalid when reels has the wrong length', async () => {
    mockGetConfig.mockResolvedValue({
      enabled: true,
      maxBet: 0,
      houseEdge: 0.05,
      payoutTable: {
        reels: [REELS[0], REELS[1], REELS[2]],
        lines: FULL_LINES,
        payouts: FULL_PAYOUTS,
      },
    });
    const engine = new SlotsEngine();
    const ctx = makeCtx(2);
    await expect(engine.onBet(ctx, { betPerLine: 1, lines: 1 } as any))
      .rejects.toThrow(/payout_table_invalid/);
  });
});

describe('SlotsEngine.onBet — deterministic outcome', () => {
  it('produces a deterministic visible matrix and outcome for a fixed seed bundle', async () => {
    const engine = new SlotsEngine();
    const ctx = makeCtx(3);

    // Force a known seed bundle: stub ensureSeeds so the bundle is fixed.
    const fixedSeeds = {
      serverSeed: 'a'.repeat(64),
      serverSeedHash: 'b'.repeat(64),
      clientSeed: 'client_seed_xyz',
      nextNonce: 1,
    };
    (engine as any).userSeeds.set(3, fixedSeeds);

    const result = await engine.onBet(ctx, { betPerLine: 10, lines: 5 } as any);

    // Bet was placed for total = betPerLine * lines = 50.
    expect(mockPlaceBet).toHaveBeenCalledWith(3, 50, 'slots', { gameSessionId: 77 });

    // Reproduce the spin with the same bundle (nonce=1, which was just consumed).
    const replay = drawReels(
      { serverSeed: fixedSeeds.serverSeed, serverSeedHash: fixedSeeds.serverSeedHash, clientSeed: fixedSeeds.clientSeed, nonce: 1 },
      REELS,
    );

    expect(result.resultDetails.offsets).toEqual(replay.offsets);
    expect(result.resultDetails.reels).toEqual(replay.visible);
    expect(typeof result.outcome).toBe('number');
    expect(result.completed).toBe(true);
    expect(result.sessionId).toBe(77);
  });

  it('returns outcome=0 + multiplier=0 when no payline hits', async () => {
    const engine = new SlotsEngine();
    const ctx = makeCtx(4);

    // Pick a config with payouts so high they are unreachable for ANY symbol —
    // simulate "no hits" by routing through a guaranteed-no-match payout
    // table where every symbol has no tier defined.
    mockGetConfig.mockResolvedValue({
      enabled: true,
      maxBet: 0,
      houseEdge: 0.05,
      payoutTable: { reels: REELS as any, lines: FULL_LINES, payouts: {} },
    });

    const result = await engine.onBet(ctx, { betPerLine: 1, lines: 5 } as any);
    expect(result.outcome).toBe(0);
    expect(result.finalMultiplier).toBe(0);
  });
});
