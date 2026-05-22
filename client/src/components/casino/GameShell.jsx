import React from 'react';

/**
 * GameShell — premium full-height layout wrapper for casino game pages.
 *
 * Visual spine:
 *   ┌─ Title bar  (game name + accent glow underline)
 *   ├─ Stats slot (multiplier history, recent results)
 *   ├─ Board area (the game scene — passed as `children`)
 *   └─ Panel area (bet panel / controls)
 *
 * Props
 *   title     string — game title rendered in the header
 *   accent    'violet' | 'gold' | 'lime' | 'rose' | 'blue' | 'emerald'
 *             | 'red' | 'orange' | 'teal' | 'magenta'
 *             Maps to a `--color-game-*` token (see index.css):
 *               violet   → plinko    (#8B5CF6)
 *               gold     → wheel     (#F59E0B)
 *               rose/red → crash     (#EF4444 / #F43F5E)
 *               emerald  → roulette  (#10B981)
 *               blue     → blackjack (#3B82F6)
 *               orange   → landmines (#F97316)
 *               teal     → dice      (#14B8A6)
 *               magenta  → slots     (#EC4899)
 *               lime     → generic win accent
 *   children  ReactNode — main board / canvas
 *   panel     ReactNode — bet controls / right-hand UI (collapses below board < lg)
 *   stats     ReactNode — optional row above the panel
 *   banner    ReactNode — optional banner above the board (disconnect, errors)
 *   headerExtras ReactNode — extra right-aligned header content (mute toggle, etc.)
 *   ariaLabel string — accessible label for the main region (default: title)
 *   className extra classes on the outer <main>
 */

const ACCENT_RING = {
  violet: 'from-accent-purple/0 via-accent-purple to-accent-purple/0',
  gold: 'from-accent-gold/0 via-accent-gold-light to-accent-gold/0',
  lime: 'from-lime-400/0 via-lime-400 to-lime-400/0',
  rose: 'from-accent-rose/0 via-accent-rose to-accent-rose/0',
  blue: 'from-blue-400/0 via-blue-400 to-blue-400/0',
  emerald: 'from-emerald-400/0 via-emerald-400 to-emerald-400/0',
  red: 'from-red-400/0 via-red-400 to-red-400/0',
  orange: 'from-orange-400/0 via-orange-400 to-orange-400/0',
  teal: 'from-teal-400/0 via-teal-400 to-teal-400/0',
  magenta: 'from-pink-500/0 via-pink-500 to-pink-500/0',
};

const ACCENT_TEXT = {
  violet: 'text-accent-purple-light',
  gold: 'text-accent-gold-light',
  lime: 'text-lime-300',
  rose: 'text-accent-rose',
  blue: 'text-blue-300',
  emerald: 'text-emerald-300',
  red: 'text-red-300',
  orange: 'text-orange-300',
  teal: 'text-teal-300',
  magenta: 'text-pink-400',
};

function GameShell({
  title,
  accent = 'violet',
  children,
  panel = null,
  stats = null,
  banner = null,
  headerExtras = null,
  ariaLabel,
  className = '',
}) {
  const ringClass = ACCENT_RING[accent] || ACCENT_RING.violet;
  const textClass = ACCENT_TEXT[accent] || ACCENT_TEXT.violet;

  return (
    <main
      className={[
        'min-h-[calc(100vh-4rem)] bg-mesh-neon text-text-primary',
        'px-4 py-6 lg:px-8 lg:py-8',
        className,
      ].join(' ')}
      aria-label={ariaLabel || title}
    >
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight lg:text-3xl">
            <span className={textClass}>{title}</span>
          </h1>
          <span
            aria-hidden="true"
            className={`h-px w-24 bg-gradient-to-r ${ringClass}`}
          />
        </div>
        {headerExtras ? (
          <div className="flex items-center gap-2">{headerExtras}</div>
        ) : null}
      </header>

      {banner ? <div className="mb-4">{banner}</div> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] lg:gap-6">
        <section
          aria-label={`${title} game board`}
          className="glass-strong rounded-2xl border-white/10 p-3 lg:p-4"
          style={{ backgroundColor: 'color-mix(in oklab, var(--color-bg-game) 70%, transparent)' }}
        >
          {children}
        </section>

        <aside className="flex flex-col gap-4">
          {stats ? (
            <section
              aria-label={`${title} stats`}
              className="glass-strong rounded-2xl border-white/10 p-3 lg:p-4"
            >
              {stats}
            </section>
          ) : null}
          {panel ? (
            <section
              aria-label={`${title} controls`}
              className="glass-strong rounded-2xl border-white/10 p-3 lg:p-4"
            >
              {panel}
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

export default GameShell;
