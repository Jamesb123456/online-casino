import React, { useCallback, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { useSound } from './SoundProvider';
import { useReducedMotion } from './MotionSafe';

/**
 * WinBurst — celebration helper.
 *
 * Three tiers, selected by multiplier:
 *   ≥ 50  → 'jackpot'  full-screen gold confetti + 'win-jackpot' sound
 *   ≥ 10  → 'big'      dense lime confetti + 'win-big' sound
 *   ≥ 2   → 'small'    light confetti + 'win-small' sound
 *
 * useWinBurst() returns:
 *   {
 *     burst({ multiplier, amount, anchor? }),  imperative trigger
 *     WinBurst,                                ReactNode floating badge
 *   }
 *
 * Reduced motion: confetti is suppressed, but sound still plays and the badge
 * fades in/out without translation.
 */

const COLORS = {
  jackpot: ['#FBBF24', '#F59E0B', '#FDE68A', '#FFFFFF'],
  big: ['#A3E635', '#84CC16', '#BEF264', '#FFFFFF'],
  small: ['#A78BFA', '#7C3AED', '#C4B5FD'],
};

function tierFor(multiplier) {
  const m = Number(multiplier) || 0;
  if (m >= 50) return 'jackpot';
  if (m >= 10) return 'big';
  if (m >= 2) return 'small';
  return null;
}

function originFromAnchor(anchor) {
  if (!anchor || typeof anchor.getBoundingClientRect !== 'function') {
    return { x: 0.5, y: 0.5 };
  }
  try {
    const rect = anchor.getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / Math.max(1, window.innerWidth);
    const y = (rect.top + rect.height / 2) / Math.max(1, window.innerHeight);
    return { x, y };
  } catch {
    return { x: 0.5, y: 0.5 };
  }
}

function fireConfetti(tier, origin) {
  const colors = COLORS[tier] || COLORS.small;
  if (tier === 'jackpot') {
    confetti({
      particleCount: 200,
      spread: 100,
      origin,
      colors,
      scalar: 1.1,
      ticks: 240,
    });
    // Sidekick salvos for full-screen effect.
    setTimeout(() => {
      confetti({ particleCount: 80, angle: 60, spread: 80, origin: { x: 0, y: 0.7 }, colors });
      confetti({ particleCount: 80, angle: 120, spread: 80, origin: { x: 1, y: 0.7 }, colors });
    }, 120);
    return;
  }
  if (tier === 'big') {
    confetti({ particleCount: 140, spread: 80, origin, colors, ticks: 180 });
    return;
  }
  confetti({ particleCount: 60, spread: 55, origin, colors, ticks: 140 });
}

function formatAmount(n) {
  if (!Number.isFinite(n)) return '0.00';
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function useWinBurst() {
  const { play } = useSound();
  const reduced = useReducedMotion();
  const [badges, setBadges] = useState([]);
  const idRef = useRef(0);

  const burst = useCallback(
    ({ multiplier, amount, anchor } = {}) => {
      const tier = tierFor(multiplier);
      if (!tier) return;
      const origin = originFromAnchor(anchor);

      // Sound first — sound is never suppressed by reduced motion.
      const soundKey =
        tier === 'jackpot' ? 'win-jackpot' : tier === 'big' ? 'win-big' : 'win-small';
      play(soundKey);

      if (!reduced) {
        try {
          fireConfetti(tier, origin);
        } catch {
          /* confetti can fail under jsdom — ignore */
        }
      }

      const id = ++idRef.current;
      setBadges((prev) => [
        ...prev,
        { id, tier, multiplier: Number(multiplier) || 0, amount: Number(amount) || 0 },
      ]);
      // Auto-remove after the float animation finishes.
      window.setTimeout(() => {
        setBadges((prev) => prev.filter((b) => b.id !== id));
      }, 1200);
    },
    [play, reduced],
  );

  const WinBurstNode = useCallback(
    function WinBurstNode({ className = '' }) {
      return (
        <div
          aria-live="polite"
          className={`pointer-events-none fixed inset-x-0 top-1/3 z-50 flex justify-center ${className}`}
        >
          <AnimatePresence>
            {badges.map((b) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 12, scale: 0.9 }}
                animate={{ opacity: 1, y: -32, scale: 1 }}
                exit={{ opacity: 0, y: -64, scale: 0.95 }}
                transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
                className={[
                  'rounded-full px-5 py-2 font-heading text-2xl font-bold tracking-tight',
                  'border backdrop-blur-md shadow-glow-amber',
                  b.tier === 'jackpot'
                    ? 'bg-accent-gold/20 border-accent-gold-light text-accent-gold-light shadow-glow-jackpot'
                    : b.tier === 'big'
                    ? 'bg-lime-400/15 border-lime-400/40 text-lime-300'
                    : 'bg-accent-purple/15 border-accent-purple/40 text-accent-purple-light',
                ].join(' ')}
              >
                +${formatAmount(b.amount)}
                <span className="ml-2 text-base font-medium opacity-80">
                  &times;{Number(b.multiplier).toFixed(2)}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      );
    },
    [badges],
  );

  return { burst, WinBurst: WinBurstNode };
}

/**
 * Convenience: a standalone <WinBurst /> component that creates and renders
 * its own internal queue. Most callers should use the useWinBurst() hook so
 * they can fire bursts imperatively in response to socket events.
 */
function WinBurst() {
  const { WinBurst: Node } = useWinBurst();
  return <Node />;
}

export default WinBurst;
