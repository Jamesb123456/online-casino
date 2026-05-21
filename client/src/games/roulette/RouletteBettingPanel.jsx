import React, { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ChipStack from '../../components/casino/ChipStack';
import { useSound } from '../../components/casino/SoundProvider';
import { useReducedMotion } from '../../components/casino/MotionSafe';
import { BET_TYPES, ROULETTE_NUMBERS } from './rouletteUtils';

/**
 * RouletteBettingPanel — felt-textured bet board.
 *
 * Click any cell to drop a chip worth `betAmount` on that bet position. Each
 * click emits onPlaceBet({ type, value, amount }). Multiple clicks stack chips
 * on the same position (visual representation handled via ChipStack).
 *
 * Props:
 *   betAmount   number  — current chip denomination (controlled)
 *   setBetAmount fn     — chip-value setter
 *   onPlaceBet  fn      — emits { type, value, amount } per click
 *   isSpinning  bool    — disables interaction
 *   balance     number  — informational only
 *   placedBets  array   — optional [{ type, value, amount }] to render chips
 *                         when not provided, falls back to internal state.
 */

const NUMBER_COLOR = (n) => ROULETTE_NUMBERS.find((x) => x.number === n)?.color || 'green';

function felByColor(color) {
  if (color === 'red') return 'bg-red-700';
  if (color === 'black') return 'bg-neutral-900';
  return 'bg-emerald-700';
}

function chipColorForBet(type) {
  switch (type) {
    case 'RED':
      return 'rose';
    case 'BLACK':
      return 'violet';
    case 'ODD':
    case 'EVEN':
      return 'blue';
    case 'LOW':
    case 'HIGH':
      return 'gold';
    case 'STRAIGHT':
      return 'gold';
    default:
      return 'lime';
  }
}

function betKey(b) {
  return `${b.type}:${b.value ?? ''}`;
}

const CHIP_DENOMS = [1, 5, 10, 25, 50, 100];

const FeltSvgNoise = () => (
  <svg
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07] mix-blend-overlay"
  >
    <filter id="feltNoise">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#feltNoise)" />
  </svg>
);

function RouletteBettingPanel({
  betAmount = 10,
  setBetAmount = () => {},
  onPlaceBet = () => {},
  isSpinning = false,
  balance = 0,
  placedBets,
}) {
  const { play } = useSound();
  const reduced = useReducedMotion();
  const [internalBets, setInternalBets] = useState([]);

  // Use externally-managed bets when provided; otherwise track internally
  // (so the panel works standalone in tests and storybook contexts).
  const bets = Array.isArray(placedBets) ? placedBets : internalBets;

  const totalsByKey = useMemo(() => {
    const map = new Map();
    bets.forEach((b) => {
      const key = betKey(b);
      map.set(key, (map.get(key) || 0) + Number(b.amount || 0));
    });
    return map;
  }, [bets]);

  const handleChange = useCallback(
    (e) => {
      const raw = e.target.value;
      if (raw === '' || raw === '-') {
        setBetAmount(0);
        return;
      }
      const parsed = parseFloat(raw);
      setBetAmount(Number.isFinite(parsed) ? parsed : 0);
    },
    [setBetAmount],
  );

  const placeBet = useCallback(
    (type, value) => {
      if (isSpinning) return;
      const amount = Number(betAmount) || 0;
      if (amount <= 0) return;
      if (amount > balance) return;

      const bet = { type, value: value != null ? String(value) : '', amount };

      // Optimistically record locally for chip visual when no external owner.
      if (!Array.isArray(placedBets)) {
        setInternalBets((prev) => [...prev, { ...bet, id: Date.now() + Math.random() }]);
      }
      try {
        play('chip-drop');
      } catch {
        /* ignore */
      }
      onPlaceBet(bet);
    },
    [betAmount, balance, isSpinning, onPlaceBet, placedBets, play],
  );

  const clearLocalBets = useCallback(() => {
    setInternalBets([]);
  }, []);

  // Build standard European roulette grid: 0 down the left, then 1..36 in 3 rows × 12 cols.
  // Layout cells (row → col):
  //   row 0: 3, 6, 9, ..., 36   (top row)
  //   row 1: 2, 5, 8, ..., 35
  //   row 2: 1, 4, 7, ..., 34
  const numberGrid = useMemo(() => {
    const rows = [[], [], []];
    for (let col = 0; col < 12; col += 1) {
      rows[0].push(3 + col * 3);
      rows[1].push(2 + col * 3);
      rows[2].push(1 + col * 3);
    }
    return rows;
  }, []);

  const renderChip = (type, value, color) => {
    const total = totalsByKey.get(`${type}:${value ?? ''}`) || 0;
    if (total <= 0) return null;
    return (
      <AnimatePresence>
        <motion.span
          key={`${type}-${value}-${total}`}
          initial={reduced ? { opacity: 0 } : { scale: 0, y: -16, opacity: 0 }}
          animate={reduced ? { opacity: 1 } : { scale: [0, 1.2, 1], y: 0, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.05 : 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none absolute bottom-1 right-1 flex flex-col items-end"
          aria-hidden="true"
        >
          <ChipStack amount={total} color={color} size={22} />
          <span className="mt-0.5 rounded bg-bg-base/80 px-1 py-[1px] text-[9px] font-bold tabular-nums text-accent-gold-light">
            ${total.toFixed(0)}
          </span>
        </motion.span>
      </AnimatePresence>
    );
  };

  const cellBase = [
    'relative flex items-center justify-center font-heading font-bold text-white',
    'min-h-[44px] cursor-pointer select-none',
    'border border-emerald-400/30 transition',
    'hover:brightness-125 hover:ring-2 hover:ring-accent-gold/60',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold',
    'active:scale-[0.97]',
    isSpinning ? 'cursor-not-allowed opacity-60 pointer-events-none' : '',
  ].join(' ');

  const outsideBase = [
    'relative flex items-center justify-center min-h-[44px] cursor-pointer select-none',
    'rounded-md border border-emerald-400/30 bg-emerald-800/60 px-2 py-2',
    'font-heading text-sm font-bold uppercase tracking-wide text-white transition',
    'hover:brightness-125 hover:ring-2 hover:ring-accent-gold/60',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold',
    'active:scale-[0.97]',
    isSpinning ? 'cursor-not-allowed opacity-60 pointer-events-none' : '',
  ].join(' ');

  const insufficient = Number(betAmount) > Number(balance);

  return (
    <div className="flex flex-col gap-4" role="group" aria-label="Roulette bet board">
      {/* Felt board with bet positions */}
      <div
        className="relative overflow-hidden rounded-2xl border border-emerald-900/60 p-3 shadow-card"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 30%, #065F46 0%, #064E3B 45%, #022C22 80%, #07080F 100%)',
        }}
      >
        <FeltSvgNoise />

        <div className="relative grid grid-cols-[auto_1fr] gap-2">
          {/* Zero column */}
          <button
            type="button"
            onClick={() => placeBet('STRAIGHT', 0)}
            disabled={isSpinning}
            aria-label="Place bet on 0 (green)"
            className={[cellBase, 'rounded-md bg-emerald-700', 'h-auto w-12 px-2 text-lg'].join(' ')}
          >
            0
            {renderChip('STRAIGHT', '0', chipColorForBet('STRAIGHT'))}
          </button>

          {/* Numbers 1-36 grid */}
          <div className="grid grid-rows-3 gap-1">
            {numberGrid.map((row, rIdx) => (
              <div key={`row-${rIdx}`} className="grid grid-cols-12 gap-1">
                {row.map((n) => {
                  const color = NUMBER_COLOR(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => placeBet('STRAIGHT', n)}
                      disabled={isSpinning}
                      aria-label={`Place bet on ${n} (${color})`}
                      className={[cellBase, 'rounded-md text-sm', felByColor(color)].join(' ')}
                    >
                      {n}
                      {renderChip('STRAIGHT', String(n), chipColorForBet('STRAIGHT'))}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Dozens row */}
        <div className="relative mt-2 grid grid-cols-3 gap-1">
          {[1, 2, 3].map((d) => (
            <button
              key={`dozen-${d}`}
              type="button"
              onClick={() => placeBet('DOZEN', d)}
              disabled={isSpinning}
              aria-label={`Place bet on ${BET_TYPES.DOZEN.name} ${d === 1 ? '1-12' : d === 2 ? '13-24' : '25-36'}`}
              className={outsideBase}
            >
              {d === 1 ? '1 to 12' : d === 2 ? '13 to 24' : '25 to 36'}
              {renderChip('DOZEN', String(d), chipColorForBet('DOZEN'))}
            </button>
          ))}
        </div>

        {/* Outside bets row */}
        <div className="relative mt-1 grid grid-cols-6 gap-1">
          <button
            type="button"
            onClick={() => placeBet('LOW')}
            disabled={isSpinning}
            aria-label="Place bet on Low (1-18)"
            className={outsideBase}
          >
            1-18
            {renderChip('LOW', '', chipColorForBet('LOW'))}
          </button>
          <button
            type="button"
            onClick={() => placeBet('EVEN')}
            disabled={isSpinning}
            aria-label="Place bet on Even"
            className={outsideBase}
          >
            Even
            {renderChip('EVEN', '', chipColorForBet('EVEN'))}
          </button>
          <button
            type="button"
            onClick={() => placeBet('RED')}
            disabled={isSpinning}
            aria-label="Place bet on Red"
            className={[outsideBase, '!bg-red-700 border-red-400/40'].join(' ')}
          >
            Red
            {renderChip('RED', '', chipColorForBet('RED'))}
          </button>
          <button
            type="button"
            onClick={() => placeBet('BLACK')}
            disabled={isSpinning}
            aria-label="Place bet on Black"
            className={[outsideBase, '!bg-neutral-900 border-white/20'].join(' ')}
          >
            Black
            {renderChip('BLACK', '', chipColorForBet('BLACK'))}
          </button>
          <button
            type="button"
            onClick={() => placeBet('ODD')}
            disabled={isSpinning}
            aria-label="Place bet on Odd"
            className={outsideBase}
          >
            Odd
            {renderChip('ODD', '', chipColorForBet('ODD'))}
          </button>
          <button
            type="button"
            onClick={() => placeBet('HIGH')}
            disabled={isSpinning}
            aria-label="Place bet on High (19-36)"
            className={outsideBase}
          >
            19-36
            {renderChip('HIGH', '', chipColorForBet('HIGH'))}
          </button>
        </div>
      </div>

      {/* Chip denomination row */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="roulette-bet-amount"
            className="text-xs uppercase tracking-wider text-text-secondary"
          >
            Chip value
          </label>
          <span className="text-xs text-text-muted">
            Total placed:{' '}
            <span className="font-mono tabular-nums text-accent-gold-light">
              ${bets.reduce((acc, b) => acc + Number(b.amount || 0), 0).toFixed(2)}
            </span>
          </span>
        </div>
        <div className="flex items-stretch gap-2">
          <input
            id="roulette-bet-amount"
            type="number"
            inputMode="decimal"
            min="0.1"
            step="0.1"
            value={betAmount}
            onChange={handleChange}
            disabled={isSpinning}
            aria-label="Bet Amount"
            className="h-[44px] flex-1 rounded-md border border-border-light bg-bg-base px-3 text-right font-mono text-base tabular-nums text-text-primary focus-visible:border-accent-gold focus-visible:ring-2 focus-visible:ring-accent-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Chip presets">
          {CHIP_DENOMS.map((d) => {
            const active = Number(betAmount) === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => !isSpinning && setBetAmount(d)}
                disabled={isSpinning}
                aria-pressed={active}
                aria-label={`${d}`}
                className={[
                  'h-[44px] rounded-md text-xs font-semibold transition cursor-pointer',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold',
                  active
                    ? 'bg-accent-gold text-bg-base shadow-glow-amber'
                    : 'border border-white/10 bg-white/5 text-text-primary hover:border-accent-gold hover:bg-accent-gold/10',
                  isSpinning ? 'cursor-not-allowed opacity-60' : '',
                ].join(' ')}
              >
                {d}
              </button>
            );
          })}
        </div>

        {insufficient ? (
          <p className="text-xs text-status-error" role="alert">
            Chip value above balance.
          </p>
        ) : null}

        {!Array.isArray(placedBets) && bets.length > 0 ? (
          <button
            type="button"
            onClick={clearLocalBets}
            disabled={isSpinning}
            className="h-[36px] rounded-md border border-white/10 bg-white/5 text-xs font-medium text-text-secondary transition hover:border-accent-rose hover:text-accent-rose focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-rose cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            Clear local chips
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default RouletteBettingPanel;
