import React, { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { useReducedMotion } from '@/components/casino/MotionSafe';

/**
 * DiceBoard — premium roll visualisation for Dice.
 *
 * Layout
 * ──────
 *   ┌─ Two CSS-3D cubes that spin during a roll then snap to a face.
 *   ├─ Result digit (AnimatedNumber) fades in beside the dice.
 *   └─ A subtle range bar below shows the win zone + target + last result.
 *
 * Animation
 * ─────────
 *   We don't run the cubes off the actual server-result digit — dice show
 *   pip-faces 1..6 and the game result is a 0.00..99.99 float. Instead, while
 *   `isRolling` is true we spin the cubes; when a result arrives we ease the
 *   cubes to a final face that maps from the result tens / units digits.
 *   Pure decorative — the truth is the floating-point number to the right.
 *
 *   GSAP timeline is torn down on unmount + on every new roll so the cubes
 *   never get into a "wandering forever" state.
 *
 * Props
 *   isRolling   boolean
 *   result      number | null — server roll result (0.00..99.99)
 *   target      number
 *   direction   'under' | 'over'
 *   win         boolean | null
 *   pulseKey    number — bumping this re-triggers the result fade-in animation
 */

const CUBE_SIZE = 72;
const HALF = CUBE_SIZE / 2;

// Each face: (rotation around X, rotation around Y, label)
const FACES = [
  { rx: 0, ry: 0, pips: 1 },
  { rx: 0, ry: 90, pips: 6 },
  { rx: 0, ry: 180, pips: 5 },
  { rx: 0, ry: -90, pips: 2 },
  { rx: 90, ry: 0, pips: 3 },
  { rx: -90, ry: 0, pips: 4 },
];

// Pip layouts for face values 1..6 — 3x3 grid positions.
const PIP_LAYOUT = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function faceFromDigit(d) {
  // Map digit 0..9 to a dice face 1..6 — bucketise so big digits show bigger
  // faces. Purely cosmetic.
  if (d <= 1) return 1;
  if (d <= 3) return 2;
  if (d <= 4) return 3;
  if (d <= 6) return 4;
  if (d <= 8) return 5;
  return 6;
}

function rotationForFace(pipCount) {
  const f = FACES.find((face) => face.pips === pipCount) || FACES[0];
  return { rx: f.rx, ry: f.ry };
}

function Pip({ row, col }) {
  return (
    <span
      aria-hidden="true"
      className="absolute h-2 w-2 rounded-full bg-text-primary shadow-[0_0_4px_rgba(255,255,255,0.4)]"
      style={{
        top: `calc(${(row / 2) * 100}% - 4px)`,
        left: `calc(${(col / 2) * 100}% - 4px)`,
        transform: `translate(${row === 0 ? 6 : row === 2 ? -6 : 0}px, ${
          col === 0 ? 6 : col === 2 ? -6 : 0
        }px)`,
      }}
    />
  );
}

function Face({ pips, transform, tone }) {
  return (
    <div
      aria-hidden="true"
      className={[
        'absolute inset-0 rounded-lg border',
        'flex items-center justify-center',
        tone === 'gold'
          ? 'bg-gradient-to-br from-accent-gold to-accent-gold-dark border-accent-gold-light/60'
          : 'bg-gradient-to-br from-teal-500 to-teal-700 border-teal-300/40',
      ].join(' ')}
      style={{
        transform,
        backfaceVisibility: 'hidden',
        boxShadow: 'inset 0 0 12px rgba(0,0,0,0.35)',
      }}
    >
      <div className="relative h-full w-full p-2">
        {(PIP_LAYOUT[pips] || []).map(([r, c]) => (
          <Pip key={`${r}-${c}`} row={r} col={c} />
        ))}
      </div>
    </div>
  );
}

function Cube({ cubeRef, tone }) {
  const faceTransforms = useMemo(
    () => [
      `rotateY(0deg) translateZ(${HALF}px)`,
      `rotateY(90deg) translateZ(${HALF}px)`,
      `rotateY(180deg) translateZ(${HALF}px)`,
      `rotateY(-90deg) translateZ(${HALF}px)`,
      `rotateX(90deg) translateZ(${HALF}px)`,
      `rotateX(-90deg) translateZ(${HALF}px)`,
    ],
    [],
  );

  return (
    <div
      style={{
        width: CUBE_SIZE,
        height: CUBE_SIZE,
        perspective: 600,
      }}
      className="relative"
    >
      <div
        ref={cubeRef}
        className="relative h-full w-full"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {FACES.map((f, i) => (
          <Face key={f.pips} pips={f.pips} transform={faceTransforms[i]} tone={tone} />
        ))}
      </div>
    </div>
  );
}

function DiceBoard({
  isRolling = false,
  result = null,
  target,
  direction = 'under',
  win = null,
  pulseKey = 0,
}) {
  const reduced = useReducedMotion();
  const cubeARef = useRef(null);
  const cubeBRef = useRef(null);
  const tlRef = useRef(null);

  // Spin while rolling.
  useEffect(() => {
    if (reduced) return undefined;
    if (!isRolling) return undefined;
    const a = cubeARef.current;
    const b = cubeBRef.current;
    if (!a || !b) return undefined;

    // Kill any prior timeline before starting a new one.
    if (tlRef.current) {
      tlRef.current.kill();
      tlRef.current = null;
    }

    const tl = gsap.timeline({ repeat: -1 });
    tl.to(
      a,
      {
        rotateX: '+=720',
        rotateY: '+=540',
        duration: 0.9,
        ease: 'none',
      },
      0,
    );
    tl.to(
      b,
      {
        rotateX: '+=540',
        rotateY: '+=720',
        duration: 0.9,
        ease: 'none',
      },
      0,
    );
    tlRef.current = tl;

    return () => {
      if (tlRef.current) {
        tlRef.current.kill();
        tlRef.current = null;
      }
    };
  }, [isRolling, reduced]);

  // Snap to result face when result lands.
  useEffect(() => {
    if (reduced) return;
    if (isRolling) return;
    if (result == null) return;
    const a = cubeARef.current;
    const b = cubeBRef.current;
    if (!a || !b) return;

    if (tlRef.current) {
      tlRef.current.kill();
      tlRef.current = null;
    }

    // Decorative: split the result into two "digits" and map each onto a face.
    const tens = Math.min(9, Math.floor(Math.max(0, result) / 10));
    const units = Math.min(9, Math.floor(Math.max(0, result) % 10));
    const faceA = rotationForFace(faceFromDigit(tens));
    const faceB = rotationForFace(faceFromDigit(units));

    const settle = gsap.timeline();
    settle.to(
      a,
      {
        rotateX: faceA.rx + 720,
        rotateY: faceA.ry + 540,
        duration: 0.6,
        ease: 'power3.out',
      },
      0,
    );
    settle.to(
      b,
      {
        rotateX: faceB.rx + 540,
        rotateY: faceB.ry + 720,
        duration: 0.6,
        ease: 'power3.out',
      },
      0,
    );
    tlRef.current = settle;

    return () => {
      if (tlRef.current) {
        tlRef.current.kill();
        tlRef.current = null;
      }
    };
  }, [result, isRolling, reduced]);

  // Hard teardown on unmount.
  useEffect(
    () => () => {
      if (tlRef.current) {
        tlRef.current.kill();
        tlRef.current = null;
      }
    },
    [],
  );

  const resultColor = win === null
    ? 'text-text-primary'
    : win
      ? 'text-lime-300'
      : 'text-accent-rose';

  const resultDisplay = useMemo(() => {
    if (typeof result !== 'number' || !Number.isFinite(result)) return null;
    return result;
  }, [result]);

  return (
    <div className="relative w-full">
      <div className="flex flex-col items-center justify-center gap-6 py-6 lg:py-10">
        <div className="text-[11px] uppercase tracking-[0.2em] text-text-secondary">
          Roll result
        </div>

        <div className="flex items-center justify-center gap-8">
          <Cube cubeRef={cubeARef} tone="teal" />
          <Cube cubeRef={cubeBRef} tone="gold" />
        </div>

        <div
          key={pulseKey}
          data-testid="dice-result"
          aria-live="polite"
          className={[
            'font-heading text-5xl lg:text-6xl font-bold tabular-nums',
            resultColor,
            resultDisplay != null && !reduced ? 'animate-[fadeIn_0.4s_ease-out]' : '',
          ].join(' ')}
        >
          {resultDisplay != null ? resultDisplay.toFixed(2) : '--'}
        </div>

        <DiceRangeBar target={target} direction={direction} result={result} win={win} />
      </div>
    </div>
  );
}

function DiceRangeBar({ target, direction, result, win }) {
  const targetPct = `${Math.max(0, Math.min(100, target))}%`;
  const resultPct = typeof result === 'number'
    ? `${Math.max(0, Math.min(100, result))}%`
    : null;

  const winZoneStyle = direction === 'under'
    ? { left: '0%', right: `${100 - target}%` }
    : { left: `${target}%`, right: '0%' };

  return (
    <div className="w-full max-w-lg">
      <div
        className="relative h-3 rounded-full bg-bg-base border border-white/10 overflow-visible"
        aria-hidden="true"
      >
        <div
          className="absolute top-0 bottom-0 bg-lime-400/30 rounded-full"
          style={winZoneStyle}
        />
        {/* target marker */}
        <div
          className="absolute -top-1 -bottom-1 w-0.5 bg-accent-gold-light shadow-glow-gold"
          style={{ left: targetPct, transform: 'translateX(-50%)' }}
        />
        {/* result marker */}
        {resultPct ? (
          <div
            className={[
              'absolute -top-2 -bottom-2 w-1 rounded-full',
              win ? 'bg-lime-300' : 'bg-accent-rose',
            ].join(' ')}
            style={{ left: resultPct, transform: 'translateX(-50%)' }}
          />
        ) : null}
      </div>
      <div className="flex justify-between text-[10px] text-text-secondary mt-1 font-mono tabular-nums">
        <span>0.00</span>
        <span>Target {Number(target).toFixed(2)}</span>
        <span>99.99</span>
      </div>
    </div>
  );
}

export default DiceBoard;
