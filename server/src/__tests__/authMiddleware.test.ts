// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks -- use vi.hoisted for variables referenced inside vi.mock factories
// ---------------------------------------------------------------------------

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock('../../lib/auth.js', () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock('better-auth/node', () => ({
  fromNodeHeaders: vi.fn((headers) => headers),
}));

vi.mock('../services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import module under test
// ---------------------------------------------------------------------------

import { authenticate, adminOnly, userOrAdmin } from '../../middleware/auth.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockRequest(overrides = {}) {
  return {
    headers: { authorization: 'Bearer test-token' },
    ...overrides,
  };
}

function mockResponse() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockNext() {
  return vi.fn();
}

// ---------------------------------------------------------------------------
// authenticate
// ---------------------------------------------------------------------------
describe('authenticate middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call next() and attach user to request when session is valid', async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: '1',
        name: 'testuser',
        username: 'testuser',
        role: 'user',
        isActive: true,
      },
      session: { token: 'abc' },
    });

    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    await authenticate(req as any, res as any, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toEqual({
      userId: 1,
      username: 'testuser',
      role: 'user',
    });
  });

  it('should set role to "user" when session user has no role', async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: '2',
        name: 'norole',
        username: 'norole',
        isActive: true,
      },
      session: { token: 'abc' },
    });

    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    await authenticate(req as any, res as any, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user.role).toBe('user');
  });

  it('should use name when username is not available', async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: '3',
        name: 'displayname',
        role: 'user',
        isActive: true,
      },
      session: { token: 'abc' },
    });

    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    await authenticate(req as any, res as any, next);

    expect(req.user.username).toBe('displayname');
  });

  it('should return 401 when there is no session', async () => {
    mockGetSession.mockResolvedValue(null);

    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    await authenticate(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'No valid session, authorization denied' });
  });

  it('should return 401 when session has no user', async () => {
    mockGetSession.mockResolvedValue({ user: null, session: {} });

    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    await authenticate(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 401 when user account is disabled (isActive === false)', async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: '4',
        name: 'disabled',
        username: 'disabled',
        role: 'user',
        isActive: false,
      },
      session: { token: 'abc' },
    });

    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    await authenticate(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Account is disabled' });
  });

  it('should return 401 when getSession throws an error', async () => {
    mockGetSession.mockRejectedValue(new Error('Database error'));

    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    await authenticate(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Session is not valid' });
  });

  it('should convert user id to Number', async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: '42',
        name: 'testuser',
        username: 'testuser',
        role: 'admin',
        isActive: true,
      },
      session: { token: 'abc' },
    });

    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    await authenticate(req as any, res as any, next);

    expect(req.user.userId).toBe(42);
    expect(typeof req.user.userId).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// adminOnly
// ---------------------------------------------------------------------------
describe('adminOnly middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call next() when user is an admin', () => {
    const req = { user: { userId: 1, username: 'admin', role: 'admin' } };
    const res = mockResponse();
    const next = mockNext();

    adminOnly(req as any, res as any, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 403 when user is not an admin', () => {
    const req = { user: { userId: 2, username: 'user', role: 'user' } };
    const res = mockResponse();
    const next = mockNext();

    adminOnly(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Access denied. Admin only.' });
  });

  it('should return 403 when user object is missing', () => {
    const req = {} as any;
    const res = mockResponse();
    const next = mockNext();

    adminOnly(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should return 403 when user has an undefined role', () => {
    const req = { user: { userId: 3, username: 'norole' } };
    const res = mockResponse();
    const next = mockNext();

    adminOnly(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ---------------------------------------------------------------------------
// userOrAdmin
// ---------------------------------------------------------------------------
describe('userOrAdmin middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call next() when user role is "user"', () => {
    const req = { user: { userId: 1, username: 'user', role: 'user' } };
    const res = mockResponse();
    const next = mockNext();

    userOrAdmin(req as any, res as any, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('should call next() when user role is "admin"', () => {
    const req = { user: { userId: 1, username: 'admin', role: 'admin' } };
    const res = mockResponse();
    const next = mockNext();

    userOrAdmin(req as any, res as any, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('should return 403 when user has no valid role', () => {
    const req = { user: { userId: 1, username: 'mystery', role: 'superuser' } };
    const res = mockResponse();
    const next = mockNext();

    userOrAdmin(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Access denied.' });
  });

  it('should return 403 when user object is missing', () => {
    const req = {} as any;
    const res = mockResponse();
    const next = mockNext();

    userOrAdmin(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
