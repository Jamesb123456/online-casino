/**
 * Socket.IO rate limiter
 * Limits the number of events a user can emit per time window
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

// Clean up stale entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (entry.resetAt <= now) {
      rateLimits.delete(key);
    }
  }
}, 60000);

/**
 * Create a rate-limited socket event handler
 * @param maxEvents - Maximum events allowed in the window
 * @param windowMs - Time window in milliseconds
 */
export function socketRateLimit(maxEvents: number = 10, windowMs: number = 60000) {
  return (socket: any, eventName: string, handler: (...args: any[]) => void) => {
    socket.on(eventName, (...args: any[]) => {
      const userId = socket.user?.userId || socket.id;
      const key = `${userId}:${eventName}`;
      const now = Date.now();

      let entry = rateLimits.get(key);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + windowMs };
        rateLimits.set(key, entry);
      }

      entry.count++;

      if (entry.count > maxEvents) {
        // Rate limited - find callback and send error
        const callback = args.find(arg => typeof arg === 'function');
        if (callback) {
          callback({ success: false, error: 'Rate limit exceeded. Please slow down.' });
        } else {
          socket.emit(`${eventName}:error`, { message: 'Rate limit exceeded' });
        }
        return;
      }

      handler(...args);
    });
  };
}

export default socketRateLimit;
