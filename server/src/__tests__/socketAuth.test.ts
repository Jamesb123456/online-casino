// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks -- use vi.hoisted for variables referenced inside vi.mock factories
// ---------------------------------------------------------------------------

const { mockGetSession, mockLogSystemEvent } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockLogSystemEvent: vi.fn(),
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
    logSystemEvent: mockLogSystemEvent,
  },
}));

// ---------------------------------------------------------------------------
// Import module under test
// ---------------------------------------------------------------------------

import { socketAuth, getAuthenticatedUser } from '../../middleware/socket/socketAuth.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockSocket(overrides: Record<string, any> = {}) {
  return {
    id: 'test-socket-id',
    handshake: {
      headers: {
        cookie: 'better_auth.session_token=valid-session-token',
      },
    },
    ...overrides,
  };
}

function createMockSocketNoCookies() {
  return {
    id: 'test-socket-no-cookies',
    handshake: {
      headers: {},
    },
  };
}

function createMockNext() {
  return vi.fn();
}

function validSessionResponse(overrides: Record<string, any> = {}) {
  return {
    user: {
      id: '42',
      name: 'testplayer',
      username: 'testplayer',
      role: 'user',
      balance: '1000.50',
      isActive: true,
      ...overrides,
    },
    session: { token: 'abc-session-token' },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('socketAuth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Successful authentication
  // -----------------------------------------------------------------------
  describe('successful authentication', () => {
    it('should authenticate a socket with a valid session cookie', async () => {
      mockGetSession.mockResolvedValue(validSessionResponse());

      const socket = createMockSocket();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith(); // no error
    });

    it('should attach user object to the socket', async () => {
      mockGetSession.mockResolvedValue(validSessionResponse());

      const socket = createMockSocket();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(socket.user).toEqual({
        userId: 42,
        username: 'testplayer',
        role: 'user',
        balance: 1000.50,
        isActive: true,
      });
    });

    it('should convert user id to a Number', async () => {
      mockGetSession.mockResolvedValue(validSessionResponse({ id: '99' }));

      const socket = createMockSocket();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(socket.user.userId).toBe(99);
      expect(typeof socket.user.userId).toBe('number');
    });

    it('should parse balance as a float', async () => {
      mockGetSession.mockResolvedValue(validSessionResponse({ balance: '500.75' }));

      const socket = createMockSocket();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(socket.user.balance).toBe(500.75);
      expect(typeof socket.user.balance).toBe('number');
    });

    it('should default balance to 0 when balance is not provided', async () => {
      mockGetSession.mockResolvedValue(
        validSessionResponse({ balance: undefined }),
      );

      const socket = createMockSocket();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(socket.user.balance).toBe(0);
    });

    it('should use name when username is not available', async () => {
      mockGetSession.mockResolvedValue(
        validSessionResponse({ username: undefined, name: 'displayname' }),
      );

      // Manually set name on the mock since validSessionResponse spreads override
      // into user but the name field is on session.user directly.
      const session = validSessionResponse();
      session.user.username = undefined;
      session.user.name = 'displayname';
      mockGetSession.mockResolvedValue(session);

      const socket = createMockSocket();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(socket.user.username).toBe('displayname');
    });

    it('should default role to "user" when role is not set', async () => {
      const session = validSessionResponse();
      session.user.role = undefined;
      mockGetSession.mockResolvedValue(session);

      const socket = createMockSocket();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(socket.user.role).toBe('user');
    });

    it('should pass admin role through correctly', async () => {
      mockGetSession.mockResolvedValue(validSessionResponse({ role: 'admin' }));

      const socket = createMockSocket();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(socket.user.role).toBe('admin');
    });

    it('should pass the cookie header to auth.api.getSession', async () => {
      mockGetSession.mockResolvedValue(validSessionResponse());

      const cookie = 'better_auth.session_token=my-specific-token';
      const socket = createMockSocket({
        handshake: { headers: { cookie } },
      });
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(mockGetSession).toHaveBeenCalledOnce();
      const callArg = mockGetSession.mock.calls[0][0];
      expect(callArg.headers).toBeInstanceOf(Headers);
      expect(callArg.headers.get('cookie')).toBe(cookie);
    });
  });

  // -----------------------------------------------------------------------
  // Rejection: no cookies
  // -----------------------------------------------------------------------
  describe('rejection: no cookies', () => {
    it('should reject a socket with no cookies', async () => {
      const socket = createMockSocketNoCookies();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe(
        'Authentication error: No cookies provided',
      );
    });

    it('should not attach user to socket when cookies are missing', async () => {
      const socket = createMockSocketNoCookies();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(socket.user).toBeUndefined();
    });

    it('should reject when cookie header is undefined', async () => {
      const socket = {
        id: 'no-cookie-header',
        handshake: { headers: { cookie: undefined } },
      };
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toContain('No cookies provided');
    });
  });

  // -----------------------------------------------------------------------
  // Rejection: invalid session
  // -----------------------------------------------------------------------
  describe('rejection: invalid session', () => {
    it('should reject when getSession returns null', async () => {
      mockGetSession.mockResolvedValue(null);

      const socket = createMockSocket();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe(
        'Authentication error: Invalid session',
      );
    });

    it('should reject when session has no user', async () => {
      mockGetSession.mockResolvedValue({ user: null, session: {} });

      const socket = createMockSocket();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe(
        'Authentication error: Invalid session',
      );
    });

    it('should reject when session user is undefined', async () => {
      mockGetSession.mockResolvedValue({ user: undefined, session: {} });

      const socket = createMockSocket();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe(
        'Authentication error: Invalid session',
      );
    });
  });

  // -----------------------------------------------------------------------
  // Rejection: disabled account
  // -----------------------------------------------------------------------
  describe('rejection: disabled account', () => {
    it('should reject when user account is disabled (isActive: false)', async () => {
      mockGetSession.mockResolvedValue(
        validSessionResponse({ isActive: false }),
      );

      const socket = createMockSocket();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe(
        'Authentication error: Account inactive',
      );
    });

    it('should not attach user to socket when account is disabled', async () => {
      mockGetSession.mockResolvedValue(
        validSessionResponse({ isActive: false }),
      );

      const socket = createMockSocket();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(socket.user).toBeUndefined();
    });

    it('should allow users when isActive is true', async () => {
      mockGetSession.mockResolvedValue(
        validSessionResponse({ isActive: true }),
      );

      const socket = createMockSocket();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(next).toHaveBeenCalledWith(); // no error
      expect(socket.user).toBeDefined();
      expect(socket.user.isActive).toBe(true);
    });

    it('should allow users when isActive is undefined (not explicitly false)', async () => {
      // isActive check uses === false, so undefined passes through
      const session = validSessionResponse();
      delete session.user.isActive;
      mockGetSession.mockResolvedValue(session);

      const socket = createMockSocket();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(next).toHaveBeenCalledWith(); // no error
    });
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------
  describe('error handling', () => {
    it('should call next with generic error when getSession throws', async () => {
      mockGetSession.mockRejectedValue(new Error('Database connection failed'));

      const socket = createMockSocket();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Authentication error');
    });

    it('should log the error when getSession throws', async () => {
      mockGetSession.mockRejectedValue(new Error('DB timeout'));

      const socket = createMockSocket();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(mockLogSystemEvent).toHaveBeenCalledWith(
        'socket_auth_error',
        { error: expect.stringContaining('DB timeout') },
        'error',
      );
    });

    it('should not attach user when getSession throws', async () => {
      mockGetSession.mockRejectedValue(new Error('Unexpected error'));

      const socket = createMockSocket();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(socket.user).toBeUndefined();
    });

    it('should handle non-Error throws gracefully', async () => {
      mockGetSession.mockRejectedValue('string-error');

      const socket = createMockSocket();
      const next = createMockNext();

      await socketAuth(socket as any, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Authentication error');
      expect(mockLogSystemEvent).toHaveBeenCalledWith(
        'socket_auth_error',
        { error: 'string-error' },
        'error',
      );
    });
  });
});

// ---------------------------------------------------------------------------
// getAuthenticatedUser
// ---------------------------------------------------------------------------

describe('getAuthenticatedUser', () => {
  it('should return the user object when present on the socket', () => {
    const userObj = {
      userId: 1,
      username: 'testplayer',
      role: 'user',
      balance: 500,
      isActive: true,
    };
    const socket = { user: userObj } as any;

    const result = getAuthenticatedUser(socket);

    expect(result).toEqual(userObj);
  });

  it('should return null when no user is attached to the socket', () => {
    const socket = {} as any;

    const result = getAuthenticatedUser(socket);

    expect(result).toBeNull();
  });

  it('should return null when socket.user is undefined', () => {
    const socket = { user: undefined } as any;

    const result = getAuthenticatedUser(socket);

    expect(result).toBeNull();
  });

  it('should return null when socket.user is null', () => {
    const socket = { user: null } as any;

    const result = getAuthenticatedUser(socket);

    expect(result).toBeNull();
  });

  it('should return the full user shape from a successfully authenticated socket', async () => {
    mockGetSession.mockResolvedValue(
      validSessionResponse({
        id: '7',
        username: 'authenticated',
        role: 'admin',
        balance: '250.00',
        isActive: true,
      }),
    );

    const socket = createMockSocket();
    const next = createMockNext();

    await socketAuth(socket as any, next);

    const user = getAuthenticatedUser(socket as any);
    expect(user).toEqual({
      userId: 7,
      username: 'authenticated',
      role: 'admin',
      balance: 250,
      isActive: true,
    });
  });
});
