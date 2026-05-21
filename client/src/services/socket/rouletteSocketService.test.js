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
  const mod = await import('./rouletteSocketService');
  svc = mod.default;
});

afterEach(() => {
  vi.doUnmock('socket.io-client');
});

describe('RouletteSocketService', () => {
  describe('setUser()', () => {
    it('stores user info', () => {
      svc.setUser({ userId: 5, username: 'p' });
      expect(svc.user).toEqual({ userId: 5, username: 'p' });
    });
  });

  describe('connect()', () => {
    it('creates a socket to /roulette and resolves on connect', async () => {
      const p = svc.connect();
      mockSocket._fire('connect');
      await p;

      const [url] = ioMock.mock.calls[0];
      expect(url).toMatch(/\/roulette$/);
      expect(svc.isConnected).toBe(true);
    });

    it('rejects on connect_error', async () => {
      const p = svc.connect();
      const err = new Error('nope');
      mockSocket._fire('connect_error', err);
      await expect(p).rejects.toBe(err);
    });

    it('resolves immediately when already connected', async () => {
      const p = svc.connect();
      mockSocket._fire('connect');
      await p;

      ioMock.mockClear();
      await svc.connect();
      expect(ioMock).not.toHaveBeenCalled();
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
    });

    it('is no-op without socket', () => {
      svc.disconnect();
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('placeBet()', () => {
    it('emits roulette:place_bet and resolves on success', async () => {
      const p = svc.connect();
      mockSocket._fire('connect');
      await p;

      mockSocket.emit.mockImplementationOnce((event, data, cb) => {
        cb({ success: true, betId: 1 });
      });

      const result = await svc.placeBet({ type: 'RED', amount: 10 });
      expect(result.betId).toBe(1);
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'roulette:place_bet',
        { type: 'RED', amount: 10 },
        expect.any(Function),
      );
    });

    it('rejects on failure response', async () => {
      const p = svc.connect();
      mockSocket._fire('connect');
      await p;

      mockSocket.emit.mockImplementationOnce((event, data, cb) => {
        cb({ success: false, error: 'invalid' });
      });

      await expect(svc.placeBet({})).rejects.toThrow('invalid');
    });

    it('rejects when not connected', async () => {
      await expect(svc.placeBet({})).rejects.toThrow('Socket not connected');
    });
  });

  describe('clearBets()', () => {
    it('emits clearBets when connected', async () => {
      const p = svc.connect();
      mockSocket._fire('connect');
      await p;
      svc.clearBets();
      expect(mockSocket.emit).toHaveBeenCalledWith('clearBets');
    });

    it('is a no-op when not connected', () => {
      svc.clearBets();
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('joinGame()', () => {
    it('emits roulette:join and resolves on success', async () => {
      const p = svc.connect();
      mockSocket._fire('connect');
      await p;

      mockSocket.emit.mockImplementationOnce((event, data, cb) => {
        cb({ success: true, game: 'ok' });
      });

      const result = await svc.joinGame();
      expect(result.game).toBe('ok');
    });

    it('rejects when server returns no success', async () => {
      const p = svc.connect();
      mockSocket._fire('connect');
      await p;

      mockSocket.emit.mockImplementationOnce((event, data, cb) => {
        cb({ success: false, message: 'closed' });
      });

      await expect(svc.joinGame()).rejects.toThrow(/Failed to join game/);
    });

    it('rejects when not connected', async () => {
      await expect(svc.joinGame()).rejects.toThrow('Socket not connected');
    });
  });

  describe('spin()', () => {
    it('emits roulette:spin with stringified bet values and resolves', async () => {
      const p = svc.connect();
      mockSocket._fire('connect');
      await p;

      mockSocket.emit.mockImplementationOnce((event, data, cb) => {
        cb({ success: true, winningNumber: 7 });
      });

      const result = await svc.spin([{ type: 'STRAIGHT', value: 7, amount: 1 }]);
      expect(result.winningNumber).toBe(7);

      const call = mockSocket.emit.mock.calls.find((c) => c[0] === 'roulette:spin');
      expect(call[1].bets[0].value).toBe('7');
    });

    it('rejects on failure response', async () => {
      const p = svc.connect();
      mockSocket._fire('connect');
      await p;

      mockSocket.emit.mockImplementationOnce((event, data, cb) => {
        cb({ success: false, error: 'rigged' });
      });

      await expect(svc.spin([])).rejects.toThrow('rigged');
    });
  });

  describe('event listeners', () => {
    const listenerMethods = [
      ['onCountdown', 'countdown'],
      ['onBettingStart', 'bettingStart'],
      ['onBettingEnd', 'bettingEnd'],
      ['onSpinStarted', 'roulette:spin_started'],
      ['onSpinResult', 'roulette:spin_result'],
      ['onPersonalResult', 'roulette:personal_result'],
      ['onRoundComplete', 'roulette:round_complete'],
      ['onGameResult', 'roulette:game_result'],
      ['onPlayerBets', 'playerBets'],
      ['onBetConfirmed', 'betConfirmed'],
      ['onBalanceUpdate', 'balanceUpdate'],
      ['onHistoryUpdate', 'historyUpdate'],
      ['onError', 'error'],
      ['onActivePlayers', 'roulette:activePlayers'],
      ['onPlayerJoined', 'roulette:playerJoined'],
      ['onPlayerLeft', 'roulette:playerLeft'],
      ['onPlayerBet', 'roulette:playerBet'],
      ['onCurrentBets', 'roulette:currentBets'],
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

  describe('generic on()/off()', () => {
    it('on() delegates to socket.on', async () => {
      const p = svc.connect();
      mockSocket._fire('connect');
      await p;

      const cb = vi.fn();
      svc.on('foo', cb);
      expect(mockSocket.on).toHaveBeenCalledWith('foo', cb);
    });

    it('on() is a no-op without socket', () => {
      svc.on('foo', vi.fn());
      expect(mockSocket.on).not.toHaveBeenCalled();
    });

    it('off() with callback removes one handler', async () => {
      const p = svc.connect();
      mockSocket._fire('connect');
      await p;

      const cb = vi.fn();
      svc.off('foo', cb);
      expect(mockSocket.off).toHaveBeenCalledWith('foo', cb);
    });

    it('off() without callback clears all listeners for event', async () => {
      const p = svc.connect();
      mockSocket._fire('connect');
      await p;

      svc.off('foo');
      expect(mockSocket.off).toHaveBeenCalledWith('foo');
    });

    it('off() is a no-op without socket', () => {
      svc.off('foo');
      expect(mockSocket.off).not.toHaveBeenCalled();
    });
  });
});
