import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useAnnouncer — push transient messages into a polite live region.
 *
 * `announce(text)` sets `announcement` to `text`, then clears it after
 * `ttlMs` (default 1500ms). Calling `announce` again resets the timer.
 *
 * Returns { announcement, announce, clear }.
 */
export function useAnnouncer(ttlMs = 1500) {
  const [announcement, setAnnouncement] = useState('');
  const timerRef = useRef(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setAnnouncement('');
  }, []);

  const announce = useCallback(
    (text) => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Force a change even if the same string is announced twice in a row
      // (some screen readers ignore identical consecutive updates).
      setAnnouncement('');
      window.requestAnimationFrame(() => {
        setAnnouncement(String(text ?? ''));
        timerRef.current = window.setTimeout(() => {
          setAnnouncement('');
          timerRef.current = null;
        }, ttlMs);
      });
    },
    [ttlMs]
  );

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    []
  );

  return { announcement, announce, clear };
}

export default useAnnouncer;
