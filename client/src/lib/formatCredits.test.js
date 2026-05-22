import { describe, it, expect } from 'vitest';
import { formatCredits, CURRENCY_NAME } from './formatCredits';

describe('formatCredits', () => {
  it('formats integer with default unit', () => {
    expect(formatCredits(1000)).toBe(`1,000 ${CURRENCY_NAME}`);
  });

  it('formats integer without unit when withUnit=false', () => {
    expect(formatCredits(1000, { withUnit: false })).toBe('1,000');
  });

  it('formats decimal values with 2 decimal places', () => {
    expect(formatCredits(1234.5)).toBe(`1,234.50 ${CURRENCY_NAME}`);
  });

  it('formats zero correctly', () => {
    expect(formatCredits(0)).toBe(`0 ${CURRENCY_NAME}`);
  });

  it('handles string input and parses to number', () => {
    expect(formatCredits('500')).toBe(`500 ${CURRENCY_NAME}`);
  });

  it('returns "0 Credits" for null', () => {
    expect(formatCredits(null)).toBe(`0 ${CURRENCY_NAME}`);
  });

  it('returns "0 Credits" for undefined', () => {
    expect(formatCredits(undefined)).toBe(`0 ${CURRENCY_NAME}`);
  });

  it('returns "0 Credits" for NaN', () => {
    expect(formatCredits(NaN)).toBe(`0 ${CURRENCY_NAME}`);
  });

  it('returns "0" without unit for null when withUnit=false', () => {
    expect(formatCredits(null, { withUnit: false })).toBe('0');
  });

  it('handles negative numbers', () => {
    expect(formatCredits(-50)).toBe(`-50 ${CURRENCY_NAME}`);
  });

  it('exports CURRENCY_NAME as a string', () => {
    expect(typeof CURRENCY_NAME).toBe('string');
    expect(CURRENCY_NAME.length).toBeGreaterThan(0);
  });
});
