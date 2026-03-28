import { z } from 'zod';

// ---------------------------------------------------------------------------
// Common schemas
// ---------------------------------------------------------------------------

/** Positive bet amount, capped at 10 000, rounded to 2 decimal places. */
export const betAmountSchema = z
  .number()
  .positive('Bet amount must be positive')
  .max(10000, 'Bet amount cannot exceed 10,000')
  .transform(v => Math.round(v * 100) / 100);

/** Accepts a string or number userId and normalises to string. */
export const userIdSchema = z
  .union([z.string(), z.number()])
  .transform(v => String(v));

// ---------------------------------------------------------------------------
// Crash game schemas
// ---------------------------------------------------------------------------

export const crashPlaceBetSchema = z.object({
  amount: betAmountSchema,
  autoCashoutAt: z.number().min(1.01).max(1000000).optional(),
});

export const crashCashoutSchema = z.object({
  betId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Roulette game schemas
//
// The roulette handler receives a single bet object per event
// (type / value / amount), NOT an array.
// ---------------------------------------------------------------------------

export const roulettePlaceBetSchema = z.object({
  type: z.string().min(1, 'Bet type is required'),
  value: z.union([z.string(), z.number()]).optional(),
  amount: betAmountSchema,
});

// ---------------------------------------------------------------------------
// Landmines game schemas
// ---------------------------------------------------------------------------

export const landminesStartSchema = z.object({
  betAmount: betAmountSchema,
  mines: z
    .number()
    .int('Mine count must be an integer')
    .min(1, 'Minimum 1 mine')
    .max(24, 'Maximum 24 mines'),
});

export const landminesPickSchema = z.object({
  row: z.number().int().min(0).max(4),
  col: z.number().int().min(0).max(4),
});

// ---------------------------------------------------------------------------
// Plinko game schemas
// ---------------------------------------------------------------------------

export const plinkoDropBallSchema = z.object({
  betAmount: betAmountSchema,
  risk: z.enum(['low', 'medium', 'high']).default('medium'),
  rows: z.number().int().min(8).max(16).default(16),
});

// ---------------------------------------------------------------------------
// Wheel game schemas
// ---------------------------------------------------------------------------

export const wheelPlaceBetSchema = z.object({
  betAmount: betAmountSchema,
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
});

// ---------------------------------------------------------------------------
// Blackjack game schemas
// ---------------------------------------------------------------------------

export const blackjackStartSchema = z.object({
  betAmount: betAmountSchema,
});

// ---------------------------------------------------------------------------
// Admin route schemas
// ---------------------------------------------------------------------------

export const adminCreateUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(30).trim(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  role: z.enum(['user', 'admin']).default('user'),
  isActive: z.boolean().optional(),
});

export const adminUpdateUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(30).trim().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100).optional(),
  role: z.enum(['user', 'admin']).optional(),
  isActive: z.boolean().optional(),
});

export const adminTransactionSchema = z.object({
  userId: userIdSchema,
  type: z.enum(['credit', 'debit']),
  amount: z
    .number()
    .positive('Amount must be positive')
    .max(1000000, 'Amount cannot exceed 1,000,000'),
  description: z.string().min(1, 'Description is required').max(500).trim(),
});

// ---------------------------------------------------------------------------
// History / pagination schemas
// ---------------------------------------------------------------------------

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(10),
});

// ---------------------------------------------------------------------------
// Helper: validate and return parsed data, or throw with a readable message
// ---------------------------------------------------------------------------

export function validateSocketData<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues as Array<{ path: Array<string | number>; message: string }>;
    const errors = issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Validation error: ${errors}`);
  }
  return result.data;
}
