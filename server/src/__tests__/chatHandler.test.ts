// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const { mockCreate, mockGetRecentMessages } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockGetRecentMessages: vi.fn(),
}));

const { mockFindById } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
}));

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock('../../drizzle/models/Message.js', () => ({
  default: {
    create: mockCreate,
    getRecentMessages: mockGetRecentMessages,
  },
}));

vi.mock('../../drizzle/models/User.js', () => ({
  default: { findById: mockFindById },
}));

vi.mock('../../lib/auth.js', () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock('../services/loggingService.js', () => ({
  default: {
    logGameEvent: vi.fn(),
    logSystemEvent: vi.fn(),
  },
}));

import initChatHandlers from '../socket/chatHandler.js';

function createMockSocket(userId = 1) {
  const eventHandlers = new Map();
  return {
    id: `socket_${Math.random().toString(36).slice(2)}`,
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
      headers: { cookie: 'session=valid_token' },
    },
    _trigger: async (event, ...args) => {
      const handler = eventHandlers.get(event);
      if (handler) return handler(...args);
    },
  };
}

function createMockNamespace() {
  const middlewares = [];
  const connectionHandlers = [];
  return {
    use: vi.fn((middleware) => middlewares.push(middleware)),
    on: vi.fn((event, handler) => {
      if (event === 'connection') connectionHandlers.push(handler);
    }),
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
    _runMiddleware: async (socket) => {
      for (const mw of middlewares) {
        await new Promise((resolve, reject) => {
          mw(socket, (err) => (err ? reject(err) : resolve()));
        });
      }
    },
    _simulateConnection: async (socket) => {
      for (const handler of connectionHandlers) {
        await handler(socket);
      }
    },
  };
}

function createMockIo() {
  const namespaces = {};
  return {
    of: vi.fn((name) => {
      if (!namespaces[name]) {
        namespaces[name] = createMockNamespace();
      }
      return namespaces[name];
    }),
    _getNamespace: (name) => namespaces[name],
  };
}

describe('ChatHandler', () => {
  let mockIo;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIo = createMockIo();
    mockFindById.mockResolvedValue({ id: 1, username: 'testuser', avatar: null });
    mockGetRecentMessages.mockResolvedValue([]);
    mockCreate.mockResolvedValue({
      id: 1,
      content: 'Hello',
      userId: 1,
      isSystem: false,
      createdAt: new Date(),
    });
    mockGetSession.mockResolvedValue({
      user: { id: '1', username: 'testuser' },
    });
  });

  describe('initialization', () => {
    it('should create chat namespace', () => {
      initChatHandlers(mockIo);
      expect(mockIo.of).toHaveBeenCalledWith('/chat');
    });

    it('should register auth middleware', () => {
      initChatHandlers(mockIo);
      const ns = mockIo._getNamespace('/chat');
      expect(ns.use).toHaveBeenCalled();
    });

    it('should register connection handler', () => {
      initChatHandlers(mockIo);
      const ns = mockIo._getNamespace('/chat');
      expect(ns.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('auth middleware', () => {
    it('should authenticate valid session', async () => {
      initChatHandlers(mockIo);
      const ns = mockIo._getNamespace('/chat');
      const socket = createMockSocket();
      await ns._runMiddleware(socket);
      expect(socket.userId).toBe(1);
    });

    it('should reject missing cookies', async () => {
      initChatHandlers(mockIo);
      const ns = mockIo._getNamespace('/chat');
      const socket = createMockSocket();
      socket.handshake.headers.cookie = undefined;
      await expect(ns._runMiddleware(socket)).rejects.toThrow('Authentication token required');
    });

    it('should reject invalid session', async () => {
      mockGetSession.mockResolvedValue(null);
      initChatHandlers(mockIo);
      const ns = mockIo._getNamespace('/chat');
      const socket = createMockSocket();
      await expect(ns._runMiddleware(socket)).rejects.toThrow('Invalid authentication session');
    });
  });

  describe('connection handler', () => {
    it('should set up user on socket', async () => {
      initChatHandlers(mockIo);
      const ns = mockIo._getNamespace('/chat');
      const socket = createMockSocket();
      await ns._simulateConnection(socket);
      expect(socket.user).toEqual({ id: 1, username: 'testuser', avatar: null });
    });

    it('should join global_chat room', async () => {
      initChatHandlers(mockIo);
      const ns = mockIo._getNamespace('/chat');
      const socket = createMockSocket();
      await ns._simulateConnection(socket);
      expect(socket.join).toHaveBeenCalledWith('global_chat');
    });

    it('should broadcast user_joined event', async () => {
      initChatHandlers(mockIo);
      const ns = mockIo._getNamespace('/chat');
      const socket = createMockSocket();
      await ns._simulateConnection(socket);
      expect(ns.to).toHaveBeenCalledWith('global_chat');
      expect(ns.emit).toHaveBeenCalledWith('user_joined', expect.objectContaining({
        user: expect.objectContaining({ username: 'testuser' }),
        message: expect.stringContaining('testuser'),
      }));
    });

    it('should send message history', async () => {
      const mockMessages = [
        { id: 1, content: 'Hello', userId: 1, username: 'user1', avatar: null, createdAt: new Date() },
      ];
      mockGetRecentMessages.mockResolvedValue(mockMessages);

      initChatHandlers(mockIo);
      const ns = mockIo._getNamespace('/chat');
      const socket = createMockSocket();
      await ns._simulateConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('message_history', expect.any(Array));
    });

    it('should disconnect if user not found in db', async () => {
      mockFindById.mockResolvedValue(null);
      initChatHandlers(mockIo);
      const ns = mockIo._getNamespace('/chat');
      const socket = createMockSocket();
      await ns._simulateConnection(socket);
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'User not found' });
    });

    it('should disconnect if userId is missing', async () => {
      initChatHandlers(mockIo);
      const ns = mockIo._getNamespace('/chat');
      const socket = createMockSocket(null);
      socket.userId = null;
      await ns._simulateConnection(socket);
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Authentication required' });
      expect(socket.disconnect).toHaveBeenCalled();
    });
  });

  describe('send_message', () => {
    it('should broadcast valid message', async () => {
      initChatHandlers(mockIo);
      const ns = mockIo._getNamespace('/chat');
      const socket = createMockSocket();
      await ns._simulateConnection(socket);

      // Reset emit to check only send_message emits
      ns.to.mockClear();
      ns.emit.mockClear();

      await socket._trigger('send_message', { content: 'Hello world' });

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        content: 'Hello world',
        userId: 1,
        isSystem: false,
      }));
      expect(ns.to).toHaveBeenCalledWith('global_chat');
      expect(ns.emit).toHaveBeenCalledWith('new_message', expect.objectContaining({
        content: 'Hello',
        username: 'testuser',
      }));
    });

    it('should reject empty messages', async () => {
      initChatHandlers(mockIo);
      const ns = mockIo._getNamespace('/chat');
      const socket = createMockSocket();
      await ns._simulateConnection(socket);

      socket.emit.mockClear();
      await socket._trigger('send_message', { content: '' });

      expect(socket.emit).toHaveBeenCalledWith('chat_error', { message: 'Message cannot be empty' });
    });

    it('should reject whitespace-only messages', async () => {
      initChatHandlers(mockIo);
      const ns = mockIo._getNamespace('/chat');
      const socket = createMockSocket();
      await ns._simulateConnection(socket);

      socket.emit.mockClear();
      await socket._trigger('send_message', { content: '   ' });

      expect(socket.emit).toHaveBeenCalledWith('chat_error', { message: 'Message cannot be empty' });
    });

    it('should reject messages over 500 characters', async () => {
      initChatHandlers(mockIo);
      const ns = mockIo._getNamespace('/chat');
      const socket = createMockSocket();
      await ns._simulateConnection(socket);

      socket.emit.mockClear();
      const longMessage = 'a'.repeat(501);
      await socket._trigger('send_message', { content: longMessage });

      expect(socket.emit).toHaveBeenCalledWith('chat_error', { message: 'Message too long (max 500 characters)' });
    });

    it('should handle database error gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('DB error'));
      initChatHandlers(mockIo);
      const ns = mockIo._getNamespace('/chat');
      const socket = createMockSocket();
      await ns._simulateConnection(socket);

      socket.emit.mockClear();
      await socket._trigger('send_message', { content: 'Hello' });

      expect(socket.emit).toHaveBeenCalledWith('chat_error', { message: 'Failed to send message' });
    });
  });

  describe('typing indicators', () => {
    it('should broadcast typing event', async () => {
      initChatHandlers(mockIo);
      const ns = mockIo._getNamespace('/chat');
      const socket = createMockSocket();
      await ns._simulateConnection(socket);

      socket.to.mockClear();
      await socket._trigger('typing');

      expect(socket.to).toHaveBeenCalledWith('global_chat');
    });

    it('should broadcast stopTyping event', async () => {
      initChatHandlers(mockIo);
      const ns = mockIo._getNamespace('/chat');
      const socket = createMockSocket();
      await ns._simulateConnection(socket);

      socket.to.mockClear();
      await socket._trigger('stopTyping');

      expect(socket.to).toHaveBeenCalledWith('global_chat');
    });
  });

  describe('leave_chat', () => {
    it('should broadcast userLeft event', async () => {
      initChatHandlers(mockIo);
      const ns = mockIo._getNamespace('/chat');
      const socket = createMockSocket();
      await ns._simulateConnection(socket);

      ns.to.mockClear();
      ns.emit.mockClear();
      await socket._trigger('leave_chat');

      expect(ns.to).toHaveBeenCalledWith('global_chat');
      expect(ns.emit).toHaveBeenCalledWith('userLeft', expect.objectContaining({
        message: expect.stringContaining('testuser'),
      }));
    });
  });
});
