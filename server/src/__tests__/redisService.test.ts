// @ts-nocheck
/**
 * RedisService tests
 * Tests the caching layer with graceful degradation when Redis is unavailable.
 * Since the ioredis mock is tricky with ESM, we test primarily through
 * the public API with the client injected directly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockLoggerError } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
}));

vi.mock('../services/loggingService.js', () => ({
  default: {
    logger: { error: mockLoggerError, info: vi.fn(), warn: vi.fn() },
    logSystemEvent: vi.fn(),
  },
}));

// We cannot easily mock `new Redis()` in ESM, so we test by injecting
// mock clients directly into the static fields.
import RedisService from '../services/redisService.js';

function resetRedisService() {
  (RedisService as any).client = null;
  (RedisService as any).subscriber = null;
}

function createMockClient() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    quit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
  };
}

describe('RedisService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    resetRedisService();
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('getClient()', () => {
    it('should return null when REDIS_URL is not set', () => {
      expect(RedisService.getClient()).toBeNull();
    });
  });

  describe('getSubscriber()', () => {
    it('should return null when REDIS_URL is not set', () => {
      expect(RedisService.getSubscriber()).toBeNull();
    });
  });

  describe('set() - no Redis', () => {
    it('should be no-op when no Redis client', async () => {
      await RedisService.set('key', 'value');
      // No throw
    });
  });

  describe('set() - with injected client', () => {
    let mockClient;

    beforeEach(() => {
      mockClient = createMockClient();
      (RedisService as any).client = mockClient;
    });

    it('should call setex with TTL', async () => {
      await RedisService.set('mykey', { foo: 'bar' }, 60);
      expect(mockClient.setex).toHaveBeenCalledWith('mykey', 60, JSON.stringify({ foo: 'bar' }));
    });

    it('should call set without TTL', async () => {
      await RedisService.set('mykey', { foo: 'bar' });
      expect(mockClient.set).toHaveBeenCalledWith('mykey', JSON.stringify({ foo: 'bar' }));
    });

    it('should serialize objects to JSON', async () => {
      const obj = { nested: { data: [1, 2] } };
      await RedisService.set('k', obj, 10);
      expect(mockClient.setex).toHaveBeenCalledWith('k', 10, JSON.stringify(obj));
    });

    it('should silently fail if Redis throws', async () => {
      mockClient.set.mockRejectedValueOnce(new Error('fail'));
      await expect(RedisService.set('k', 'v')).resolves.toBeUndefined();
    });

    it('should not call setex when TTL is 0 (falsy)', async () => {
      await RedisService.set('key', 'value', 0);
      expect(mockClient.set).toHaveBeenCalled();
      expect(mockClient.setex).not.toHaveBeenCalled();
    });
  });

  describe('get() - no Redis', () => {
    it('should return null when no Redis client', async () => {
      expect(await RedisService.get('key')).toBeNull();
    });
  });

  describe('get() - with injected client', () => {
    let mockClient;

    beforeEach(() => {
      mockClient = createMockClient();
      (RedisService as any).client = mockClient;
    });

    it('should parse JSON from Redis', async () => {
      mockClient.get.mockResolvedValue(JSON.stringify({ balance: 100 }));
      expect(await RedisService.get('key')).toEqual({ balance: 100 });
    });

    it('should return null for missing keys', async () => {
      mockClient.get.mockResolvedValue(null);
      expect(await RedisService.get('missing')).toBeNull();
    });

    it('should return null on parse error', async () => {
      mockClient.get.mockResolvedValue('bad json {{{');
      expect(await RedisService.get('bad')).toBeNull();
    });

    it('should return null if Redis throws', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('fail'));
      expect(await RedisService.get('key')).toBeNull();
    });

    it('should return parsed number', async () => {
      mockClient.get.mockResolvedValue('42');
      expect(await RedisService.get('num')).toBe(42);
    });
  });

  describe('del() - no Redis', () => {
    it('should be no-op when no Redis client', async () => {
      await RedisService.del('key');
      // No throw
    });
  });

  describe('del() - with injected client', () => {
    let mockClient;

    beforeEach(() => {
      mockClient = createMockClient();
      (RedisService as any).client = mockClient;
    });

    it('should call del on client', async () => {
      await RedisService.del('mykey');
      expect(mockClient.del).toHaveBeenCalledWith('mykey');
    });

    it('should silently fail if Redis del throws', async () => {
      mockClient.del.mockRejectedValueOnce(new Error('fail'));
      await expect(RedisService.del('key')).resolves.toBeUndefined();
    });
  });

  describe('cacheBalance()', () => {
    let mockClient;

    beforeEach(() => {
      mockClient = createMockClient();
      (RedisService as any).client = mockClient;
    });

    it('should cache with 5s TTL', async () => {
      await RedisService.cacheBalance('user_1', 500);
      expect(mockClient.setex).toHaveBeenCalledWith('balance:user_1', 5, '500');
    });

    it('should be no-op without Redis', async () => {
      resetRedisService();
      await RedisService.cacheBalance('user_1', 100);
      expect(mockClient.setex).not.toHaveBeenCalled();
    });
  });

  describe('getCachedBalance()', () => {
    let mockClient;

    beforeEach(() => {
      mockClient = createMockClient();
      (RedisService as any).client = mockClient;
    });

    it('should return cached balance', async () => {
      mockClient.get.mockResolvedValue('750.50');
      expect(await RedisService.getCachedBalance('user_1')).toBe(750.50);
    });

    it('should return null when not cached', async () => {
      mockClient.get.mockResolvedValue(null);
      expect(await RedisService.getCachedBalance('user_1')).toBeNull();
    });

    it('should return null without Redis', async () => {
      resetRedisService();
      expect(await RedisService.getCachedBalance('user_1')).toBeNull();
    });
  });

  describe('invalidateBalance()', () => {
    let mockClient;

    beforeEach(() => {
      mockClient = createMockClient();
      (RedisService as any).client = mockClient;
    });

    it('should delete balance key', async () => {
      await RedisService.invalidateBalance('user_1');
      expect(mockClient.del).toHaveBeenCalledWith('balance:user_1');
    });
  });

  describe('cacheGameStats()', () => {
    let mockClient;

    beforeEach(() => {
      mockClient = createMockClient();
      (RedisService as any).client = mockClient;
    });

    it('should cache with 60s TTL', async () => {
      const stats = { totalGames: 500 };
      await RedisService.cacheGameStats(stats);
      expect(mockClient.setex).toHaveBeenCalledWith('game_stats', 60, JSON.stringify(stats));
    });
  });

  describe('getCachedGameStats()', () => {
    let mockClient;

    beforeEach(() => {
      mockClient = createMockClient();
      (RedisService as any).client = mockClient;
    });

    it('should return cached stats', async () => {
      const stats = { totalGames: 500 };
      mockClient.get.mockResolvedValue(JSON.stringify(stats));
      expect(await RedisService.getCachedGameStats()).toEqual(stats);
    });

    it('should return null when not cached', async () => {
      mockClient.get.mockResolvedValue(null);
      expect(await RedisService.getCachedGameStats()).toBeNull();
    });
  });

  describe('close()', () => {
    it('should quit both when both exist', async () => {
      const mockQuit = vi.fn().mockResolvedValue(undefined);
      (RedisService as any).client = { quit: mockQuit };
      (RedisService as any).subscriber = { quit: mockQuit };
      await RedisService.close();
      expect(mockQuit).toHaveBeenCalledTimes(2);
      expect((RedisService as any).client).toBeNull();
      expect((RedisService as any).subscriber).toBeNull();
    });

    it('should be no-op when neither exists', async () => {
      await RedisService.close();
      // No throw
    });
  });

  describe('graceful degradation', () => {
    it('should complete all operations without Redis', async () => {
      await expect(RedisService.set('k', 'v', 60)).resolves.toBeUndefined();
      await expect(RedisService.get('k')).resolves.toBeNull();
      await expect(RedisService.del('k')).resolves.toBeUndefined();
      await expect(RedisService.cacheBalance('u', 100)).resolves.toBeUndefined();
      await expect(RedisService.getCachedBalance('u')).resolves.toBeNull();
      await expect(RedisService.invalidateBalance('u')).resolves.toBeUndefined();
      await expect(RedisService.cacheGameStats({})).resolves.toBeUndefined();
      await expect(RedisService.getCachedGameStats()).resolves.toBeNull();
      await expect(RedisService.close()).resolves.toBeUndefined();
    });
  });
});
