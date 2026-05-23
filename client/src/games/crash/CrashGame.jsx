import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import GameShell from '@/components/casino/GameShell';
import BetPanel from '@/components/casino/BetPanel';

import ProvablyFairPanel from '@/games/_shared/ProvablyFairPanel';
import DisconnectOverlay from '@/games/_shared/DisconnectOverlay';

import CrashHistory from './CrashHistory';
import CrashPlayersList from './CrashPlayersList';
import CrashActiveBets from './CrashActiveBets';
import CrashCurve from './CrashCurve';
import { formatMultiplier } from './crashUtils';
import { formatCredits } from '@/lib/formatCredits';

import useCrashPhaseLogic, { PHASE } from './useCrashPhaseLogic';

const MIN_BET = 1;
const MAX_BET = 5000;
const HISTORY_PILL_LIMIT = 8;

/**
 * CrashGame — Phase 2.3 visual rebuild.
 *
 * Render layer rebuilt with `GameShell` + `BetPanel` + SVG curve renderer.
 * All state-machine logic lives in `useCrashPhaseLogic`. This component is
 * now purely a function of that hook's return value.
 */
const CrashGame = () => {
  const navigate = useNavigate();
  const logic = useCrashPhaseLogic();
  const {
    phase,
    currentMultiplier,
    crashPoint,
    countdown,
    history,
    players,
    activeBets,
    betAmount,
    setBetAmount,
    autoCashoutAt,
    setAutoCashoutAt,
    betStatus,
    lastResult,
    clientSeed,
    setClientSeed,
    pfHistory,
    shake,
    flash,
    canPlaceBet,
    canCashout,
    placeBet,
    cashOut,
    status,
    lastError,
    serverSeedHash,
    auth,
    announcement,
    WinBurst,
  } = logic;

  const { isAuthenticated, loading, balance } = auth;

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login', {
        state: { from: '/games/crash', message: 'You must be logged in to play games.' },
      });
    }
  }, [isAuthenticated, loading, navigate]);

  // ─── UI pieces ───────────────────────────────────────────────────────────

  const isCashout = canCashout || betStatus === 'cashing_out';
  const primaryLabel = (() => {
    if (betStatus === 'placing') return 'Placing…';
    if (betStatus === 'cashing_out') return 'Cashing out…';
    if (isCashout) return `Cash out @ ${formatMultiplier(currentMultiplier)}`;
    if (betStatus === 'placed') return 'Bet placed';
    if (betStatus === 'cashed_out') return 'Cashed out';
    if (betStatus === 'lost') return 'Lost — wait for next';
    return 'Place Bet';
  })();

  const primaryVariant = isCashout ? 'primary' : 'accent';
  const primaryDisabled = (() => {
    if (isCashout) return betStatus === 'cashing_out';
    return !canPlaceBet || betStatus !== 'idle';
  })();

  const onPrimary = () => {
    if (isCashout) {
      cashOut();
    } else {
      placeBet();
    }
  };

  const statusLine = lastResult
    ? lastResult.type === 'win'
      ? `Won +${formatCredits(lastResult.profit)} @ ${formatMultiplier(lastResult.multiplier)}`
      : `Lost ${formatCredits(lastResult.lost)} @ ${formatMultiplier(lastResult.crashPoint)}`
    : null;

  const recentPills = useMemo(() => history.slice(0, HISTORY_PILL_LIMIT), [history]);

  const phaseLabel =
    phase === PHASE.RUNNING
      ? 'Live'
      : phase === PHASE.WAITING
        ? 'Starting'
        : phase === PHASE.CRASHED
          ? 'Crashed'
          : 'Connecting';

  const phaseDotClass =
    phase === PHASE.RUNNING
      ? 'bg-lime-400'
      : phase === PHASE.WAITING
        ? 'bg-accent-gold-light'
        : phase === PHASE.CRASHED
          ? 'bg-accent-rose'
          : 'bg-text-secondary';

  const extra = (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="crash-auto-cashout"
        className="text-xs uppercase tracking-wider text-text-secondary"
      >
        Auto cashout (×)
      </label>
      <input
        id="crash-auto-cashout"
        type="number"
        inputMode="decimal"
        min={1.01}
        step={0.01}
        value={autoCashoutAt}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v >= 1.01) setAutoCashoutAt(v);
          else setAutoCashoutAt(1.01);
        }}
        disabled={betStatus !== 'idle'}
        className="h-[44px] rounded-md border border-border-light bg-bg-base px-3 font-mono tabular-nums text-text-primary focus-visible:border-accent-gold focus-visible:ring-2 focus-visible:ring-accent-gold focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />
      {statusLine ? (
        <p className="text-xs text-text-secondary" role="status">
          {statusLine}
        </p>
      ) : null}
      {announcement ? (
        <span className="sr-only" role="status" aria-live="polite">
          {announcement}
        </span>
      ) : null}
    </div>
  );

  const panel = (
    <BetPanel
      bet={betAmount}
      onBetChange={setBetAmount}
      min={MIN_BET}
      max={MAX_BET}
      balance={balance}
      recentWin={lastResult?.type === 'win'}
      onPlaceBet={onPrimary}
      betLabel={primaryLabel}
      primaryVariant={primaryVariant}
      disabled={primaryDisabled}
      loading={betStatus === 'placing' || betStatus === 'cashing_out'}
      multiplier={phase === PHASE.RUNNING ? currentMultiplier : undefined}
      extra={extra}
      betInputId="crash-bet-amount"
    />
  );

  // (No legacy alias needed — the visible CTA label is "Place Bet" which
  // satisfies the E2E specs directly.)

  const stats = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.2em] text-text-secondary">
          Recent
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-text-secondary">
          <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${phaseDotClass}`} />
          {phaseLabel}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5" role="list" aria-label="Recent crash multipliers">
        {recentPills.length === 0 ? (
          <span className="text-xs text-text-muted">No rounds yet</span>
        ) : (
          recentPills.map((g) => {
            const cp = Number(g.crashPoint) || 0;
            const tone =
              cp >= 10
                ? 'bg-accent-gold/15 text-accent-gold-light ring-accent-gold/40'
                : cp >= 2
                  ? 'bg-lime-400/10 text-lime-300 ring-lime-400/30'
                  : 'bg-accent-rose/10 text-accent-rose ring-accent-rose/30';
            return (
              <span
                key={g.id}
                role="listitem"
                className={`inline-flex h-7 items-center rounded-full px-2.5 font-mono text-xs tabular-nums ring-1 ${tone}`}
              >
                {cp.toFixed(2)}x
              </span>
            );
          })
        )}
      </div>
      <CrashActiveBets bets={activeBets} currentMultiplier={currentMultiplier} />
    </div>
  );

  const boardChildren = (
    <div className={`relative ${shake ? 'animate-loss-shake' : ''}`}>
      <CrashCurve
        phase={phase}
        multiplier={currentMultiplier}
        crashPoint={crashPoint}
        countdown={countdown}
      />

      {/* Flash overlay */}
      <AnimatePresence>
        {flash ? (
          <motion.div
            key={flash}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.45 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={`pointer-events-none absolute inset-0 rounded-2xl ${
              flash === 'red'
                ? 'bg-accent-rose/40'
                : 'bg-lime-400/40'
            }`}
          />
        ) : null}
      </AnimatePresence>

      <DisconnectOverlay status={status} lastError={lastError} />
      <WinBurst />

      {/* Hidden game canvas alias for SR / legacy queries — preserved aria. */}
      <span className="sr-only" aria-label="Crash multiplier chart" data-testid="game-canvas-fallback" />

      {/* History + players below the board */}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <CrashHistory history={history} />
        <CrashPlayersList players={players} />
      </div>

      {/* Provably fair below the board */}
      <div className="mt-3">
        <ProvablyFairPanel
          currentHash={serverSeedHash}
          clientSeed={clientSeed}
          onClientSeedChange={setClientSeed}
          history={pfHistory}
        />
      </div>
    </div>
  );

  return (
    <GameShell title="Crash" accent="rose" panel={panel} stats={stats}>
      {boardChildren}
    </GameShell>
  );
};

export default CrashGame;
