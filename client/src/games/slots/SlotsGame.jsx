import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import GameShell from '../../components/casino/GameShell';
import BetPanel from '../../components/casino/BetPanel';
import { useWinBurst } from '../../components/casino/WinBurst';
import { useSound } from '../../components/casino/SoundProvider';
import { useGameSocket } from '../_shared/useGameSocket';
import { useAnnouncer } from '../_shared/hooks/useAnnouncer';
import DisconnectOverlay from '../_shared/DisconnectOverlay';
import TestShim from '../_shared/TestShim';
import SlotsBoard from './SlotsBoard';
import { AuthContext } from '../../contexts/AuthContext';
import { formatCredits } from '../../lib/formatCredits';
import { normalizeSymbolKey, SYMBOL_META } from './symbols';

/**
 * SlotsGame — Phase 2.5 visual rebuild.
 *
 * Render layer is Pixi (SlotsBoard); bet panel is the shared BetPanel.
 * Server contract unchanged: `slots:join` on connect, `slots:spin` per spin
 * with `{ betPerLine, lines }` payload and `{ ok, reels, hits, totalPayout,
 * multiplier, newBalance }` ack.
 */

const REELS = 5;
const ROWS = 3;
const MIN_LINES = 1;
const MAX_LINES = 5;
const HISTORY_LIMIT = 8;
const BIG_WIN_THRESHOLD = 10; // multiplier ≥ 10× → cinematic flash

const EMPTY_GRID = Array.from({ length: REELS }, () =>
  Array.from({ length: ROWS }, () => 'bar'),
);

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

function topSymbolFromHits(hits) {
  if (!Array.isArray(hits) || hits.length === 0) return null;
  let best = hits[0];
  for (const h of hits) {
    if ((h?.payout || 0) > (best?.payout || 0)) best = h;
  }
  return best;
}

const SlotsGame = () => {
  const { user, updateBalance } = useContext(AuthContext) || {};
  const balance = typeof user?.balance === 'number' ? user.balance : 0;
  const { play } = useSound();
  const { burst, WinBurst: WinBurstNode } = useWinBurst();

  const [betPerLine, setBetPerLine] = useState(1);
  const [lines, setLines] = useState(MAX_LINES);

  const [reels, setReels] = useState(EMPTY_GRID);
  const [hits, setHits] = useState([]);
  const [lastSpin, setLastSpin] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showWinHighlights, setShowWinHighlights] = useState(false);
  const [recentWin, setRecentWin] = useState(false);

  const [history, setHistory] = useState([]);

  const highlightTimerRef = useRef(null);
  const recentWinTimerRef = useRef(null);
  const burstRef = useRef(burst);
  burstRef.current = burst;

  const { announcement, announce } = useAnnouncer(2000);

  const totalBet = useMemo(() => {
    const bet = Number(betPerLine) || 0;
    const ln = Math.max(MIN_LINES, Math.min(MAX_LINES, Number(lines) || 0));
    return Math.round(bet * ln * 100) / 100;
  }, [betPerLine, lines]);

  const handleGameState = useCallback(
    (payload) => {
      if (payload?.balance != null && typeof updateBalance === 'function') {
        updateBalance(payload.balance);
      }
    },
    [updateBalance],
  );

  const { emit, status, lastError } = useGameSocket('slots', {
    events: { gameState: handleGameState },
  });

  // Send join ack once on connect.
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

  // Cleanup timers on unmount.
  useEffect(
    () => () => {
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
      if (recentWinTimerRef.current) window.clearTimeout(recentWinTimerRef.current);
    },
    [],
  );

  const winningCells = useMemo(() => {
    if (!showWinHighlights) return new Set();
    return computeWinningCells(hits, reels);
  }, [showWinHighlights, hits, reels]);

  const isBigWin = useMemo(() => {
    if (!lastSpin || !showWinHighlights) return false;
    return (Number(lastSpin.multiplier) || 0) >= BIG_WIN_THRESHOLD;
  }, [lastSpin, showWinHighlights]);

  const handleSpinClick = useCallback(() => {
    if (isSpinning) return;
    const bet = Number(betPerLine);
    if (!Number.isFinite(bet) || bet <= 0) return;
    const activeLines = Math.max(MIN_LINES, Math.min(MAX_LINES, Number(lines) || MAX_LINES));
    const spinTotalBet = Math.round(bet * activeLines * 100) / 100;
    if (spinTotalBet > balance) return;
    if (status !== 'connected') return;

    setIsSpinning(true);
    setShowWinHighlights(false);
    setHits([]);
    setLastSpin(null);
    play('bet');

    emit('slots:spin', { betPerLine: bet, lines: activeLines }, (resp) => {
      if (!resp || resp.ok === false) {
        setIsSpinning(false);
        announce('Spin failed');
        return;
      }

      const safeReels = Array.isArray(resp.reels)
        ? resp.reels.map((col) =>
            Array.isArray(col) ? col.map((sym) => normalizeSymbolKey(sym)) : [],
          )
        : EMPTY_GRID;
      setReels(safeReels);
      setHits(Array.isArray(resp.hits) ? resp.hits : []);
      setLastSpin({
        gameId: resp.gameId,
        totalPayout: Number(resp.totalPayout) || 0,
        multiplier: Number(resp.multiplier) || 0,
        activeLines,
      });

      if (typeof resp.newBalance === 'number' && typeof updateBalance === 'function') {
        updateBalance(resp.newBalance);
      }

      const payout = Number(resp.totalPayout) || 0;
      const winningLineCount = Array.isArray(resp.hits) ? resp.hits.length : 0;
      if (payout > 0) {
        announce(
          `Won ${formatCredits(payout, { withUnit: false })} credits on ${winningLineCount} line${
            winningLineCount === 1 ? '' : 's'
          }`,
        );
      } else {
        announce('No payout');
      }

      const topHit = topSymbolFromHits(resp.hits);
      setHistory((prev) =>
        [
          {
            id: resp.gameId || `${Date.now()}-${Math.random()}`,
            totalPayout: payout,
            multiplier: Number(resp.multiplier) || 0,
            totalBet: spinTotalBet,
            topSymbol: topHit ? normalizeSymbolKey(topHit.symbol) : null,
            timestamp: Date.now(),
          },
          ...prev,
        ].slice(0, HISTORY_LIMIT),
      );

      setShowWinHighlights(true);

      // Celebrate + sound feedback after reels settle.
      const mult = Number(resp.multiplier) || 0;
      const settleDelayMs = 2300;
      window.setTimeout(() => {
        if (payout > 0 && mult >= 2) {
          burstRef.current?.({ multiplier: mult, amount: payout });
          setRecentWin(true);
          if (recentWinTimerRef.current) window.clearTimeout(recentWinTimerRef.current);
          recentWinTimerRef.current = window.setTimeout(() => setRecentWin(false), 1500);
        } else if (payout > 0) {
          play('cashout');
        } else {
          play('lose');
        }
      }, settleDelayMs);

      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = window.setTimeout(() => {
        setShowWinHighlights(false);
      }, 4500);

      setIsSpinning(false);
    });
  }, [
    isSpinning,
    betPerLine,
    lines,
    balance,
    status,
    emit,
    updateBalance,
    announce,
    play,
  ]);

  // BetPanel extras: line selector + total bet + last result summary.
  const extras = (
    <div className="flex flex-col gap-2">
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
                onClick={() => !isSpinning && setLines(n)}
                disabled={isSpinning}
                className={[
                  'h-[44px] rounded-md text-sm font-mono tabular-nums transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold',
                  active
                    ? 'bg-accent-purple text-white shadow-glow-amber cursor-pointer'
                    : 'border border-white/10 bg-white/5 text-text-primary hover:border-accent-purple hover:bg-accent-purple/10 cursor-pointer',
                  isSpinning ? 'cursor-not-allowed opacity-60' : '',
                ].join(' ')}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-xs ring-1 ring-white/10">
        <span className="text-text-secondary uppercase tracking-wider">Total bet</span>
        <span
          data-testid="slots-total-bet"
          className="font-mono tabular-nums text-text-primary"
        >
          {formatCredits(totalBet, { withUnit: false })}
        </span>
      </div>

      <div className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-xs ring-1 ring-white/10">
        <span className="text-text-secondary uppercase tracking-wider">Last spin</span>
        <span
          data-testid="slots-result"
          className={[
            'font-mono tabular-nums',
            lastSpin && lastSpin.totalPayout > 0
              ? 'text-lime-300'
              : 'text-text-secondary',
          ].join(' ')}
        >
          {lastSpin
            ? lastSpin.totalPayout > 0
              ? `Won +${formatCredits(lastSpin.totalPayout, { withUnit: false })}`
              : 'No win this spin'
            : '—'}
        </span>
      </div>

      {/* Hidden test-shims — legacy E2E specs use a single range slider
          (#slots-lines) instead of the radiogroup, and target the bet input
          via #slots-bet-per-line. The visible UI is unchanged. */}
      <TestShim>
        <input
          id="slots-lines"
          type="range"
          min={MIN_LINES}
          max={MAX_LINES}
          step={1}
          value={lines}
          onChange={(e) => !isSpinning && setLines(Number(e.target.value))}
          disabled={isSpinning}
          aria-label="Lines (test-shim)"
          tabIndex={-1}
        />
        <input
          id="slots-bet-per-line"
          type="number"
          inputMode="decimal"
          step={0.10}
          value={Number(betPerLine).toFixed(2)}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) setBetPerLine(n);
          }}
          disabled={isSpinning}
          aria-label="Bet per line (test-shim)"
          tabIndex={-1}
        />
      </TestShim>
    </div>
  );

  const insufficient = totalBet > balance || balance < 0.01;

  const panel = (
    <BetPanel
      bet={betPerLine}
      onBetChange={setBetPerLine}
      min={0.01}
      max={Math.max(0.01, Math.floor((balance / Math.max(1, lines)) * 100) / 100 || 1)}
      step={0.10}
      balance={balance}
      recentWin={recentWin}
      onPlaceBet={handleSpinClick}
      betLabel={isSpinning ? 'Spinning…' : 'Spin'}
      loading={isSpinning}
      disabled={isSpinning || insufficient || status !== 'connected'}
      extra={extras}
      betInputId="slots-bet-input"
    />
  );

  const stats = (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs uppercase tracking-wider text-text-secondary">
        Recent spins
      </h2>
      <div className="flex flex-wrap gap-1.5" aria-label="Recent spin results">
        {history.length === 0 ? (
          <span className="text-xs text-text-muted">No spins yet.</span>
        ) : (
          history.map((row) => {
            const win = row.totalPayout > 0;
            const label = row.topSymbol
              ? SYMBOL_META[row.topSymbol]?.label || row.topSymbol
              : null;
            return (
              <span
                key={row.id}
                title={label ? `${label} · ${row.multiplier.toFixed(2)}×` : `${row.multiplier.toFixed(2)}×`}
                className={[
                  'inline-flex h-7 items-center gap-1 rounded-full px-2.5',
                  'font-mono text-[11px] font-semibold tabular-nums ring-1',
                  win
                    ? 'bg-lime-400/10 text-lime-300 ring-lime-400/30'
                    : 'bg-white/5 text-text-secondary ring-white/10',
                ].join(' ')}
              >
                <span aria-hidden="true">{label ? `${label} ` : ''}</span>
                <span>{row.multiplier.toFixed(2)}×</span>
              </span>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <GameShell title="Slots" accent="magenta" panel={panel} stats={stats}>
      <div className="relative">
        <DisconnectOverlay status={status} lastError={lastError} />
        <SlotsBoard
          reels={reels}
          spinning={isSpinning}
          winningCells={winningCells}
          bigWin={isBigWin}
        />
        {/* Polite live region for screen readers */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </div>
        {/* Hidden spin button alias + reel DOM mirror for legacy test
            selectors. The visible spin CTA is rendered by BetPanel; this
            shim only exists so `getByTestId('slots-spin-button')` resolves
            and the reels grid can be asserted on without a Pixi readback. */}
        <TestShim>
          <button
            type="button"
            data-testid="slots-spin-button"
            aria-label="Spin (test-shim)"
            onClick={handleSpinClick}
            disabled={isSpinning || insufficient || status !== 'connected'}
            tabIndex={-1}
          >
            {isSpinning ? 'Spinning…' : 'Spin'}
          </button>
          <div data-testid="slots-reels">
            {Array.from({ length: REELS }, (_, i) => {
              const col = Array.isArray(reels[i]) ? reels[i] : [];
              const text = lastSpin ? col.slice(0, ROWS).join(' ') : '?';
              return (
                <span key={i} data-testid={`slots-reel-${i}`}>
                  {text}
                </span>
              );
            })}
          </div>
        </TestShim>
      </div>
      <WinBurstNode />
    </GameShell>
  );
};

export default SlotsGame;
