/**
 * Unit tests for RingBuffer — covers eviction order, slice semantics, and a
 * snapshot-equality gate against the legacy hand-rolled history arrays so we
 * can be confident the four engine swaps (crash/roulette/wheel/plinko) emit
 * byte-identical history on the wire.
 */
import { describe, it, expect } from 'vitest';
import { RingBuffer } from '../../../games/_engine/history.js';

describe('RingBuffer', () => {
  it('throws when constructed with a non-positive capacity', () => {
    expect(() => new RingBuffer<number>(0)).toThrow();
    expect(() => new RingBuffer<number>(-5)).toThrow();
    expect(() => new RingBuffer<number>(Number.NaN)).toThrow();
  });

  it('tracks length while pushing under capacity', () => {
    const buf = new RingBuffer<number>(5);
    expect(buf.length).toBe(0);
    buf.push(1);
    buf.push(2);
    expect(buf.length).toBe(2);
    expect(buf.slice()).toEqual([1, 2]);
  });

  it('reaches capacity exactly without eviction', () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    expect(buf.length).toBe(3);
    expect(buf.slice()).toEqual([1, 2, 3]);
  });

  it('evicts from the head once over capacity (FIFO order)', () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4);
    expect(buf.length).toBe(3);
    expect(buf.slice()).toEqual([2, 3, 4]);
    buf.push(5);
    expect(buf.slice()).toEqual([3, 4, 5]);
  });

  it('slice supports negative indices like Array.prototype.slice', () => {
    const buf = new RingBuffer<number>(10);
    for (let i = 1; i <= 7; i++) buf.push(i);
    expect(buf.slice(-3)).toEqual([5, 6, 7]);
    expect(buf.slice(-10)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(buf.slice(2, 5)).toEqual([3, 4, 5]);
    expect(buf.slice()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('slice returns a copy — mutating the result does not affect the buffer', () => {
    const buf = new RingBuffer<number>(5);
    buf.push(1);
    buf.push(2);
    const out = buf.slice();
    out.push(999);
    expect(buf.slice()).toEqual([1, 2]);
  });

  it('toArray returns the full snapshot oldest-first', () => {
    const buf = new RingBuffer<string>(4);
    buf.push('a');
    buf.push('b');
    buf.push('c');
    expect(buf.toArray()).toEqual(['a', 'b', 'c']);
  });

  it('at() supports negative indices', () => {
    const buf = new RingBuffer<number>(5);
    buf.push(10);
    buf.push(20);
    buf.push(30);
    expect(buf.at(0)).toBe(10);
    expect(buf.at(-1)).toBe(30);
    expect(buf.at(99)).toBeUndefined();
  });

  it('is iterable oldest-first', () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    expect([...buf]).toEqual([1, 2, 3]);
  });

  it('clear() empties the buffer', () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.clear();
    expect(buf.length).toBe(0);
    expect(buf.slice()).toEqual([]);
  });
});

/**
 * Snapshot-equality gate: drive the same push sequence through (a) the
 * RingBuffer and (b) each engine's legacy eviction pattern. Both should leave
 * the underlying array byte-identical for every public read path the engines
 * use (`slice(-10)`, `slice(-N)`, `.length`).
 */
describe('RingBuffer snapshot-equality gate (legacy parity)', () => {
  function pushSequence(max: number, items: number[]): { ring: number[]; crash: number[]; rwp: number[] } {
    // (a) RingBuffer
    const ring = new RingBuffer<number>(max);
    // (b) Crash legacy: push + (if len > max) shift
    const crash: number[] = [];
    // (c) Roulette/Wheel/Plinko legacy: push + (if len > max) splice(0, len - max)
    const rwp: number[] = [];

    for (const v of items) {
      ring.push(v);

      crash.push(v);
      if (crash.length > max) crash.shift();

      rwp.push(v);
      if (rwp.length > max) rwp.splice(0, rwp.length - max);
    }

    return { ring: ring.slice(), crash, rwp };
  }

  it('matches the crash shift() eviction pattern across 200 pushes', () => {
    const items = Array.from({ length: 200 }, (_, i) => i + 1);
    const { ring, crash } = pushSequence(50, items);
    expect(ring).toEqual(crash);
  });

  it('matches the roulette/wheel/plinko splice() eviction pattern across 500 pushes', () => {
    const items = Array.from({ length: 500 }, (_, i) => i + 1);
    const { ring, rwp } = pushSequence(100, items);
    expect(ring).toEqual(rwp);
  });

  it('slice(-10) is byte-identical to legacy after eviction', () => {
    const items = Array.from({ length: 73 }, (_, i) => i + 1);
    const max = 50;

    const ring = new RingBuffer<number>(max);
    const legacy: number[] = [];
    for (const v of items) {
      ring.push(v);
      legacy.push(v);
      if (legacy.length > max) legacy.shift();
    }

    expect(ring.slice(-10)).toEqual(legacy.slice(-10));
    expect(ring.length).toBe(legacy.length);
  });

  it('handles eviction when items overflow capacity by an exact multiple', () => {
    const max = 10;
    const items = Array.from({ length: 30 }, (_, i) => i);
    const ring = new RingBuffer<number>(max);
    const legacy: number[] = [];
    for (const v of items) {
      ring.push(v);
      legacy.push(v);
      if (legacy.length > max) legacy.splice(0, legacy.length - max);
    }
    expect(ring.slice()).toEqual(legacy);
    expect(ring.slice()).toEqual([20, 21, 22, 23, 24, 25, 26, 27, 28, 29]);
  });
});
