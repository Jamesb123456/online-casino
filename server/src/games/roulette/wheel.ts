/**
 * European single-zero roulette wheel layout.
 *
 * Order matters: the index of each entry in `ROULETTE_NUMBERS` is the wheel
 * segment index used by the spin animation maths. Copied verbatim from
 * `socket/rouletteHandler.ts` so the visual wheel rendering stays identical.
 *
 * Colors: 0 is green; alternating red/black follows the classic European
 * pocket assignment.
 */
export interface RouletteSlot {
  number: number;
  color: 'red' | 'black' | 'green';
}

export const ROULETTE_NUMBERS: ReadonlyArray<RouletteSlot> = [
  { number: 0, color: 'green' },
  { number: 32, color: 'red' },  { number: 15, color: 'black' },
  { number: 19, color: 'red' },  { number: 4, color: 'black' },
  { number: 21, color: 'red' },  { number: 2, color: 'black' },
  { number: 25, color: 'red' },  { number: 17, color: 'black' },
  { number: 34, color: 'red' },  { number: 6, color: 'black' },
  { number: 27, color: 'red' },  { number: 13, color: 'black' },
  { number: 36, color: 'red' },  { number: 11, color: 'black' },
  { number: 30, color: 'red' },  { number: 8, color: 'black' },
  { number: 23, color: 'red' },  { number: 10, color: 'black' },
  { number: 5, color: 'red' },   { number: 24, color: 'black' },
  { number: 16, color: 'red' },  { number: 33, color: 'black' },
  { number: 1, color: 'red' },   { number: 20, color: 'black' },
  { number: 14, color: 'red' },  { number: 31, color: 'black' },
  { number: 9, color: 'red' },   { number: 22, color: 'black' },
  { number: 18, color: 'red' },  { number: 29, color: 'black' },
  { number: 7, color: 'red' },   { number: 28, color: 'black' },
  { number: 12, color: 'red' },  { number: 35, color: 'black' },
  { number: 3, color: 'red' },   { number: 26, color: 'black' },
];

/** Lookup the slot for a given winning number (0..36). Throws on invalid. */
export function slotForNumber(n: number): RouletteSlot {
  const found = ROULETTE_NUMBERS.find((s) => s.number === n);
  if (!found) throw new Error(`invalid_winning_number:${n}`);
  return found;
}

/** Lookup the wheel segment index for a given winning number. */
export function indexForNumber(n: number): number {
  const i = ROULETTE_NUMBERS.findIndex((s) => s.number === n);
  if (i < 0) throw new Error(`invalid_winning_number:${n}`);
  return i;
}
