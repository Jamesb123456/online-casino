/**
 * Provably-fair shoe construction.
 *
 * WHY one PF seed per hand: a 52-card Fisher-Yates needs ~51 random draws, but
 * the engine rotates seeds per hand (the simplest instant-game model). We use
 * the single HMAC output as the seed for a mulberry32 PRNG and pull 51 floats
 * from that. Replayability still holds — given the persisted serverSeed +
 * clientSeed + nonce, anyone can rebuild the shoe deterministically.
 *
 * Trade-off vs HMAC-per-draw: lower per-card entropy, but the shuffle is still
 * uniformly random under mulberry32 and the seed is itself crypto-strong
 * (HMAC-SHA256 of the server seed). Good enough for casino gameplay and keeps
 * the seed-rotation logic identical to Dice/Slots.
 */
import pf from '../_engine/provablyFair.js';
import type { SeedBundle } from '../_engine/types.js';
import { Card, RANKS, SUITS } from './hand.js';

/**
 * Mulberry32 — small, fast, deterministic PRNG. Reads `state` and mutates it,
 * returning a float in [0, 1).
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build a fresh ordered deck (52 cards, no jokers). */
export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/**
 * Build a shuffled shoe for one hand. The seed bundle drives a mulberry32
 * PRNG that runs the Fisher-Yates shuffle, so the same bundle always yields
 * the same shoe (provably-fair replay).
 */
export function createShoe(seedBundle: SeedBundle): Card[] {
  const deck = freshDeck();
  const { raw } = pf.generate(seedBundle);
  // raw is in [0,1); scale to a 32-bit seed for mulberry32.
  const seedInt = Math.floor(raw * 0x100000000) >>> 0;
  const rand = mulberry32(seedInt);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

/** Pop one card from the top of the shoe. Mutates. */
export function draw(shoe: Card[]): Card {
  const card = shoe.pop();
  if (!card) {
    // Shouldn't happen in single-hand play (we draw at most ~12 cards), but
    // keep parity with the legacy handler's safety net rather than throwing.
    return { suit: 'hearts', rank: 'A' };
  }
  return card;
}
