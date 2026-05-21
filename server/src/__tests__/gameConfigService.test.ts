// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock('../../drizzle/db.js', () => ({
  db: {
    execute: mockExecute,
  },
}));

vi.mock('drizzle-orm', () => ({
  sql: Object.assign(
    (...args: any[]) => args,
    { join: (...args: any[]) => args },
  ),
}));

vi.mock('../services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  },
}));

import GameConfigService, { DEFAULT_GAME_CONFIGS } from '../services/gameConfigService.js';

function resetCache() {
  (GameConfigService as any)._cache.clear();
}

describe('GameConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCache();
  });

  describe('getConfig()', () => {
    it('reads from the DB on cache miss', async () => {
      mockExecute.mockResolvedValueOnce([[{
        house_edge: '0.0400',
        payout_table: '{}',
        max_bet: '0.00',
        enabled: 1,
      }]]);

      const cfg = await GameConfigService.getConfig('crash');

      expect(cfg.houseEdge).toBe(0.04);
      expect(cfg.maxBet).toBe(0);
      expect(cfg.enabled).toBe(true);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('returns cached value on a second read (no DB hit)', async () => {
      mockExecute.mockResolvedValueOnce([[{
        house_edge: '0.0400',
        payout_table: '{}',
        max_bet: '0.00',
        enabled: 1,
      }]]);

      await GameConfigService.getConfig('crash');
      await GameConfigService.getConfig('crash');

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('parses JSON payout tables stored as strings', async () => {
      mockExecute.mockResolvedValueOnce([[{
        house_edge: '0.0270',
        payout_table: '{"RED":1,"STRAIGHT":35}',
        max_bet: '0.00',
        enabled: 1,
      }]]);

      const cfg = await GameConfigService.getConfig('roulette');

      expect(cfg.payoutTable).toEqual({ RED: 1, STRAIGHT: 35 });
    });

    it('falls back to defaults on DB error (without caching)', async () => {
      mockExecute.mockRejectedValueOnce(new Error('DB down'));

      const cfg = await GameConfigService.getConfig('crash');

      expect(cfg.houseEdge).toBe(DEFAULT_GAME_CONFIGS.crash.houseEdge);
      // No cache populated on error
      expect((GameConfigService as any)._cache.has('crash')).toBe(false);
    });

    it('falls back to defaults when no row exists', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const cfg = await GameConfigService.getConfig('blackjack');

      expect(cfg.houseEdge).toBe(DEFAULT_GAME_CONFIGS.blackjack.houseEdge);
    });

    it('throws for unknown gameType', async () => {
      await expect(GameConfigService.getConfig('keno')).rejects.toThrow(/unknown_game_type/);
    });

    it('includes dice in DEFAULT_GAME_CONFIGS with 4% house edge', () => {
      expect(DEFAULT_GAME_CONFIGS.dice).toBeDefined();
      expect(DEFAULT_GAME_CONFIGS.dice.houseEdge).toBe(0.04);
      expect(DEFAULT_GAME_CONFIGS.dice.enabled).toBe(true);
    });

    it('includes slots in DEFAULT_GAME_CONFIGS with 5% house edge', () => {
      expect(DEFAULT_GAME_CONFIGS.slots).toBeDefined();
      expect(DEFAULT_GAME_CONFIGS.slots.houseEdge).toBe(0.05);
      expect(DEFAULT_GAME_CONFIGS.slots.enabled).toBe(true);
    });
  });

  describe('setConfig()', () => {
    it('writes to the DB and invalidates the cache for that game', async () => {
      // Prime the cache
      mockExecute.mockResolvedValueOnce([[{
        house_edge: '0.0400', payout_table: '{}', max_bet: '0.00', enabled: 1,
      }]]);
      await GameConfigService.getConfig('crash');
      expect((GameConfigService as any)._cache.has('crash')).toBe(true);

      // setConfig issues an UPDATE
      mockExecute.mockResolvedValueOnce(undefined);
      await GameConfigService.setConfig('crash', { houseEdge: 0.06 }, 42);

      // Cache cleared for crash
      expect((GameConfigService as any)._cache.has('crash')).toBe(false);
      // UPDATE was issued
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });

    it('throws for unknown gameType', async () => {
      await expect(GameConfigService.setConfig('keno', { houseEdge: 0.1 }, 1)).rejects.toThrow(/unknown_game_type/);
    });
  });

  describe('invalidate()', () => {
    it('clears a specific entry when given a gameType', async () => {
      // Populate two cache entries
      mockExecute.mockResolvedValueOnce([[{ house_edge: '0.04', payout_table: '{}', max_bet: '0', enabled: 1 }]]);
      await GameConfigService.getConfig('crash');
      mockExecute.mockResolvedValueOnce([[{ house_edge: '0.05', payout_table: '{}', max_bet: '0', enabled: 1 }]]);
      await GameConfigService.getConfig('landmines');

      expect((GameConfigService as any)._cache.has('crash')).toBe(true);
      expect((GameConfigService as any)._cache.has('landmines')).toBe(true);

      GameConfigService.invalidate('crash');

      expect((GameConfigService as any)._cache.has('crash')).toBe(false);
      expect((GameConfigService as any)._cache.has('landmines')).toBe(true);
    });

    it('clears all entries when called with no arguments', async () => {
      mockExecute.mockResolvedValueOnce([[{ house_edge: '0.04', payout_table: '{}', max_bet: '0', enabled: 1 }]]);
      await GameConfigService.getConfig('crash');
      mockExecute.mockResolvedValueOnce([[{ house_edge: '0.05', payout_table: '{}', max_bet: '0', enabled: 1 }]]);
      await GameConfigService.getConfig('landmines');

      GameConfigService.invalidate();

      expect((GameConfigService as any)._cache.size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------
  // Coverage extensions
  // ---------------------------------------------------------------------
  describe('setConfig() patch branches', () => {
    it('builds an UPDATE that includes payoutTable, maxBet, and enabled flag', async () => {
      mockExecute.mockResolvedValueOnce(undefined);
      await GameConfigService.setConfig('crash', {
        payoutTable: { foo: 1 },
        maxBet: 5000,
        enabled: false,
      }, 1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('sets enabled=true (truthy branch)', async () => {
      mockExecute.mockResolvedValueOnce(undefined);
      await GameConfigService.setConfig('crash', { enabled: true }, 1);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe('listConfigs()', () => {
    it('returns rows from the DB merged with defaults for missing games', async () => {
      // Only return a single row for crash; other known games fall back to defaults.
      mockExecute.mockResolvedValueOnce([[
        { game_type: 'crash', house_edge: '0.08', payout_table: '{}', max_bet: '50', enabled: 1 },
      ]]);
      const out = await GameConfigService.listConfigs();
      const crash = out.find((c) => c.gameType === 'crash');
      expect(crash?.houseEdge).toBe(0.08);
      // Other games still present via defaults
      const blackjack = out.find((c) => c.gameType === 'blackjack');
      expect(blackjack?.houseEdge).toBe(DEFAULT_GAME_CONFIGS.blackjack.houseEdge);
    });

    it('returns defaults when listConfigs DB read throws', async () => {
      mockExecute.mockRejectedValueOnce(new Error('db down'));
      const out = await GameConfigService.listConfigs();
      const crash = out.find((c) => c.gameType === 'crash');
      expect(crash?.houseEdge).toBe(DEFAULT_GAME_CONFIGS.crash.houseEdge);
    });

    it('handles object-typed payout_table rows', async () => {
      mockExecute.mockResolvedValueOnce([[
        { game_type: 'roulette', house_edge: '0.027', payout_table: { RED: 1 }, max_bet: '0', enabled: 1 },
      ]]);
      const out = await GameConfigService.listConfigs();
      const roulette = out.find((c) => c.gameType === 'roulette');
      expect(roulette?.payoutTable).toEqual({ RED: 1 });
    });
  });

  describe('_parsePayoutTable()', () => {
    it('returns {} for null/undefined input', () => {
      expect((GameConfigService as any)._parsePayoutTable(null)).toEqual({});
      expect((GameConfigService as any)._parsePayoutTable(undefined)).toEqual({});
    });

    it('returns object inputs as-is', () => {
      const obj = { a: 1 };
      expect((GameConfigService as any)._parsePayoutTable(obj)).toBe(obj);
    });

    it('parses valid JSON strings', () => {
      expect((GameConfigService as any)._parsePayoutTable('{"x":2}')).toEqual({ x: 2 });
    });

    it('returns {} for invalid JSON strings (catch branch)', () => {
      expect((GameConfigService as any)._parsePayoutTable('not json')).toEqual({});
    });
  });
});

// NOTE: The legacy `crashHandler integration with gameConfigService` describe
// block was removed when the legacy `socket/crashHandler.ts` was deleted in
// Phase F-6. Equivalent integration coverage now lives under
// `server/src/__tests__/games/crash/` via `_engine/base.ts.assertCanBet`,
// which exercises the same `gameConfigService.getConfig` pathway.
