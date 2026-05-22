import React, { useEffect, useState } from 'react';
import { MotionConfig } from 'framer-motion';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Hook returning the current value of the user's `prefers-reduced-motion` setting.
 * Updates live if the OS preference changes during the session.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    try {
      return window.matchMedia(QUERY).matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    let mql;
    try {
      mql = window.matchMedia(QUERY);
    } catch {
      return undefined;
    }
    const handler = (event) => setReduced(!!event.matches);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    if (typeof mql.addListener === 'function') {
      mql.addListener(handler);
      return () => mql.removeListener(handler);
    }
    return undefined;
  }, []);

  return reduced;
}

/**
 * MotionSafe — wraps children with Framer Motion's MotionConfig so that all
 * descendant motion components honour `prefers-reduced-motion: reduce`.
 * Use around game scenes that animate heavily.
 */
export function MotionSafe({ children }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export default MotionSafe;
