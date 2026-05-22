import React, { useEffect, useRef, useState } from 'react';
import AnimatedNumber from './AnimatedNumber';

/**
 * AnimatedBalance — currency-formatted GSAP counter with directional pulse.
 *
 * - Amber glow on any increase (default).
 * - Lime glow when the consumer flags the change as a win (`recentWin` true).
 * - Rose flash on decrease (bet placed / loss).
 *
 * Props:
 *   value        number — balance to display
 *   currency     ISO code or short prefix; '$' by default
 *   recentWin    when true and value increased, use the lime/win glow
 *   duration     tween length in seconds
 *   className    pass-through for layout
 */
const CURRENCY_FORMATTER = (n) =>
  Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const FLASH_MS = 600;

function AnimatedBalance({
  value = 0,
  currency = '$',
  recentWin = false,
  duration = 0.7,
  className = '',
}) {
  const prevRef = useRef(value);
  const [flash, setFlash] = useState(null); // 'up' | 'win' | 'down' | null

  useEffect(() => {
    const prev = prevRef.current;
    if (!Number.isFinite(prev) || !Number.isFinite(value)) {
      prevRef.current = value;
      return undefined;
    }
    if (value > prev) {
      setFlash(recentWin ? 'win' : 'up');
    } else if (value < prev) {
      setFlash('down');
    }
    prevRef.current = value;
    const t = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => window.clearTimeout(t);
  }, [value, recentWin]);

  const flashClass =
    flash === 'win'
      ? 'shadow-[0_0_24px_rgba(163,230,53,0.55)] ring-1 ring-lime-400/40'
      : flash === 'up'
      ? 'shadow-glow-amber ring-1 ring-accent-gold-light/40'
      : flash === 'down'
      ? 'ring-1 ring-accent-rose/50 bg-accent-rose/5'
      : 'ring-1 ring-white/5';

  return (
    <span
      className={[
        'inline-flex items-baseline gap-1 rounded-full px-3 py-1 font-heading',
        'bg-white/5 transition-shadow duration-300',
        flashClass,
        className,
      ].join(' ')}
    >
      <span className="text-text-secondary text-sm">{currency}</span>
      <AnimatedNumber
        value={value}
        duration={duration}
        format={CURRENCY_FORMATTER}
        className="text-text-primary font-semibold tabular-nums"
      />
    </span>
  );
}

export default AnimatedBalance;
