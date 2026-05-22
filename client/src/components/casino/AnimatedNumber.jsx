import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useReducedMotion } from './MotionSafe';

const DEFAULT_FORMAT = (n) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

/**
 * AnimatedNumber — tweens between numeric values using GSAP.
 *
 * Props:
 *   value      number — target value
 *   duration   seconds (default 0.6)
 *   format     fn(n) → string
 *   className  pass-through
 *   ease       gsap ease (default 'power2.out')
 *
 * Honours `prefers-reduced-motion`: snaps instantly to the target value when
 * the user has reduced motion enabled.
 */
function AnimatedNumber({
  value,
  duration = 0.6,
  format = DEFAULT_FORMAT,
  className = '',
  ease = 'power2.out',
  ...rest
}) {
  const spanRef = useRef(null);
  const prevRef = useRef(typeof value === 'number' && Number.isFinite(value) ? value : 0);
  const tweenRef = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const target = Number.isFinite(value) ? Number(value) : 0;
    const from = Number.isFinite(prevRef.current) ? prevRef.current : 0;
    const node = spanRef.current;
    if (!node) {
      prevRef.current = target;
      return undefined;
    }

    // Kill any in-flight tween so the new target wins.
    if (tweenRef.current) {
      tweenRef.current.kill();
      tweenRef.current = null;
    }

    if (reduced || duration <= 0 || from === target) {
      node.textContent = format(target);
      prevRef.current = target;
      return undefined;
    }

    const proxy = { n: from };
    tweenRef.current = gsap.to(proxy, {
      n: target,
      duration,
      ease,
      onUpdate: () => {
        if (spanRef.current) {
          spanRef.current.textContent = format(proxy.n);
        }
      },
      onComplete: () => {
        if (spanRef.current) {
          spanRef.current.textContent = format(target);
        }
        prevRef.current = target;
        tweenRef.current = null;
      },
    });

    return () => {
      if (tweenRef.current) {
        tweenRef.current.kill();
        tweenRef.current = null;
      }
    };
  }, [value, duration, format, ease, reduced]);

  // Initial paint: render the formatted current value synchronously so SSR /
  // first frame doesn't show empty content.
  const initial = format(
    Number.isFinite(prevRef.current) ? prevRef.current : (Number.isFinite(value) ? value : 0),
  );

  return (
    <span ref={spanRef} className={className} {...rest}>
      {initial}
    </span>
  );
}

export default AnimatedNumber;
