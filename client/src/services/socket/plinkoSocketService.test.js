import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function createMockSocket() {
  const listeners = {};
  return {
    listeners,
    on: vi.fn((event, cb) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    }),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    _fire(event, ...args) {
      (listeners[event] || []).forEach((fn) => fn(...args));
    },
  };
}

let mockSocket;
let ioMock;
let svc;

beforeEach(async () => {
  mockSocket = createMockSocket();
  ioMock = vi.fn(() => mockSocket);
  vi.resetModules();
  vi.doMock('socket.io-client', () => ({ io: ioMock }));
  const mod = await import('./plinkoSocketService');
  svc = mod.default;
});

afterEach(() => {
  vi.doUnmock('socket.io-client');
});

describe('PlinkoSocketService', () => {
  describe('connect()', () => {
    it('creates a socket connection to /plinko', async () => {
      const promise = svc.connect();
      mockSocket._fire('connect');
      await promise;

      expect(ioMock).toHaveBeenCalledTimes(1);
      const [url] = ioMock.mock.calls[0];
      expect(url).toMatch(/\/plinko$/);
      expect(svc.isConnected).toBe(true);
    });

    it('resolves immediately when already connected', async () => {
      const p1 = svc.connect();
      mockSocket._fire('connect');
      await p1;
      ioMock.mockClear();

      await svc.connect();
      expect(ioMock).not.toHaveBeenCalled();
    });

    it('rejects on connect_error', async () => {
      const promise = svc.connect();
      const err = new Error('boom');
      mockSocket._fire('connect_error', err);
      await expect(promise).rejects.toBe(err);
    });

    it('sets isConnected=false on disconnect', async () => {
      const p = svc.connect();
      mockSocket._fire('connect');
      await p;
      mockSocket._fire('disconnect');
      expect(svc.isConnected).toBe(false);
    });
  });

  describe('disconnect()', () => {
    it('disconnects and clears socket', async () => {
      const p = svc.connect();
      mockSocket._fire('connect');
      await p;

      svc.disconnect();
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(svc.socket).toBeNull();
      expect(svc.isConnected).toBe(false);
    });

    it('is a no-op when no socket exists', () => {
      svc.disconnect();
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('startGame()', () => {
    it('emits plinko:drop_ball with bet data when connected', async () => {
      const p = svc.connect();
      mockSocket._fire('connect');
      await p;

      const cb = vi.fn();
      svc.startGame(50, 16, 'medium', cb);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'plinko:drop_ball',
        { betAmount: 50, rows: 16, risk: 'medium' },
        cb,
      );
    });

    it('invokes callback with error when not connected', () => {
      const cb = vi.fn();
      svc.startGame(50, 16, 'medium', cb);
      expect(cb).toHaveBeenCalledWith({ success: false, error: 'Socket not connected' });
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('event listeners', () => {
    const listenerMethods = [
      ['onGameStarted', 'gameStarted'],
      ['onBallUpdate', 'ballUpdate'],
      ['onGameResult', 'plinko:game_result'],
      ['onBalanceUpdate', 'balanceUpdate'],
      ['onPathReveal', 'pathReveal'],
      ['onHistoryUpdate', 'historyUpdate'],
      ['onError', 'plinko:error'],
    ];

    for (const [method, event] of listenerMethods) {
      it(`${method}() wires socket.on("${event}") and returns unsubscribe`, async () => {
        const p = svc.connect();
        mockSocket._fire('connect');
        await p;

        const cb = vi.fn();
        const unsub = svc[method](cb);

        expect(mockSocket.on).toHaveBeenCalledWith(event, cb);
        expect(typeof unsub).toBe('function');

        unsub();
        expect(mockSocket.off).toHaveBeenCalledWith(event, cb);
      });

      it(`${method}() returns no-op when no socket exists`, () => {
        const unsub = svc[method](vi.fn());
        expect(typeof unsub).toBe('function');
        expect(() => unsub()).not.toThrow();
      });
    }
  });
});
