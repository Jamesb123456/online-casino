import Decimal from 'decimal.js';
import { db } from '../../drizzle/db.js';
import { sql } from 'drizzle-orm';
import LoggingService from './loggingService.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Game Config Service
 *
 * Provides hot-loaded per-game odds/payouts (house edge, payout table,
 * max bet, enabled flag) from the `game_config` table with a small
 * in-memory TTL cache. Handlers call `getConfig(gameType)` at the start
 * of each round to read the current values.
 *
 * Falls back to baked-in defaults when the DB read fails or no row is
 * cached yet — this keeps behaviour identical to the previous hardcoded
 * implementation if the migration has not been applied (and lets unit
 * tests that don't mock the DB still work).
 */

export interface GameConfigSnapshot {
  houseEdge: number;
  payoutTable: any;
  maxBet: number;
  enabled: boolean;
}

const CACHE_TTL_MS = 30_000;

// Baked-in defaults — must mirror the seed values in 0004_game_config.sql
// and the values previously hardcoded in each handler.
const DEFAULTS: Record<string, GameConfigSnapshot> = {
  crash: {
    houseEdge: 0.04,
    payoutTable: {},
    maxBet: 0,
    enabled: true,
  },
  roulette: {
    houseEdge: 0.027,
    payoutTable: {
      STRAIGHT: 35, SPLIT: 17, STREET: 11, CORNER: 8, FIVE: 6, LINE: 5,
      COLUMN: 2, DOZEN: 2, RED: 1, BLACK: 1, ODD: 1, EVEN: 1, LOW: 1, HIGH: 1,
    },
    maxBet: 0,
    enabled: true,
  },
  wheel: {
    houseEdge: 0,
    payoutTable: {
      easy:   [0, 0.2, 0.3, 0.5, 0.5, 0.8, 1.0, 1.0, 1.2, 1.5, 1.5, 3.0],
      medium: [0, 0, 0, 0.1, 0.2, 0.3, 0.5, 0.5, 1.0, 1.5, 2.0, 5.0],
      hard:   [0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.5, 1.0, 2.0, 7.0],
    },
    maxBet: 0,
    enabled: true,
  },
  plinko: {
    houseEdge: 0,
    payoutTable: {
      low: {
        '8':  [2.5, 1.4, 1.1, 0.9, 0.8, 0.9, 1.1, 1.4, 2.5],
        '9':  [2.7, 1.5, 1.1, 0.9, 0.8, 0.8, 0.9, 1.1, 1.5, 2.7],
        '10': [2.9, 1.6, 1.2, 0.9, 0.8, 0.8, 0.9, 1.2, 1.6, 2.9],
        '11': [3.0, 1.6, 1.2, 1.0, 0.8, 0.7, 0.8, 1.0, 1.2, 1.6, 3.0],
        '12': [3.2, 1.7, 1.2, 1.0, 0.8, 0.7, 0.7, 0.8, 1.0, 1.2, 1.7, 3.2],
        '13': [3.4, 1.8, 1.3, 1.0, 0.9, 0.7, 0.7, 0.7, 0.9, 1.0, 1.3, 1.8, 3.4],
        '14': [3.6, 1.9, 1.3, 1.0, 0.9, 0.8, 0.7, 0.7, 0.8, 0.9, 1.0, 1.3, 1.9, 3.6],
        '15': [3.8, 2.0, 1.4, 1.1, 0.9, 0.8, 0.7, 0.7, 0.7, 0.8, 0.9, 1.1, 1.4, 2.0, 3.8],
        '16': [4.0, 2.1, 1.4, 1.1, 0.9, 0.8, 0.7, 0.7, 0.6, 0.7, 0.7, 0.8, 0.9, 1.1, 1.4, 2.1, 4.0],
      },
      medium: {
        '8':  [5.6, 2.1, 1.1, 0.7, 0.5, 0.7, 1.1, 2.1, 5.6],
        '9':  [6.2, 2.3, 1.2, 0.7, 0.5, 0.5, 0.7, 1.2, 2.3, 6.2],
        '10': [7.0, 2.5, 1.3, 0.8, 0.5, 0.5, 0.8, 1.3, 2.5, 7.0],
        '11': [8.0, 2.8, 1.4, 0.8, 0.5, 0.4, 0.5, 0.8, 1.4, 2.8, 8.0],
        '12': [9.0, 3.0, 1.5, 0.9, 0.6, 0.4, 0.4, 0.6, 0.9, 1.5, 3.0, 9.0],
        '13': [10.0, 3.2, 1.6, 0.9, 0.6, 0.4, 0.3, 0.4, 0.6, 0.9, 1.6, 3.2, 10.0],
        '14': [12.0, 3.5, 1.7, 1.0, 0.6, 0.4, 0.3, 0.3, 0.4, 0.6, 1.0, 1.7, 3.5, 12.0],
        '15': [14.0, 4.0, 1.8, 1.0, 0.7, 0.4, 0.3, 0.3, 0.3, 0.4, 0.7, 1.0, 1.8, 4.0, 14.0],
        '16': [16.0, 4.5, 2.0, 1.1, 0.7, 0.5, 0.3, 0.3, 0.2, 0.3, 0.3, 0.5, 0.7, 1.1, 2.0, 4.5, 16.0],
      },
      high: {
        '8':  [15.0, 4.0, 1.5, 0.5, 0.3, 0.5, 1.5, 4.0, 15.0],
        '9':  [18.0, 4.5, 1.6, 0.6, 0.3, 0.3, 0.6, 1.6, 4.5, 18.0],
        '10': [22.0, 5.0, 1.8, 0.6, 0.3, 0.2, 0.3, 0.6, 1.8, 5.0, 22.0],
        '11': [26.0, 5.5, 2.0, 0.7, 0.3, 0.2, 0.3, 0.7, 2.0, 5.5, 26.0],
        '12': [30.0, 6.0, 2.2, 0.8, 0.4, 0.2, 0.2, 0.4, 0.8, 2.2, 6.0, 30.0],
        '13': [35.0, 7.0, 2.5, 0.9, 0.4, 0.2, 0.1, 0.2, 0.4, 0.9, 2.5, 7.0, 35.0],
        '14': [40.0, 8.0, 2.8, 1.0, 0.4, 0.2, 0.1, 0.1, 0.2, 0.4, 1.0, 2.8, 8.0, 40.0],
        '15': [45.0, 9.0, 3.0, 1.1, 0.5, 0.2, 0.1, 0.1, 0.1, 0.2, 0.5, 1.1, 3.0, 9.0, 45.0],
        '16': [50.0, 10.0, 3.5, 1.2, 0.5, 0.3, 0.1, 0.1, 0.1, 0.1, 0.1, 0.3, 0.5, 1.2, 3.5, 10.0, 50.0],
      },
    },
    maxBet: 0,
    enabled: true,
  },
  landmines: {
    houseEdge: 0.05,
    payoutTable: {},
    maxBet: 0,
    enabled: true,
  },
  blackjack: {
    houseEdge: 0.02,
    payoutTable: { win: 2.0, blackjack: 2.5, push: 1.0 },
    maxBet: 0,
    enabled: true,
  },
  dice: {
    houseEdge: 0.04,
    payoutTable: {},
    maxBet: 0,
    enabled: true,
  },
  slots: {
    houseEdge: 0.05,
    payoutTable: {},
    maxBet: 0,
    enabled: true,
  },
};

const KNOWN_GAMES = Object.keys(DEFAULTS);

class GameConfigService {
  _cache: Map<string, { value: GameConfigSnapshot; expiresAt: number }>;

  constructor() {
    this._cache = new Map();
  }

  /**
   * Read the current config for a game. Uses a TTL cache; on cache miss
   * reads from the `game_config` table. Falls back to baked-in defaults
   * if the DB read fails (so dev/test environments without the migration
   * applied keep working).
   *
   * Throws if `gameType` is not a recognised game.
   */
  async getConfig(gameType: string): Promise<GameConfigSnapshot> {
    if (!KNOWN_GAMES.includes(gameType)) {
      throw new Error(`unknown_game_type:${gameType}`);
    }

    const cached = this._cache.get(gameType);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    try {
      const result = await db.execute(
        sql`SELECT house_edge, payout_table, max_bet, enabled FROM game_config WHERE game_type = ${gameType} LIMIT 1`
      );
      const row = (result as any)[0]?.[0];
      if (!row) {
        // No row yet — fall back to defaults but DO NOT cache (so a later
        // seed/migration becomes visible without restart).
        return DEFAULTS[gameType];
      }

      const snapshot: GameConfigSnapshot = {
        houseEdge: new Decimal(String(row.house_edge ?? '0')).toNumber(),
        payoutTable: this._parsePayoutTable(row.payout_table),
        maxBet: new Decimal(String(row.max_bet ?? '0')).toNumber(),
        enabled: Boolean(row.enabled),
      };

      this._cache.set(gameType, { value: snapshot, expiresAt: now + CACHE_TTL_MS });
      return snapshot;
    } catch (error) {
      LoggingService.logSystemEvent('game_config_read_error', {
        gameType,
        error: error instanceof Error ? error.message : String(error),
      }, 'warning');
      // Fall back to defaults — keep handlers operational even if the table
      // is missing or unreachable.
      return DEFAULTS[gameType];
    }
  }

  /**
   * Update a config row. Caller (the admin endpoint) is responsible for
   * input validation. Writes to the DB and invalidates the cache.
   */
  async setConfig(
    gameType: string,
    patch: Partial<{ houseEdge: number; payoutTable: any; maxBet: number; enabled: boolean }>,
    adminId: number | null,
  ): Promise<void> {
    if (!KNOWN_GAMES.includes(gameType)) {
      throw new Error(`unknown_game_type:${gameType}`);
    }

    const sets: any[] = [];
    if (patch.houseEdge != null) {
      sets.push(sql`house_edge = ${new Decimal(patch.houseEdge).toFixed(4)}`);
    }
    if (patch.payoutTable != null) {
      sets.push(sql`payout_table = ${JSON.stringify(patch.payoutTable)}`);
    }
    if (patch.maxBet != null) {
      sets.push(sql`max_bet = ${new Decimal(patch.maxBet).toFixed(2)}`);
    }
    if (patch.enabled != null) {
      sets.push(sql`enabled = ${patch.enabled ? 1 : 0}`);
    }
    sets.push(sql`updated_by = ${adminId ?? null}`);
    sets.push(sql`updated_at = NOW()`);

    // Build SET clause manually since drizzle-orm sql template doesn't
    // natively join fragments with commas — use sql.join.
    const setClause = sql.join(sets, sql`, `);

    await db.execute(
      sql`UPDATE game_config SET ${setClause} WHERE game_type = ${gameType}`
    );

    this.invalidate(gameType);
  }

  /**
   * List all known configs. Used by the admin "list all six" endpoint.
   * Reads straight from the DB (bypasses cache to give a consistent snapshot)
   * and falls back to defaults on error.
   */
  async listConfigs(): Promise<Array<{ gameType: string } & GameConfigSnapshot>> {
    try {
      const result = await db.execute(
        sql`SELECT game_type, house_edge, payout_table, max_bet, enabled FROM game_config ORDER BY game_type ASC`
      );
      const rows = (result as any)[0] || [];
      const byType: Record<string, any> = {};
      for (const r of rows) {
        byType[r.game_type] = {
          gameType: r.game_type,
          houseEdge: new Decimal(String(r.house_edge ?? '0')).toNumber(),
          payoutTable: this._parsePayoutTable(r.payout_table),
          maxBet: new Decimal(String(r.max_bet ?? '0')).toNumber(),
          enabled: Boolean(r.enabled),
        };
      }
      return KNOWN_GAMES.map((gameType) => byType[gameType] || { gameType, ...DEFAULTS[gameType] });
    } catch (error) {
      LoggingService.logSystemEvent('game_config_list_error', {
        error: error instanceof Error ? error.message : String(error),
      }, 'warning');
      return KNOWN_GAMES.map((gameType) => ({ gameType, ...DEFAULTS[gameType] }));
    }
  }

  /**
   * Clear the in-memory cache. With no argument, clears all entries.
   */
  invalidate(gameType?: string): void {
    if (gameType) {
      this._cache.delete(gameType);
    } else {
      this._cache.clear();
    }
  }

  _parsePayoutTable(raw: any): any {
    if (raw == null) return {};
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
}

export default new GameConfigService();
export { GameConfigService, DEFAULTS as DEFAULT_GAME_CONFIGS, KNOWN_GAMES };
