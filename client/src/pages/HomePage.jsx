import React, { useContext, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiPlay,
  FiShield,
  FiZap,
  FiHeadphones,
  FiArrowRight,
} from 'react-icons/fi';
import MainLayout from '../layouts/MainLayout';
import LiveWinsTicker from '../components/casino/LiveWinsTicker';
import { AuthContext } from '../contexts/AuthContext';

/**
 * Featured games — keep these four to preserve homepage tests that look for
 * specific headings + descriptions. The accent metadata maps to the in-app
 * `--color-game-*` tokens defined in index.css.
 */
const FEATURED_GAMES = [
  {
    id: 1,
    title: 'Crash',
    description: 'Watch the multiplier rise and cash out before it crashes!',
    path: '/games/crash',
    accent: 'text-game-crash',
    border: 'border-game-crash/40',
    glow: 'shadow-[0_0_60px_rgba(239,68,68,0.18)]',
    bg: 'from-game-crash/40 via-bg-card to-bg-card',
    Preview: CrashPreview,
  },
  {
    id: 2,
    title: 'Roulette',
    description: 'Place your bets on red, black, or your lucky number!',
    path: '/games/roulette',
    accent: 'text-game-roulette',
    border: 'border-game-roulette/40',
    glow: 'shadow-[0_0_60px_rgba(16,185,129,0.18)]',
    bg: 'from-game-roulette/40 via-bg-card to-bg-card',
    Preview: WheelOrbitPreview,
  },
  {
    id: 3,
    title: 'Blackjack',
    description: 'Beat the dealer with a hand value of 21 or less.',
    path: '/games/blackjack',
    accent: 'text-game-blackjack',
    border: 'border-game-blackjack/40',
    glow: 'shadow-[0_0_60px_rgba(59,130,246,0.18)]',
    bg: 'from-game-blackjack/40 via-bg-card to-bg-card',
    Preview: CardFlipPreview,
  },
  {
    id: 4,
    title: 'Plinko',
    description: 'Drop the ball and watch it bounce for big wins!',
    path: '/games/plinko',
    accent: 'text-game-plinko',
    border: 'border-game-plinko/40',
    glow: 'shadow-[0_0_60px_rgba(139,92,246,0.18)]',
    bg: 'from-game-plinko/40 via-bg-card to-bg-card',
    Preview: PlinkoBallPreview,
  },
];

const TRUST_ITEMS = [
  {
    Icon: FiShield,
    title: 'Secure & Fair',
    body: 'Provably-fair RNG with cryptographic seeds. Every roll is independently verifiable.',
  },
  {
    Icon: FiZap,
    title: 'Fast Payouts',
    body: 'Streamlined transactions land in seconds. No waiting, no friction.',
  },
  {
    Icon: FiHeadphones,
    title: '24/7 Support',
    body: 'Our concierge team is online around the clock — real humans, real fast.',
  },
];

/* ── Animated preview snippets per featured tile ─────────────────────────── */

function CrashPreview() {
  // Animated curve sweep
  return (
    <svg
      viewBox="0 0 200 120"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="crashGrad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#EF4444" stopOpacity="0" />
          <stop offset="100%" stopColor="#EF4444" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <motion.path
        d="M 10 110 Q 80 110 110 70 T 190 12"
        stroke="url(#crashGrad)"
        strokeWidth="2.5"
        fill="none"
        initial={{ pathLength: 0, opacity: 0.2 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{
          duration: 2.4,
          ease: 'easeOut',
          repeat: Infinity,
          repeatType: 'loop',
          repeatDelay: 0.6,
        }}
      />
      <motion.circle
        r="3"
        fill="#FBBF24"
        initial={{ cx: 10, cy: 110 }}
        animate={{ cx: 190, cy: 12 }}
        transition={{
          duration: 2.4,
          ease: 'easeOut',
          repeat: Infinity,
          repeatType: 'loop',
          repeatDelay: 0.6,
        }}
      />
    </svg>
  );
}

function PlinkoBallPreview() {
  // A small ball drops repeatedly through a pin grid hint
  return (
    <svg
      viewBox="0 0 200 120"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {/* Pin dots */}
      {[0, 1, 2, 3].map((row) =>
        Array.from({ length: 5 + row }, (_, i) => (
          <circle
            key={`${row}-${i}`}
            cx={40 + i * 24 - row * 12}
            cy={25 + row * 18}
            r="1.6"
            fill="#A78BFA"
            opacity="0.35"
          />
        )),
      )}
      <motion.circle
        r="4.5"
        fill="#FBBF24"
        initial={{ cx: 100, cy: -5, opacity: 0 }}
        animate={{ cx: [100, 88, 112, 96, 104], cy: [-5, 30, 60, 92, 120], opacity: [0, 1, 1, 1, 0] }}
        transition={{
          duration: 2.2,
          ease: 'easeIn',
          repeat: Infinity,
          repeatDelay: 0.8,
        }}
      />
    </svg>
  );
}

function WheelOrbitPreview() {
  return (
    <svg
      viewBox="0 0 200 120"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <circle cx="100" cy="60" r="38" fill="none" stroke="#10B981" strokeOpacity="0.3" strokeWidth="1.5" />
      <circle cx="100" cy="60" r="44" fill="none" stroke="#10B981" strokeOpacity="0.15" strokeWidth="1" strokeDasharray="2 3" />
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 4, ease: 'linear', repeat: Infinity }}
        style={{ transformOrigin: '100px 60px' }}
      >
        <circle cx="138" cy="60" r="4" fill="#FBBF24" />
      </motion.g>
    </svg>
  );
}

function CardFlipPreview() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <motion.div
        className="h-20 w-14 rounded-lg border border-blue-300/40 bg-bg-elevated/70 backdrop-blur"
        animate={{ rotateY: [0, 180, 360] }}
        transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div className="flex h-full w-full items-center justify-center font-heading text-2xl text-blue-300">
          A
        </div>
      </motion.div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

const HomePage = () => {
  useEffect(() => {
    document.title = 'Platinum Casino';
  }, []);

  const { isAuthenticated } = useContext(AuthContext) || {};

  return (
    <MainLayout>
      <div className="-mx-4 -mt-8 -mb-8">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-mesh-neon">
          {/* Animated drifting mesh accents */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 left-1/4 h-[520px] w-[520px] rounded-full bg-accent-purple/15 blur-[120px]"
            animate={{ x: [0, 30, -10, 0], y: [0, 20, -10, 0] }}
            transition={{ duration: 16, ease: 'easeInOut', repeat: Infinity }}
          />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 right-1/4 h-[460px] w-[460px] rounded-full bg-accent-gold/10 blur-[120px]"
            animate={{ x: [0, -20, 10, 0], y: [0, -10, 20, 0] }}
            transition={{ duration: 18, ease: 'easeInOut', repeat: Infinity }}
          />

          <div className="relative z-10 px-4 py-20 md:py-28">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto max-w-4xl text-center"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-gold/30 bg-accent-gold/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-accent-gold-light">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-gold animate-pulse" aria-hidden="true" />
                Live now
              </span>

              <h1 className="mt-5 font-heading text-5xl md:text-7xl font-bold leading-tight tracking-tight">
                <span className="text-gold-gradient">Platinum</span>{' '}
                <span className="text-text-primary">Casino</span>
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg md:text-xl text-text-secondary">
                Experience the thrill of casino games from the comfort of your home.
                Play now and claim your welcome bonus!
              </p>

              {/* CTAs */}
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                {isAuthenticated ? (
                  <Link
                    to="/games"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light px-8 font-heading font-bold text-bg-base shadow-glow-gold hover:shadow-glow-gold-lg transition-shadow duration-300 cursor-pointer"
                  >
                    <FiPlay className="h-5 w-5" aria-hidden="true" />
                    Play Now
                  </Link>
                ) : (
                  <Link
                    to="/register"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light px-8 font-heading font-bold text-bg-base shadow-glow-gold hover:shadow-glow-gold-lg transition-shadow duration-300 cursor-pointer"
                  >
                    Sign Up Now
                    <FiArrowRight className="h-5 w-5" aria-hidden="true" />
                  </Link>
                )}
                <Link
                  to="/games"
                  className="glass inline-flex h-12 items-center justify-center rounded-lg px-8 font-heading font-bold text-text-primary hover:bg-white/10 transition-colors duration-300 cursor-pointer"
                >
                  Browse Games
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Live wins ticker ──────────────────────────────────────────────── */}
        <section className="bg-bg-base" aria-label="Recent wins">
          <div className="container mx-auto max-w-7xl px-4 py-6">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse" aria-hidden="true" />
              Live wins
            </div>
            <LiveWinsTicker items={[]} speed={50} />
          </div>
        </section>

        {/* ── Featured games rail ───────────────────────────────────────────── */}
        <section className="bg-bg-base py-16">
          <div className="container mx-auto max-w-7xl px-4">
            <div className="mb-8 flex items-end justify-between gap-3">
              <div>
                <h2 className="font-heading text-3xl font-bold text-text-primary">
                  Featured Games
                </h2>
                <p className="mt-2 text-text-secondary">
                  Try our most popular casino games
                </p>
              </div>
              <Link
                to="/games"
                className="hidden md:inline-flex items-center gap-1 text-sm text-accent-gold hover:text-accent-gold-light cursor-pointer"
              >
                View all <FiArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURED_GAMES.map((game) => (
                <motion.div
                  key={game.id}
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full"
                >
                  <Link
                    to={game.path}
                    className={`group flex h-full flex-col overflow-hidden rounded-2xl border ${game.border} bg-bg-card transition-shadow duration-300 hover:${game.glow} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold`}
                  >
                    {/* 16:9 artwork */}
                    <div
                      className={`relative aspect-video bg-gradient-to-br ${game.bg} overflow-hidden`}
                    >
                      <div className="pointer-events-none absolute inset-0 opacity-50 mix-blend-screen bg-mesh-neon" />
                      <game.Preview />

                      {/* Wordmark */}
                      <div className="absolute inset-x-0 bottom-3 flex items-center justify-center">
                        <h3
                          className={`font-heading text-2xl md:text-3xl font-bold tracking-tight drop-shadow-lg ${game.accent}`}
                        >
                          {game.title}
                        </h3>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="flex flex-1 flex-col gap-4 p-5">
                      <p className="flex-1 text-sm text-text-secondary">
                        {game.description}
                      </p>
                      <span
                        className={`inline-flex w-fit items-center gap-2 rounded-full border ${game.border} bg-white/5 px-4 py-1.5 text-sm font-medium ${game.accent} group-hover:bg-white/10 transition-colors duration-200`}
                      >
                        <FiPlay className="h-3.5 w-3.5" aria-hidden="true" />
                        Play Now
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Trust strip ───────────────────────────────────────────────────── */}
        <section className="bg-bg-card py-16">
          <div className="container mx-auto max-w-7xl px-4">
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <h2 className="font-heading text-3xl font-bold text-text-primary">
                Why Choose Platinum Casino
              </h2>
              <p className="mt-3 text-text-secondary">
                We offer the best online casino experience with secure payments and exciting bonuses
              </p>
            </div>

            <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {TRUST_ITEMS.map(({ Icon, title, body }) => (
                <li
                  key={title}
                  className="glass rounded-2xl p-6 transition-shadow duration-300 hover:shadow-card"
                >
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-gold/15 text-accent-gold">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="font-heading text-xl font-bold text-text-primary">
                    {title}
                  </h3>
                  <p className="mt-2 text-text-secondary">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Bottom CTA ────────────────────────────────────────────────────── */}
        <section className="bg-gradient-to-r from-accent-gold-dark via-accent-gold to-accent-gold-light py-14">
          <div className="container mx-auto max-w-7xl px-4 text-center">
            <h2 className="font-heading text-3xl font-bold text-bg-base">
              Ready to Play?
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-bg-base/80">
              Join thousands of players and start winning today. Sign up now and claim your welcome bonus!
            </p>
            <Link
              to="/register"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-bg-base px-8 font-heading font-bold text-text-primary hover:bg-bg-card transition-colors duration-200 cursor-pointer"
            >
              Create Account
            </Link>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default HomePage;
