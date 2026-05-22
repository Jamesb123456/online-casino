import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiSearch,
  FiPlay,
  FiZap,
} from 'react-icons/fi';
import MainLayout from '../layouts/MainLayout';

/**
 * Game registry — single source of truth for the lobby.
 * Each entry carries display copy + a per-game `accent` token (mapped to the
 * design-system `--color-game-*` palette) + a `category` for filter chips.
 */
const games = [
  {
    id: 'crash',
    name: 'Crash',
    tagline: 'Ride the rocket, cash out before the bust.',
    description:
      "Watch the multiplier increase until it crashes. Cash out before it's too late!",
    category: 'original',
    accent: '--color-game-crash',
    accentText: 'text-game-crash',
    accentBorder: 'border-game-crash/40',
    accentGlow: 'shadow-[0_0_40px_rgba(239,68,68,0.20)]',
    bg: 'bg-gradient-to-br from-game-crash/30 via-bg-card to-bg-card',
  },
  {
    id: 'plinko',
    name: 'Plinko',
    tagline: 'Drop. Bounce. Glow.',
    description:
      'Drop the ball and watch it bounce through pins to determine your payout.',
    category: 'original',
    accent: '--color-game-plinko',
    accentText: 'text-game-plinko',
    accentBorder: 'border-game-plinko/40',
    accentGlow: 'shadow-[0_0_40px_rgba(139,92,246,0.20)]',
    bg: 'bg-gradient-to-br from-game-plinko/30 via-bg-card to-bg-card',
  },
  {
    id: 'wheel',
    name: 'Wheel',
    tagline: 'One spin. Pure adrenaline.',
    description: 'Spin the wheel and win based on where it stops!',
    category: 'original',
    accent: '--color-game-wheel',
    accentText: 'text-game-wheel',
    accentBorder: 'border-game-wheel/40',
    accentGlow: 'shadow-[0_0_40px_rgba(245,158,11,0.22)]',
    bg: 'bg-gradient-to-br from-game-wheel/30 via-bg-card to-bg-card',
  },
  {
    id: 'roulette',
    name: 'Roulette',
    tagline: 'Felt, chips, and the spinning wheel.',
    description: 'Classic casino roulette with multiple betting options.',
    category: 'table',
    accent: '--color-game-roulette',
    accentText: 'text-game-roulette',
    accentBorder: 'border-game-roulette/40',
    accentGlow: 'shadow-[0_0_40px_rgba(16,185,129,0.20)]',
    bg: 'bg-gradient-to-br from-game-roulette/30 via-bg-card to-bg-card',
  },
  {
    id: 'blackjack',
    name: 'Blackjack',
    tagline: 'Twenty-one, or bust.',
    description: 'Beat the dealer by getting closer to 21 without going over.',
    category: 'table',
    accent: '--color-game-blackjack',
    accentText: 'text-game-blackjack',
    accentBorder: 'border-game-blackjack/40',
    accentGlow: 'shadow-[0_0_40px_rgba(59,130,246,0.20)]',
    bg: 'bg-gradient-to-br from-game-blackjack/30 via-bg-card to-bg-card',
  },
  {
    id: 'landmines',
    name: 'Landmines',
    tagline: 'Find the gems. Avoid the boom.',
    description:
      'Find diamonds and avoid mines for increasing rewards. Cash out anytime!',
    category: 'original',
    accent: '--color-game-landmines',
    accentText: 'text-game-landmines',
    accentBorder: 'border-game-landmines/40',
    accentGlow: 'shadow-[0_0_40px_rgba(249,115,42,0.22)]',
    bg: 'bg-gradient-to-br from-game-landmines/30 via-bg-card to-bg-card',
  },
  {
    id: 'dice',
    name: 'Dice',
    tagline: 'Slide. Roll. Win.',
    description: 'Pick your threshold, choose over or under, roll the dice.',
    category: 'original',
    accent: '--color-game-dice',
    accentText: 'text-game-dice',
    accentBorder: 'border-game-dice/40',
    accentGlow: 'shadow-[0_0_40px_rgba(20,184,166,0.22)]',
    bg: 'bg-gradient-to-br from-game-dice/30 via-bg-card to-bg-card',
  },
  {
    id: 'slots',
    name: 'Slots',
    tagline: 'Spin the reels. Chase the jackpot.',
    description: 'Five reels, five paylines, classic slot-machine thrills.',
    category: 'slot',
    accent: '--color-game-slots',
    accentText: 'text-game-slots',
    accentBorder: 'border-game-slots/40',
    accentGlow: 'shadow-[0_0_40px_rgba(236,72,153,0.22)]',
    bg: 'bg-gradient-to-br from-game-slots/30 via-bg-card to-bg-card',
  },
];

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'original', label: 'Originals' },
  { id: 'table', label: 'Table' },
  { id: 'slot', label: 'Slots' },
  { id: 'new', label: 'New' },
];

function GameTile({ game }) {
  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="group h-full"
    >
      <Link
        to={`/games/${game.id}`}
        aria-label={`Play ${game.name}`}
        className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-bg-card text-left transition-colors duration-300 hover:border-white/15 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
      >
        {/* Tile artwork */}
        <div
          className={`relative h-44 ${game.bg} overflow-hidden`}
          aria-hidden="true"
        >
          {/* Subtle neon mesh overlay */}
          <div className="pointer-events-none absolute inset-0 opacity-60 mix-blend-screen bg-mesh-neon" />

          {/* Game wordmark */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={`font-heading text-4xl md:text-5xl font-bold tracking-tight drop-shadow-lg ${game.accentText}`}
            >
              {game.name}
            </span>
          </div>

          {/* Accent corner badge */}
          <span
            className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border ${game.accentBorder} bg-black/40 px-2.5 py-1 text-[10px] font-heading uppercase tracking-wider ${game.accentText}`}
          >
            <FiZap className="h-3 w-3" aria-hidden="true" />
            {game.category === 'original' ? 'Original' : game.category === 'table' ? 'Table' : 'Slot'}
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-3 p-5">
          <div>
            <h2 className="font-heading text-xl font-bold text-text-primary">
              {game.name}
            </h2>
            <p className="mt-1 text-sm text-text-secondary line-clamp-2">
              {game.tagline}
            </p>
          </div>

          {/* Description preserved for SEO + test selectors */}
          <p className="text-xs text-text-muted line-clamp-2">
            {game.description}
          </p>

          {/* CTA */}
          <span
            className={`mt-auto inline-flex items-center justify-center gap-2 rounded-lg border ${game.accentBorder} bg-white/5 py-2.5 px-4 text-sm font-medium ${game.accentText} group-hover:bg-white/10 group-hover:${game.accentGlow} transition-all duration-300`}
          >
            <FiPlay className="h-4 w-4" aria-hidden="true" />
            Play Now
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

const GamesPage = () => {
  useEffect(() => {
    document.title = 'Games | Platinum Casino';
  }, []);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return games.filter((g) => {
      const matchesFilter = filter === 'all' || g.category === filter;
      const matchesSearch =
        !term ||
        g.name.toLowerCase().includes(term) ||
        g.tagline.toLowerCase().includes(term) ||
        g.description.toLowerCase().includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [search, filter]);

  return (
    <MainLayout>
      {/* Header */}
      <header className="mb-8 mt-2">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold">
              <span className="text-gold-gradient">Our Games</span>
            </h1>
            <p className="mt-3 max-w-2xl text-text-secondary text-lg">
              Browse the floor. All games use virtual currency &mdash; no real money at stake.
            </p>
          </div>

          {/* Search + filter chips */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label
              htmlFor="games-search"
              className="relative inline-flex w-full md:w-80 items-center"
            >
              <FiSearch
                className="pointer-events-none absolute left-3 h-4 w-4 text-text-muted"
                aria-hidden="true"
              />
              <input
                id="games-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search games..."
                aria-label="Search games"
                className="w-full rounded-full border border-border bg-bg-card/60 pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-gold cursor-text"
              />
            </label>

            <div
              className="flex flex-wrap items-center gap-2"
              role="tablist"
              aria-label="Filter games by category"
            >
              {FILTERS.map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(f.id)}
                    className={`inline-flex h-9 items-center rounded-full border px-4 text-sm transition-colors duration-200 cursor-pointer ${
                      active
                        ? 'border-accent-gold/60 bg-accent-gold/10 text-accent-gold'
                        : 'border-border bg-bg-card/40 text-text-secondary hover:text-text-primary hover:border-border-light'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div
          className="rounded-2xl border border-border bg-bg-card/50 px-6 py-16 text-center"
          role="status"
        >
          <p className="font-heading text-xl text-text-primary">No games match that search.</p>
          <p className="mt-2 text-text-secondary">Try a different keyword or filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g) => (
            <GameTile key={g.id} game={g} />
          ))}
        </div>
      )}
    </MainLayout>
  );
};

export default GamesPage;
