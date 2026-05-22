// @ts-nocheck
import { describe, it, expect } from 'vitest';

import { parseOrigins } from '../../../lib/env.js';

// ---------------------------------------------------------------------------
// parseOrigins -- trusted-origins parsing used by server/lib/auth.ts
// Background: commit 51d85c3 introduced this helper so CLIENT_URL can be a
// comma-separated list. Better Auth's `trustedOrigins` config requires a
// string[], not a single comma-blob. The cases below pin the documented
// behaviour so future regressions are caught immediately.
// ---------------------------------------------------------------------------

describe('parseOrigins', () => {
  describe('comma-separated lists', () => {
    it('splits a simple two-origin list', () => {
      const result = parseOrigins('http://a.test,http://b.test');
      expect(result).toEqual(['http://a.test', 'http://b.test']);
    });

    it('handles three or more origins', () => {
      const result = parseOrigins(
        'http://a.test,http://b.test,http://c.test,https://d.test',
      );
      expect(result).toEqual([
        'http://a.test',
        'http://b.test',
        'http://c.test',
        'https://d.test',
      ]);
    });
  });

  describe('whitespace handling', () => {
    it('trims surrounding whitespace from each value', () => {
      const result = parseOrigins(' http://a.test , http://b.test ');
      expect(result).toEqual(['http://a.test', 'http://b.test']);
    });

    it('trims tabs and mixed whitespace', () => {
      const result = parseOrigins('\thttp://a.test\t,\n  http://b.test\n');
      expect(result).toEqual(['http://a.test', 'http://b.test']);
    });

    it('drops entries that are pure whitespace', () => {
      // Trailing comma + whitespace-only segment should not produce an empty
      // string in the output, otherwise Better Auth would treat '' as a
      // valid origin.
      const result = parseOrigins('http://a.test,   ,http://b.test,');
      expect(result).toEqual(['http://a.test', 'http://b.test']);
    });
  });

  describe('single value', () => {
    it('returns a one-element array for a single origin', () => {
      const result = parseOrigins('http://localhost:5173');
      expect(result).toEqual(['http://localhost:5173']);
    });

    it('still trims a single value with surrounding whitespace', () => {
      const result = parseOrigins('  http://localhost:5173  ');
      expect(result).toEqual(['http://localhost:5173']);
    });
  });

  describe('empty / falsy input', () => {
    it('returns the default fallback when the raw value is an empty string', () => {
      // Empty string is falsy in the helper so the default fallback kicks in.
      const result = parseOrigins('');
      expect(result).toEqual(['http://localhost']);
    });

    it('returns the default fallback when the env var is undefined', () => {
      const result = parseOrigins(undefined);
      expect(result).toEqual(['http://localhost']);
    });

    it('honours a custom fallback when input is undefined', () => {
      const result = parseOrigins(undefined, 'http://fallback.test');
      expect(result).toEqual(['http://fallback.test']);
    });

    it('honours a custom fallback when input is an empty string', () => {
      const result = parseOrigins('', 'http://fallback.test,http://other.test');
      expect(result).toEqual(['http://fallback.test', 'http://other.test']);
    });

    it('returns an empty array when input is only commas and whitespace', () => {
      // The string ',  ,' is truthy so the fallback does NOT apply, but every
      // split segment is whitespace-only and gets filtered out.
      const result = parseOrigins(',  ,');
      expect(result).toEqual([]);
    });
  });
});
