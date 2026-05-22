import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiNavigation } from 'react-icons/fi';
import gsap from 'gsap';
import { useReducedMotion } from '@/components/casino/MotionSafe';
import AnimatedNumber from '@/components/casino/AnimatedNumber';

/**
 * CrashCurve — SVG curve renderer for the Crash multiplier graph.
 *
 * Shape: y = (multiplier - 1) on a normalized 0..1 path inside an SVG viewBox.
 * The curve is built per-frame from a fixed set of sample points; only the
 * `d` attribute mutates, which is cheap for the browser to repaint.
 *
 * Why SVG over Canvas: discrete element with crisp DPR-independent strokes,
 * easy to overlay a DOM rocket + animate trail particles via framer-motion.
 *
 * Props:
 *   phase          'connecting' | 'waiting' | 'running' | 'crashed'
 *   multiplier     current x (number, ≥ 1)
 *   crashPoint     final x when crashed (or null)
 *   countdown      seconds remaining in waiting phase
 *   accentColor    optional override; defaults derived from phase
 */

const VIEW_W = 1000;
const VIEW_H = 520;
const PAD_L = 56;
const PAD_R = 32;
const PAD_T = 56;
const PAD_B = 56;

const PLOT_W = VIEW_W - PAD_L - PAD_R;
const PLOT_H = VIEW_H - PAD_T - PAD_B;

const SAMPLES = 80;
const TRAIL_MAX = 12;
const TRAIL_INTERVAL_MS = 60;

function colorFor(m) {
  if (m < 1.5) return '#FBBF24'; // amber
  if (m < 2) return '#F59E0B';
  if (m < 5) return '#A3E635'; // lime
  if (m < 10) return '#84CC16';
  if (m < 25) return '#7C3AED'; // violet
  return '#F43F5E'; // rose
}

function buildPath(currentMultiplier) {
  const m = Math.max(1, currentMultiplier);
  // Normalised x along the plot — we let "time" map directly to plot width.
  // We render the entire curve from x=1 (origin) to x=m (current tip), then
  // pad to right-edge by capping at the visible window which scrolls with x.
  // To keep the tip on-screen with breathing room, scale x to a window that
  // grows as m grows: maxX = max(m, 2) so early game shows headroom.
  const maxX = Math.max(m, 2);
  const maxY = Math.max(m, 2);

  let d = `M ${PAD_L} ${PAD_T + PLOT_H}`;
  for (let i = 1; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const xVal = 1 + (maxX - 1) * t;
    if (xVal > m) break;
    // Curve "speed": y grows like (x-1)^k. k=1.6 gives a nice rising curve.
    const yVal = Math.pow(xVal - 1, 1.6);
    const px = PAD_L + ((xVal - 1) / Math.max(0.0001, maxX - 1)) * PLOT_W;
    const py = PAD_T + PLOT_H - (yVal / Math.max(0.0001, Math.pow(maxY - 1, 1.6))) * PLOT_H;
    d += ` L ${px.toFixed(2)} ${py.toFixed(2)}`;
  }
  // tip
  const tipX = PAD_L + ((m - 1) / Math.max(0.0001, maxX - 1)) * PLOT_W;
  const tipY = PAD_T + PLOT_H - (Math.pow(m - 1, 1.6) / Math.max(0.0001, Math.pow(maxY - 1, 1.6))) * PLOT_H;
  d += ` L ${tipX.toFixed(2)} ${tipY.toFixed(2)}`;
  return { d, tipX, tipY };
}

function formatMultiplier(m) {
  return `${Number(m).toFixed(2)}x`;
}

function CrashCurve({
  phase,
  multiplier,
  crashPoint,
  countdown,
}) {
  const reduced = useReducedMotion();
  const pathRef = useRef(null);
  const fillRef = useRef(null);
  const rocketRef = useRef(null);
  const stateRef = useRef({ m: 1, tipX: PAD_L, tipY: PAD_T + PLOT_H });
  const lastTrailRef = useRef(0);
  const [trail, setTrail] = useState([]);
  const trailIdRef = useRef(0);

  const isAnimating = phase === 'running';
  const displayMultiplier = phase === 'crashed' && typeof crashPoint === 'number' ? crashPoint : multiplier;

  // Target multiplier ref — updated by props; ticker reads it.
  const targetRef = useRef(displayMultiplier);
  useEffect(() => {
    targetRef.current = displayMultiplier;
  }, [displayMultiplier]);

  // GSAP ticker — interpolates smoothly between socket multiplier updates so
  // the curve doesn't jitter at the network rate. Suspended in reduced motion.
  useEffect(() => {
    if (!isAnimating || reduced) {
      // Single-shot render for non-running phases.
      const { d, tipX, tipY } = buildPath(targetRef.current);
      stateRef.current = { m: targetRef.current, tipX, tipY };
      if (pathRef.current) pathRef.current.setAttribute('d', d);
      if (fillRef.current) {
        fillRef.current.setAttribute(
          'd',
          `${d} L ${tipX.toFixed(2)} ${PAD_T + PLOT_H} L ${PAD_L} ${PAD_T + PLOT_H} Z`,
        );
      }
      if (rocketRef.current) {
        rocketRef.current.style.transform = `translate(${tipX}px, ${tipY}px)`;
      }
      return undefined;
    }

    const tick = () => {
      const target = targetRef.current;
      // Smooth approach to socket value (frame-rate-independent ease).
      const dt = gsap.ticker.deltaRatio(60); // ~1 at 60fps
      const ease = 1 - Math.pow(1 - 0.18, dt);
      const next = stateRef.current.m + (target - stateRef.current.m) * ease;
      const { d, tipX, tipY } = buildPath(next);
      stateRef.current = { m: next, tipX, tipY };

      if (pathRef.current) pathRef.current.setAttribute('d', d);
      if (fillRef.current) {
        fillRef.current.setAttribute(
          'd',
          `${d} L ${tipX.toFixed(2)} ${PAD_T + PLOT_H} L ${PAD_L} ${PAD_T + PLOT_H} Z`,
        );
      }
      if (rocketRef.current) {
        rocketRef.current.style.transform = `translate(${tipX}px, ${tipY}px)`;
      }

      // Emit a trail dot at fixed cadence.
      const now = performance.now();
      if (now - lastTrailRef.current > TRAIL_INTERVAL_MS) {
        lastTrailRef.current = now;
        const id = ++trailIdRef.current;
        setTrail((prev) => {
          const next2 = [...prev, { id, x: tipX, y: tipY }];
          return next2.length > TRAIL_MAX ? next2.slice(-TRAIL_MAX) : next2;
        });
      }
    };

    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [isAnimating, reduced]);

  // Clear trail when phase resets to waiting.
  useEffect(() => {
    if (phase === 'waiting' || phase === 'connecting') {
      setTrail([]);
      stateRef.current = { m: 1, tipX: PAD_L, tipY: PAD_T + PLOT_H };
      targetRef.current = 1;
    }
  }, [phase]);

  const stroke = useMemo(() => {
    if (phase === 'crashed') return '#F43F5E';
    return colorFor(displayMultiplier);
  }, [phase, displayMultiplier]);

  return (
    <div className="relative w-full" style={{ aspectRatio: '1000 / 520' }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="crash-curve-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
          <filter id="crash-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* grid */}
        <g stroke="rgba(255,255,255,0.05)" strokeWidth="1">
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} />
          <line x1={PAD_L} y1={PAD_T + PLOT_H} x2={PAD_L + PLOT_W} y2={PAD_T + PLOT_H} />
        </g>

        {/* curve fill */}
        <path ref={fillRef} d="" fill="url(#crash-curve-fill)" />
        {/* curve stroke */}
        <path
          ref={pathRef}
          d=""
          fill="none"
          stroke={stroke}
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#crash-glow)"
        />

        {/* trail particles — DOM elements would clip to SVG bounds awkwardly, so
            we use circle nodes inside the SVG instead, fading via opacity. */}
        <AnimatePresence>
          {!reduced && isAnimating
            ? trail.map((t, i) => (
                <motion.circle
                  key={t.id}
                  cx={t.x}
                  cy={t.y}
                  r={4}
                  fill={stroke}
                  initial={{ opacity: 0.7, scale: 1 }}
                  animate={{ opacity: 0, scale: 0.4 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.005 }}
                />
              ))
            : null}
        </AnimatePresence>
      </svg>

      {/* Rocket icon — positioned as a DOM element over the SVG. */}
      {phase === 'running' || phase === 'crashed' ? (
        <div
          ref={rocketRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0"
          style={{
            transform: `translate(${stateRef.current.tipX}px, ${stateRef.current.tipY}px)`,
            // Scale rocket to the responsive viewBox: we use a CSS calc trick
            // by placing the icon at logical coords and letting the SVG-sized
            // container percentage-scale via aspect-ratio.
            width: 0,
            height: 0,
          }}
        >
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ color: stroke, filter: `drop-shadow(0 0 8px ${stroke})` }}
          >
            <FiNavigation
              aria-hidden="true"
              className="-rotate-45"
              size={28}
            />
          </div>
        </div>
      ) : null}

      {/* Centered multiplier overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {phase === 'connecting' ? (
          <span className="font-heading text-xl text-text-secondary">Connecting…</span>
        ) : phase === 'waiting' ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-xs uppercase tracking-[0.3em] text-text-secondary">Next round</span>
            <span className="font-heading text-5xl font-bold tabular-nums text-accent-gold-light">
              {countdown > 0 ? `${countdown}s` : 'Place bets'}
            </span>
          </div>
        ) : (
          <div
            className={[
              'font-heading text-7xl font-bold tabular-nums tracking-tight transition-colors duration-150',
              phase === 'crashed' ? 'text-accent-rose' : '',
            ].join(' ')}
            style={phase === 'running' ? { color: stroke, textShadow: `0 0 32px ${stroke}66` } : undefined}
          >
            <AnimatedNumber
              value={Number(displayMultiplier) || 1}
              duration={0.2}
              format={formatMultiplier}
            />
          </div>
        )}
        {phase === 'crashed' ? (
          <span className="mt-2 text-sm uppercase tracking-[0.3em] text-accent-rose/90">
            Crashed
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default CrashCurve;
