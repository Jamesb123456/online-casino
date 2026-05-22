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

import LoginRewardConfigService, {
  LOGIN_REWARD_DEFAULTS,
  LOGIN_REWARD_KEYS,
} from '../services/loginRewardConfigService.js';

describe('LoginRewardConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (LoginRewardConfigService as any).invalidate();
  });

  describe('getLoginRewardConfig()', () => {
    it('returns defaults when no settings rows exist', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const cfg = await LoginRewardConfigService.getLoginRewardConfig();

      expect(cfg).toEqual(LOGIN_REWARD_DEFAULTS);
    });

    it('reads each key and merges over defaults', async () => {
      mockExecute.mockResolvedValueOnce([[
        { key: LOGIN_REWARD_KEYS.min, value: '25' },
        { key: LOGIN_REWARD_KEYS.max, value: '250' },
        { key: LOGIN_REWARD_KEYS.streakBonus, value: '15' },
        { key: LOGIN_REWARD_KEYS.capPerDay, value: '1000000' },
      ]]);

      const cfg = await LoginRewardConfigService.getLoginRewardConfig();

      expect(cfg).toEqual({ min: 25, max: 250, streakBonus: 15, capPerDay: 1000000 });
    });

    it('caches reads for the TTL window', async () => {
      mockExecute.mockResolvedValueOnce([[]]);
      await LoginRewardConfigService.getLoginRewardConfig();
      await LoginRewardConfigService.getLoginRewardConfig();
      await LoginRewardConfigService.getLoginRewardConfig();

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('falls back to defaults on DB error and does not cache', async () => {
      mockExecute.mockRejectedValueOnce(new Error('DB down'));

      const cfg = await LoginRewardConfigService.getLoginRewardConfig();
      expect(cfg).toEqual(LOGIN_REWARD_DEFAULTS);
      expect((LoginRewardConfigService as any)._cache).toBeNull();
    });

    it('preserves null capPerDay (unlimited)', async () => {
      mockExecute.mockResolvedValueOnce([[
        { key: LOGIN_REWARD_KEYS.min, value: '10' },
        { key: LOGIN_REWARD_KEYS.max, value: '100' },
        // capPerDay row absent → null
      ]]);

      const cfg = await LoginRewardConfigService.getLoginRewardConfig();
      expect(cfg.capPerDay).toBeNull();
    });
  });

  describe('setLoginRewardConfig()', () => {
    it('writes only the provided keys and invalidates the cache', async () => {
      // Prime the cache
      mockExecute.mockResolvedValueOnce([[]]);
      await LoginRewardConfigService.getLoginRewardConfig();
      expect((LoginRewardConfigService as any)._cache).not.toBeNull();

      // setLoginRewardConfig issues an INSERT…ON DUPLICATE KEY UPDATE per key
      mockExecute.mockResolvedValue([]);

      await LoginRewardConfigService.setLoginRewardConfig({ min: 5, max: 250 }, 99);

      // Two writes (min, max), not four
      const writeCalls = mockExecute.mock.calls.slice(1);
      expect(writeCalls).toHaveLength(2);

      // Cache invalidated
      expect((LoginRewardConfigService as any)._cache).toBeNull();
    });

    it('persists capPerDay = null when explicitly provided', async () => {
      mockExecute.mockResolvedValue([]);
      await LoginRewardConfigService.setLoginRewardConfig({ capPerDay: null }, 1);
      // 1 write call
      const writeCalls = mockExecute.mock.calls;
      expect(writeCalls).toHaveLength(1);
    });

    it('full round-trip: set then get returns the patched values', async () => {
      // set
      mockExecute.mockResolvedValue([]);
      await LoginRewardConfigService.setLoginRewardConfig({ min: 5, max: 50, streakBonus: 3, capPerDay: 5000 }, 1);

      // Next get reads from DB
      mockExecute.mockResolvedValueOnce([[
        { key: LOGIN_REWARD_KEYS.min, value: '5' },
        { key: LOGIN_REWARD_KEYS.max, value: '50' },
        { key: LOGIN_REWARD_KEYS.streakBonus, value: '3' },
        { key: LOGIN_REWARD_KEYS.capPerDay, value: '5000' },
      ]]);

      const cfg = await LoginRewardConfigService.getLoginRewardConfig();
      expect(cfg).toEqual({ min: 5, max: 50, streakBonus: 3, capPerDay: 5000 });
    });
  });
});
