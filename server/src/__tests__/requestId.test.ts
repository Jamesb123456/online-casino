// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestIdMiddleware } from '../../middleware/requestId.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockRequest(overrides: Record<string, any> = {}) {
  return {
    headers: {},
    ...overrides,
  };
}

function mockResponse() {
  const res: any = {};
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
}

function mockNext() {
  return vi.fn();
}

// ---------------------------------------------------------------------------
// UUID v4 format regex
// ---------------------------------------------------------------------------

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requestIdMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // UUID generation
  // -----------------------------------------------------------------------
  it('should generate a UUID when no x-request-id header is present', () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    requestIdMiddleware(req as any, res as any, next);

    expect(req.requestId).toBeDefined();
    expect(typeof req.requestId).toBe('string');
    expect(req.requestId).toMatch(UUID_V4_REGEX);
  });

  it('should reuse the x-request-id header value when provided', () => {
    const customId = 'my-custom-request-id-12345';
    const req = mockRequest({
      headers: { 'x-request-id': customId },
    });
    const res = mockResponse();
    const next = mockNext();

    requestIdMiddleware(req as any, res as any, next);

    expect(req.requestId).toBe(customId);
  });

  // -----------------------------------------------------------------------
  // req.requestId attachment
  // -----------------------------------------------------------------------
  it('should set requestId on the req object when generated', () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    requestIdMiddleware(req as any, res as any, next);

    expect(req).toHaveProperty('requestId');
    expect(typeof req.requestId).toBe('string');
    expect(req.requestId.length).toBeGreaterThan(0);
  });

  it('should set requestId on the req object when provided via header', () => {
    const req = mockRequest({
      headers: { 'x-request-id': 'header-provided-id' },
    });
    const res = mockResponse();
    const next = mockNext();

    requestIdMiddleware(req as any, res as any, next);

    expect(req.requestId).toBe('header-provided-id');
  });

  // -----------------------------------------------------------------------
  // Response header
  // -----------------------------------------------------------------------
  it('should set the x-request-id response header with a generated UUID', () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    requestIdMiddleware(req as any, res as any, next);

    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', req.requestId);
  });

  it('should set the x-request-id response header with the provided header value', () => {
    const customId = 'echo-this-id';
    const req = mockRequest({
      headers: { 'x-request-id': customId },
    });
    const res = mockResponse();
    const next = mockNext();

    requestIdMiddleware(req as any, res as any, next);

    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', customId);
  });

  it('should set request id on the response header that matches the req.requestId', () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    requestIdMiddleware(req as any, res as any, next);

    const headerCallArg = res.setHeader.mock.calls[0][1];
    expect(headerCallArg).toBe(req.requestId);
  });

  // -----------------------------------------------------------------------
  // next() invocation
  // -----------------------------------------------------------------------
  it('should call next() with no arguments', () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    requestIdMiddleware(req as any, res as any, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it('should call next() when x-request-id header is provided', () => {
    const req = mockRequest({
      headers: { 'x-request-id': 'provided-id' },
    });
    const res = mockResponse();
    const next = mockNext();

    requestIdMiddleware(req as any, res as any, next);

    expect(next).toHaveBeenCalledOnce();
  });

  // -----------------------------------------------------------------------
  // Uniqueness
  // -----------------------------------------------------------------------
  it('should generate unique IDs across multiple calls', () => {
    const ids = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();

      requestIdMiddleware(req as any, res as any, next);

      ids.add(req.requestId);
    }

    expect(ids.size).toBe(100);
  });

  // -----------------------------------------------------------------------
  // UUID format validation
  // -----------------------------------------------------------------------
  it('should generate IDs that are valid UUID v4 format', () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    requestIdMiddleware(req as any, res as any, next);

    // UUID v4 has specific patterns:
    // - 8-4-4-4-12 hex characters separated by dashes
    // - 13th character is always '4' (version)
    // - 17th character is 8, 9, a, or b (variant)
    expect(req.requestId).toMatch(UUID_V4_REGEX);
  });

  it('should not generate a UUID when a non-empty x-request-id header is provided', () => {
    const customId = 'not-a-uuid-but-valid';
    const req = mockRequest({
      headers: { 'x-request-id': customId },
    });
    const res = mockResponse();
    const next = mockNext();

    requestIdMiddleware(req as any, res as any, next);

    // The custom value should be used as-is, not replaced with a UUID
    expect(req.requestId).toBe(customId);
    expect(req.requestId).not.toMatch(UUID_V4_REGEX);
  });

  it('should generate a UUID when x-request-id header is an empty string', () => {
    const req = mockRequest({
      headers: { 'x-request-id': '' },
    });
    const res = mockResponse();
    const next = mockNext();

    requestIdMiddleware(req as any, res as any, next);

    // Empty string is falsy, so the || fallback to crypto.randomUUID() kicks in
    expect(req.requestId).toMatch(UUID_V4_REGEX);
  });
});
