import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import GameLayout from '@/games/_shared/GameLayout';
import BetControls from '@/games/_shared/BetControls';
import ProvablyFairPanel from '@/games/_shared/ProvablyFairPanel';
import DisconnectOverlay from '@/games/_shared/DisconnectOverlay';
import { useGameSocket } from '@/games/_shared/useGameSocket';
import { useAnnouncer } from '@/games/_shared/hooks/useAnnouncer';
import Button from '@/components/ui/Button';
import { AuthContext } from '@/contexts/AuthContext';
import { formatCredits } from '@/lib/formatCredits';
import rules from './rules';

const SYMBOL_ICONS = {
  CHERRY: '🍒',
  LEMON: '🍋',
  ORANGE: '🍊',
  PLUM: '🍇',
  BELL: '🔔',
  BAR: '📊',
  SEVEN: '7️⃣',
  A: '🅰️',
  B: '🅱️',
  C: '🆎',
};

const ALL_SYMBOLS = Object.keys(SYMBOL_ICONS);
const REELS = 5;
const ROWS = 3;
const MIN_LINES = 1;
const MAX_LINES = 5;
const SPIN_ANIM_MS = 800;
const AUTOPLAY_DELAY_MS = 800;
const AUTOPLAY_DEFAULT = 10;

const EMPTY_GRID = Array.from({ length: REELS }, () =>
  Array.from({ length: ROWS }, () => '?'),
);

const randomSymbol = () =>
  ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)];

const randomGrid = () =>
  Array.from({ length: REELS }, () =>
    Array.from({ length: ROWS }, () => randomSymbol()),
  );

/**
 * Identify winning cells. Server returns `hits` as
 * `{ lineIdx, symbol, count, payout }[]` but no line geometry. We approximate
 * by finding the symbol's row in each of the first `count` reels.
 */
const computeWinningCells = (hits, reels) => {
  const set = new Set();
  if (!Array.isArray(hits) || !Array.isArray(reels)) return set;
  for (const hit of hits) {
    const count = Math.min(REELS, hit?.count || 0);
    for (let r = 0; r < count; r++) {
      const col = reels[r];
      if (!Array.isArray(col)) continue;
      const row = col.findIndex((s) => s === hit.symbol);
      if (row >= 0) set.add(`${r}:${row}`);
    }
  }
  return set;
};

const SlotsCell = ({ symbol, highlighted, spinning }) => {
  const display = SYMBOL_ICONS[symbol] ?? symbol ?? '?';
  return (
    <div
      role="gridcell"
      aria-pressed={highlighted ? 'true' : undefined}
      aria-label={symbol || 'empty'}
      className={[
        'flex items-center justify-center text-3xl md:text-4xl h-16 md:h-20 w-full rounded-md border transition-all duration-150',
        highlighted
          ? 'bg-accent-gold/30 border-accent-gold text-accent-gold ring-2 ring-accent-gold shadow-[0_0_12px_rgba(232,189,90,0.6)]'
          : 'bg-bg-base border-border-light text-text-primary',
        spinning ? 'blur-[1.5px] opacity-90' : '',
      ].join(' ')}
    >
      <span aria-hidden="true">{display}</span>
    </div>
  );
};

const SlotsGame = () => {
  const { user, updateBalance } = useContext(AuthContext) || {};
  const balance = typeof user?.balance === 'number' ? user.balance : 0;

  // Bet config
  const [betPerLine, setBetPerLine] = useState(1);
  const [lines, setLines] = useState(5);

  // Spin state
  const [reels, setReels] = useState(EMPTY_GRID);
  const [animReels, setAnimReels] = useState(EMPTY_GRID);
  const [hits, setHits] = useState([]);
  const [lastSpin, setLastSpin] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showWinHighlights, setShowWinHighlights] = useState(false);

  // History (last 10) and provably-fair (built from each spin ack)
  const [history, setHistory] = useState([]);
  const [pfHistory, setPfHistory] = useState([]);
  const [clientSeed, setClientSeed] = useState('');

  // Autoplay
  const [autoplay, setAutoplay] = useState(false);
  const [autoplayRemaining, setAutoplayRemaining] = useState(0);
  const [stopOnWin, setStopOnWin] = useState(false);

  const animTimerRef = useRef(null);
  const animIntervalRef = useRef(null);
  const highlightTimerRef = useRef(null);
  const autoplayTimerRef = useRef(null);
  const autoplayRef = useRef(false);
  autoplayRef.current = autoplay;

  // Announcer for screen readers
  const { announcement, announce } = useAnnouncer(2000);

  const totalBet = useMemo(() => {
    const bet = Number(betPerLine) || 0;
    const ln = Math.max(MIN_LINES, Math.min(MAX_LINES, Number(lines) || 0));
    return Math.round(bet * ln * 100) / 100;
  }, [betPerLine, lines]);

  const maxBetPerLine = useMemo(() => {
    if (balance <= 0) return 1;
    return Math.max(0.01, Math.floor((balance / MAX_LINES) * 100) / 100);
  }, [balance]);

  // Socket
  const handleGameState = useCallback((payload) => {
    if (payload?.balance != null && typeof updateBalance === 'function') {
      updateBalance(payload.balance);
    }
  }, [updateBalance]);

  const { emit, status, lastError, serverSeedHash } = useGameSocket('slots', {
    events: { gameState: handleGameState },
  });

  // Send join ack once on connect
  const joinedRef = useRef(false);
  useEffect(() => {
    if (status !== 'connected' || joinedRef.current) return;
    joinedRef.current = true;
    emit('slots:join', {}, (resp) => {
      if (resp?.success && typeof resp.balance === 'number' && typeof updateBalance === 'function') {
        updateBalance(resp.balance);
      }
    });
  }, [status, emit, updateBalance]);

  // Cleanup all timers on unmount
  useEffect(() => () => {
    if (animTimerRef.current) window.clearTimeout(animTimerRef.current);
    if (animIntervalRef.current) window.clearInterval(animIntervalRef.current);
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    if (autoplayTimerRef.current) window.clearTimeout(autoplayTimerRef.current);
  }, []);

  const winningCells = useMemo(() => {
    if (!showWinHighlights) return new Set();
    return computeWinningCells(hits, reels);
  }, [showWinHighlights, hits, reels]);

  const stopAutoplay = useCallback(() => {
    setAutoplay(false);
    setAutoplayRemaining(0);
    if (autoplayTimerRef.current) {
      window.clearTimeout(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }
  }, []);

  const performSpin = useCallback(() => {
    if (isSpinning) return false;
    const bet = Number(betPerLine);
    if (!Number.isFinite(bet) || bet <= 0) return false;
    const activeLines = Math.max(MIN_LINES, Math.min(MAX_LINES, Number(lines) || MAX_LINES));
    const spinTotalBet = Math.round(bet * activeLines * 100) / 100;
    if (spinTotalBet > balance) return false;
    if (status !== 'connected') return false;

    setIsSpinning(true);
    setShowWinHighlights(false);
    setHits([]);
    setLastSpin(null);

    // Animate: rotate random symbols rapidly for SPIN_ANIM_MS
    setAnimReels(randomGrid());
    if (animIntervalRef.current) window.clearInterval(animIntervalRef.current);
    animIntervalRef.current = window.setInterval(() => {
      setAnimReels(randomGrid());
    }, 80);

    emit('slots:spin', { betPerLine: bet, lines: activeLines }, (resp) => {
      // Finish the animation window before revealing.
      const reveal = () => {
        if (animIntervalRef.current) {
          window.clearInterval(animIntervalRef.current);
          animIntervalRef.current = null;
        }

        if (!resp || resp.ok === false) {
          setIsSpinning(false);
          announce('Spin failed');
          if (autoplayRef.current) stopAutoplay();
          return;
        }

        const safeReels = Array.isArray(resp.reels) ? resp.reels : EMPTY_GRID;
        setReels(safeReels);
        setAnimReels(safeReels);
        setHits(Array.isArray(resp.hits) ? resp.hits : []);
        setLastSpin({
          gameId: resp.gameId,
          totalPayout: resp.totalPayout || 0,
          multiplier: resp.multiplier || 0,
          activeLines,
        });

        if (typeof resp.newBalance === 'number' && typeof updateBalance === 'function') {
          updateBalance(resp.newBalance);
        }

        const payout = Number(resp.totalPayout) || 0;
        const winningLineCount = Array.isArray(resp.hits) ? resp.hits.length : 0;
        if (payout > 0) {
          announce(`Won ${formatCredits(payout, { withUnit: false })} credits on ${winningLineCount} line${winningLineCount === 1 ? '' : 's'}`);
        } else {
          announce('No payout');
        }

        // Push to history
        setHistory((prev) => [
          {
            id: resp.gameId || `${Date.now()}-${Math.random()}`,
            totalPayout: payout,
            multiplier: Number(resp.multiplier) || 0,
            totalBet: spinTotalBet,
            timestamp: Date.now(),
          },
          ...prev,
        ].slice(0, 10));

        // PF history row (server seed not exposed for slots — verify is best-effort)
        setPfHistory((prev) => [
          {
            id: resp.gameId || `${Date.now()}-${Math.random()}`,
            gameType: 'slots',
            serverSeedHash: serverSeedHash || '',
            serverSeed: null,
            clientSeed,
            nonce: prev.length + 1,
            outcome: payout,
            multiplier: Number(resp.multiplier) || 0,
            timestamp: Date.now(),
          },
          ...prev,
        ].slice(0, 20));

        setShowWinHighlights(true);
        if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = window.setTimeout(() => {
          setShowWinHighlights(false);
        }, 2200);

        setIsSpinning(false);

        // Autoplay continuation logic
        if (autoplayRef.current) {
          if (stopOnWin && payout > 0) {
            stopAutoplay();
            return;
          }
          setAutoplayRemaining((n) => {
            const next = n - 1;
            if (next <= 0) {
              // Schedule stop on next tick to avoid setState during render path
              window.setTimeout(stopAutoplay, 0);
              return 0;
            }
            return next;
          });
        }
      };

      // Ensure the animation has at least ~SPIN_ANIM_MS visible time.
      if (animTimerRef.current) window.clearTimeout(animTimerRef.current);
      animTimerRef.current = window.setTimeout(reveal, SPIN_ANIM_MS);
    });

    return true;
  }, [
    isSpinning,
    betPerLine,
    lines,
    balance,
    status,
    emit,
    updateBalance,
    announce,
    serverSeedHash,
    clientSeed,
    stopOnWin,
    stopAutoplay,
  ]);

  // Autoplay driver: when autoplay is on and not spinning, schedule the next spin.
  useEffect(() => {
    if (!autoplay) return undefined;
    if (isSpinning) return undefined;
    if (autoplayRemaining <= 0) return undefined;

    // Stop if balance can't cover the next bet
    if (totalBet > balance) {
      stopAutoplay();
      return undefined;
    }

    autoplayTimerRef.current = window.setTimeout(() => {
      const ok = performSpin();
      if (!ok) stopAutoplay();
    }, AUTOPLAY_DELAY_MS);

    return () => {
      if (autoplayTimerRef.current) {
        window.clearTimeout(autoplayTimerRef.current);
        autoplayTimerRef.current = null;
      }
    };
  }, [autoplay, autoplayRemaining, isSpinning, totalBet, balance, performSpin, stopAutoplay]);

  const handleSpinClick = useCallback(() => {
    // Manual spin disables autoplay if it was running
    if (autoplay) stopAutoplay();
    performSpin();
  }, [autoplay, stopAutoplay, performSpin]);

  const handleToggleAutoplay = useCallback(() => {
    if (autoplay) {
      stopAutoplay();
      return;
    }
    setAutoplayRemaining(AUTOPLAY_DEFAULT);
    setAutoplay(true);
  }, [autoplay, stopAutoplay]);

  const handleBetPerLineChange = useCallback((e) => {
    const raw = e.target.value;
    if (raw === '') { setBetPerLine(0.01); return; }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) { setBetPerLine(0.01); return; }
    const clamped = Math.max(0.01, Math.min(maxBetPerLine, parsed));
    setBetPerLine(Math.round(clamped * 100) / 100);
  }, [maxBetPerLine]);

  // Build the canvas (reels grid)
  const visibleReels = isSpinning ? animReels : reels;
  const winLineCount = lastSpin?.totalPayout > 0 ? hits.length : 0;

  const canvas = (
    <div className="relative">
      <DisconnectOverlay status={status} lastError={lastError} />

      {/* Win banner above reels */}
      <div className="min-h-[2.25rem] mb-3 flex items-center justify-center">
        {lastSpin && lastSpin.totalPayout > 0 ? (
          <div
            data-testid="slots-win-banner"
            className="px-4 py-1.5 rounded-md bg-status-success/15 border border-status-success/60 text-status-success font-semibold text-sm md:text-base"
            role="status"
          >
            Won {formatCredits(lastSpin.totalPayout, { withUnit: false })} credits on {winLineCount} line{winLineCount === 1 ? '' : 's'}!
          </div>
        ) : lastSpin && lastSpin.totalPayout === 0 ? (
          <div
            data-testid="slots-result"
            className="px-4 py-1.5 rounded-md bg-bg-base border border-border-light text-text-secondary text-sm"
          >
            No win this spin
          </div>
        ) : (
          <div className="text-xs text-text-secondary uppercase tracking-wider">
            5 × 3 Reels · Up to {MAX_LINES} Lines
          </div>
        )}
        {lastSpin && lastSpin.totalPayout > 0 ? (
          // Hidden testid for "Won..." copy parity with old tests
          <span data-testid="slots-result" className="sr-only">
            Won {formatCredits(lastSpin.totalPayout, { withUnit: false })} credits
          </span>
        ) : null}
      </div>

      <div
        data-testid="slots-reels"
        role="grid"
        aria-label="Slots reels"
        className="grid grid-cols-5 gap-2 md:gap-3"
      >
        {visibleReels.map((col, reelIdx) => (
          <div
            key={reelIdx}
            data-testid={`slots-reel-${reelIdx}`}
            role="row"
            aria-label={`Reel ${reelIdx + 1}`}
            className="flex flex-col gap-2"
          >
            {col.map((sym, rowIdx) => (
              <SlotsCell
                key={`${reelIdx}-${rowIdx}`}
                symbol={sym}
                highlighted={winningCells.has(`${reelIdx}:${rowIdx}`)}
                spinning={isSpinning}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Polite live region */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </div>
  );

  const insufficient = totalBet > balance;
  const spinDisabled = isSpinning || status !== 'connected' || insufficient;

  const controls = (
    <BetControls
      value={betPerLine}
      onChange={() => { /* not used — handled inline below */ }}
      min={0.01}
      max={maxBetPerLine}
      balance={balance}
      primaryAction={handleSpinClick}
      primaryLabel={isSpinning ? 'Spinning…' : 'Spin'}
      primaryDisabled={spinDisabled}
      status={
        autoplay
          ? `Autoplay running · ${autoplayRemaining} spin${autoplayRemaining === 1 ? '' : 's'} left`
          : null
      }
    >
      {/* Bet per line input (replaces BetControls' integer default) */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="slots-bet-per-line"
          className="text-xs uppercase tracking-wider text-text-secondary"
        >
          Bet per line
        </label>
        <input
          id="slots-bet-per-line"
          type="number"
          inputMode="decimal"
          min={0.01}
          max={maxBetPerLine}
          step={0.01}
          value={betPerLine}
          onChange={handleBetPerLineChange}
          disabled={isSpinning}
          className="bg-bg-base border border-border-light rounded-md px-3 py-2 text-text-primary font-mono tabular-nums focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:border-accent-gold focus:outline-none disabled:opacity-50"
          aria-describedby="slots-total-bet-helper"
        />
      </div>

      {/* Lines segmented control */}
      <div className="flex flex-col gap-1.5">
        <span
          id="slots-lines-label"
          className="text-xs uppercase tracking-wider text-text-secondary"
        >
          Active lines ({lines})
        </span>
        <div
          role="radiogroup"
          aria-labelledby="slots-lines-label"
          className="grid grid-cols-5 gap-1.5"
        >
          {Array.from({ length: MAX_LINES }, (_, i) => i + 1).map((n) => {
            const active = n === lines;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${n} line${n === 1 ? '' : 's'}`}
                onClick={() => setLines(n)}
                disabled={isSpinning}
                className={[
                  'py-2 rounded-md text-sm font-mono tabular-nums border transition-colors focus-visible:ring-2 focus-visible:ring-accent-gold focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
                  active
                    ? 'bg-accent-gold/20 border-accent-gold text-accent-gold'
                    : 'bg-bg-base border-border-light text-text-secondary hover:border-accent-gold/60',
                ].join(' ')}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* Total bet display */}
      <div
        id="slots-total-bet-helper"
        className="flex items-center justify-between bg-bg-base border border-border-light rounded-md px-3 py-2 text-xs"
      >
        <span className="uppercase tracking-wider text-text-secondary">Total bet</span>
        <span
          data-testid="slots-total-bet"
          className="font-mono tabular-nums text-text-primary"
        >
          {formatCredits(totalBet, { withUnit: false })}
        </span>
      </div>

      {/* Autoplay */}
      <div className="flex flex-col gap-2 border-t border-border-light pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wider text-text-secondary">
            Autoplay
          </span>
          <Button
            variant={autoplay ? 'accent' : 'outline'}
            size="sm"
            onClick={handleToggleAutoplay}
            disabled={status !== 'connected' || insufficient}
            aria-pressed={autoplay}
          >
            {autoplay ? `Stop (${autoplayRemaining} left)` : `Auto × ${AUTOPLAY_DEFAULT}`}
          </Button>
        </div>
        <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={stopOnWin}
            onChange={(e) => setStopOnWin(e.target.checked)}
            className="accent-accent-gold"
          />
          Stop on win
        </label>
      </div>

      {/* Hidden spin button alias for old test selectors */}
      <button
        type="button"
        data-testid="slots-spin-button"
        onClick={handleSpinClick}
        disabled={spinDisabled}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      >
        Spin
      </button>
    </BetControls>
  );

  const historyPanel = (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs uppercase tracking-wider text-text-secondary">
        Recent spins
      </h2>
      {history.length === 0 ? (
        <p className="text-xs text-text-secondary italic">No spins yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {history.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 bg-bg-base border border-border-light rounded-md px-2 py-1.5 text-xs"
            >
              <span className="font-mono tabular-nums text-text-secondary">
                {row.multiplier.toFixed(2)}×
              </span>
              <span
                className={[
                  'font-mono tabular-nums',
                  row.totalPayout > 0 ? 'text-status-success' : 'text-text-secondary',
                ].join(' ')}
              >
                {row.totalPayout > 0 ? '+' : ''}
                {formatCredits(row.totalPayout - row.totalBet, { withUnit: false })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const provablyFair = (
    <ProvablyFairPanel
      currentHash={serverSeedHash}
      clientSeed={clientSeed}
      onClientSeedChange={setClientSeed}
      history={pfHistory}
    />
  );

  return (
    <GameLayout
      title="Slots"
      gameType="slots"
      rules={rules}
      canvas={canvas}
      controls={controls}
      history={historyPanel}
      provablyFair={provablyFair}
    />
  );
};

export default SlotsGame;
