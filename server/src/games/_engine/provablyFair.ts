import crypto from 'crypto';
import ProvablyFairService from '../../services/provablyFairService.js';
import type { FairResult, GameType, PersistedSeeds, SeedBundle } from './types.js';

/**
 * Provably-fair RNG wrapper.
 *
 * Engines never call `crypto.randomInt` or `ProvablyFairService` directly —
 * they go through one of the `generate*` helpers here. Every RNG draw is
 * derived from `HMAC-SHA256(serverSeed, clientSeed:nonce)` so a player can
 * later verify the outcome with the revealed server seed.
 *
 * Two lifecycles:
 *
 * - **Round-based** (Crash/Roulette/Wheel): one server seed per round,
 *   broadcast as a hash up front and revealed on settle. The clientSeed is
 *   deterministic — derived from the round id + sorted bettor userIds — so a
 *   third party can replay the round.
 *
 * - **Instant** (Blackjack/Plinko/Landmines/Dice/Slots): per-user rotating
 *   seed pair held in memory by the engine. The player may set their own
 *   client seed; nonces increment per draw. After a configurable number of
 *   draws (or by player request) the engine rotates: reveals the current
 *   serverSeed and generates a new pair.
 */

class ProvablyFair {
  /**
   * Mint a new server-seed pair. Used at round start (round-based) and on
   * rotation (instant).
   */
  newServerSeed(): { serverSeed: string; serverSeedHash: string } {
    const serverSeed = ProvablyFairService.generateServerSeed();
    const serverSeedHash = ProvablyFairService.hashServerSeed(serverSeed);
    return { serverSeed, serverSeedHash };
  }

  /**
   * Derive a deterministic client seed for a shared round. Hashing the round
   * id together with the sorted bettor userIds means two observers with the
   * same round metadata derive the same seed — third-party replay works.
   */
  deterministicClientSeed(roundId: string | number, userIds: Array<number | string>): string {
    const sorted = [...userIds].map((u) => String(u)).sort();
    const material = `${String(roundId)}|${sorted.join(',')}`;
    return crypto.createHash('sha256').update(material).digest('hex');
  }

  /**
   * Validate and normalise a player-supplied client seed.
   *
   * - Must be 1..64 chars, [A-Za-z0-9_-]. Otherwise a fresh random hex string
   *   is returned so a malformed input never blocks gameplay (and never lets
   *   the player smuggle SQL or socket-control chars through).
   */
  normaliseClientSeed(raw: unknown): string {
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed.length > 0 && trimmed.length <= 64 && /^[A-Za-z0-9_-]+$/.test(trimmed)) {
        return trimmed;
      }
    }
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Produce one fair float in [0, 1) for the given seed bundle.
   * Pure passthrough to ProvablyFairService — kept here so engines have one
   * point of entry and we can swap the underlying primitive without touching
   * every game.
   */
  generate(bundle: SeedBundle): FairResult {
    const raw = ProvablyFairService.generateResult(bundle.serverSeed, bundle.clientSeed, bundle.nonce);
    return { raw, seeds: bundle };
  }

  /**
   * Produce an integer in [0, max). Uses 53 bits of HMAC output to avoid
   * modulo bias for small `max`.
   */
  generateInt(bundle: SeedBundle, max: number): { value: number; seeds: SeedBundle } {
    if (!Number.isInteger(max) || max <= 0) throw new Error('invalid_max');
    const { raw } = this.generate(bundle);
    return { value: Math.floor(raw * max), seeds: bundle };
  }

  /**
   * Crash multiplier with house edge from the supplied config.
   * Mirrors the math in `ProvablyFairService.generateCrashPoint` but lets the
   * caller supply the edge so it can come from `GameConfigService` instead of
   * being hardcoded.
   */
  generateCrashPoint(bundle: SeedBundle, houseEdge: number): { crashPoint: number; seeds: SeedBundle } {
    const { raw } = this.generate(bundle);
    if (raw < houseEdge) return { crashPoint: 1.0, seeds: bundle };
    const crashPoint = Math.floor((1 / (1 - raw)) * 100) / 100;
    return { crashPoint: Math.max(1.0, crashPoint), seeds: bundle };
  }

  /** Roulette wheel position 0..36. */
  generateRouletteNumber(bundle: SeedBundle): { value: number; seeds: SeedBundle } {
    const { raw } = this.generate(bundle);
    return { value: Math.floor(raw * 37), seeds: bundle };
  }

  /**
   * Verify a previously-played round using the now-revealed serverSeed.
   * The client also has a JS port of this for the Verify button — server side
   * we expose it for replay tests and admin tooling.
   */
  verify(persisted: PersistedSeeds, nonce: number = persisted.nonce): {
    valid: boolean;
    result: number;
    serverSeedHashMatch: boolean;
  } {
    if (!persisted.serverSeed) {
      return { valid: false, result: 0, serverSeedHashMatch: false };
    }
    return ProvablyFairService.verifyResult(
      persisted.serverSeed,
      persisted.serverSeedHash,
      persisted.clientSeed,
      nonce,
    );
  }

  /**
   * Build the JSON object to store in `gameSessions.gameState`. The server
   * seed is null at session start and filled in at session end.
   */
  toPersisted(bundle: SeedBundle, options: { reveal: boolean; roundId?: string | number }): PersistedSeeds {
    return {
      serverSeedHash: bundle.serverSeedHash,
      serverSeed: options.reveal ? bundle.serverSeed : null,
      clientSeed: bundle.clientSeed,
      nonce: bundle.nonce,
      roundId: options.roundId ?? null,
    };
  }

  /** Convenience accessor — kept for parity with the existing service API. */
  // eslint-disable-next-line class-methods-use-this
  forGame(_gameType: GameType): ProvablyFair {
    return this;
  }
}

const provablyFair = new ProvablyFair();
export default provablyFair;
export { ProvablyFair };
