// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// We need to prevent the module-level setInterval from running during import.
// We enable fake timers BEFORE importing the module under test.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Import module under test
// ---------------------------------------------------------------------------
import { socketRateLimit } from '../../middleware/socket/socketRateLimit.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockSocket(overrides: Record<string, any> = {}) {
  const eventHandlers = new Map<string, (...args: any[]) => void>();

  const socket = {
    id: `socket_${Math.random().toString(36).slice(2)}`,
    user: undefined as any,
    emit: vi.fn(),
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      eventHandlers.set(event, handler);
    }),
    _trigger: async (event: string, ...args: any[]) => {
      const handler = eventHandlers.get(event);
      if (handler) return handler(...args);
    },
    ...overrides,
  };

  return socket;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('socketRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Basic functionality
  // -----------------------------------------------------------------------
  describe('basic functionality', () => {
    it('should allow events within the rate limit', async () => {
      const limiter = socketRateLimit(5, 60000);
      const socket = createMockSocket({ user: { userId: 'user1' } });
      const handler = vi.fn();

      limiter(socket, 'testEvent', handler);

      // Fire 5 events (the limit)
      for (let i = 0; i < 5; i++) {
        await socket._trigger('testEvent', { data: i });
      }

      expect(handler).toHaveBeenCalledTimes(5);
    });

    it('should block events exceeding the rate limit', async () => {
      const limiter = socketRateLimit(3, 60000);
      const socket = createMockSocket({ user: { userId: 'user2' } });
      const handler = vi.fn();

      limiter(socket, 'testEvent', handler);

      // Fire 5 events; only the first 3 should go through
      for (let i = 0; i < 5; i++) {
        await socket._trigger('testEvent', { data: i });
      }

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should call the handler with the original arguments', async () => {
      const limiter = socketRateLimit(10, 60000);
      const socket = createMockSocket({ user: { userId: 'user3' } });
      const handler = vi.fn();

      limiter(socket, 'testEvent', handler);

      await socket._trigger('testEvent', 'arg1', 'arg2');

      expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  // -----------------------------------------------------------------------
  // Error handling when rate limited
  // -----------------------------------------------------------------------
  describe('error handling when rate limited', () => {
    it('should call callback with error when rate limited and callback is provided', async () => {
      const limiter = socketRateLimit(1, 60000);
      const socket = createMockSocket({ user: { userId: 'user4' } });
      const handler = vi.fn();

      limiter(socket, 'testEvent', handler);

      // First event passes
      await socket._trigger('testEvent', { data: 'first' });
      expect(handler).toHaveBeenCalledTimes(1);

      // Second event exceeds limit; the callback is the last arg
      const callback = vi.fn();
      await socket._trigger('testEvent', { data: 'second' }, callback);

      expect(handler).toHaveBeenCalledTimes(1); // handler NOT called again
      expect(callback).toHaveBeenCalledWith({
        success: false,
        error: 'Rate limit exceeded. Please slow down.',
      });
    });

    it('should emit error event when rate limited and no callback provided', async () => {
      const limiter = socketRateLimit(1, 60000);
      const socket = createMockSocket({ user: { userId: 'user5' } });
      const handler = vi.fn();

      limiter(socket, 'testEvent', handler);

      // First event passes
      await socket._trigger('testEvent', 'no-callback');
      expect(handler).toHaveBeenCalledTimes(1);

      // Second event exceeds limit; no function arg
      await socket._trigger('testEvent', 'also-no-callback');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(socket.emit).toHaveBeenCalledWith('testEvent:error', {
        message: 'Rate limit exceeded',
      });
    });
  });

  // -----------------------------------------------------------------------
  // Window expiry
  // -----------------------------------------------------------------------
  describe('window expiry', () => {
    it('should reset the counter after the window expires', async () => {
      const windowMs = 5000;
      const limiter = socketRateLimit(2, windowMs);
      const socket = createMockSocket({ user: { userId: 'user6' } });
      const handler = vi.fn();

      limiter(socket, 'testEvent', handler);

      // Use up the limit
      await socket._trigger('testEvent', 'one');
      await socket._trigger('testEvent', 'two');
      expect(handler).toHaveBeenCalledTimes(2);

      // Third event blocked
      await socket._trigger('testEvent', 'three');
      expect(handler).toHaveBeenCalledTimes(2);

      // Advance time past the window
      vi.advanceTimersByTime(windowMs + 1);

      // Now events should be allowed again
      await socket._trigger('testEvent', 'four');
      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should start a new window after the previous one expires', async () => {
      const windowMs = 3000;
      const limiter = socketRateLimit(1, windowMs);
      const socket = createMockSocket({ user: { userId: 'user7' } });
      const handler = vi.fn();

      limiter(socket, 'testEvent', handler);

      // First window: 1 event allowed
      await socket._trigger('testEvent', 'w1');
      expect(handler).toHaveBeenCalledTimes(1);

      // Blocked in first window
      await socket._trigger('testEvent', 'w1-blocked');
      expect(handler).toHaveBeenCalledTimes(1);

      // Advance past window
      vi.advanceTimersByTime(windowMs + 1);

      // Second window: 1 event allowed again
      await socket._trigger('testEvent', 'w2');
      expect(handler).toHaveBeenCalledTimes(2);

      // Blocked again in second window
      await socket._trigger('testEvent', 'w2-blocked');
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------------------
  // User identification
  // -----------------------------------------------------------------------
  describe('user identification', () => {
    it('should use userId when socket.user is available', async () => {
      const limiter = socketRateLimit(1, 60000);
      const socket = createMockSocket({
        id: 'socket-id-fallback',
        user: { userId: 'real-user-id' },
      });
      const handler = vi.fn();

      limiter(socket, 'testEvent', handler);

      // First event passes for real-user-id
      await socket._trigger('testEvent', 'first');
      expect(handler).toHaveBeenCalledTimes(1);

      // Second event blocked for real-user-id
      await socket._trigger('testEvent', 'second');
      expect(handler).toHaveBeenCalledTimes(1);

      // A different socket with the SAME socket.id but different userId should NOT be affected
      const socket2 = createMockSocket({
        id: 'socket-id-fallback', // same socket id
        user: { userId: 'different-user-id' },
      });
      const handler2 = vi.fn();

      limiter(socket2, 'testEvent', handler2);

      await socket2._trigger('testEvent', 'first-for-user2');
      expect(handler2).toHaveBeenCalledTimes(1); // allowed because different userId
    });

    it('should fall back to socket.id when socket.user is undefined', async () => {
      const limiter = socketRateLimit(1, 60000);
      const socket = createMockSocket({
        id: 'anon-socket-123',
        user: undefined,
      });
      const handler = vi.fn();

      limiter(socket, 'testEvent', handler);

      await socket._trigger('testEvent', 'first');
      expect(handler).toHaveBeenCalledTimes(1);

      // Second event blocked based on socket.id
      await socket._trigger('testEvent', 'second');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should fall back to socket.id when socket.user has no userId', async () => {
      const limiter = socketRateLimit(1, 60000);
      const socket = createMockSocket({
        id: 'fallback-socket-id',
        user: {}, // user object exists but no userId
      });
      const handler = vi.fn();

      limiter(socket, 'testEvent', handler);

      await socket._trigger('testEvent', 'first');
      expect(handler).toHaveBeenCalledTimes(1);

      await socket._trigger('testEvent', 'second');
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Event isolation
  // -----------------------------------------------------------------------
  describe('event isolation', () => {
    it('should track different events with separate counters', async () => {
      const limiter = socketRateLimit(1, 60000);
      const socket = createMockSocket({ user: { userId: 'user8' } });
      const handlerA = vi.fn();
      const handlerB = vi.fn();

      limiter(socket, 'eventA', handlerA);
      limiter(socket, 'eventB', handlerB);

      // Each event should have its own counter
      await socket._trigger('eventA', 'a1');
      expect(handlerA).toHaveBeenCalledTimes(1);

      await socket._trigger('eventB', 'b1');
      expect(handlerB).toHaveBeenCalledTimes(1);

      // Second call to eventA should be blocked
      await socket._trigger('eventA', 'a2');
      expect(handlerA).toHaveBeenCalledTimes(1);

      // Second call to eventB should also be blocked (separate counter, same limit)
      await socket._trigger('eventB', 'b2');
      expect(handlerB).toHaveBeenCalledTimes(1);
    });

    it('should allow one event while blocking another that exceeded the limit', async () => {
      const limiter = socketRateLimit(2, 60000);
      const socket = createMockSocket({ user: { userId: 'user9' } });
      const handlerA = vi.fn();
      const handlerB = vi.fn();

      limiter(socket, 'eventA', handlerA);
      limiter(socket, 'eventB', handlerB);

      // Exhaust eventA's limit
      await socket._trigger('eventA', 'a1');
      await socket._trigger('eventA', 'a2');
      await socket._trigger('eventA', 'a3'); // blocked
      expect(handlerA).toHaveBeenCalledTimes(2);

      // eventB should still be allowed
      await socket._trigger('eventB', 'b1');
      expect(handlerB).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Default parameters
  // -----------------------------------------------------------------------
  describe('default parameters', () => {
    it('should default to 10 events per 60-second window', async () => {
      const limiter = socketRateLimit(); // no args = defaults
      const socket = createMockSocket({ user: { userId: 'user10' } });
      const handler = vi.fn();

      limiter(socket, 'testEvent', handler);

      // Fire 10 events (the default limit)
      for (let i = 0; i < 10; i++) {
        await socket._trigger('testEvent', { data: i });
      }
      expect(handler).toHaveBeenCalledTimes(10);

      // 11th event should be blocked
      await socket._trigger('testEvent', { data: 'blocked' });
      expect(handler).toHaveBeenCalledTimes(10);
    });

    it('should reset after the default 60-second window', async () => {
      const limiter = socketRateLimit();
      const socket = createMockSocket({ user: { userId: 'user11' } });
      const handler = vi.fn();

      limiter(socket, 'testEvent', handler);

      // Exhaust limit
      for (let i = 0; i < 10; i++) {
        await socket._trigger('testEvent', { data: i });
      }
      expect(handler).toHaveBeenCalledTimes(10);

      // Blocked
      await socket._trigger('testEvent', { data: 'over' });
      expect(handler).toHaveBeenCalledTimes(10);

      // Advance past 60s window
      vi.advanceTimersByTime(60001);

      // Should be allowed again
      await socket._trigger('testEvent', { data: 'after-reset' });
      expect(handler).toHaveBeenCalledTimes(11);
    });
  });

  // -----------------------------------------------------------------------
  // Custom parameters
  // -----------------------------------------------------------------------
  describe('custom parameters', () => {
    it('should respect custom maxEvents parameter', async () => {
      const limiter = socketRateLimit(3, 60000);
      const socket = createMockSocket({ user: { userId: 'user12' } });
      const handler = vi.fn();

      limiter(socket, 'testEvent', handler);

      for (let i = 0; i < 3; i++) {
        await socket._trigger('testEvent', { data: i });
      }
      expect(handler).toHaveBeenCalledTimes(3);

      await socket._trigger('testEvent', { data: 'blocked' });
      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should respect custom windowMs parameter', async () => {
      const limiter = socketRateLimit(1, 2000);
      const socket = createMockSocket({ user: { userId: 'user13' } });
      const handler = vi.fn();

      limiter(socket, 'testEvent', handler);

      await socket._trigger('testEvent', 'first');
      expect(handler).toHaveBeenCalledTimes(1);

      // Blocked before window expires
      await socket._trigger('testEvent', 'blocked');
      expect(handler).toHaveBeenCalledTimes(1);

      // Advance just under the window
      vi.advanceTimersByTime(1999);
      await socket._trigger('testEvent', 'still-blocked');
      expect(handler).toHaveBeenCalledTimes(1);

      // Advance past the window
      vi.advanceTimersByTime(2);
      await socket._trigger('testEvent', 'allowed');
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------------------
  // Multi-user isolation
  // -----------------------------------------------------------------------
  describe('multi-user isolation', () => {
    it('should not let one user rate limit affect another user', async () => {
      const limiter = socketRateLimit(2, 60000);

      const socket1 = createMockSocket({ user: { userId: 'alice' } });
      const socket2 = createMockSocket({ user: { userId: 'bob' } });
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      limiter(socket1, 'testEvent', handler1);
      limiter(socket2, 'testEvent', handler2);

      // Alice exhausts her limit
      await socket1._trigger('testEvent', 'a1');
      await socket1._trigger('testEvent', 'a2');
      await socket1._trigger('testEvent', 'a3'); // blocked
      expect(handler1).toHaveBeenCalledTimes(2);

      // Bob should still have his own separate counter
      await socket2._trigger('testEvent', 'b1');
      await socket2._trigger('testEvent', 'b2');
      expect(handler2).toHaveBeenCalledTimes(2);

      // Bob is also now at limit
      await socket2._trigger('testEvent', 'b3');
      expect(handler2).toHaveBeenCalledTimes(2);
    });

    it('should not let anonymous sockets with different ids interfere', async () => {
      const limiter = socketRateLimit(1, 60000);

      const socket1 = createMockSocket({ id: 'anon-1', user: undefined });
      const socket2 = createMockSocket({ id: 'anon-2', user: undefined });
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      limiter(socket1, 'testEvent', handler1);
      limiter(socket2, 'testEvent', handler2);

      // socket1 uses up its limit
      await socket1._trigger('testEvent', 'first');
      await socket1._trigger('testEvent', 'second');
      expect(handler1).toHaveBeenCalledTimes(1);

      // socket2 should be unaffected
      await socket2._trigger('testEvent', 'first');
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle exactly maxEvents without blocking', async () => {
      const limiter = socketRateLimit(5, 60000);
      const socket = createMockSocket({ user: { userId: 'exact' } });
      const handler = vi.fn();

      limiter(socket, 'testEvent', handler);

      for (let i = 0; i < 5; i++) {
        await socket._trigger('testEvent', i);
      }

      expect(handler).toHaveBeenCalledTimes(5);
    });

    it('should block the event immediately after exceeding maxEvents', async () => {
      const limiter = socketRateLimit(5, 60000);
      const socket = createMockSocket({ user: { userId: 'exact-plus-1' } });
      const handler = vi.fn();

      limiter(socket, 'testEvent', handler);

      for (let i = 0; i < 5; i++) {
        await socket._trigger('testEvent', i);
      }
      expect(handler).toHaveBeenCalledTimes(5);

      // The 6th event should be blocked
      const callback = vi.fn();
      await socket._trigger('testEvent', 'blocked', callback);
      expect(handler).toHaveBeenCalledTimes(5);
      expect(callback).toHaveBeenCalledWith({
        success: false,
        error: 'Rate limit exceeded. Please slow down.',
      });
    });

    it('should handle maxEvents of 1 correctly', async () => {
      const limiter = socketRateLimit(1, 60000);
      const socket = createMockSocket({ user: { userId: 'single' } });
      const handler = vi.fn();

      limiter(socket, 'testEvent', handler);

      await socket._trigger('testEvent', 'allowed');
      expect(handler).toHaveBeenCalledTimes(1);

      await socket._trigger('testEvent', 'blocked');
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
