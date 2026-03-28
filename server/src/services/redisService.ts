import Redis from 'ioredis';
import LoggingService from './loggingService.js';

class RedisService {
  private static client: Redis | null = null;
  private static subscriber: Redis | null = null;

  /**
   * Get or create Redis client
   * Returns null if Redis is not configured (graceful degradation)
   */
  static getClient(): Redis | null {
    if (this.client) return this.client;

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return null;

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
      });

      this.client.on('error', (err) => {
        LoggingService.logger.error('Redis client error', { error: err.message });
      });

      this.client.connect().catch(() => {
        // Silently fail - Redis is optional
        this.client = null;
      });

      return this.client;
    } catch {
      return null;
    }
  }

  /**
   * Get subscriber client for Socket.IO adapter
   */
  static getSubscriber(): Redis | null {
    if (this.subscriber) return this.subscriber;

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return null;

    try {
      this.subscriber = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.subscriber.on('error', (err) => {
        LoggingService.logger.error('Redis subscriber error', { error: err.message });
      });

      this.subscriber.connect().catch(() => {
        this.subscriber = null;
      });

      return this.subscriber;
    } catch {
      return null;
    }
  }

  /**
   * Cache a value with optional TTL
   */
  static async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const client = this.getClient();
    if (!client) return;

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await client.setex(key, ttlSeconds, serialized);
      } else {
        await client.set(key, serialized);
      }
    } catch {
      // Silently fail - cache is best-effort
    }
  }

  /**
   * Get a cached value
   */
  static async get<T = any>(key: string): Promise<T | null> {
    const client = this.getClient();
    if (!client) return null;

    try {
      const value = await client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Delete a cached value
   */
  static async del(key: string): Promise<void> {
    const client = this.getClient();
    if (!client) return;

    try {
      await client.del(key);
    } catch {
      // Silently fail
    }
  }

  /**
   * Cache user balance (short TTL, invalidated on write)
   */
  static async cacheBalance(userId: string, balance: number): Promise<void> {
    await this.set(`balance:${userId}`, balance, 5); // 5 second TTL
  }

  /**
   * Get cached balance
   */
  static async getCachedBalance(userId: string): Promise<number | null> {
    return this.get<number>(`balance:${userId}`);
  }

  /**
   * Invalidate balance cache
   */
  static async invalidateBalance(userId: string): Promise<void> {
    await this.del(`balance:${userId}`);
  }

  /**
   * Cache game stats (longer TTL)
   */
  static async cacheGameStats(stats: any): Promise<void> {
    await this.set('game_stats', stats, 60); // 60 second TTL
  }

  /**
   * Get cached game stats
   */
  static async getCachedGameStats(): Promise<any | null> {
    return this.get('game_stats');
  }

  /**
   * Close all connections
   */
  static async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
  }
}

export default RedisService;
