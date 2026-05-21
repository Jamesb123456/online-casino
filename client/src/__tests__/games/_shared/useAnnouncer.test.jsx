import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAnnouncer } from '@/games/_shared/hooks/useAnnouncer';

describe('useAnnouncer', () => {
  beforeEach(() => {
    // Make rAF run synchronously so the announcement is set within `act`.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb();
      return 0;
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts with an empty announcement', () => {
    const { result } = renderHook(() => useAnnouncer(1500));
    expect(result.current.announcement).toBe('');
  });

  it('announce(text) sets the announcement to text', () => {
    const { result } = renderHook(() => useAnnouncer(1500));
    act(() => {
      result.current.announce('hi');
    });
    expect(result.current.announcement).toBe('hi');
  });

  it('clears the announcement after ttlMs', () => {
    const { result } = renderHook(() => useAnnouncer(1500));
    act(() => {
      result.current.announce('hi');
    });
    expect(result.current.announcement).toBe('hi');

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.announcement).toBe('');
  });

  it('calling announce again resets the timer', () => {
    const { result } = renderHook(() => useAnnouncer(1000));
    act(() => {
      result.current.announce('one');
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    // Re-announce — timer should reset.
    act(() => {
      result.current.announce('two');
    });
    expect(result.current.announcement).toBe('two');
    act(() => {
      vi.advanceTimersByTime(800);
    });
    // Still 'two' because 800ms < 1000ms after the second announce
    expect(result.current.announcement).toBe('two');
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.announcement).toBe('');
  });

  it('clear() empties the announcement immediately', () => {
    const { result } = renderHook(() => useAnnouncer(5000));
    act(() => {
      result.current.announce('howdy');
    });
    expect(result.current.announcement).toBe('howdy');
    act(() => {
      result.current.clear();
    });
    expect(result.current.announcement).toBe('');
  });
});
