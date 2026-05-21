import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function createMockSocket({ connected = false } = {}) {
  const listeners = {};
  return {
    listeners,
    connected,
    on: vi.fn((event, cb) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    }),
    off: vi.fn((event, cb) => {
      if (!listeners[event]) return;
      if (!cb) {
        listeners[event] = [];
      } else {
        listeners[event] = listeners[event].filter((fn) => fn !== cb);
      }
    }),
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
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});

  const mod = await import('./chatSocketService');
  svc = mod.default;
});

afterEach(() => {
  vi.doUnmock('socket.io-client');
  vi.restoreAllMocks();
});

describe('chatSocketService', () => {
  it('connect() resolves on connect event and wires all handlers', async () => {
    const promise = svc.connect();
    mockSocket._fire('connect');
    await promise;

    expect(ioMock).toHaveBeenCalled();
    const events = mockSocket.on.mock.calls.map((c) => c[0]);
    expect(events).toEqual(
      expect.arrayContaining([
        'connect',
        'connect_error',
        'disconnect',
        'error',
        'new_message',
        'message_history',
        'user_joined',
        'userLeft',
        'userTyping',
        'userStoppedTyping',
        'chat_error',
      ]),
    );
    expect(svc.connected).toBe(true);
  });

  it('connect() rejects on connect_error', async () => {
    const promise = svc.connect();
    const err = new Error('boom');
    mockSocket._fire('connect_error', err);
    await expect(promise).rejects.toBe(err);
  });

  it('connect() resolves immediately when already connected', async () => {
    const p1 = svc.connect();
    mockSocket._fire('connect');
    await p1;

    // socket.connected is required for the early-resolve guard
    svc.socket.connected = true;
    ioMock.mockClear();
    await svc.connect();
    expect(ioMock).not.toHaveBeenCalled();
  });

  it('connect() rejects when io throws synchronously', async () => {
    vi.resetModules();
    const throwingIo = vi.fn(() => {
      throw new Error('init-fail');
    });
    vi.doMock('socket.io-client', () => ({ io: throwingIo }));
    const mod = await import('./chatSocketService');
    const freshSvc = mod.default;
    await expect(freshSvc.connect()).rejects.toThrow('init-fail');
  });

  it('disconnect handler attempts reconnection when server forces disconnect', async () => {
    vi.useFakeTimers();
    const promise = svc.connect();
    mockSocket._fire('connect');
    await promise;

    // Need a separate socket for the reconnect attempt
    const secondSocket = createMockSocket();
    ioMock.mockImplementationOnce(() => secondSocket);

    mockSocket._fire('disconnect', 'io server disconnect');
    expect(svc.connected).toBe(false);

    // Setting timeout in handler is 3000ms
    vi.advanceTimersByTime(3000);
    // After timer, connect() is called again — verify io was invoked again
    expect(ioMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('fans out new_message events to registered handlers', async () => {
    const p = svc.connect();
    mockSocket._fire('connect');
    await p;

    const handler = vi.fn();
    svc.on('newMessage', handler);
    mockSocket._fire('new_message', { id: 1, content: 'hello' });
    expect(handler).toHaveBeenCalledWith({ id: 1, content: 'hello' });
  });

  it('fans out previous message history events', async () => {
    const p = svc.connect();
    mockSocket._fire('connect');
    await p;
    const handler = vi.fn();
    svc.on('previousMessages', handler);
    mockSocket._fire('message_history', [{ id: 1 }]);
    expect(handler).toHaveBeenCalledWith([{ id: 1 }]);
  });

  it('fans out user_joined, userLeft, userTyping and userStoppedTyping events', async () => {
    const p = svc.connect();
    mockSocket._fire('connect');
    await p;

    const joinedH = vi.fn();
    const leftH = vi.fn();
    const typingH = vi.fn();
    const stopH = vi.fn();
    svc.on('userJoined', joinedH);
    svc.on('userLeft', leftH);
    svc.on('userTyping', typingH);
    svc.on('userStoppedTyping', stopH);

    mockSocket._fire('user_joined', { username: 'a' });
    mockSocket._fire('userLeft', { username: 'b' });
    mockSocket._fire('userTyping', { username: 'c' });
    mockSocket._fire('userStoppedTyping', { username: 'd' });

    expect(joinedH).toHaveBeenCalledWith({ username: 'a' });
    expect(leftH).toHaveBeenCalledWith({ username: 'b' });
    expect(typingH).toHaveBeenCalledWith({ username: 'c' });
    expect(stopH).toHaveBeenCalledWith({ username: 'd' });
  });

  it('fans out error and chat_error events to error handlers', async () => {
    const p = svc.connect();
    mockSocket._fire('connect');
    await p;

    const handler = vi.fn();
    svc.on('error', handler);
    mockSocket._fire('error', { type: 'general' });
    mockSocket._fire('chat_error', { type: 'chat' });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('sendMessage emits send_message when connected', async () => {
    const p = svc.connect();
    mockSocket._fire('connect');
    await p;
    svc.sendMessage('hi');
    expect(mockSocket.emit).toHaveBeenCalledWith('send_message', { content: 'hi' });
  });

  it('sendMessage does nothing when not connected', () => {
    svc.sendMessage('hi');
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('sendTyping emits typing event when connected', async () => {
    const p = svc.connect();
    mockSocket._fire('connect');
    await p;
    svc.sendTyping();
    expect(mockSocket.emit).toHaveBeenCalledWith('typing');
  });

  it('sendTyping is a no-op when not connected', () => {
    svc.sendTyping();
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('sendStopTyping emits stopTyping event when connected', async () => {
    const p = svc.connect();
    mockSocket._fire('connect');
    await p;
    svc.sendStopTyping();
    expect(mockSocket.emit).toHaveBeenCalledWith('stopTyping');
  });

  it('sendStopTyping is a no-op when not connected', () => {
    svc.sendStopTyping();
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('on() ignores unknown event names', () => {
    expect(() => svc.on('does_not_exist', vi.fn())).not.toThrow();
  });

  it('on() returns an unsubscribe function that removes the handler', async () => {
    const p = svc.connect();
    mockSocket._fire('connect');
    await p;
    const handler = vi.fn();
    const unsub = svc.on('newMessage', handler);
    unsub();
    mockSocket._fire('new_message', {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('off() ignores unknown event names', () => {
    expect(() => svc.off('does_not_exist', vi.fn())).not.toThrow();
  });

  it('disconnect() tears down the socket and resets connected state', async () => {
    const p = svc.connect();
    mockSocket._fire('connect');
    await p;

    svc.disconnect();
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(svc.socket).toBeNull();
    expect(svc.connected).toBe(false);
  });

  it('disconnect() is a no-op when no socket is open', () => {
    expect(() => svc.disconnect()).not.toThrow();
  });
});
