import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock socket.io-client ----

const mockSocket = {
  on: vi.fn(),
  emit: vi.fn(),
  close: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

// Import after mock setup
// We need to isolate module state between tests since socketService uses module-level variables
let socketService;
let ioMock;

beforeEach(async () => {
  vi.clearAllMocks();
  mockSocket.on.mockReset();
  mockSocket.emit.mockReset();
  mockSocket.close.mockReset();
  mockSocket.disconnect.mockReset();

  // Reset the module to get fresh module-level state
  vi.resetModules();

  // Re-mock after reset
  vi.doMock('socket.io-client', () => ({
    io: vi.fn(() => mockSocket),
  }));

  const mod = await import('@/services/socketService');
  socketService = mod.default;
  const ioModule = await import('socket.io-client');
  ioMock = ioModule.io;
});

describe('socketService', () => {
  describe('initializeSocket()', () => {
    it('creates a Socket.IO connection with correct options', () => {
      socketService.initializeSocket();

      expect(ioMock).toHaveBeenCalledTimes(1);
      const [url, options] = ioMock.mock.calls[0];
      expect(url).toMatch(/^http:\/\/localhost:\d+$/);
      expect(options.withCredentials).toBe(true);
      expect(options.reconnection).toBe(true);
    });

    it('returns the socket instance', () => {
      const result = socketService.initializeSocket();
      expect(result).toBe(mockSocket);
    });

    it('closes existing socket before creating new one', () => {
      socketService.initializeSocket();
      socketService.initializeSocket();

      expect(mockSocket.close).toHaveBeenCalledTimes(1);
      expect(ioMock).toHaveBeenCalledTimes(2);
    });

    it('sets up default event handlers', () => {
      socketService.initializeSocket();

      // Should register connect, disconnect, connect_error from setupDefaultEventHandlers
      // plus connect_error from the inline listener
      const registeredEvents = mockSocket.on.mock.calls.map((c) => c[0]);
      expect(registeredEvents).toContain('connect');
      expect(registeredEvents).toContain('disconnect');
      expect(registeredEvents).toContain('connect_error');
    });
  });

  describe('getSocket()', () => {
    it('returns existing socket if already initialized', () => {
      socketService.initializeSocket();
      const callCount = ioMock.mock.calls.length;

      const result = socketService.getSocket();

      // Should not create a new one
      expect(ioMock).toHaveBeenCalledTimes(callCount);
      expect(result).toBe(mockSocket);
    });

    it('creates new socket if none exists', () => {
      const result = socketService.getSocket();

      expect(ioMock).toHaveBeenCalled();
      expect(result).toBe(mockSocket);
    });
  });

  describe('onSocketEvent()', () => {
    it('registers event handler and returns unsubscribe function', () => {
      socketService.initializeSocket();
      const handler = vi.fn();

      const unsubscribe = socketService.onSocketEvent('game:update', handler);

      expect(typeof unsubscribe).toBe('function');
      // Should register the event on the socket
      const registeredEvents = mockSocket.on.mock.calls.map((c) => c[0]);
      expect(registeredEvents).toContain('game:update');
    });

    it('initializes socket if not already initialized', () => {
      const handler = vi.fn();
      socketService.onSocketEvent('test:event', handler);

      expect(ioMock).toHaveBeenCalled();
    });

    it('unsubscribe function removes handler', () => {
      socketService.initializeSocket();
      const handler = vi.fn();

      const unsubscribe = socketService.onSocketEvent('game:update', handler);

      // The handler is stored internally. Calling unsubscribe should remove it.
      // We verify by triggering the socket event and checking the handler is not called.
      unsubscribe();

      // Find the socket.on callback for 'game:update' and trigger it
      const gameUpdateCall = mockSocket.on.mock.calls.find((c) => c[0] === 'game:update');
      if (gameUpdateCall) {
        gameUpdateCall[1]('test data');
      }

      expect(handler).not.toHaveBeenCalled();
    });

    it('multiple subscriptions to same event', () => {
      socketService.initializeSocket();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      socketService.onSocketEvent('game:update', handler1);
      socketService.onSocketEvent('game:update', handler2);

      // socket.on should only be called once for non-default events
      const gameUpdateCalls = mockSocket.on.mock.calls.filter((c) => c[0] === 'game:update');
      expect(gameUpdateCalls).toHaveLength(1);

      // Both handlers should be registered internally; trigger them
      const callback = gameUpdateCalls[0][1];
      callback('payload');

      expect(handler1).toHaveBeenCalledWith('payload');
      expect(handler2).toHaveBeenCalledWith('payload');
    });

    it('unsubscribing one handler does not affect others', () => {
      socketService.initializeSocket();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const unsub1 = socketService.onSocketEvent('game:update', handler1);
      socketService.onSocketEvent('game:update', handler2);

      unsub1();

      // Trigger event
      const gameUpdateCall = mockSocket.on.mock.calls.find((c) => c[0] === 'game:update');
      gameUpdateCall[1]('data');

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith('data');
    });
  });

  describe('emitSocketEvent()', () => {
    it('emits event with data', () => {
      socketService.initializeSocket();

      socketService.emitSocketEvent('bet:place', { amount: 100 });

      expect(mockSocket.emit).toHaveBeenCalledWith('bet:place', { amount: 100 });
    });

    it('emits event with acknowledgment callback', () => {
      socketService.initializeSocket();
      const ack = vi.fn();

      socketService.emitSocketEvent('bet:place', { amount: 50 }, ack);

      expect(mockSocket.emit).toHaveBeenCalledWith('bet:place', { amount: 50 }, ack);
    });

    it('initializes socket if not already initialized', () => {
      socketService.emitSocketEvent('test', {});

      expect(ioMock).toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('test', {});
    });
  });

  describe('disconnectSocket()', () => {
    it('disconnects and cleans up', () => {
      socketService.initializeSocket();

      socketService.disconnectSocket();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('does nothing if no socket exists', () => {
      // Should not throw
      socketService.disconnectSocket();
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it('clears event handlers on disconnect', () => {
      socketService.initializeSocket();
      const handler = vi.fn();
      socketService.onSocketEvent('game:update', handler);

      socketService.disconnectSocket();

      // After disconnect, getSocket() should create a new socket
      socketService.getSocket();
      expect(ioMock).toHaveBeenCalledTimes(2);
    });
  });
});
