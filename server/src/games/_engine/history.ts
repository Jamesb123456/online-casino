/**
 * Bounded FIFO ring buffer used by round-based game engines to retain a
 * sliding window of recent round results (crash points, roulette spins, wheel
 * segments, plinko drops).
 *
 * Behaviour is intentionally identical to the legacy hand-rolled arrays the
 * four engines used previously:
 *
 *   - Newest items are appended at the end.
 *   - Whenever a push would take `length` above `max`, items are evicted
 *     from the head until `length <= max`. (Equivalent to both the old
 *     `shift()` and `splice(0, len - max)` patterns since pushes happen one
 *     at a time.)
 *   - `slice()` mirrors `Array.prototype.slice` semantics, including negative
 *     indices (`slice(-10)` returns the last 10 items, newest-last).
 *   - The returned array from `slice()` / `toArray()` is a fresh copy — the
 *     caller cannot mutate the internal store.
 */
export class RingBuffer<T> {
  private items: T[] = [];

  constructor(private readonly max: number) {
    if (!Number.isFinite(max) || max <= 0) {
      throw new Error(`RingBuffer max must be a positive number, got ${max}`);
    }
  }

  /** Append `item` to the buffer and evict from the head until length <= max. */
  push(item: T): void {
    this.items.push(item);
    while (this.items.length > this.max) {
      this.items.shift();
    }
  }

  /** Number of items currently retained (always `<= max`). */
  get length(): number {
    return this.items.length;
  }

  /** Configured capacity. */
  get capacity(): number {
    return this.max;
  }

  /**
   * Same semantics as `Array.prototype.slice` — supports negative indices.
   * Returns a fresh array; mutating it does not affect the buffer.
   */
  slice(start?: number, end?: number): T[] {
    return this.items.slice(start, end);
  }

  /** Read a single item by (possibly negative) index, matching `Array` indexing. */
  at(index: number): T | undefined {
    return this.items.at(index);
  }

  /** Iterate oldest-first. */
  [Symbol.iterator](): IterableIterator<T> {
    return this.items[Symbol.iterator]();
  }

  /** Return a shallow copy of all retained items, oldest-first. */
  toArray(): T[] {
    return this.items.slice();
  }

  /** Drop all retained items. */
  clear(): void {
    this.items = [];
  }
}

export default RingBuffer;
