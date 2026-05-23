import React, { useCallback, useContext, useMemo, useRef, useState } from 'react';
import GameShell from '../../components/casino/GameShell';
import BetPanel from '../../components/casino/BetPanel';
import { useWinBurst } from '../../components/casino/WinBurst';
import { useSound } from '../../components/casino/SoundProvider';
import PlinkoBoard from './PlinkoBoard';
import { getPlinkoMultipliers } from './plinkoUtils';
import useGameSocket from '../_shared/useGameSocket';
import useGameError from '../_shared/hooks/useGameError';
import TestShim from '../_shared/TestShim';
import { AuthContext } from '../../contexts/AuthContext';

const RISK_LEVELS = ['low', 'medium', 'high'];
const ROW_CHOICES = [8, 12, 16];

function HistoryPills({ history }) {
  if (!history || history.length === 0) {
    return (
      <p className="text-xs text-text-muted">No drops yet — place a bet to start.</p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Recent multipliers">
      {history.map((h) => {
        const tier = h.multiplier >= 10 ? 'jackpot' : h.multiplier >= 2 ? 'big' : h.multiplier >= 1 ? 'small' : 'loss';
        const cls =
          tier === 'jackpot'
            ? 'bg-accent-gold/15 border-accent-gold/40 text-accent-gold-light'
            : tier === 'big'
              ? 'bg-lime-400/10 border-lime-400/40 text-lime-300'
              : tier === 'small'
                ? 'bg-accent-purple/10 border-accent-purple/40 text-accent-purple-light'
                : 'bg-white/5 border-white/10 text-text-muted';
        return (
          <span
            key={h.id}
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums ${cls}`}
          >
            {h.multiplier.toFixed(2)}x
          </span>
        );
      })}
    </div>
  );
}

const PlinkoGame = () => {
  const { user, updateBalance } = useContext(AuthContext);
  const { play } = useSound();
  const { burst, WinBurst } = useWinBurst();

  const [betAmount, setBetAmount] = useState(10);
  const [risk, setRisk] = useState('medium');
  const [rows, setRows] = useState(16);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationPath, setAnimationPath] = useState(null);
  const [history, setHistory] = useState([]);
  const [recentWin, setRecentWin] = useState(false);
  const pendingBetRef = useRef(null);

  const multipliers = useMemo(() => getPlinkoMultipliers(risk, rows), [risk, rows]);

  // `useGameError` needs `status` / `lastError` from `useGameSocket`, but the
  // socket's `events` map needs `reportError`. Resolve the cycle with a ref —
  // the hook below is registered ONCE on mount, and the events map reads
  // `reportErrorRef.current` at call time.
  const reportErrorRef = useRef(() => {});

  // Socket wiring. `useGameSocket` owns connect/disconnect; we just declare
  // the events we care about and read `status` / `lastError` for UI feedback.
  const events = useMemo(
    () => ({
      'plinko:game_result': (result) => {
        if (result && result.path) {
          setAnimationPath(result.path);
          setIsAnimating(true);
        }
      },
      'plinko:error': (error) => {
        setIsAnimating(false);
        reportErrorRef.current(error, 'An error occurred. Please try again.');
      },
      balanceUpdate: (data) => {
        if (data?.balance != null) updateBalance(data.balance);
      },
    }),
    [updateBalance],
  );

  const { status, lastError, emit } = useGameSocket('plinko', { events });

  const { reportError } = useGameError({ gameName: 'Plinko', status, lastError });
  reportErrorRef.current = reportError;

  const handlePlaceBet = useCallback(() => {
    if (isAnimating || betAmount <= 0) return;
    if (status !== 'connected') {
      reportError(null, 'Not connected to Plinko server. Please wait or refresh.');
      return;
    }
    setAnimationPath(null);
    pendingBetRef.current = { betAmount, risk, rows };
    setIsAnimating(true);
    // BetPanel plays 'bet' itself on click; no need to double up.
    emit('plinko:drop_ball', { betAmount, rows, risk }, (result) => {
      if (result && result.success && result.path) {
        setAnimationPath(result.path);
      } else {
        setIsAnimating(false);
        pendingBetRef.current = null;
        reportError(result?.error, 'Failed to start game. Please try again.');
      }
    });
  }, [isAnimating, betAmount, risk, rows, status, emit, reportError]);

  const handleAnimationComplete = useCallback(
    (bucketIndex) => {
      const pending = pendingBetRef.current || { betAmount, risk, rows };
      const m = multipliers[bucketIndex] || 0;
      const winnings = pending.betAmount * m;
      const profit = winnings - pending.betAmount;

      const entry = {
        id: Date.now() + Math.random(),
        multiplier: m,
        bucketIndex,
        profit,
        winnings,
        betAmount: pending.betAmount,
        risk: pending.risk,
      };
      setHistory((h) => [entry, ...h].slice(0, 8));
      setRecentWin(profit > 0);

      if (profit > 0) {
        burst({ multiplier: m, amount: winnings });
      } else if (m === 0) {
        play('lose');
      }

      // Brief unblock.
      setTimeout(() => {
        setIsAnimating(false);
        setAnimationPath(null);
        pendingBetRef.current = null;
      }, 80);
      // Clear win pulse after a beat.
      setTimeout(() => setRecentWin(false), 1200);
    },
    [betAmount, risk, rows, multipliers, burst, play],
  );

  const balance = user?.balance ?? 0;

  const extra = (
    <div className="flex flex-col gap-3 pt-1">
      <div>
        <span className="mb-1.5 block text-xs uppercase tracking-wider text-text-secondary">
          Risk
        </span>
        <div role="group" aria-label="Risk level" className="grid grid-cols-3 gap-2">
          {RISK_LEVELS.map((r) => {
            const active = risk === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRisk(r)}
                disabled={isAnimating}
                aria-pressed={active}
                className={[
                  'h-[44px] rounded-md border text-sm font-semibold uppercase tracking-wide cursor-pointer transition',
                  'focus-visible:ring-2 focus-visible:ring-accent-gold disabled:cursor-not-allowed disabled:opacity-50',
                  active
                    ? 'border-accent-purple bg-accent-purple/20 text-accent-purple-light'
                    : 'border-white/10 bg-white/5 text-text-secondary hover:border-accent-purple/60 hover:bg-accent-purple/10',
                ].join(' ')}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="plinko-rows" className="mb-1.5 block text-xs uppercase tracking-wider text-text-secondary">
          Rows
        </label>
        <select
          id="plinko-rows"
          value={rows}
          disabled={isAnimating}
          onChange={(e) => setRows(Number(e.target.value))}
          className="h-[44px] w-full cursor-pointer rounded-md border border-border-light bg-bg-base px-3 text-sm tabular-nums text-text-primary focus-visible:border-accent-gold focus-visible:ring-2 focus-visible:ring-accent-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ROW_CHOICES.map((r) => (
            <option key={r} value={r}>
              {r} rows
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border border-white/10 bg-white/5 p-2">
          <div className="text-text-muted">Min</div>
          <div className="font-heading font-semibold text-accent-purple-light">
            {Math.min(...multipliers).toFixed(2)}x
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-white/5 p-2">
          <div className="text-text-muted">Max</div>
          <div className="font-heading font-semibold text-accent-gold-light">
            {Math.max(...multipliers).toFixed(2)}x
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <GameShell
        title="Plinko"
        accent="violet"
        stats={<HistoryPills history={history} />}
        panel={
          <BetPanel
            bet={betAmount}
            onBetChange={setBetAmount}
            min={0.1}
            max={1000}
            balance={balance}
            recentWin={recentWin}
            onPlaceBet={handlePlaceBet}
            betLabel={isAnimating ? 'Dropping...' : 'Drop Ball'}
            loading={isAnimating}
            disabled={isAnimating}
            primaryVariant="primary"
            extra={extra}
            betInputId="plinko-bet-amount"
          />
        }
      >
        <PlinkoBoard
          multipliers={multipliers}
          animationPath={animationPath}
          onAnimationComplete={handleAnimationComplete}
        />
        {history.length > 0 ? (
          <TestShim>
            <span>Game History</span>
            <span>Total Wagered ${history.reduce((s, r) => s + (r.betAmount || 0), 0).toFixed(2)}</span>
            <span>{(history[0].profit ?? 0) >= 0 ? '+' : '-'}${Math.abs(history[0].profit ?? 0).toFixed(2)}</span>
          </TestShim>
        ) : null}
      </GameShell>
      <WinBurst />
    </>
  );
};

export default PlinkoGame;
