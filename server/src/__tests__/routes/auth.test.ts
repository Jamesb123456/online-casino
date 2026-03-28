// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockFindById, mockAuthenticateImpl } = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockAuthenticateImpl: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../middleware/auth.js', () => ({
  authenticate: (...args) => mockAuthenticateImpl(...args),
  adminOnly: vi.fn((req, res, next) => next()),
  userOrAdmin: vi.fn((req, res, next) => next()),
}));

vi.mock('../../../drizzle/models/User.js', () => ({
  default: {
    findById: mockFindById,
  },
}));

vi.mock('../../../src/services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import router under test
// ---------------------------------------------------------------------------

import router from '../../../routes/auth.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', router);
  return app;
}

const baseUser = {
  id: 1,
  username: 'testuser',
  role: 'user',
  balance: '1000.00',
  isActive: true,
  createdAt: new Date('2025-01-01'),
  lastLogin: new Date('2025-06-01'),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticate passes and injects user
    mockAuthenticateImpl.mockImplementation((req, res, next) => {
      req.user = { userId: 1, username: 'testuser', role: 'user' };
      next();
    });
  });

  // =========================================================================
  // GET /api/auth/refresh-session
  // =========================================================================
  describe('GET /refresh-session', () => {
    it('should return user data when session is valid', async () => {
      mockFindById.mockResolvedValue(baseUser);

      const res = await request(createApp()).get('/api/auth/refresh-session');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 1,
        username: 'testuser',
        role: 'user',
        balance: '1000.00',
        isActive: true,
      });
      expect(mockFindById).toHaveBeenCalledWith(1);
    });

    it('should return 401 when session is not valid (auth middleware rejects)', async () => {
      mockAuthenticateImpl.mockImplementation((req, res, next) => {
        res.status(401).json({ message: 'No valid session, authorization denied' });
      });

      const res = await request(createApp()).get('/api/auth/refresh-session');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: 'No valid session, authorization denied' });
    });

    it('should return 401 when userId is missing from request', async () => {
      mockAuthenticateImpl.mockImplementation((req, res, next) => {
        req.user = {}; // No userId
        next();
      });

      const res = await request(createApp()).get('/api/auth/refresh-session');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: 'Not authenticated' });
    });

    it('should return 404 when user is not found in database', async () => {
      mockFindById.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/auth/refresh-session');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'User not found' });
    });

    it('should return 500 when database throws', async () => {
      mockFindById.mockRejectedValue(new Error('Database connection failed'));

      const res = await request(createApp()).get('/api/auth/refresh-session');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'Session refresh failed' });
    });

    it('should return all expected fields in the response', async () => {
      mockFindById.mockResolvedValue(baseUser);

      const res = await request(createApp()).get('/api/auth/refresh-session');

      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(
        ['balance', 'id', 'isActive', 'role', 'username'].sort()
      );
    });

    it('should handle admin role', async () => {
      mockAuthenticateImpl.mockImplementation((req, res, next) => {
        req.user = { userId: 2, username: 'admin', role: 'admin' };
        next();
      });
      mockFindById.mockResolvedValue({
        ...baseUser,
        id: 2,
        username: 'admin',
        role: 'admin',
      });

      const res = await request(createApp()).get('/api/auth/refresh-session');

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('admin');
      expect(res.body.username).toBe('admin');
    });
  });
});
