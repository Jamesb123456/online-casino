/**
 * Roulette payout table + bet evaluator.
 *
 * Math copied verbatim from the legacy `socket/rouletteHandler.ts` to keep the
 * external contract (winning numbers per type, payout multipliers, win amount
 * formula) byte-for-byte identical for parity tests.
 *
 *   winAmount = betAmount * (payout + 1)   // includes returning the stake
 *   profit    = isWinner ? winAmount - betAmount : -betAmount
 */
import { ROULETTE_NUMBERS } from './wheel.js';

export type RouletteBetType =
  | 'STRAIGHT'
  | 'SPLIT'
  | 'STREET'
  | 'CORNER'
  | 'FIVE'
  | 'LINE'
  | 'COLUMN'
  | 'DOZEN'
  | 'RED'
  | 'BLACK'
  | 'ODD'
  | 'EVEN'
  | 'LOW'
  | 'HIGH';

export interface BetTypeMeta {
  name: string;
  payout: number;
}

/** Default European single-zero payout multipliers. */
export const BET_TYPES: Record<RouletteBetType, BetTypeMeta> = {
  STRAIGHT: { name: 'Straight Up', payout: 35 },
  SPLIT:    { name: 'Split',       payout: 17 },
  STREET:   { name: 'Street',      payout: 11 },
  CORNER:   { name: 'Corner',      payout: 8 },
  FIVE:     { name: 'Five',        payout: 6 },
  LINE:     { name: 'Line',        payout: 5 },
  COLUMN:   { name: 'Column',      payout: 2 },
  DOZEN:    { name: 'Dozen',       payout: 2 },
  RED:      { name: 'Red',         payout: 1 },
  BLACK:    { name: 'Black',       payout: 1 },
  ODD:      { name: 'Odd',         payout: 1 },
  EVEN:     { name: 'Even',        payout: 1 },
  LOW:      { name: 'Low',         payout: 1 },
  HIGH:     { name: 'High',        payout: 1 },
};

export const ALL_BET_TYPES = Object.keys(BET_TYPES) as RouletteBetType[];

export interface RouletteBet {
  type: RouletteBetType;
  /** Type-dependent value: number for STRAIGHT, '1|2|3' for DOZEN/COLUMN, etc. */
  value?: string | number | null;
  amount: number;
}

export interface BetEvaluation {
  isWinner: boolean;
  winAmount: number;
  profit: number;
}

/**
 * Parse `value` into an integer. Returns NaN for non-numeric.
 */
function toInt(value: unknown): number {
  if (typeof value === 'number') return Math.floor(value);
  if (typeof value === 'string' && value.trim() !== '') return parseInt(value, 10);
  return NaN;
}

/**
 * Return the set of winning numbers for a given bet type/value pair.
 * Mirrors `getBetNumbers` in the legacy handler.
 *
 * SPLIT/STREET/CORNER/FIVE/LINE use comma-separated number lists in `value`
 * (e.g. "1,2" for split, "1,2,3" for street). When no value is supplied or it
 * is unparseable, the bet covers nothing (always a loser).
 */
export function getBetNumbers(type: RouletteBetType, value: unknown): number[] {
  switch (type) {
    case 'STRAIGHT': {
      const n = toInt(value);
      return Number.isFinite(n) ? [n] : [];
    }
    case 'RED':
      return ROULETTE_NUMBERS.filter((n) => n.color === 'red').map((n) => n.number);
    case 'BLACK':
      return ROULETTE_NUMBERS.filter((n) => n.color === 'black').map((n) => n.number);
    case 'ODD':
      return ROULETTE_NUMBERS.filter((n) => n.number > 0 && n.number % 2 === 1).map((n) => n.number);
    case 'EVEN':
      return ROULETTE_NUMBERS.filter((n) => n.number > 0 && n.number % 2 === 0).map((n) => n.number);
    case 'LOW':
      return Array.from({ length: 18 }, (_, i) => i + 1);
    case 'HIGH':
      return Array.from({ length: 18 }, (_, i) => i + 19);
    case 'DOZEN': {
      const d = toInt(value);
      if (![1, 2, 3].includes(d)) return [];
      const start = d * 12 - 11;
      return Array.from({ length: 12 }, (_, i) => i + start);
    }
    case 'COLUMN': {
      const c = toInt(value);
      if (![1, 2, 3].includes(c)) return [];
      return Array.from({ length: 12 }, (_, i) => i * 3 + c);
    }
    case 'SPLIT':
    case 'STREET':
    case 'CORNER':
    case 'FIVE':
    case 'LINE': {
      if (typeof value !== 'string') return [];
      return value
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n));
    }
    default:
      return [];
  }
}

/** Returns true if `winningNumber` is included in the bet's covered set. */
export function isBetWinner(type: RouletteBetType, value: unknown, winningNumber: number): boolean {
  return getBetNumbers(type, value).includes(winningNumber);
}

/**
 * Compute win amount for a bet. Uses `payoutsOverride` if provided (admin
 * config tuned payouts via `GameConfigService`), otherwise falls back to the
 * default `BET_TYPES` table.
 *
 * `winAmount` includes the returned stake: `betAmount * (payout + 1)`.
 */
export function calculateWinnings(
  type: RouletteBetType,
  betAmount: number,
  isWinner: boolean,
  payoutsOverride: Record<string, number> | null = null,
): number {
  if (!isWinner) return 0;
  let payout: number;
  if (payoutsOverride && payoutsOverride[type] != null) {
    payout = payoutsOverride[type];
  } else {
    payout = (BET_TYPES[type] || { payout: 0 }).payout;
  }
  return betAmount * (payout + 1);
}

/**
 * Evaluate a single bet against the round's winning number.
 *
 * Returns:
 *   - `isWinner`: did the bet cover the winning number?
 *   - `winAmount`: total credit returned to the player (0 on loss; bet + payout on win)
 *   - `profit`: signed net (positive on win, negative bet on loss)
 */
export function evaluateBet(
  bet: RouletteBet,
  winningNumber: number,
  payoutsOverride: Record<string, number> | null = null,
): BetEvaluation {
  const isWinner = isBetWinner(bet.type, bet.value, winningNumber);
  const winAmount = calculateWinnings(bet.type, bet.amount, isWinner, payoutsOverride);
  const profit = isWinner ? winAmount - bet.amount : -bet.amount;
  return { isWinner, winAmount, profit };
}
