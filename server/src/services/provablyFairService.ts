import crypto from 'crypto';

/**
 * Provably Fair Service
 * Implements HMAC-SHA256 based provably fair algorithm
 */
class ProvablyFairService {
  /**
   * Generate a new server seed
   */
  static generateServerSeed(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash a server seed (this hash is shown to the player BEFORE the game)
   */
  static hashServerSeed(serverSeed: string): string {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }

  /**
   * Generate a game result from server seed, client seed, and nonce
   * Returns a value between 0 and 1
   */
  static generateResult(serverSeed: string, clientSeed: string, nonce: number): number {
    const hmac = crypto.createHmac('sha256', serverSeed);
    hmac.update(`${clientSeed}:${nonce}`);
    const hex = hmac.digest('hex');

    // Take first 8 hex characters (32 bits) and convert to float 0-1
    const intValue = parseInt(hex.substring(0, 8), 16);
    return intValue / 0xFFFFFFFF;
  }

  /**
   * Generate a crash point from a fair result
   * House edge: 1%
   */
  static generateCrashPoint(serverSeed: string, clientSeed: string, nonce: number): number {
    const result = this.generateResult(serverSeed, clientSeed, nonce);
    const houseEdge = 0.01;

    // Convert to crash point with house edge
    if (result < houseEdge) return 1.00;

    const crashPoint = Math.floor((1 / (1 - result)) * 100) / 100;
    return Math.max(1.00, crashPoint);
  }

  /**
   * Generate a roulette number from a fair result (0-36)
   */
  static generateRouletteNumber(serverSeed: string, clientSeed: string, nonce: number): number {
    const result = this.generateResult(serverSeed, clientSeed, nonce);
    return Math.floor(result * 37); // 0-36
  }

  /**
   * Verify a game result given the seeds
   * This is what the client uses to verify fairness
   */
  static verifyResult(serverSeed: string, serverSeedHash: string, clientSeed: string, nonce: number): {
    valid: boolean;
    result: number;
    serverSeedHashMatch: boolean;
  } {
    const computedHash = this.hashServerSeed(serverSeed);
    const serverSeedHashMatch = computedHash === serverSeedHash;
    const result = this.generateResult(serverSeed, clientSeed, nonce);

    return {
      valid: serverSeedHashMatch,
      result,
      serverSeedHashMatch,
    };
  }
}

export default ProvablyFairService;
