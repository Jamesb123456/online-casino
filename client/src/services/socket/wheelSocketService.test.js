import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function createMockSocket() {
  const listeners = {};
  return {
    listeners,
    connected: false,
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
  const mod = await import('./wheelSocketService');
  svc = mod.default;
});

afterEach(() => {
  vi.doUnmock('socket.io-client');
});

describe('WheelSocketService', () => {
  describe('setUser()', () => {
    it('stores user info', () => {
      svc.setUser({ userId: 9 });
      expect(svc.user).toEqual({ userId: 9 });
    });
  });

  describe('connect()', () => {
    it('creates a socket to /wheel and resolves on connect', async () => {
      const p = svc.connect();
      mockSocket._fire('connect');
      await p;

      const [url] = ioMock.mock.calls[0];
      expect(url).toMatch(/\/wheel$/);
      expect(svc.isConnected).toBe(true);
    });

    it('rejects on connect_error', async () => {
      const p = svc.connect();
      const err = new Error('boom');
      mockSocket._fire('connect_error', err);
      await expect(p).rejects.toBe(err);
    });

    it('resolves immediately when socket is already connected', async () => {
      const p = svc.connect();
      mockSocket._fire('connect');
      await p;
      // The implementation checks socket?.connected — set it to true on the mock.
      mockSocket.connected = true;

      ioMock.mockClear();
      await svc.connect();
      expect(ioMock).not.toHaveBeenCalled();
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

    it('is a no-op when no socket', () => {
      svc.disconnect();
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('placeBet()', () => {
    it('emits wheel:place_bet and resolves on success', async () => {
      const p = svc.connect();
      mockSocket._fire('connect');
      await p;

      mockSocket.emit.mockImplementationOnce((event, data, cb) => {
        cb({ success: true, payout: 5 });
      });

      const res = await svc.placeBet({ amount: 10, difficulty: 'medium' });
      expect(res.payout).toBe(5);
    });

    it('rejects on error response', async () => {
      const p = svc.connect();
      mockSocket._fire('connect');
      await p;

      mockSocket.emit.mockImplementationOnce((event, data, cb) => {
        cb({ success: false, error: 'oops' });
      });

      await expect(svc.placeBet({})).rejects.toThrow('oops');
    });

    it('rejects when not connected', async () => {
      await expect(svc.placeBet({})).rejects.toThrow('Socket not connected');
    });
  });

  describe('event listeners', () => {
    const listenerMethods = [
      ['onCountdown', 'countdown'],
      ['onGameStarting', 'gameStarting'],
      ['onWheelSpinning', 'wheelSpinning'],
      ['onGameResult', 'wheel:game_result'],
      ['onPlayerBets', 'playerBets'],
      ['onBalanceUpdate', 'balanceUpdate'],
      ['onHistoryUpdate', 'historyUpdate'],
      ['onError', 'wheel:error'],
      ['onActivePlayers', 'wheel:activePlayers'],
      ['onPlayerJoined', 'wheel:playerJoined'],
      ['onPlayerLeft', 'wheel:playerLeft'],
      ['onPlayerBet', 'wheel:playerBet'],
      ['onCurrentBets', 'wheel:currentBets'],
    ];

    for (const [method, event] of listenerMethods) {
      it(`${method}() wires socket.on("${event}") and returns unsubscribe`, async () => {
        const p = svc.connect();
        mockSocket._fire('connect');
        await p;

        const cb = vi.fn();
        const unsub = svc[method](cb);
        expect(mockSocket.on).toHaveBeenCalledWith(event, cb);

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
