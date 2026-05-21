import { describe, it, expect, beforeAll } from 'vitest';

// Some jsdom versions lack `crypto.subtle`. Polyfill from Node's webcrypto if
// missing — this is a noop on modern jsdom.
beforeAll(async () => {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    const { webcrypto } = await import('node:crypto');
    globalThis.crypto = webcrypto;
  }
});

const importLib = async () => await import('@/lib/provablyFair');

describe('provablyFair', () => {
  describe('hashServerSeed', () => {
    it('matches the known SHA-256 of "test"', async () => {
      const { hashServerSeed } = await importLib();
      const hash = await hashServerSeed('test');
      expect(hash).toBe(
        '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
      );
    });

    it('returns a 64-char lowercase hex string for any input', async () => {
      const { hashServerSeed } = await importLib();
      const hash = await hashServerSeed('arbitrary-server-seed-12345');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('generateResult', () => {
    it('is deterministic for fixed (serverSeed, clientSeed, nonce)', async () => {
      const { generateResult } = await importLib();
      const a = await generateResult('server-1', 'client-1', 1);
      const b = await generateResult('server-1', 'client-1', 1);
      expect(a).toBe(b);
    });

    it('returns a value in [0, 1]', async () => {
      const { generateResult } = await importLib();
      for (let nonce = 0; nonce < 5; nonce++) {
        const r = await generateResult('server-seed', 'client', nonce);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
      }
    });

    it('produces different values for different nonces', async () => {
      const { generateResult } = await importLib();
      const r1 = await generateResult('server', 'client', 1);
      const r2 = await generateResult('server', 'client', 2);
      expect(r1).not.toBe(r2);
    });
  });

  describe('verifyResult', () => {
    it('valid:true when serverSeed hashes to serverSeedHash', async () => {
      const { hashServerSeed, verifyResult } = await importLib();
      const serverSeed = 'verify-me';
      const serverSeedHash = await hashServerSeed(serverSeed);
      const out = await verifyResult({
        serverSeed,
        serverSeedHash,
        clientSeed: 'cs',
        nonce: 7,
      });
      expect(out.valid).toBe(true);
      expect(out.serverSeedHashMatch).toBe(true);
      expect(typeof out.result).toBe('number');
    });

    it('valid:false when serverSeed does NOT match serverSeedHash', async () => {
      const { verifyResult } = await importLib();
      const out = await verifyResult({
        serverSeed: 'mismatch',
        serverSeedHash: 'deadbeef'.padEnd(64, '0'),
        clientSeed: 'cs',
        nonce: 1,
      });
      expect(out.valid).toBe(false);
      expect(out.serverSeedHashMatch).toBe(false);
    });
  });

  describe('generateCrashPoint', () => {
    it('is always ≥ 1.0', async () => {
      const { generateCrashPoint } = await importLib();
      for (let nonce = 0; nonce < 25; nonce++) {
        const cp = await generateCrashPoint('seed', 'client', nonce);
        expect(cp).toBeGreaterThanOrEqual(1.0);
      }
    });

    it('returns 1.0 when houseEdge is high enough to force the floor', async () => {
      const { generateCrashPoint } = await importLib();
      // houseEdge=1 means raw is always < houseEdge → always returns 1.0
      const cp = await generateCrashPoint('seed', 'client', 1, 1);
      expect(cp).toBe(1.0);
    });
  });

  describe('generateRouletteNumber', () => {
    it('is an integer in [0, 36]', async () => {
      const { generateRouletteNumber } = await importLib();
      for (let nonce = 0; nonce < 20; nonce++) {
        const n = await generateRouletteNumber('seed', 'client', nonce);
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(36);
      }
    });
  });
});
