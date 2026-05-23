// @ts-nocheck
/**
 * Unit tests for chat socket handler.
 *
 * Purpose: lock in current behaviour of `server/src/socket/chatHandler.ts`
 * so that an upcoming refactor can be verified against this regression gate.
 *
 * Strategy: no real Socket.IO server, no real DB. We build hand-rolled
 * mocks for the io/namespace/socket surface and for the Drizzle models,
 * Better Auth, and LoggingService dependencies. Every branch the handler
 * exposes (auth middleware happy/sad paths, connection setup, send_message
 * validation + happy/error paths, typing/stopTyping, leave_chat, outer
 * try/catch) is asserted.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- vi.hoisted mock factories (hoisted above vi.mock) ---------------------
const { mockMessageCreate, mockGetRecentMessages } = vi.hoisted(() => ({
  mockMessageCreate: vi.fn(),
  mockGetRecentMessages: vi.fn(),
}));

const { mockUserFindById } = vi.hoisted(() => ({
  mockUserFindById: vi.fn(),
}));

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

const { mockLogGameEvent, mockLogSystemEvent } = vi.hoisted(() => ({
  mockLogGameEvent: vi.fn(),
  mockLogSystemEvent: vi.fn(),
}));

vi.mock('../../../drizzle/models/Message.js', () => ({
  default: {
    create: mockMessageCreate,
    getRecentMessages: mockGetRecentMessages,
  },
}));

vi.mock('../../../drizzle/models/User.js', () => ({
  default: { findById: mockUserFindById },
}));

vi.mock('../../../lib/auth.js', () => ({
  auth: {
    api: { getSession: mockGetSession },
  },
}));

vi.mock('../../services/loggingService.js', () => ({
  default: {
    logGameEvent: mockLogGameEvent,
    logSystemEvent: mockLogSystemEvent,
  },
}));

// Import after mocks are registered. Note the relative path because this
// file lives under src/__tests__/socket/.
import initChatHandlers from '../../socket/chatHandler.js';

// --- Socket.IO surface mocks ----------------------------------------------
function createMockSocket(userId = 7) {
  const eventHandlers = new Map();
  return {
    id: `sock_${Math.random().toString(36).slice(2)}`,
    userId,
    user: null,
    emit: vi.fn(),
    join: vi.fn(),
    to: vi.fn().mockReturnThis(),
    on: vi.fn((event, handler) => {
      eventHandlers.set(event, handler);
    }),
    disconnect: vi.fn(),
    handshake: {
      headers: { cookie: 'better-auth.session_token=abc' },
    },
    _trigger: async (event, ...args) => {
      const handler = eventHandlers.get(event);
      if (!handler) throw new Error(`No handler registered for '${event}'`);
      return handler(...args);
    },
    _registeredEvents: () => Array.from(eventHandlers.keys()),
  };
}

function createMockNamespace() {
  const middlewares: any[] = [];
  const connectionHandlers: any[] = [];
  return {
    use: vi.fn((middleware: any) => middlewares.push(middleware)),
    on: vi.fn((event: string, handler: any) => {
      if (event === 'connection') connectionHandlers.push(handler);
    }),
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
    _runMiddleware: async (socket: any) => {
      for (const mw of middlewares) {
        await new Promise<void>((resolve, reject) => {
          mw(socket, (err: any) => (err ? reject(err) : resolve()));
        });
      }
    },
    _simulateConnection: async (socket: any) => {
      for (const handler of connectionHandlers) {
        await handler(socket);
      }
    },
  };
}

function createMockIo() {
  const namespaces: Record<string, any> = {};
  return {
    of: vi.fn((name: string) => {
      if (!namespaces[name]) namespaces[name] = createMockNamespace();
      return namespaces[name];
    }),
    _getNamespace: (name: string) => namespaces[name],
  };
}

// --- Default mock state ----------------------------------------------------
const DEFAULT_USER = { id: 7, username: 'alice', avatar: 'avatar.png' };

beforeEach(() => {
  vi.clearAllMocks();

  mockUserFindById.mockResolvedValue(DEFAULT_USER);
  mockGetRecentMessages.mockResolvedValue([]);
  mockMessageCreate.mockResolvedValue({
    id: 100,
    content: 'Hello world',
    userId: 7,
    isSystem: false,
    createdAt: new Date('2026-05-23T00:00:00.000Z'),
  });
  mockGetSession.mockResolvedValue({
    user: { id: '7', username: 'alice' },
  });
});

// --- Tests -----------------------------------------------------------------
describe('chatHandler (socket regression gate)', () => {
  describe('namespace setup', () => {
    it('creates a "/chat" namespace', () => {
      const io = createMockIo();
      initChatHandlers(io);
      expect(io.of).toHaveBeenCalledWith('/chat');
    });

    it('registers exactly one auth middleware', () => {
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      expect(ns.use).toHaveBeenCalledTimes(1);
    });

    it('registers a "connection" listener on the namespace', () => {
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      expect(ns.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('returns the chat namespace from init', () => {
      const io = createMockIo();
      const ret = initChatHandlers(io);
      expect(ret).toBe(io._getNamespace('/chat'));
    });
  });

  describe('auth middleware', () => {
    it('passes when cookie + valid session present and coerces userId to a Number', async () => {
      mockGetSession.mockResolvedValue({ user: { id: '42', username: 'bob' } });
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket(undefined);

      await ns._runMiddleware(socket);

      expect(socket.userId).toBe(42);
      expect(typeof socket.userId).toBe('number');
    });

    it('rejects when no cookie header is present', async () => {
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket();
      socket.handshake.headers.cookie = undefined;

      await expect(ns._runMiddleware(socket)).rejects.toThrow(
        'Authentication token required',
      );
    });

    it('rejects when session has no user', async () => {
      mockGetSession.mockResolvedValue(null);
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket();

      await expect(ns._runMiddleware(socket)).rejects.toThrow(
        'Invalid authentication session',
      );
    });

    it('rejects when session.user is undefined', async () => {
      mockGetSession.mockResolvedValue({ user: undefined });
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket();

      await expect(ns._runMiddleware(socket)).rejects.toThrow(
        'Invalid authentication session',
      );
    });

    it('logs and rejects with "Authentication failed" when auth.api.getSession throws', async () => {
      mockGetSession.mockRejectedValue(new Error('boom'));
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket();

      await expect(ns._runMiddleware(socket)).rejects.toThrow('Authentication failed');
      expect(mockLogSystemEvent).toHaveBeenCalledWith(
        'chat_auth_error',
        { error: 'boom' },
        'error',
      );
    });
  });

  describe('connection lifecycle', () => {
    it('logs a client_connected game event with the socket id', async () => {
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket();

      await ns._simulateConnection(socket);

      expect(mockLogGameEvent).toHaveBeenCalledWith(
        'chat',
        'client_connected',
        { socketId: socket.id },
      );
    });

    it('emits error + disconnects when socket.userId is missing', async () => {
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket();
      socket.userId = null;

      await ns._simulateConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Authentication required' });
      expect(socket.disconnect).toHaveBeenCalled();
      expect(mockLogSystemEvent).toHaveBeenCalledWith(
        'chat_unauthenticated',
        { socketId: socket.id },
        'warning',
      );
      // Should not proceed to DB lookups
      expect(mockUserFindById).not.toHaveBeenCalled();
    });

    it('emits "User not found" error when findById returns null and does not disconnect', async () => {
      mockUserFindById.mockResolvedValue(null);
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket();

      await ns._simulateConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'User not found' });
      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(mockLogSystemEvent).toHaveBeenCalledWith(
        'chat_user_not_found',
        { userId: socket.userId },
        'warning',
      );
    });

    it('attaches a user object to the socket from the DB user record', async () => {
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket();

      await ns._simulateConnection(socket);

      expect(socket.user).toEqual({
        id: DEFAULT_USER.id,
        username: DEFAULT_USER.username,
        avatar: DEFAULT_USER.avatar,
      });
    });

    it('joins the global_chat room', async () => {
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket();

      await ns._simulateConnection(socket);

      expect(socket.join).toHaveBeenCalledWith('global_chat');
    });

    it('broadcasts a user_joined event into global_chat with username in the message', async () => {
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket();

      await ns._simulateConnection(socket);

      expect(ns.to).toHaveBeenCalledWith('global_chat');
      expect(ns.emit).toHaveBeenCalledWith(
        'user_joined',
        expect.objectContaining({
          user: expect.objectContaining({ username: 'alice' }),
          message: 'alice has joined the chat',
          timestamp: expect.any(Date),
        }),
      );
    });

    it('emits message_history with the last 50 transformed messages', async () => {
      const messages = [
        {
          id: 1,
          content: 'first',
          userId: 7,
          username: 'alice',
          avatar: 'a.png',
          createdAt: new Date('2026-05-22T10:00:00Z'),
          isSystem: false,
        },
        {
          id: 2,
          content: 'system notice',
          userId: 0,
          username: 'system',
          avatar: null,
          createdAt: new Date('2026-05-22T10:01:00Z'),
          isSystem: true,
        },
      ];
      mockGetRecentMessages.mockResolvedValue(messages);

      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket();

      await ns._simulateConnection(socket);

      expect(mockGetRecentMessages).toHaveBeenCalledWith(50);

      const historyCall = socket.emit.mock.calls.find((c: any[]) => c[0] === 'message_history');
      expect(historyCall).toBeDefined();
      const payload = historyCall![1];
      expect(payload).toHaveLength(2);
      expect(payload[0]).toEqual({
        id: 1,
        _id: 1,
        content: 'first',
        createdAt: messages[0].createdAt,
        userId: 7,
        isSystem: false,
        username: 'alice',
        avatar: 'a.png',
      });
      expect(payload[1]).toEqual({
        id: 2,
        _id: 2,
        content: 'system notice',
        createdAt: messages[1].createdAt,
        userId: 0,
        isSystem: true,
        username: 'system',
        avatar: null,
      });
    });

    it('defaults isSystem to false when the DB row omits it', async () => {
      mockGetRecentMessages.mockResolvedValue([
        {
          id: 99,
          content: 'no flag',
          userId: 1,
          username: 'u',
          avatar: null,
          createdAt: new Date(),
        },
      ]);

      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket();

      await ns._simulateConnection(socket);

      const historyCall = socket.emit.mock.calls.find((c: any[]) => c[0] === 'message_history');
      expect(historyCall![1][0].isSystem).toBe(false);
    });

    it('registers send_message, typing, stopTyping, and leave_chat listeners', async () => {
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket();

      await ns._simulateConnection(socket);

      const events = socket._registeredEvents();
      expect(events).toEqual(
        expect.arrayContaining(['send_message', 'typing', 'stopTyping', 'leave_chat']),
      );
    });

    it('logs chat_handler_error when the outer try block throws (e.g. findById rejects)', async () => {
      mockUserFindById.mockRejectedValue(new Error('db blew up'));
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket();

      // should not throw — handler swallows and logs
      await ns._simulateConnection(socket);

      expect(mockLogSystemEvent).toHaveBeenCalledWith(
        'chat_handler_error',
        expect.objectContaining({
          error: expect.stringContaining('db blew up'),
          socketId: socket.id,
        }),
        'error',
      );
    });
  });

  describe('send_message event', () => {
    async function connect() {
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket();
      await ns._simulateConnection(socket);
      // Clear post-connection emits so each test can assert in isolation
      socket.emit.mockClear();
      ns.to.mockClear();
      ns.emit.mockClear();
      return { io, ns, socket };
    }

    it('rejects empty content with chat_error and does not write to DB', async () => {
      const { socket } = await connect();
      await socket._trigger('send_message', { content: '' });
      expect(socket.emit).toHaveBeenCalledWith('chat_error', { message: 'Message cannot be empty' });
      expect(mockMessageCreate).not.toHaveBeenCalled();
    });

    it('rejects whitespace-only content with chat_error', async () => {
      const { socket } = await connect();
      await socket._trigger('send_message', { content: '     \t  ' });
      expect(socket.emit).toHaveBeenCalledWith('chat_error', { message: 'Message cannot be empty' });
      expect(mockMessageCreate).not.toHaveBeenCalled();
    });

    it('rejects missing content field with chat_error', async () => {
      const { socket } = await connect();
      await socket._trigger('send_message', {});
      expect(socket.emit).toHaveBeenCalledWith('chat_error', { message: 'Message cannot be empty' });
      expect(mockMessageCreate).not.toHaveBeenCalled();
    });

    it('rejects content over 500 characters with chat_error and does not write to DB', async () => {
      const { socket } = await connect();
      await socket._trigger('send_message', { content: 'x'.repeat(501) });
      expect(socket.emit).toHaveBeenCalledWith('chat_error', {
        message: 'Message too long (max 500 characters)',
      });
      expect(mockMessageCreate).not.toHaveBeenCalled();
    });

    it('accepts content of exactly 500 characters', async () => {
      const { socket } = await connect();
      await socket._trigger('send_message', { content: 'x'.repeat(500) });
      expect(mockMessageCreate).toHaveBeenCalledTimes(1);
    });

    it('trims content before persisting and broadcasts a new_message with the persisted shape', async () => {
      const { ns, socket } = await connect();
      mockMessageCreate.mockResolvedValueOnce({
        id: 200,
        content: 'hello',
        userId: 7,
        isSystem: false,
        createdAt: new Date('2026-05-23T01:00:00Z'),
      });

      await socket._trigger('send_message', { content: '   hello   ' });

      expect(mockMessageCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'hello',
          userId: 7,
          isSystem: false,
          createdAt: expect.any(Date),
        }),
      );
      expect(ns.to).toHaveBeenCalledWith('global_chat');
      expect(ns.emit).toHaveBeenCalledWith(
        'new_message',
        expect.objectContaining({
          id: 200,
          _id: 200,
          content: 'hello',
          userId: 7,
          isSystem: false,
          username: 'alice',
          avatar: 'avatar.png',
        }),
      );
    });

    it('logs a message_sent game event on success', async () => {
      const { socket } = await connect();
      mockLogGameEvent.mockClear();

      await socket._trigger('send_message', { content: 'hi' });

      expect(mockLogGameEvent).toHaveBeenCalledWith(
        'chat',
        'message_sent',
        { userId: 7, username: 'alice' },
      );
    });

    it('emits chat_error when Message.create rejects and logs error_sending_message', async () => {
      const { socket } = await connect();
      mockMessageCreate.mockRejectedValueOnce(new Error('db down'));

      await socket._trigger('send_message', { content: 'hi' });

      expect(socket.emit).toHaveBeenCalledWith('chat_error', { message: 'Failed to send message' });
      expect(mockLogGameEvent).toHaveBeenCalledWith(
        'chat',
        'error_sending_message',
        expect.objectContaining({ userId: 7, error: expect.stringContaining('db down') }),
      );
    });
  });

  describe('typing indicators', () => {
    it('broadcasts userTyping to other members of global_chat (socket.to, not namespace)', async () => {
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket();
      await ns._simulateConnection(socket);

      socket.to.mockClear();
      socket.emit.mockClear();
      ns.emit.mockClear();

      await socket._trigger('typing');

      expect(socket.to).toHaveBeenCalledWith('global_chat');
      // socket.to(...).emit('userTyping', {...})
      const toReturn = socket.to.mock.results[0].value;
      expect(toReturn.emit).toHaveBeenCalledWith(
        'userTyping',
        { username: 'alice' },
      );
      // namespace broadcast should NOT have been used for typing
      expect(ns.emit).not.toHaveBeenCalled();
    });

    it('broadcasts userStoppedTyping on stopTyping', async () => {
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket();
      await ns._simulateConnection(socket);

      socket.to.mockClear();
      await socket._trigger('stopTyping');

      expect(socket.to).toHaveBeenCalledWith('global_chat');
      const toReturn = socket.to.mock.results[0].value;
      expect(toReturn.emit).toHaveBeenCalledWith(
        'userStoppedTyping',
        { username: 'alice' },
      );
    });
  });

  describe('leave_chat event', () => {
    it('broadcasts userLeft to global_chat using namespace.to (visible to everyone incl. sender)', async () => {
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket();
      await ns._simulateConnection(socket);

      ns.to.mockClear();
      ns.emit.mockClear();

      await socket._trigger('leave_chat');

      expect(ns.to).toHaveBeenCalledWith('global_chat');
      expect(ns.emit).toHaveBeenCalledWith(
        'userLeft',
        expect.objectContaining({
          user: expect.objectContaining({ username: 'alice' }),
          message: 'alice has left the chat',
          timestamp: expect.any(Date),
        }),
      );
    });

    it('logs a client_disconnected game event with socketId and userId', async () => {
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket();
      await ns._simulateConnection(socket);

      mockLogGameEvent.mockClear();
      await socket._trigger('leave_chat');

      expect(mockLogGameEvent).toHaveBeenCalledWith(
        'chat',
        'client_disconnected',
        { socketId: socket.id, userId: 7 },
      );
    });

    it('falls back to "A user" in the leave message when socket.user is missing', async () => {
      const io = createMockIo();
      initChatHandlers(io);
      const ns = io._getNamespace('/chat');
      const socket = createMockSocket();
      await ns._simulateConnection(socket);

      // Simulate user object being cleared between connection and leave.
      socket.user = null;
      ns.emit.mockClear();

      await socket._trigger('leave_chat');

      expect(ns.emit).toHaveBeenCalledWith(
        'userLeft',
        expect.objectContaining({
          message: 'A user has left the chat',
        }),
      );
    });
  });
});
