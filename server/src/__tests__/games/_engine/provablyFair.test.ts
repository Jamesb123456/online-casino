// @ts-nocheck
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

import pf, { ProvablyFair } from '../../../games/_engine/provablyFair.js';
import ProvablyFairService from '../../../services/provablyFairService.js';

describe('ProvablyFair (engine wrapper)', () => {
  describe('newServerSeed()', () => {
    it('returns hex strings for both seed and hash', () => {
      const { serverSeed, serverSeedHash } = pf.newServerSeed();
      expect(serverSeed).toMatch(/^[0-9a-f]+$/);
      expect(serverSeedHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('hash matches sha256(serverSeed)', () => {
      const { serverSeed, serverSeedHash } = pf.newServerSeed();
      const expected = crypto.createHash('sha256').update(serverSeed).digest('hex');
      expect(serverSeedHash).toBe(expected);
    });

    it('produces distinct seeds across calls', () => {
      const a = pf.newServerSeed();
      const b = pf.newServerSeed();
      expect(a.serverSeed).not.toBe(b.serverSeed);
    });
  });

  describe('deterministicClientSeed()', () => {
    it('returns the same hash for the same roundId + userIds', () => {
      const a = pf.deterministicClientSeed('round-1', [1, 2, 3]);
      const b = pf.deterministicClientSeed('round-1', [1, 2, 3]);
      expect(a).toBe(b);
    });

    it('is independent of userId order (sorted internally)', () => {
      const a = pf.deterministicClientSeed('round-9', [3, 1, 2]);
      const b = pf.deterministicClientSeed('round-9', [1, 2, 3]);
      const c = pf.deterministicClientSeed('round-9', [2, 3, 1]);
      expect(a).toBe(b);
      expect(b).toBe(c);
    });

    it('produces different output for different roundIds', () => {
      const a = pf.deterministicClientSeed('r1', [1]);
      const b = pf.deterministicClientSeed('r2', [1]);
      expect(a).not.toBe(b);
    });

    it('returns a 64-char hex string', () => {
      const out = pf.deterministicClientSeed(123, ['x', 'y']);
      expect(out).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('normaliseClientSeed()', () => {
    it('passes through a valid trimmed alphanumeric seed', () => {
      expect(pf.normaliseClientSeed('  myseed_123  ')).toBe('myseed_123');
    });

    it('accepts hyphens and underscores', () => {
      expect(pf.normaliseClientSeed('my-seed_42')).toBe('my-seed_42');
    });

    it('falls back to a 32-char hex string when input is empty', () => {
      const out = pf.normaliseClientSeed('');
      expect(out).toHaveLength(32);
      expect(out).toMatch(/^[0-9a-f]{32}$/);
    });

    it('falls back when input contains special chars', () => {
      const out = pf.normaliseClientSeed("'; DROP TABLE users; --");
      expect(out).toMatch(/^[0-9a-f]{32}$/);
    });

    it('falls back when input is longer than 64 chars', () => {
      const out = pf.normaliseClientSeed('a'.repeat(65));
      expect(out).toMatch(/^[0-9a-f]{32}$/);
    });

    it('falls back when input is not a string', () => {
      expect(pf.normaliseClientSeed(undefined)).toMatch(/^[0-9a-f]{32}$/);
      expect(pf.normaliseClientSeed(null)).toMatch(/^[0-9a-f]{32}$/);
      expect(pf.normaliseClientSeed(12345)).toMatch(/^[0-9a-f]{32}$/);
      expect(pf.normaliseClientSeed({})).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe('generate()', () => {
    it('returns a float in [0, 1)', () => {
      const { serverSeed, serverSeedHash } = pf.newServerSeed();
      for (let i = 0; i < 50; i++) {
        const res = pf.generate({ serverSeed, serverSeedHash, clientSeed: 'cs', nonce: i });
        expect(res.raw).toBeGreaterThanOrEqual(0);
        expect(res.raw).toBeLessThan(1);
      }
    });

    it('passes the seeds through in the result', () => {
      const bundle = { serverSeed: 'a'.repeat(64), serverSeedHash: 'h', clientSeed: 'c', nonce: 0 };
      const res = pf.generate(bundle);
      expect(res.seeds).toBe(bundle);
    });
  });

  describe('generateInt()', () => {
    it('returns an integer in [0, max)', () => {
      const { serverSeed, serverSeedHash } = pf.newServerSeed();
      for (let i = 0; i < 100; i++) {
        const { value } = pf.generateInt({ serverSeed, serverSeedHash, clientSeed: 'cs', nonce: i }, 10);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(10);
      }
    });

    it('throws on max <= 0', () => {
      const bundle = { serverSeed: 'a', serverSeedHash: 'h', clientSeed: 'c', nonce: 1 };
      expect(() => pf.generateInt(bundle, 0)).toThrow(/invalid_max/);
      expect(() => pf.generateInt(bundle, -1)).toThrow(/invalid_max/);
    });

    it('throws on non-integer max', () => {
      const bundle = { serverSeed: 'a', serverSeedHash: 'h', clientSeed: 'c', nonce: 1 };
      expect(() => pf.generateInt(bundle, 3.5)).toThrow(/invalid_max/);
    });
  });

  describe('generateCrashPoint()', () => {
    it('always returns >= 1.0', () => {
      const { serverSeed, serverSeedHash } = pf.newServerSeed();
      for (let i = 0; i < 100; i++) {
        const { crashPoint } = pf.generateCrashPoint(
          { serverSeed, serverSeedHash, clientSeed: 'cs', nonce: i },
          0.01,
        );
        expect(crashPoint).toBeGreaterThanOrEqual(1.0);
      }
    });

    it('returns 1.0 when raw < houseEdge (very large house edge forces this)', () => {
      const { serverSeed, serverSeedHash } = pf.newServerSeed();
      // 1.0 houseEdge forces every raw < edge => 1.0
      const { crashPoint } = pf.generateCrashPoint(
        { serverSeed, serverSeedHash, clientSeed: 'cs', nonce: 7 },
        1.0,
      );
      expect(crashPoint).toBe(1.0);
    });
  });

  describe('generateRouletteNumber()', () => {
    it('always returns integer in [0, 36]', () => {
      const { serverSeed, serverSeedHash } = pf.newServerSeed();
      for (let i = 0; i < 100; i++) {
        const { value } = pf.generateRouletteNumber({
          serverSeed,
          serverSeedHash,
          clientSeed: 'cs',
          nonce: i,
        });
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(36);
      }
    });
  });

  describe('verify()', () => {
    it('round-trip: toPersisted reveal+verify returns valid=true', () => {
      const { serverSeed, serverSeedHash } = pf.newServerSeed();
      const bundle = { serverSeed, serverSeedHash, clientSeed: 'cs', nonce: 3 };
      const persisted = pf.toPersisted(bundle, { reveal: true, roundId: 'r-1' });
      const v = pf.verify(persisted);
      expect(v.valid).toBe(true);
      expect(v.serverSeedHashMatch).toBe(true);
    });

    it('returns valid=false when serverSeed is null (not yet revealed)', () => {
      const { serverSeed, serverSeedHash } = pf.newServerSeed();
      const bundle = { serverSeed, serverSeedHash, clientSeed: 'cs', nonce: 1 };
      const persisted = pf.toPersisted(bundle, { reveal: false });
      const v = pf.verify(persisted);
      expect(v.valid).toBe(false);
      expect(v.serverSeedHashMatch).toBe(false);
      expect(v.result).toBe(0);
    });

    it('uses persisted.nonce by default but accepts override', () => {
      const { serverSeed, serverSeedHash } = pf.newServerSeed();
      const persisted = pf.toPersisted(
        { serverSeed, serverSeedHash, clientSeed: 'c', nonce: 5 },
        { reveal: true },
      );
      const a = pf.verify(persisted);
      const b = pf.verify(persisted, 5);
      expect(a.result).toBe(b.result);
    });
  });

  describe('toPersisted()', () => {
    it('omits serverSeed (null) when reveal:false', () => {
      const bundle = { serverSeed: 'ss', serverSeedHash: 'hh', clientSeed: 'cs', nonce: 1 };
      const p = pf.toPersisted(bundle, { reveal: false });
      expect(p.serverSeed).toBeNull();
      expect(p.serverSeedHash).toBe('hh');
      expect(p.clientSeed).toBe('cs');
      expect(p.nonce).toBe(1);
    });

    it('includes serverSeed when reveal:true', () => {
      const bundle = { serverSeed: 'ss', serverSeedHash: 'hh', clientSeed: 'cs', nonce: 2 };
      const p = pf.toPersisted(bundle, { reveal: true });
      expect(p.serverSeed).toBe('ss');
    });

    it('carries roundId through when provided', () => {
      const bundle = { serverSeed: 'ss', serverSeedHash: 'hh', clientSeed: 'cs', nonce: 0 };
      const p = pf.toPersisted(bundle, { reveal: true, roundId: 'abc-123' });
      expect(p.roundId).toBe('abc-123');
    });

    it('roundId is null by default', () => {
      const bundle = { serverSeed: 'ss', serverSeedHash: 'hh', clientSeed: 'cs', nonce: 0 };
      const p = pf.toPersisted(bundle, { reveal: false });
      expect(p.roundId).toBeNull();
    });
  });

  describe('forGame()', () => {
    it('returns the same instance regardless of gameType', () => {
      const a = pf.forGame('dice');
      const b = pf.forGame('crash');
      expect(a).toBe(pf);
      expect(b).toBe(pf);
    });
  });

  describe('class export', () => {
    it('exports a constructible class', () => {
      const fresh = new ProvablyFair();
      const seed = fresh.newServerSeed();
      expect(seed.serverSeed).toMatch(/^[0-9a-f]+$/);
    });
  });
});
