import { db } from '../../drizzle/db.js';
import { sql } from 'drizzle-orm';
import LoggingService from './loggingService.js';

const USER_DEFAULTS_KEYS = {
  defaultNewUserBalance: 'default_new_user_balance',
} as const;

const CACHE_TTL_MS = 30_000;

/**
 * User Defaults Service
 * Reads admin-configurable defaults applied at user-creation time from the
 * `settings` table. Currently exposes `default_new_user_balance` (the
 * starting credit applied to brand-new admin-created users).
 */
class UserDefaultsService {
  _cache: { value: number; loadedAt: number } | null = null;

  /**
   * Read the configured default starting balance for new users.
   * Returns 0 when:
   *   - the setting row is absent
   *   - the value cannot be parsed as JSON
   *   - the parsed value is not a finite number > 0
   *   - the DB query throws (logged, not propagated — never block user creation)
   */
  async getDefaultNewUserBalance(): Promise<number> {
    if (this._cache && Date.now() - this._cache.loadedAt < CACHE_TTL_MS) {
      return this._cache.value;
    }

    try {
      const result = await db.execute(
        sql`SELECT \`value\` FROM settings WHERE \`key\` = ${USER_DEFAULTS_KEYS.defaultNewUserBalance}`
      );
      const row = (result as any)[0]?.[0];
      let amount = 0;
      if (row && row.value != null) {
        amount = this._parseAmount(row.value);
      }
      this._cache = { value: amount, loadedAt: Date.now() };
      return amount;
    } catch (error) {
      LoggingService.logSystemEvent('user_defaults_read_error', {
        key: USER_DEFAULTS_KEYS.defaultNewUserBalance,
        error: error instanceof Error ? error.message : String(error),
      }, 'warning');
      return 0;
    }
  }

  /**
   * Manually clear the cache. Useful if `default_new_user_balance` is updated
   * via the generic /admin/settings endpoint mid-process.
   */
  invalidate(): void {
    this._cache = null;
  }

  _parseAmount(raw: any): number {
    let parsed: any = raw;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
    }
    const n = Number(parsed);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
}

export default new UserDefaultsService();
