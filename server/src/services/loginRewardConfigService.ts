import Decimal from 'decimal.js';
import { db } from '../../drizzle/db.js';
import { sql } from 'drizzle-orm';
import LoggingService from './loggingService.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Settings keys (one row per key in the `settings` table)
export const LOGIN_REWARD_KEYS = {
  min: 'login_reward_min',
  max: 'login_reward_max',
  streakBonus: 'login_reward_streak_bonus',
  capPerDay: 'login_reward_cap_per_day',
} as const;

export interface LoginRewardConfig {
  min: number;
  max: number;
  streakBonus: number;
  capPerDay: number | null;
}

const DEFAULTS: LoginRewardConfig = {
  min: 10,
  max: 100,
  streakBonus: 0,
  capPerDay: null,
};

const CACHE_TTL_MS = 30_000;

class LoginRewardConfigService {
  _cache: { value: LoginRewardConfig; loadedAt: number } | null = null;

  /**
   * Read the current login-reward config. Uses a TTL cache; on miss reads
   * the four keys from the `settings` table and merges over the defaults.
   * Falls back to defaults on DB error.
   */
  async getLoginRewardConfig(): Promise<LoginRewardConfig> {
    if (this._cache && Date.now() - this._cache.loadedAt < CACHE_TTL_MS) {
      return this._cache.value;
    }

    try {
      const result = await db.execute(
        sql`SELECT \`key\`, \`value\` FROM settings WHERE \`key\` IN (${LOGIN_REWARD_KEYS.min}, ${LOGIN_REWARD_KEYS.max}, ${LOGIN_REWARD_KEYS.streakBonus}, ${LOGIN_REWARD_KEYS.capPerDay})`
      );
      const rows = (result as any)[0] || [];

      const lookup: Record<string, any> = {};
      for (const r of rows) {
        lookup[r.key] = this._parseSettingValue(r.value);
      }

      const cfg: LoginRewardConfig = {
        min: this._toNumberOrDefault(lookup[LOGIN_REWARD_KEYS.min], DEFAULTS.min),
        max: this._toNumberOrDefault(lookup[LOGIN_REWARD_KEYS.max], DEFAULTS.max),
        streakBonus: this._toNumberOrDefault(lookup[LOGIN_REWARD_KEYS.streakBonus], DEFAULTS.streakBonus),
        capPerDay: lookup[LOGIN_REWARD_KEYS.capPerDay] == null
          ? DEFAULTS.capPerDay
          : new Decimal(String(lookup[LOGIN_REWARD_KEYS.capPerDay])).toNumber(),
      };

      this._cache = { value: cfg, loadedAt: Date.now() };
      return cfg;
    } catch (error) {
      LoggingService.logSystemEvent('login_reward_config_read_error', {
        error: error instanceof Error ? error.message : String(error),
      }, 'warning');
      return { ...DEFAULTS };
    }
  }

  /**
   * Persist a partial update to the config. Validation is caller's job.
   * Invalidates the in-memory cache on success.
   */
  async setLoginRewardConfig(
    patch: Partial<LoginRewardConfig>,
    adminId: number | null,
  ): Promise<void> {
    const writes: Array<{ key: string; value: any }> = [];
    if (patch.min !== undefined) writes.push({ key: LOGIN_REWARD_KEYS.min, value: Number(patch.min) });
    if (patch.max !== undefined) writes.push({ key: LOGIN_REWARD_KEYS.max, value: Number(patch.max) });
    if (patch.streakBonus !== undefined) writes.push({ key: LOGIN_REWARD_KEYS.streakBonus, value: Number(patch.streakBonus) });
    if (patch.capPerDay !== undefined) {
      writes.push({ key: LOGIN_REWARD_KEYS.capPerDay, value: patch.capPerDay === null ? null : Number(patch.capPerDay) });
    }

    for (const w of writes) {
      const json = JSON.stringify(w.value);
      await db.execute(
        sql`INSERT INTO settings (\`key\`, \`value\`, updated_by, updated_at)
            VALUES (${w.key}, ${json}, ${adminId ?? null}, NOW())
            ON DUPLICATE KEY UPDATE \`value\` = ${json}, updated_by = ${adminId ?? null}, updated_at = NOW()`
      );
    }

    this._cache = null;
  }

  /**
   * Drop the in-memory cache. Mostly useful for tests.
   */
  invalidate(): void {
    this._cache = null;
  }

  _parseSettingValue(raw: any): any {
    if (raw == null) return null;
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  _toNumberOrDefault(value: any, fallback: number): number {
    if (value == null) return fallback;
    const n = new Decimal(String(value));
    if (!n.isFinite()) return fallback;
    return n.toNumber();
  }
}

export default new LoginRewardConfigService();
export { LoginRewardConfigService, DEFAULTS as LOGIN_REWARD_DEFAULTS };
