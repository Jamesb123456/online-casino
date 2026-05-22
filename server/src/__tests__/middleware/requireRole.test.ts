// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Module mocks — requireRole pulls in the auth module which loads Better Auth.
// Stub the auth module so we never touch the real config.
vi.mock('../../../lib/auth.js', () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock('better-auth/node', () => ({
  fromNodeHeaders: vi.fn((h) => h),
}));
vi.mock('../../services/loggingService.js', () => ({
  default: { logSystemEvent: vi.fn() },
}));

import {
  requireRole,
  adminOnly,
  adminOrOperator,
  adminOrOperatorOrViewer,
} from '../../../middleware/auth.js';

function mockResponse() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('requireRole middleware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no user on request', () => {
    const mw = requireRole(['admin']);
    const req: any = {};
    const res = mockResponse();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Authentication required' });
  });

  it('returns 403 when role is not in the allowed list', () => {
    const mw = requireRole(['admin', 'operator']);
    const req: any = { user: { userId: 1, role: 'viewer' } };
    const res = mockResponse();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Forbidden' });
  });

  it('calls next() when role is in the allowed list', () => {
    const mw = requireRole(['admin', 'operator']);
    const req: any = { user: { userId: 1, role: 'operator' } };
    const res = mockResponse();
    const next = vi.fn();

    mw(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('adminOnly accepts admin and rejects operator/viewer/user', () => {
    const cases = [
      { role: 'admin', allowed: true },
      { role: 'operator', allowed: false },
      { role: 'viewer', allowed: false },
      { role: 'user', allowed: false },
    ];
    for (const { role, allowed } of cases) {
      const req: any = { user: { userId: 1, role } };
      const res = mockResponse();
      const next = vi.fn();
      adminOnly(req, res, next);
      if (allowed) {
        expect(next).toHaveBeenCalledOnce();
      } else {
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
      }
    }
  });

  it('adminOrOperator accepts admin and operator; rejects viewer and user', () => {
    const cases = [
      { role: 'admin', allowed: true },
      { role: 'operator', allowed: true },
      { role: 'viewer', allowed: false },
      { role: 'user', allowed: false },
    ];
    for (const { role, allowed } of cases) {
      const req: any = { user: { userId: 1, role } };
      const res = mockResponse();
      const next = vi.fn();
      adminOrOperator(req, res, next);
      if (allowed) {
        expect(next).toHaveBeenCalledOnce();
      } else {
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
      }
    }
  });

  it('adminOrOperatorOrViewer accepts admin/operator/viewer; rejects user', () => {
    const cases = [
      { role: 'admin', allowed: true },
      { role: 'operator', allowed: true },
      { role: 'viewer', allowed: true },
      { role: 'user', allowed: false },
    ];
    for (const { role, allowed } of cases) {
      const req: any = { user: { userId: 1, role } };
      const res = mockResponse();
      const next = vi.fn();
      adminOrOperatorOrViewer(req, res, next);
      if (allowed) {
        expect(next).toHaveBeenCalledOnce();
      } else {
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
      }
    }
  });
});
