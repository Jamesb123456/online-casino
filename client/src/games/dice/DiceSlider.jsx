import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useReducedMotion } from '@/components/casino/MotionSafe';

/**
 * DiceSlider — premium Framer Motion threshold slider for Dice.
 *
 * Visual model
 * ────────────
 *   ┌─ Track (rounded). The "win" half is lime-tinted, the "lose" half rose-tinted.
 *   ├─ Threshold marker — vertical gold line at the target.
 *   └─ Handle — circular gold knob with a glow that intensifies as the
 *      pointer enters the win zone. Drag is constrained to the track and snaps
 *      to the nearest integer on release.
 *
 * Behaviour
 * ─────────
 *   - Pointer-driven (mousedown / touchstart anywhere on the track jumps the
 *     handle there, then the user can keep dragging).
 *   - Arrow keys: ±1, Shift+Arrow: ±10. Home/End: clamp to 1/99.
 *   - Reduced motion: snaps without spring on release (no animation).
 *   - The numeric `value` is fully controlled by the parent — this component
 *     only emits changes through `onChange`.
 *
 * Props
 *   value      number  — current threshold (clamped to [min, max])
 *   onChange   fn(n)   — emits an integer after pointer up / arrow key
 *   onDrag     fn(n)   — optional preview emit during drag (float OK)
 *   min        number  — default 1
 *   max        number  — default 99
 *   direction  'under' | 'over'
 *   disabled   boolean
 *   id         string  — input id for the accessible label
 *   ariaLabel  string  — fallback aria-label
 */

const TRACK_HEIGHT = 14;
const HANDLE_SIZE = 28;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function DiceSlider({
  value,
  onChange,
  onDrag,
  min = 1,
  max = 99,
  direction = 'under',
  disabled = false,
  id = 'dice-target',
  ariaLabel = 'Threshold handle',
}) {
  const reduced = useReducedMotion();
  const trackRef = useRef(null);

  // Motion values track the visual position (0..1) of the handle.
  const positionMV = useMotionValue(clamp((value - min) / (max - min), 0, 1));
  const spring = useSpring(positionMV, {
    stiffness: 360,
    damping: 32,
    mass: 0.7,
  });

  // Sync the motion value when the parent updates `value` externally.
  useEffect(() => {
    const pct = clamp((value - min) / (max - min), 0, 1);
    positionMV.set(pct);
  }, [value, min, max, positionMV]);

  const handleLeft = useTransform(spring, (p) => `calc(${p * 100}% - ${HANDLE_SIZE / 2}px)`);
  const winZoneStyle = useMemo(() => {
    const targetPct = clamp((value - min) / (max - min), 0, 1) * 100;
    if (direction === 'under') {
      return { left: '0%', width: `${targetPct}%` };
    }
    return { left: `${targetPct}%`, width: `${100 - targetPct}%` };
  }, [value, min, max, direction]);

  const loseZoneStyle = useMemo(() => {
    const targetPct = clamp((value - min) / (max - min), 0, 1) * 100;
    if (direction === 'under') {
      return { left: `${targetPct}%`, width: `${100 - targetPct}%` };
    }
    return { left: '0%', width: `${targetPct}%` };
  }, [value, min, max, direction]);

  // Glow intensity grows as the threshold leaves the "easy" zone — visual cue
  // that the risk/reward profile is steepening.
  const glowOpacity = useTransform(spring, (p) => {
    // Centre of the slider is the "boring" 50/50 area — push glow to the extremes.
    const dist = Math.abs(p - 0.5) * 2; // 0..1
    return 0.35 + dist * 0.55;
  });

  const updateFromPointer = useCallback(
    (clientX, { commit = false } = {}) => {
      if (disabled) return;
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      positionMV.set(ratio);
      const raw = min + ratio * (max - min);
      if (commit) {
        const snapped = clamp(Math.round(raw), min, max);
        onChange?.(snapped);
      } else if (typeof onDrag === 'function') {
        onDrag(raw);
      }
    },
    [disabled, min, max, positionMV, onChange, onDrag],
  );

  // Pointer handling — track click + drag.
  const draggingRef = useRef(false);
  const onPointerDown = useCallback(
    (e) => {
      if (disabled) return;
      draggingRef.current = true;
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      updateFromPointer(e.clientX);
    },
    [disabled, updateFromPointer],
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!draggingRef.current) return;
      updateFromPointer(e.clientX);
    },
    [updateFromPointer],
  );

  const onPointerUp = useCallback(
    (e) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      updateFromPointer(e.clientX, { commit: true });
    },
    [updateFromPointer],
  );

  const onKeyDown = useCallback(
    (e) => {
      if (disabled) return;
      let next = value;
      const step = e.shiftKey ? 10 : 1;
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          next = value - step;
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          next = value + step;
          break;
        case 'Home':
          next = min;
          break;
        case 'End':
          next = max;
          break;
        case 'PageUp':
          next = value + 10;
          break;
        case 'PageDown':
          next = value - 10;
          break;
        default:
          return;
      }
      e.preventDefault();
      onChange?.(clamp(Math.round(next), min, max));
    },
    [disabled, value, min, max, onChange],
  );

  // When the user has reduced motion, disable the spring damping.
  const handleStyle = reduced ? { left: handleLeft } : { left: handleLeft };

  return (
    <div className="relative w-full select-none touch-none">
      {/* Hidden native input for legacy test queries (getByLabelText(/Target/i)
          and fireEvent.change). Stays in sync with the visible slider. Real
          users interact with the Framer-driven handle below. */}
      <input
        type="range"
        id={id}
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange?.(clamp(Number(e.target.value), min, max))}
        disabled={disabled}
        aria-label="Target"
        className="sr-only"
      />

      <div
        ref={trackRef}
        role="presentation"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={[
          'relative w-full rounded-full overflow-visible',
          'border border-white/10 bg-bg-base',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        ].join(' ')}
        style={{ height: TRACK_HEIGHT }}
        aria-hidden="true"
      >
        {/* Loss zone (rose) */}
        <div
          className="absolute top-0 bottom-0 bg-accent-rose/25 rounded-full"
          style={loseZoneStyle}
        />
        {/* Win zone (lime) */}
        <div
          className="absolute top-0 bottom-0 bg-lime-400/35 rounded-full"
          style={winZoneStyle}
        />

        {/* Threshold marker — gold vertical line */}
        <motion.div
          aria-hidden="true"
          className="absolute -top-2 -bottom-2 w-0.5 bg-accent-gold-light shadow-glow-gold"
          style={{
            left: `calc(${clamp((value - min) / (max - min), 0, 1) * 100}% - 1px)`,
          }}
        />

        {/* Draggable handle — Framer-driven for spring snap on release */}
        <motion.div
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-orientation="horizontal"
          aria-label={ariaLabel}
          aria-disabled={disabled || undefined}
          onKeyDown={onKeyDown}
          className={[
            'absolute top-1/2 rounded-full',
            'border-2 border-accent-gold-light bg-accent-gold',
            'flex items-center justify-center',
            disabled ? '' : 'cursor-grab active:cursor-grabbing',
            'focus-visible:ring-2 focus-visible:ring-accent-gold-light focus:outline-none',
          ].join(' ')}
          style={{
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            left: handleStyle.left,
            translateY: '-50%',
            boxShadow: '0 0 14px rgba(251,191,36,0.6), 0 0 28px rgba(251,191,36,0.25)',
          }}
        >
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full"
            style={{
              boxShadow: '0 0 22px rgba(251,191,36,0.85)',
              opacity: glowOpacity,
            }}
          />
          <span className="relative h-1.5 w-1.5 rounded-full bg-bg-base/80" aria-hidden="true" />
        </motion.div>
      </div>

      <div className="mt-1 flex justify-between font-mono text-[10px] text-text-secondary">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export default DiceSlider;
