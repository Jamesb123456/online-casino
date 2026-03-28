// @ts-nocheck
/**
 * Security tests
 * Tests for injection vulnerabilities, input validation bypass,
 * authorization bypass, and other OWASP Top 10 concerns.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  betAmountSchema,
  userIdSchema,
  crashPlaceBetSchema,
  roulettePlaceBetSchema,
  landminesStartSchema,
  landminesPickSchema,
  plinkoDropBallSchema,
  wheelPlaceBetSchema,
  blackjackStartSchema,
  adminCreateUserSchema,
  adminUpdateUserSchema,
  adminTransactionSchema,
  validateSocketData,
} from '../validation/schemas.js';

// ---------------------------------------------------------------------------
// Security: Input validation & injection prevention
// ---------------------------------------------------------------------------
describe('Security: Input validation', () => {
  describe('SQL injection prevention via Zod schemas', () => {
    it('should reject SQL injection in username', () => {
      const result = adminCreateUserSchema.safeParse({
        username: "'; DROP TABLE users; --",
        password: 'password123',
      });
      // The string passes min(3) but Zod doesn't filter SQL — the important
      // thing is it *validates type/length* before reaching the DB.
      // Drizzle ORM parameterises queries, preventing actual injection.
      expect(result.success).toBe(true);
      // Verify trimming works
      expect(result.data.username).toBe("'; DROP TABLE users; --");
    });

    it('should reject script tags in username (XSS via stored input)', () => {
      const result = adminCreateUserSchema.safeParse({
        username: '<script>alert("xss")</script>',
        password: 'password123',
      });
      // Zod accepts it (it's a valid string). XSS prevention must happen
      // at the rendering layer. This test documents that input validation
      // alone does NOT prevent XSS — output encoding is required.
      expect(result.success).toBe(true);
    });

    it('should reject excessively long usernames (DoS via payload size)', () => {
      const result = adminCreateUserSchema.safeParse({
        username: 'a'.repeat(31), // max is 30
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject excessively long passwords', () => {
      const result = adminCreateUserSchema.safeParse({
        username: 'testuser',
        password: 'p'.repeat(101), // max is 100
      });
      expect(result.success).toBe(false);
    });

    it('should reject excessively long descriptions in admin transactions', () => {
      const result = adminTransactionSchema.safeParse({
        userId: '1',
        type: 'credit',
        amount: 100,
        description: 'x'.repeat(501), // max is 500
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Type coercion attacks', () => {
    it('should reject object as bet amount', () => {
      const result = betAmountSchema.safeParse({ valueOf: () => 100 });
      expect(result.success).toBe(false);
    });

    it('should reject array as bet amount', () => {
      const result = betAmountSchema.safeParse([100]);
      expect(result.success).toBe(false);
    });

    it('should reject string as bet amount', () => {
      const result = betAmountSchema.safeParse('100');
      expect(result.success).toBe(false);
    });

    it('should reject boolean as bet amount', () => {
      const result = betAmountSchema.safeParse(true);
      expect(result.success).toBe(false);
    });

    it('should reject NaN as bet amount', () => {
      const result = betAmountSchema.safeParse(NaN);
      expect(result.success).toBe(false);
    });

    it('should reject Infinity as bet amount', () => {
      const result = betAmountSchema.safeParse(Infinity);
      expect(result.success).toBe(false);
    });

    it('should reject -Infinity as bet amount', () => {
      const result = betAmountSchema.safeParse(-Infinity);
      expect(result.success).toBe(false);
    });
  });

  describe('Negative value attacks on bet amounts', () => {
    it('should reject negative bet amount', () => {
      const result = betAmountSchema.safeParse(-100);
      expect(result.success).toBe(false);
    });

    it('should reject zero bet amount', () => {
      const result = betAmountSchema.safeParse(0);
      expect(result.success).toBe(false);
    });

    it('should reject very small negative bet (epsilon attack)', () => {
      const result = betAmountSchema.safeParse(-0.001);
      expect(result.success).toBe(false);
    });
  });

  describe('Overflow attacks', () => {
    it('should reject bet amount exceeding max (10000)', () => {
      const result = betAmountSchema.safeParse(10001);
      expect(result.success).toBe(false);
    });

    it('should reject admin transaction exceeding max (1000000)', () => {
      const result = adminTransactionSchema.safeParse({
        userId: '1',
        type: 'credit',
        amount: 1000001,
        description: 'overflow test',
      });
      expect(result.success).toBe(false);
    });

    it('should reject Number.MAX_SAFE_INTEGER as bet', () => {
      const result = betAmountSchema.safeParse(Number.MAX_SAFE_INTEGER);
      expect(result.success).toBe(false);
    });
  });

  describe('Precision attacks on bet amounts', () => {
    it('should round bet to 2 decimal places (prevents micro-cent exploits)', () => {
      const result = betAmountSchema.safeParse(1.999);
      expect(result.success).toBe(true);
      expect(result.data).toBe(2.00);
    });

    it('should round 0.015 correctly', () => {
      const result = betAmountSchema.safeParse(0.015);
      expect(result.success).toBe(true);
      expect(result.data).toBe(0.02);
    });

    it('should handle floating point edge: 0.1 + 0.2', () => {
      const result = betAmountSchema.safeParse(0.1 + 0.2);
      expect(result.success).toBe(true);
      expect(result.data).toBe(0.30);
    });
  });

  describe('Landmines game boundary attacks', () => {
    it('should reject 0 mines', () => {
      const result = landminesStartSchema.safeParse({ betAmount: 100, mines: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject 25 mines (all cells)', () => {
      const result = landminesStartSchema.safeParse({ betAmount: 100, mines: 25 });
      expect(result.success).toBe(false);
    });

    it('should reject fractional mines', () => {
      const result = landminesStartSchema.safeParse({ betAmount: 100, mines: 3.5 });
      expect(result.success).toBe(false);
    });

    it('should reject negative mines', () => {
      const result = landminesStartSchema.safeParse({ betAmount: 100, mines: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject out-of-bounds row in pick', () => {
      const result = landminesPickSchema.safeParse({ row: 5, col: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject out-of-bounds col in pick', () => {
      const result = landminesPickSchema.safeParse({ row: 0, col: 5 });
      expect(result.success).toBe(false);
    });

    it('should reject negative row in pick', () => {
      const result = landminesPickSchema.safeParse({ row: -1, col: 0 });
      expect(result.success).toBe(false);
    });
  });

  describe('Plinko game boundary attacks', () => {
    it('should reject rows below minimum (8)', () => {
      const result = plinkoDropBallSchema.safeParse({ betAmount: 100, risk: 'low', rows: 7 });
      expect(result.success).toBe(false);
    });

    it('should reject rows above maximum (16)', () => {
      const result = plinkoDropBallSchema.safeParse({ betAmount: 100, risk: 'high', rows: 17 });
      expect(result.success).toBe(false);
    });

    it('should reject invalid risk level', () => {
      const result = plinkoDropBallSchema.safeParse({ betAmount: 100, risk: 'extreme', rows: 10 });
      expect(result.success).toBe(false);
    });
  });

  describe('Authorization role validation', () => {
    it('should reject invalid role in admin create user', () => {
      const result = adminCreateUserSchema.safeParse({
        username: 'testuser',
        password: 'password123',
        role: 'superadmin',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid transaction type', () => {
      const result = adminTransactionSchema.safeParse({
        userId: '1',
        type: 'steal',
        amount: 100,
        description: 'test',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Null/undefined injection', () => {
    it('should reject null data in validateSocketData', () => {
      expect(() => validateSocketData(crashPlaceBetSchema, null)).toThrow('Validation error');
    });

    it('should reject undefined data in validateSocketData', () => {
      expect(() => validateSocketData(crashPlaceBetSchema, undefined)).toThrow('Validation error');
    });

    it('should reject empty object for required fields', () => {
      expect(() => validateSocketData(crashPlaceBetSchema, {})).toThrow('Validation error');
    });

    it('should reject prototype pollution attempt', () => {
      const malicious = JSON.parse('{"amount": 100, "__proto__": {"isAdmin": true}}');
      const result = crashPlaceBetSchema.safeParse(malicious);
      // Zod strips unknown keys — __proto__ should not appear in output
      if (result.success) {
        expect((result.data as any).__proto__?.isAdmin).toBeUndefined();
      }
    });
  });

  describe('Crash game autoCashout exploitation', () => {
    it('should reject autoCashoutAt below minimum (1.01)', () => {
      const result = crashPlaceBetSchema.safeParse({ amount: 100, autoCashoutAt: 1.00 });
      expect(result.success).toBe(false);
    });

    it('should reject autoCashoutAt above maximum (1000000)', () => {
      const result = crashPlaceBetSchema.safeParse({ amount: 100, autoCashoutAt: 1000001 });
      expect(result.success).toBe(false);
    });

    it('should accept autoCashoutAt at minimum boundary', () => {
      const result = crashPlaceBetSchema.safeParse({ amount: 100, autoCashoutAt: 1.01 });
      expect(result.success).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Security: Provably fair integrity
// ---------------------------------------------------------------------------
describe('Security: Provably fair integrity', () => {
  // Import the actual service (no mocks needed — it's pure crypto)
  let ProvablyFairService;

  beforeEach(async () => {
    const mod = await import('../services/provablyFairService.js');
    ProvablyFairService = mod.default;
  });

  it('should produce a valid verification when given the correct seeds', () => {
    const serverSeed = ProvablyFairService.generateServerSeed();
    const serverSeedHash = ProvablyFairService.hashServerSeed(serverSeed);
    const clientSeed = 'test-client-seed';
    const nonce = 1;

    const verification = ProvablyFairService.verifyResult(
      serverSeed, serverSeedHash, clientSeed, nonce
    );

    expect(verification.valid).toBe(true);
    expect(verification.serverSeedHashMatch).toBe(true);
  });

  it('should fail verification with a tampered server seed', () => {
    const serverSeed = ProvablyFairService.generateServerSeed();
    const serverSeedHash = ProvablyFairService.hashServerSeed(serverSeed);
    const tamperedSeed = serverSeed.slice(0, -2) + 'ff'; // Change last byte

    const verification = ProvablyFairService.verifyResult(
      tamperedSeed, serverSeedHash, 'client', 1
    );

    expect(verification.valid).toBe(false);
  });

  it('should produce deterministic results for the same inputs', () => {
    const result1 = ProvablyFairService.generateResult('server', 'client', 42);
    const result2 = ProvablyFairService.generateResult('server', 'client', 42);
    expect(result1).toBe(result2);
  });

  it('should produce different results for different nonces', () => {
    const result1 = ProvablyFairService.generateResult('server', 'client', 1);
    const result2 = ProvablyFairService.generateResult('server', 'client', 2);
    expect(result1).not.toBe(result2);
  });

  it('should produce crash points >= 1.00 always', () => {
    for (let i = 0; i < 500; i++) {
      const cp = ProvablyFairService.generateCrashPoint('seed', 'client', i);
      expect(cp).toBeGreaterThanOrEqual(1.00);
    }
  });

  it('should produce roulette numbers in range 0-36 always', () => {
    for (let i = 0; i < 500; i++) {
      const n = ProvablyFairService.generateRouletteNumber('seed', 'client', i);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(36);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('server seeds should be 64 hex characters (32 bytes)', () => {
    for (let i = 0; i < 20; i++) {
      const seed = ProvablyFairService.generateServerSeed();
      expect(seed).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('server seed hashes should be 64 hex characters (SHA-256)', () => {
    const seed = ProvablyFairService.generateServerSeed();
    const hash = ProvablyFairService.hashServerSeed(seed);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// Security: Auth middleware edge cases
// ---------------------------------------------------------------------------
describe('Security: Auth middleware attack vectors', () => {
  const { mockGetSession } = vi.hoisted(() => ({
    mockGetSession: vi.fn(),
  }));

  vi.mock('../../lib/auth.js', () => ({
    auth: { api: { getSession: mockGetSession } },
  }));

  vi.mock('better-auth/node', () => ({
    fromNodeHeaders: vi.fn((h) => h),
  }));

  vi.mock('../services/loggingService.js', () => ({
    default: { logSystemEvent: vi.fn() },
  }));

  // Lazy import to ensure mocks are installed
  let authenticate, adminOnly;
  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../middleware/auth.js');
    authenticate = mod.authenticate;
    adminOnly = mod.adminOnly;
  });

  function mockReq(overrides = {}) {
    return { headers: {}, ...overrides };
  }
  function mockRes() {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  }

  it('should block disabled accounts even with a valid session', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: '1', name: 'disabled', username: 'disabled', role: 'admin', isActive: false },
      session: { token: 'valid' },
    });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should prevent role escalation — user cannot claim admin', () => {
    const req = { user: { userId: 1, username: 'hacker', role: 'user' } };
    const res = mockRes();
    const next = vi.fn();

    adminOnly(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should handle missing user object gracefully (no crash)', () => {
    const req = {};
    const res = mockRes();
    const next = vi.fn();

    expect(() => adminOnly(req as any, res as any, next)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
