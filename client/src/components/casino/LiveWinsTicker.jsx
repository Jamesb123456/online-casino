import React, { useMemo } from 'react';

/**
 * LiveWinsTicker — horizontal marquee of recent wins.
 *
 * Props:
 *   items   Array<{ id, username, game, amount, multiplier }>
 *   speed   seconds for one full loop (default 40)
 *
 * Implementation: duplicates the items inline and scrolls the container with a
 * CSS keyframe animation — no JS RAF loop, no layout thrash. Pauses on hover.
 *
 * Visual: each pill is a small dot in the game's accent colour + "username won
 * $X (Yx) on Game". Accent colour resolves from a small per-game palette.
 */

const GAME_ACCENT = {
  crash: 'bg-red-400',
  plinko: 'bg-violet-400',
  wheel: 'bg-amber-400',
  roulette: 'bg-emerald-400',
  blackjack: 'bg-blue-400',
  landmines: 'bg-orange-400',
  slots: 'bg-pink-400',
  dice: 'bg-cyan-400',
};

function accentFor(game) {
  if (!game) return 'bg-accent-purple-light';
  const key = String(game).toLowerCase();
  return GAME_ACCENT[key] || 'bg-accent-purple-light';
}

function formatAmount(n) {
  if (!Number.isFinite(n)) return '0.00';
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Pill({ item }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white/5 px-3 py-1.5 text-sm text-text-secondary ring-1 ring-white/10">
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${accentFor(item.game)} shadow-[0_0_8px_currentColor]`}
      />
      <span className="font-medium text-text-primary">{item.username || 'Anon'}</span>
      <span className="opacity-70">won</span>
      <span className="font-semibold text-accent-gold-light">${formatAmount(item.amount)}</span>
      {Number.isFinite(Number(item.multiplier)) && Number(item.multiplier) > 0 ? (
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-lime-300">
          &times;{Number(item.multiplier).toFixed(2)}
        </span>
      ) : null}
      <span className="opacity-50">on</span>
      <span className="capitalize text-text-primary/80">{item.game || 'casino'}</span>
    </span>
  );
}

function LiveWinsTicker({ items = [], speed = 40, className = '' }) {
  const safeItems = useMemo(
    () => (Array.isArray(items) ? items.filter(Boolean) : []),
    [items],
  );

  if (safeItems.length === 0) {
    return (
      <div
        className={`group relative overflow-hidden rounded-full border border-white/5 bg-bg-card/50 px-4 py-2 text-sm text-text-muted ${className}`}
        role="status"
        aria-live="polite"
      >
        Waiting for the next big win...
      </div>
    );
  }

  // Duplicate items so the marquee loops seamlessly.
  const loop = [...safeItems, ...safeItems];

  return (
    <div
      className={`group relative overflow-hidden rounded-full border border-white/5 bg-bg-card/50 ${className}`}
      role="region"
      aria-label="Live wins ticker"
    >
      <div
        className="flex gap-3 py-2 pr-3 will-change-transform group-hover:[animation-play-state:paused] motion-reduce:[animation-play-state:paused]"
        style={{
          animation: `pcTickerScroll ${Math.max(10, speed)}s linear infinite`,
          width: 'max-content',
        }}
      >
        {loop.map((item, idx) => (
          <Pill key={`${item.id ?? 'pill'}-${idx}`} item={item} />
        ))}
      </div>
      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-bg-base to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-bg-base to-transparent" />
      <style>{`
        @keyframes pcTickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

export default LiveWinsTicker;
