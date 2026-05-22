import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { LuHeart, LuDiamond, LuSpade, LuClub } from 'react-icons/lu';
import { useReducedMotion } from '../../components/casino/MotionSafe';

/**
 * Card — single playing card with Framer Motion deal + flip animation.
 *
 * Cards begin face-down at a deck origin (top-right of the table). On mount
 * they translate to their hand slot with a small stagger delay, then flip
 * 180° on the Y axis to reveal the face. Reduced-motion users get an
 * instant, non-flipping render.
 *
 * Props
 *   rank           string  — '2'..'10' | 'J' | 'Q' | 'K' | 'A'
 *   suit           string  — 'hearts' | 'diamonds' | 'clubs' | 'spades'
 *   index          number  — card position in hand (drives stagger delay)
 *   faceDown       boolean — when true, do not flip to reveal
 *   size           'sm' | 'md' — render size; default 'md'
 *   ariaLabel      string  — accessible label (defaults to rank + suit)
 */

// Lucide-style suit glyphs from react-icons (react-icons/fa lacks Spade/Club).
const SUIT_ICON = {
  hearts: LuHeart,
  diamonds: LuDiamond,
  clubs: LuClub,
  spades: LuSpade,
};

const SUIT_COLOR = {
  hearts: 'text-rose-500',
  diamonds: 'text-rose-500',
  clubs: 'text-neutral-900',
  spades: 'text-neutral-900',
};

const RANK_NAME = { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack' };

function describeCard(rank, suit) {
  if (!rank || !suit) return 'a card';
  const r = RANK_NAME[rank] || rank;
  return `${r} of ${String(suit).toLowerCase()}`;
}

function CardCorner({ rank, SuitIcon, color, rotated = false }) {
  return (
    <div
      className={[
        'flex flex-col items-center leading-none',
        color,
        rotated ? 'rotate-180' : '',
      ].join(' ')}
      aria-hidden="true"
    >
      <span className="font-heading text-sm font-bold sm:text-base">{rank}</span>
      <SuitIcon className="text-[10px] sm:text-xs" />
    </div>
  );
}

function CardFace({ rank, suit }) {
  const SuitIcon = SUIT_ICON[suit] || LuSpade;
  const color = SUIT_COLOR[suit] || 'text-neutral-900';
  return (
    <div
      className="absolute inset-0 flex flex-col justify-between rounded-lg bg-white p-1.5 shadow-md sm:p-2"
      style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
    >
      {/* Faux-foil ridge */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg"
        style={{
          background:
            'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.55) 50%, transparent 65%)',
          mixBlendMode: 'overlay',
        }}
      />
      <div className="flex items-start justify-between">
        <CardCorner rank={rank} SuitIcon={SuitIcon} color={color} />
      </div>
      <div className={`flex flex-1 items-center justify-center ${color}`}>
        <SuitIcon className="text-3xl sm:text-4xl" aria-hidden="true" />
      </div>
      <div className="flex items-end justify-end">
        <CardCorner rank={rank} SuitIcon={SuitIcon} color={color} rotated />
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-lg border border-accent-purple/40 shadow-md"
      style={{
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: 'rotateY(180deg)',
        backgroundImage:
          'repeating-linear-gradient(45deg, #2e1065 0, #2e1065 4px, #4c1d95 4px, #4c1d95 8px)',
      }}
      aria-hidden="true"
    >
      <div className="rounded-md border border-accent-gold/40 px-2 py-1 font-heading text-[10px] tracking-widest text-accent-gold-light sm:text-xs">
        PC
      </div>
    </div>
  );
}

const SIZE_CLASS = {
  sm: 'h-20 w-14 sm:h-24 sm:w-16',
  md: 'h-24 w-16 sm:h-32 sm:w-24',
};

function Card({
  rank,
  suit,
  index = 0,
  faceDown = false,
  size = 'md',
  ariaLabel,
}) {
  const reduced = useReducedMotion();
  const label = ariaLabel || (faceDown ? 'Face-down card' : describeCard(rank, suit));

  // Reveal target: face-down = 180 (back facing camera), face-up = 0.
  const rotateY = faceDown ? 180 : 0;

  const dealDelay = useMemo(() => Math.min(0.9, index * 0.15), [index]);
  const flipDelay = useMemo(() => dealDelay + 0.25, [dealDelay]);

  const initial = reduced
    ? { opacity: 1, x: 0, y: 0, rotateY }
    : { opacity: 0, x: 200, y: -140, rotateY: 180 };

  const animate = { opacity: 1, x: 0, y: 0, rotateY };

  const transition = reduced
    ? { duration: 0 }
    : {
        x: { duration: 0.4, delay: dealDelay, ease: [0.22, 1, 0.36, 1] },
        y: { duration: 0.4, delay: dealDelay, ease: [0.22, 1, 0.36, 1] },
        opacity: { duration: 0.2, delay: dealDelay },
        rotateY: {
          duration: 0.4,
          delay: faceDown ? 0 : flipDelay,
          ease: [0.22, 1, 0.36, 1],
        },
      };

  return (
    <motion.div
      className={[
        'relative shrink-0 select-none',
        SIZE_CLASS[size] || SIZE_CLASS.md,
      ].join(' ')}
      style={{ perspective: 800, transformStyle: 'preserve-3d' }}
      role="img"
      aria-label={label}
      initial={initial}
      animate={animate}
      transition={transition}
    >
      <CardFace rank={rank} suit={suit} />
      <CardBack />
    </motion.div>
  );
}

export default Card;
