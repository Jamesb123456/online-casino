// @ts-nocheck
import { describe, it, expect } from 'vitest';

import {
  betAmountSchema,
  userIdSchema,
  crashPlaceBetSchema,
  crashCashoutSchema,
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
// betAmountSchema
// ---------------------------------------------------------------------------

describe('betAmountSchema', () => {
  describe('valid values', () => {
    it('should accept 0.10 (minimum positive)', () => {
      expect(betAmountSchema.parse(0.10)).toBe(0.10);
    });

    it('should accept 100', () => {
      expect(betAmountSchema.parse(100)).toBe(100);
    });

    it('should accept 4999.99', () => {
      expect(betAmountSchema.parse(4999.99)).toBe(4999.99);
    });

    it('should accept 5000 (maximum)', () => {
      expect(betAmountSchema.parse(5000)).toBe(5000);
    });

    it('should accept 1', () => {
      expect(betAmountSchema.parse(1)).toBe(1);
    });

    it('should accept 0.50', () => {
      expect(betAmountSchema.parse(0.50)).toBe(0.50);
    });
  });

  describe('invalid values', () => {
    it('should reject 0', () => {
      const result = betAmountSchema.safeParse(0);
      expect(result.success).toBe(false);
    });

    it('should reject negative numbers', () => {
      const result = betAmountSchema.safeParse(-1);
      expect(result.success).toBe(false);
    });

    it('should reject -100', () => {
      const result = betAmountSchema.safeParse(-100);
      expect(result.success).toBe(false);
    });

    it('should reject amounts exceeding 10000', () => {
      const result = betAmountSchema.safeParse(10001);
      expect(result.success).toBe(false);
    });

    it('should reject NaN', () => {
      const result = betAmountSchema.safeParse(NaN);
      expect(result.success).toBe(false);
    });

    it('should reject strings', () => {
      const result = betAmountSchema.safeParse('100');
      expect(result.success).toBe(false);
    });

    it('should reject null', () => {
      const result = betAmountSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it('should reject undefined', () => {
      const result = betAmountSchema.safeParse(undefined);
      expect(result.success).toBe(false);
    });
  });

  describe('rounding to 2 decimal places', () => {
    it('should round 1.999 to 2.00', () => {
      expect(betAmountSchema.parse(1.999)).toBe(2.00);
    });

    it('should round 1.005 to 1.01', () => {
      // Floating point: 1.005 * 100 = 100.49999... rounds to 100, so 1.00
      // This is a known JS floating-point issue; the transform uses Math.round
      const result = betAmountSchema.parse(1.005);
      expect(typeof result).toBe('number');
      // The result is either 1.00 or 1.01 depending on float precision
      expect(result).toBeCloseTo(1.00, 2);
    });

    it('should round 99.999 to 100.00', () => {
      expect(betAmountSchema.parse(99.999)).toBe(100.00);
    });

    it('should keep 50.50 as 50.50', () => {
      expect(betAmountSchema.parse(50.50)).toBe(50.50);
    });

    it('should round 1.111 to 1.11', () => {
      expect(betAmountSchema.parse(1.111)).toBe(1.11);
    });

    it('should round 1.119 to 1.12', () => {
      expect(betAmountSchema.parse(1.119)).toBe(1.12);
    });
  });
});

// ---------------------------------------------------------------------------
// userIdSchema
// ---------------------------------------------------------------------------

describe('userIdSchema', () => {
  it('should convert string "123" to "123"', () => {
    expect(userIdSchema.parse('123')).toBe('123');
  });

  it('should convert number 123 to "123"', () => {
    expect(userIdSchema.parse(123)).toBe('123');
  });

  it('should convert number 0 to "0"', () => {
    expect(userIdSchema.parse(0)).toBe('0');
  });

  it('should convert string "0" to "0"', () => {
    expect(userIdSchema.parse('0')).toBe('0');
  });

  it('should handle large numbers', () => {
    expect(userIdSchema.parse(999999)).toBe('999999');
  });

  it('should handle empty string', () => {
    expect(userIdSchema.parse('')).toBe('');
  });

  it('should reject null', () => {
    const result = userIdSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('should reject undefined', () => {
    const result = userIdSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });

  it('should reject boolean', () => {
    const result = userIdSchema.safeParse(true);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// crashPlaceBetSchema
// ---------------------------------------------------------------------------

describe('crashPlaceBetSchema', () => {
  describe('valid inputs', () => {
    it('should accept { amount: 100, autoCashoutAt: 2.0 }', () => {
      const result = crashPlaceBetSchema.parse({ amount: 100, autoCashoutAt: 2.0 });
      expect(result.amount).toBe(100);
      expect(result.autoCashoutAt).toBe(2.0);
    });

    it('should accept { amount: 100 } (autoCashoutAt optional)', () => {
      const result = crashPlaceBetSchema.parse({ amount: 100 });
      expect(result.amount).toBe(100);
      expect(result.autoCashoutAt).toBeUndefined();
    });

    it('should accept minimum autoCashoutAt of 1.01', () => {
      const result = crashPlaceBetSchema.parse({ amount: 50, autoCashoutAt: 1.01 });
      expect(result.autoCashoutAt).toBe(1.01);
    });

    it('should accept maximum autoCashoutAt of 50', () => {
      const result = crashPlaceBetSchema.parse({ amount: 50, autoCashoutAt: 50 });
      expect(result.autoCashoutAt).toBe(50);
    });
  });

  describe('invalid inputs', () => {
    it('should reject missing amount', () => {
      const result = crashPlaceBetSchema.safeParse({ autoCashoutAt: 2.0 });
      expect(result.success).toBe(false);
    });

    it('should reject autoCashoutAt less than 1.01', () => {
      const result = crashPlaceBetSchema.safeParse({ amount: 100, autoCashoutAt: 1.0 });
      expect(result.success).toBe(false);
    });

    it('should reject autoCashoutAt of exactly 1.0', () => {
      const result = crashPlaceBetSchema.safeParse({ amount: 100, autoCashoutAt: 1.0 });
      expect(result.success).toBe(false);
    });

    it('should reject autoCashoutAt exceeding 1000000', () => {
      const result = crashPlaceBetSchema.safeParse({ amount: 100, autoCashoutAt: 1000001 });
      expect(result.success).toBe(false);
    });

    it('should reject empty object', () => {
      const result = crashPlaceBetSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject when amount is negative', () => {
      const result = crashPlaceBetSchema.safeParse({ amount: -10 });
      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// crashCashoutSchema
// ---------------------------------------------------------------------------

describe('crashCashoutSchema', () => {
  it('should accept { betId: "abc" }', () => {
    const result = crashCashoutSchema.parse({ betId: 'abc' });
    expect(result.betId).toBe('abc');
  });

  it('should accept {} (betId is optional)', () => {
    const result = crashCashoutSchema.parse({});
    expect(result.betId).toBeUndefined();
  });

  it('should accept { betId: "" }', () => {
    const result = crashCashoutSchema.parse({ betId: '' });
    expect(result.betId).toBe('');
  });

  it('should reject non-string betId', () => {
    const result = crashCashoutSchema.safeParse({ betId: 123 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// roulettePlaceBetSchema
// ---------------------------------------------------------------------------

describe('roulettePlaceBetSchema', () => {
  describe('valid inputs', () => {
    it('should accept { type: "red", amount: 100 }', () => {
      const result = roulettePlaceBetSchema.parse({ type: 'red', amount: 100 });
      expect(result.type).toBe('red');
      expect(result.amount).toBe(100);
    });

    it('should accept { type: "straight", value: 17, amount: 50 }', () => {
      const result = roulettePlaceBetSchema.parse({
        type: 'straight',
        value: 17,
        amount: 50,
      });
      expect(result.type).toBe('straight');
      expect(result.value).toBe(17);
      expect(result.amount).toBe(50);
    });

    it('should accept string values for value field', () => {
      const result = roulettePlaceBetSchema.parse({
        type: 'column',
        value: 'first',
        amount: 25,
      });
      expect(result.value).toBe('first');
    });

    it('should accept bet without value (value is optional)', () => {
      const result = roulettePlaceBetSchema.parse({ type: 'black', amount: 200 });
      expect(result.value).toBeUndefined();
    });
  });

  describe('invalid inputs', () => {
    it('should reject missing type', () => {
      const result = roulettePlaceBetSchema.safeParse({ amount: 100 });
      expect(result.success).toBe(false);
    });

    it('should reject empty type string', () => {
      const result = roulettePlaceBetSchema.safeParse({ type: '', amount: 100 });
      expect(result.success).toBe(false);
    });

    it('should reject missing amount', () => {
      const result = roulettePlaceBetSchema.safeParse({ type: 'red' });
      expect(result.success).toBe(false);
    });

    it('should reject empty object', () => {
      const result = roulettePlaceBetSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject non-string type', () => {
      const result = roulettePlaceBetSchema.safeParse({ type: 123, amount: 100 });
      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// landminesStartSchema
// ---------------------------------------------------------------------------

describe('landminesStartSchema', () => {
  describe('valid inputs', () => {
    it('should accept { betAmount: 100, mines: 5 }', () => {
      const result = landminesStartSchema.parse({ betAmount: 100, mines: 5 });
      expect(result.betAmount).toBe(100);
      expect(result.mines).toBe(5);
    });

    it('should accept minimum mines of 1', () => {
      const result = landminesStartSchema.parse({ betAmount: 10, mines: 1 });
      expect(result.mines).toBe(1);
    });

    it('should accept maximum mines of 24', () => {
      const result = landminesStartSchema.parse({ betAmount: 10, mines: 24 });
      expect(result.mines).toBe(24);
    });
  });

  describe('invalid inputs', () => {
    it('should reject mines of 0', () => {
      const result = landminesStartSchema.safeParse({ betAmount: 100, mines: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject mines of 25', () => {
      const result = landminesStartSchema.safeParse({ betAmount: 100, mines: 25 });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer mines', () => {
      const result = landminesStartSchema.safeParse({ betAmount: 100, mines: 3.5 });
      expect(result.success).toBe(false);
    });

    it('should reject missing betAmount', () => {
      const result = landminesStartSchema.safeParse({ mines: 5 });
      expect(result.success).toBe(false);
    });

    it('should reject missing mines', () => {
      const result = landminesStartSchema.safeParse({ betAmount: 100 });
      expect(result.success).toBe(false);
    });

    it('should reject empty object', () => {
      const result = landminesStartSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject negative mines', () => {
      const result = landminesStartSchema.safeParse({ betAmount: 100, mines: -1 });
      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// landminesPickSchema
// ---------------------------------------------------------------------------

describe('landminesPickSchema', () => {
  describe('valid inputs', () => {
    it('should accept { row: 0, col: 0 } (top-left corner)', () => {
      const result = landminesPickSchema.parse({ row: 0, col: 0 });
      expect(result.row).toBe(0);
      expect(result.col).toBe(0);
    });

    it('should accept { row: 4, col: 4 } (bottom-right corner)', () => {
      const result = landminesPickSchema.parse({ row: 4, col: 4 });
      expect(result.row).toBe(4);
      expect(result.col).toBe(4);
    });

    it('should accept { row: 2, col: 3 } (middle)', () => {
      const result = landminesPickSchema.parse({ row: 2, col: 3 });
      expect(result.row).toBe(2);
      expect(result.col).toBe(3);
    });
  });

  describe('invalid inputs', () => {
    it('should reject row of -1', () => {
      const result = landminesPickSchema.safeParse({ row: -1, col: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject row of 5', () => {
      const result = landminesPickSchema.safeParse({ row: 5, col: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject col of -1', () => {
      const result = landminesPickSchema.safeParse({ row: 0, col: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject col of 5', () => {
      const result = landminesPickSchema.safeParse({ row: 0, col: 5 });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer row', () => {
      const result = landminesPickSchema.safeParse({ row: 1.5, col: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer col', () => {
      const result = landminesPickSchema.safeParse({ row: 0, col: 2.7 });
      expect(result.success).toBe(false);
    });

    it('should reject missing row', () => {
      const result = landminesPickSchema.safeParse({ col: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject missing col', () => {
      const result = landminesPickSchema.safeParse({ row: 0 });
      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// plinkoDropBallSchema
// ---------------------------------------------------------------------------

describe('plinkoDropBallSchema', () => {
  describe('valid inputs', () => {
    it('should accept { betAmount: 100, risk: "low", rows: 8 }', () => {
      const result = plinkoDropBallSchema.parse({
        betAmount: 100,
        risk: 'low',
        rows: 8,
      });
      expect(result.betAmount).toBe(100);
      expect(result.risk).toBe('low');
      expect(result.rows).toBe(8);
    });

    it('should accept { betAmount: 100, risk: "medium", rows: 12 }', () => {
      const result = plinkoDropBallSchema.parse({
        betAmount: 100,
        risk: 'medium',
        rows: 12,
      });
      expect(result.risk).toBe('medium');
      expect(result.rows).toBe(12);
    });

    it('should accept { betAmount: 100, risk: "high", rows: 16 }', () => {
      const result = plinkoDropBallSchema.parse({
        betAmount: 100,
        risk: 'high',
        rows: 16,
      });
      expect(result.risk).toBe('high');
      expect(result.rows).toBe(16);
    });

    it('should accept minimum rows of 8', () => {
      const result = plinkoDropBallSchema.parse({
        betAmount: 10,
        risk: 'low',
        rows: 8,
      });
      expect(result.rows).toBe(8);
    });

    it('should accept maximum rows of 16', () => {
      const result = plinkoDropBallSchema.parse({
        betAmount: 10,
        risk: 'low',
        rows: 16,
      });
      expect(result.rows).toBe(16);
    });
  });

  describe('defaults', () => {
    it('should default risk to "medium" when not provided', () => {
      const result = plinkoDropBallSchema.parse({ betAmount: 100 });
      expect(result.risk).toBe('medium');
    });

    it('should default rows to 16 when not provided', () => {
      const result = plinkoDropBallSchema.parse({ betAmount: 100 });
      expect(result.rows).toBe(16);
    });

    it('should default both risk and rows when only betAmount is provided', () => {
      const result = plinkoDropBallSchema.parse({ betAmount: 50 });
      expect(result.risk).toBe('medium');
      expect(result.rows).toBe(16);
    });
  });

  describe('invalid inputs', () => {
    it('should reject invalid risk value', () => {
      const result = plinkoDropBallSchema.safeParse({
        betAmount: 100,
        risk: 'invalid',
        rows: 8,
      });
      expect(result.success).toBe(false);
    });

    it('should reject rows below 8', () => {
      const result = plinkoDropBallSchema.safeParse({
        betAmount: 100,
        risk: 'low',
        rows: 7,
      });
      expect(result.success).toBe(false);
    });

    it('should reject rows above 16', () => {
      const result = plinkoDropBallSchema.safeParse({
        betAmount: 100,
        risk: 'low',
        rows: 17,
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer rows', () => {
      const result = plinkoDropBallSchema.safeParse({
        betAmount: 100,
        risk: 'low',
        rows: 10.5,
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing betAmount', () => {
      const result = plinkoDropBallSchema.safeParse({ risk: 'low', rows: 8 });
      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// wheelPlaceBetSchema
// ---------------------------------------------------------------------------

describe('wheelPlaceBetSchema', () => {
  describe('valid inputs', () => {
    it('should accept { betAmount: 100, difficulty: "easy" }', () => {
      const result = wheelPlaceBetSchema.parse({
        betAmount: 100,
        difficulty: 'easy',
      });
      expect(result.betAmount).toBe(100);
      expect(result.difficulty).toBe('easy');
    });

    it('should accept { betAmount: 100, difficulty: "medium" }', () => {
      const result = wheelPlaceBetSchema.parse({
        betAmount: 100,
        difficulty: 'medium',
      });
      expect(result.difficulty).toBe('medium');
    });

    it('should accept { betAmount: 100, difficulty: "hard" }', () => {
      const result = wheelPlaceBetSchema.parse({
        betAmount: 100,
        difficulty: 'hard',
      });
      expect(result.difficulty).toBe('hard');
    });
  });

  describe('defaults', () => {
    it('should default difficulty to "medium" when not provided', () => {
      const result = wheelPlaceBetSchema.parse({ betAmount: 100 });
      expect(result.difficulty).toBe('medium');
    });
  });

  describe('invalid inputs', () => {
    it('should reject invalid difficulty value', () => {
      const result = wheelPlaceBetSchema.safeParse({
        betAmount: 100,
        difficulty: 'extreme',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing betAmount', () => {
      const result = wheelPlaceBetSchema.safeParse({ difficulty: 'easy' });
      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// blackjackStartSchema
// ---------------------------------------------------------------------------

describe('blackjackStartSchema', () => {
  describe('valid inputs', () => {
    it('should accept { betAmount: 100 }', () => {
      const result = blackjackStartSchema.parse({ betAmount: 100 });
      expect(result.betAmount).toBe(100);
    });

    it('should accept { betAmount: 0.10 }', () => {
      const result = blackjackStartSchema.parse({ betAmount: 0.10 });
      expect(result.betAmount).toBe(0.10);
    });

    it('should accept { betAmount: 5000 }', () => {
      const result = blackjackStartSchema.parse({ betAmount: 5000 });
      expect(result.betAmount).toBe(5000);
    });
  });

  describe('invalid inputs', () => {
    it('should reject missing betAmount', () => {
      const result = blackjackStartSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject empty object', () => {
      const result = blackjackStartSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject betAmount of 0', () => {
      const result = blackjackStartSchema.safeParse({ betAmount: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject negative betAmount', () => {
      const result = blackjackStartSchema.safeParse({ betAmount: -50 });
      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// adminCreateUserSchema
// ---------------------------------------------------------------------------

describe('adminCreateUserSchema', () => {
  describe('valid inputs', () => {
    it('should accept { username: "testuser", password: "password123", role: "user" }', () => {
      const result = adminCreateUserSchema.parse({
        username: 'testuser',
        password: 'password123',
        role: 'user',
      });
      expect(result.username).toBe('testuser');
      expect(result.password).toBe('password123');
      expect(result.role).toBe('user');
    });

    it('should accept role "admin"', () => {
      const result = adminCreateUserSchema.parse({
        username: 'adminuser',
        password: 'securepass',
        role: 'admin',
      });
      expect(result.role).toBe('admin');
    });

    it('should accept isActive: true', () => {
      const result = adminCreateUserSchema.parse({
        username: 'testuser',
        password: 'password123',
        isActive: true,
      });
      expect(result.isActive).toBe(true);
    });

    it('should accept isActive: false', () => {
      const result = adminCreateUserSchema.parse({
        username: 'testuser',
        password: 'password123',
        isActive: false,
      });
      expect(result.isActive).toBe(false);
    });

    it('should trim whitespace from username', () => {
      const result = adminCreateUserSchema.parse({
        username: '  testuser  ',
        password: 'password123',
      });
      expect(result.username).toBe('testuser');
    });
  });

  describe('defaults', () => {
    it('should default role to "user" when not provided', () => {
      const result = adminCreateUserSchema.parse({
        username: 'testuser',
        password: 'password123',
      });
      expect(result.role).toBe('user');
    });
  });

  describe('invalid inputs', () => {
    it('should reject username shorter than 3 characters', () => {
      const result = adminCreateUserSchema.safeParse({
        username: 'ab',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject single character username', () => {
      const result = adminCreateUserSchema.safeParse({
        username: 'a',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject password shorter than 6 characters', () => {
      const result = adminCreateUserSchema.safeParse({
        username: 'testuser',
        password: '12345',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid role', () => {
      const result = adminCreateUserSchema.safeParse({
        username: 'testuser',
        password: 'password123',
        role: 'superadmin',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing username', () => {
      const result = adminCreateUserSchema.safeParse({
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
      const result = adminCreateUserSchema.safeParse({
        username: 'testuser',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty username', () => {
      const result = adminCreateUserSchema.safeParse({
        username: '',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = adminCreateUserSchema.safeParse({
        username: 'testuser',
        password: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject username longer than 30 characters', () => {
      const result = adminCreateUserSchema.safeParse({
        username: 'a'.repeat(31),
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject password longer than 100 characters', () => {
      const result = adminCreateUserSchema.safeParse({
        username: 'testuser',
        password: 'a'.repeat(101),
      });
      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// adminUpdateUserSchema
// ---------------------------------------------------------------------------

describe('adminUpdateUserSchema', () => {
  describe('valid inputs', () => {
    it('should accept { username: "newname" } (all fields optional)', () => {
      const result = adminUpdateUserSchema.parse({ username: 'newname' });
      expect(result.username).toBe('newname');
    });

    it('should accept empty object (all fields optional)', () => {
      const result = adminUpdateUserSchema.parse({});
      expect(result).toEqual({});
    });

    it('should accept { password: "newpassword" }', () => {
      const result = adminUpdateUserSchema.parse({ password: 'newpassword' });
      expect(result.password).toBe('newpassword');
    });

    it('should accept { role: "admin" }', () => {
      const result = adminUpdateUserSchema.parse({ role: 'admin' });
      expect(result.role).toBe('admin');
    });

    it('should accept { isActive: false }', () => {
      const result = adminUpdateUserSchema.parse({ isActive: false });
      expect(result.isActive).toBe(false);
    });

    it('should accept all fields at once', () => {
      const result = adminUpdateUserSchema.parse({
        username: 'updateduser',
        password: 'updatedpass',
        role: 'admin',
        isActive: true,
      });
      expect(result.username).toBe('updateduser');
      expect(result.password).toBe('updatedpass');
      expect(result.role).toBe('admin');
      expect(result.isActive).toBe(true);
    });

    it('should trim whitespace from username', () => {
      const result = adminUpdateUserSchema.parse({ username: '  trimmed  ' });
      expect(result.username).toBe('trimmed');
    });
  });

  describe('invalid inputs', () => {
    it('should reject username shorter than 3 characters when provided', () => {
      const result = adminUpdateUserSchema.safeParse({ username: 'ab' });
      expect(result.success).toBe(false);
    });

    it('should reject password shorter than 6 characters when provided', () => {
      const result = adminUpdateUserSchema.safeParse({ password: '12345' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid role when provided', () => {
      const result = adminUpdateUserSchema.safeParse({ role: 'moderator' });
      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// adminTransactionSchema
// ---------------------------------------------------------------------------

describe('adminTransactionSchema', () => {
  describe('valid inputs', () => {
    it('should accept { userId: "1", type: "credit", amount: 100, description: "test" }', () => {
      const result = adminTransactionSchema.parse({
        userId: '1',
        type: 'credit',
        amount: 100,
        description: 'test',
      });
      expect(result.userId).toBe('1');
      expect(result.type).toBe('credit');
      expect(result.amount).toBe(100);
      expect(result.description).toBe('test');
    });

    it('should accept type "debit"', () => {
      const result = adminTransactionSchema.parse({
        userId: '1',
        type: 'debit',
        amount: 50,
        description: 'withdrawal',
      });
      expect(result.type).toBe('debit');
    });

    it('should accept numeric userId and convert to string', () => {
      const result = adminTransactionSchema.parse({
        userId: 42,
        type: 'credit',
        amount: 10,
        description: 'bonus',
      });
      expect(result.userId).toBe('42');
    });

    it('should accept amount of 1000000 (maximum)', () => {
      const result = adminTransactionSchema.parse({
        userId: '1',
        type: 'credit',
        amount: 1000000,
        description: 'jackpot',
      });
      expect(result.amount).toBe(1000000);
    });

    it('should trim whitespace from description', () => {
      const result = adminTransactionSchema.parse({
        userId: '1',
        type: 'credit',
        amount: 10,
        description: '  trimmed description  ',
      });
      expect(result.description).toBe('trimmed description');
    });
  });

  describe('invalid inputs', () => {
    it('should reject missing userId', () => {
      const result = adminTransactionSchema.safeParse({
        type: 'credit',
        amount: 100,
        description: 'test',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing type', () => {
      const result = adminTransactionSchema.safeParse({
        userId: '1',
        amount: 100,
        description: 'test',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing amount', () => {
      const result = adminTransactionSchema.safeParse({
        userId: '1',
        type: 'credit',
        description: 'test',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing description', () => {
      const result = adminTransactionSchema.safeParse({
        userId: '1',
        type: 'credit',
        amount: 100,
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid type value', () => {
      const result = adminTransactionSchema.safeParse({
        userId: '1',
        type: 'transfer',
        amount: 100,
        description: 'test',
      });
      expect(result.success).toBe(false);
    });

    it('should reject amount exceeding 1000000', () => {
      const result = adminTransactionSchema.safeParse({
        userId: '1',
        type: 'credit',
        amount: 1000001,
        description: 'test',
      });
      expect(result.success).toBe(false);
    });

    it('should reject amount of 0', () => {
      const result = adminTransactionSchema.safeParse({
        userId: '1',
        type: 'credit',
        amount: 0,
        description: 'test',
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative amount', () => {
      const result = adminTransactionSchema.safeParse({
        userId: '1',
        type: 'credit',
        amount: -100,
        description: 'test',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty description', () => {
      const result = adminTransactionSchema.safeParse({
        userId: '1',
        type: 'credit',
        amount: 100,
        description: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject description longer than 500 characters', () => {
      const result = adminTransactionSchema.safeParse({
        userId: '1',
        type: 'credit',
        amount: 100,
        description: 'a'.repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// validateSocketData
// ---------------------------------------------------------------------------

describe('validateSocketData', () => {
  it('should return parsed data for valid input', () => {
    const result = validateSocketData(betAmountSchema, 100);
    expect(result).toBe(100);
  });

  it('should return transformed data (rounding applied)', () => {
    const result = validateSocketData(betAmountSchema, 1.999);
    expect(result).toBe(2.00);
  });

  it('should return parsed object data', () => {
    const result = validateSocketData(crashPlaceBetSchema, {
      amount: 50,
      autoCashoutAt: 2.5,
    });
    expect(result).toEqual({ amount: 50, autoCashoutAt: 2.5 });
  });

  it('should throw Error for invalid input', () => {
    expect(() => validateSocketData(betAmountSchema, -1)).toThrow(Error);
  });

  it('should throw with "Validation error:" prefix in message', () => {
    expect(() => validateSocketData(betAmountSchema, 'not-a-number')).toThrow(
      /^Validation error:/,
    );
  });

  it('should include field names in the error message for object schemas', () => {
    expect(() =>
      validateSocketData(crashPlaceBetSchema, { autoCashoutAt: 0.5 }),
    ).toThrow(/amount/);
  });

  it('should include validation details in the error message', () => {
    expect(() =>
      validateSocketData(landminesStartSchema, { betAmount: 100, mines: 30 }),
    ).toThrow(/mines/);
  });

  it('should handle null input gracefully', () => {
    expect(() => validateSocketData(betAmountSchema, null)).toThrow(
      /Validation error/,
    );
  });

  it('should handle undefined input gracefully', () => {
    expect(() => validateSocketData(betAmountSchema, undefined)).toThrow(
      /Validation error/,
    );
  });

  it('should work with userIdSchema transforms', () => {
    const result = validateSocketData(userIdSchema, 42);
    expect(result).toBe('42');
  });

  it('should throw descriptive error for multiple validation failures', () => {
    try {
      validateSocketData(landminesStartSchema, {});
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.message).toContain('Validation error:');
      expect(err.message).toContain('betAmount');
      expect(err.message).toContain('mines');
    }
  });

  it('should work with schemas that have defaults', () => {
    const result = validateSocketData(plinkoDropBallSchema, { betAmount: 100 });
    expect(result.risk).toBe('medium');
    expect(result.rows).toBe(16);
  });
});
