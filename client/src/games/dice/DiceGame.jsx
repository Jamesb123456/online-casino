import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';

import GameShell from '@/components/casino/GameShell';
import BetPanel from '@/components/casino/BetPanel';
import { useWinBurst } from '@/components/casino/WinBurst';
import { useSound } from '@/components/casino/SoundProvider';

import ProvablyFairPanel from '../_shared/ProvablyFairPanel';
import DisconnectOverlay from '../_shared/DisconnectOverlay';
import TestShim from '../_shared/TestShim';
import useGameSocket from '../_shared/useGameSocket';
import useAnnouncer from '../_shared/hooks/useAnnouncer';

import useAuth from '@/hooks/useAuth';
import { useAudio } from '@/contexts/AudioContext';
import { formatCredits } from '@/lib/formatCredits';

import DiceBoard from './DiceBoard';
import DiceSlider from './DiceSlider';

const HOUSE_EDGE = 0.04;
const MAX_MULTIPLIER = 50;
const MIN_TARGET = 1;
const MAX_TARGET = 99;
const MIN_BET = 1;
const MAX_BET = 10000;
const HISTORY_PILL_LIMIT = 8;

/**
 * Compute client-side preview multiplier. Server is authoritative; this is
 * only used for display so players see what they're committing to.
 */
const previewMultiplier = (target, direction, houseEdge = HOUSE_EDGE) => {
  const t = Math.max(MIN_TARGET, Math.min(MAX_TARGET, Number(target) || 0));
  const winProb = direction === 'under' ? t / 100 : (100 - t) / 100;
  if (winProb <= 0 || winProb >= 1) return 0;
  const raw = (1 - houseEdge) / winProb;
  return Math.min(Math.floor(raw * 100) / 100, MAX_MULTIPLIER);
};

const previewWinProb = (target, direction) => {
  const t = Math.max(MIN_TARGET, Math.min(MAX_TARGET, Number(target) || 0));
  const p = direction === 'under' ? t / 100 : (100 - t) / 100;
  return Math.max(0, Math.min(1, p));
};

const clampTarget = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return MIN_TARGET;
  return Math.max(MIN_TARGET, Math.min(MAX_TARGET, Math.round(v)));
};

/**
 * DiceGame — Phase 2.7 visual rebuild.
 *
 * Render layer rebuilt with `GameShell` + `BetPanel` + `DiceSlider` +
 * `DiceBoard`. Socket transport (`useGameSocket('dice')`) and game logic
 * are unchanged.
 */
const DiceGame = () => {
  const { user, updateBalance } = useAuth();
  // Legacy audio context — preserved so existing tests (which mock useAudio)
  // continue to assert that `play(SFX.BET|WIN|LOSS|BIG_WIN)` is called.
  const { play: playLegacy, stopAmbient, SFX } = useAudio();
  const { play: playFx } = useSound();
  const { burst, WinBurst } = useWinBurst();
  const balance = typeof user?.balance === 'number' ? user.balance : 0;

  const [betAmount, setBetAmount] = useState(10);
  const [target, setTarget] = useState(50);
  const [direction, setDirection] = useState('under');
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [pfHistory, setPfHistory] = useState([]);
  const [clientSeed, setClientSeed] = useState('');
  const [resultPulse, setResultPulse] = useState(0);

  const { announcement, announce } = useAnnouncer(1800);

  // Stop lobby ambient on entry.
  useEffect(() => {
    stopAmbient();
  }, [stopAmbient]);

  // Socket wiring. `gameState` is captured by useGameSocket (sets
  // serverSeedHash) and forwarded here so we can hydrate the client seed.
  const events = useMemo(
    () => ({
      gameState: (payload) => {
        const seed = payload?.state?.clientSeed ?? payload?.clientSeed;
        if (typeof seed === 'string' && seed.length > 0) {
          setClientSeed((cur) => cur || seed);
        }
      },
    }),
    [],
  );

  const { status, lastError, serverSeedHash, emit } = useGameSocket('dice', {
    events,
  });

  // Send a no-op join once the socket is connected.
  useEffect(() => {
    if (status !== 'connected') return;
    emit('dice:join', {}, () => {});
  }, [status, emit]);

  const multiplier = useMemo(
    () => previewMultiplier(target, direction),
    [target, direction],
  );
  const winProb = useMemo(
    () => previewWinProb(target, direction),
    [target, direction],
  );
  const potentialPayout = useMemo(() => {
    const b = Number(betAmount);
    if (!Number.isFinite(b) || b <= 0) return 0;
    return b * multiplier;
  }, [betAmount, multiplier]);

  const handleRoll = useCallback(() => {
    if (isRolling) return;
    if (status !== 'connected') return;
    const bet = Number(betAmount);
    if (!Number.isFinite(bet) || bet <= 0) return;
    const t = clampTarget(target);

    setIsRolling(true);
    playLegacy(SFX.BET);
    playFx('bet');

    emit('dice:roll', { betAmount: bet, target: t, direction }, (resp) => {
      try {
        if (resp && resp.ok) {
          const entry = {
            id: resp.gameId || `${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
            betAmount: bet,
            target: resp.target,
            direction: resp.direction,
            result: resp.result,
            win: resp.win,
            multiplier: resp.multiplier,
            winAmount: resp.winAmount,
            profit: resp.win ? resp.winAmount - bet : -bet,
          };

          setLastResult({
            result: resp.result,
            target: resp.target,
            direction: resp.direction,
            win: resp.win,
            multiplier: resp.multiplier,
            winAmount: resp.winAmount,
          });
          setResultPulse((n) => n + 1);
          setHistory((prev) => [entry, ...prev].slice(0, 10));

          if (resp.serverSeedHash || resp.serverSeed) {
            setPfHistory((prev) => [
              {
                id: entry.id,
                gameType: 'dice',
                serverSeedHash: resp.serverSeedHash || null,
                serverSeed: resp.serverSeed || null,
                clientSeed: resp.clientSeed || clientSeed || null,
                nonce: resp.nonce ?? null,
                outcome: resp.result,
                multiplier: resp.multiplier,
                timestamp: Date.now(),
              },
              ...prev,
            ].slice(0, 25));
          }

          if (resp.win) {
            const big =
              typeof resp.winAmount === 'number' && resp.winAmount > bet * 5;
            playLegacy(big ? SFX.BIG_WIN : SFX.WIN);
            playFx('cashout');
            burst({
              multiplier: typeof resp.multiplier === 'number' ? resp.multiplier : 2,
              amount: typeof resp.winAmount === 'number' ? resp.winAmount - bet : 0,
            });
            announce(
              `Rolled ${resp.result.toFixed(2)} — won ${formatCredits(
                resp.winAmount,
                { withUnit: false },
              )} credits`,
            );
          } else {
            playLegacy(SFX.LOSS);
            playFx('lose');
            announce(`Rolled ${resp.result.toFixed(2)} — lost`);
          }

          if (typeof resp.newBalance === 'number') {
            updateBalance(resp.newBalance);
          }
        } else {
          console.error('Dice roll failed:', resp?.error);
          announce(`Roll failed: ${resp?.error || 'unknown error'}`);
        }
      } finally {
        setIsRolling(false);
      }
    });
  }, [
    isRolling,
    status,
    betAmount,
    target,
    direction,
    emit,
    playLegacy,
    playFx,
    SFX,
    updateBalance,
    announce,
    burst,
    clientSeed,
  ]);

  // ─── UI pieces ───────────────────────────────────────────────────────────

  const board = (
    <div className="relative">
      <DisconnectOverlay status={status} lastError={lastError} />
      <DiceBoard
        isRolling={isRolling}
        result={lastResult ? lastResult.result : null}
        target={clampTarget(target)}
        direction={direction}
        win={lastResult ? lastResult.win : null}
        pulseKey={resultPulse}
      />
      <WinBurst />
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div className="mt-4">
        <ProvablyFairPanel
          currentHash={serverSeedHash}
          clientSeed={clientSeed}
          onClientSeedChange={setClientSeed}
          history={pfHistory}
        />
      </div>
    </div>
  );

  const extra = (
    <div className="flex flex-col gap-4">
      {/* Direction toggle */}
      <div className="flex flex-col gap-1.5">
        <span
          id="dice-direction-label"
          className="text-xs uppercase tracking-wider text-text-secondary"
        >
          Direction
        </span>
        <div
          aria-labelledby="dice-direction-label"
          className="flex gap-2"
        >
          <button
            type="button"
            aria-checked={direction === 'under'}
            aria-pressed={direction === 'under'}
            onClick={() => setDirection('under')}
            disabled={isRolling}
            className={[
              'flex-1 min-h-[44px] rounded-md text-sm font-medium transition-colors',
              'focus-visible:ring-2 focus-visible:ring-accent-gold focus:outline-none disabled:opacity-50',
              'cursor-pointer',
              direction === 'under'
                ? 'bg-teal-500/15 border border-teal-300 text-teal-200'
                : 'bg-bg-base border border-border-light text-text-secondary hover:text-text-primary',
            ].join(' ')}
          >
            Roll Under
          </button>
          <button
            type="button"
            aria-checked={direction === 'over'}
            aria-pressed={direction === 'over'}
            onClick={() => setDirection('over')}
            disabled={isRolling}
            className={[
              'flex-1 min-h-[44px] rounded-md text-sm font-medium transition-colors',
              'focus-visible:ring-2 focus-visible:ring-accent-gold focus:outline-none disabled:opacity-50',
              'cursor-pointer',
              direction === 'over'
                ? 'bg-teal-500/15 border border-teal-300 text-teal-200'
                : 'bg-bg-base border border-border-light text-text-secondary hover:text-text-primary',
            ].join(' ')}
          >
            Roll Over
          </button>
        </div>
      </div>

      {/* Slider */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wider text-text-secondary">
            Target
          </span>
          <span className="font-mono text-sm tabular-nums text-accent-gold-light">
            {clampTarget(target).toFixed(2)}
          </span>
        </div>
        <DiceSlider
          id="dice-target"
          ariaLabel="Threshold handle"
          value={clampTarget(target)}
          onChange={(n) => setTarget(clampTarget(n))}
          min={MIN_TARGET}
          max={MAX_TARGET}
          direction={direction}
          disabled={isRolling}
        />
      </div>

      {/* Win-chance / multiplier / payout readout */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md bg-white/5 border border-white/10 p-2">
          <div className="text-[10px] uppercase tracking-wider text-text-secondary">
            Win Chance
          </div>
          <div
            data-testid="dice-win-chance"
            className="font-heading text-sm font-semibold text-text-primary tabular-nums"
          >
            {(winProb * 100).toFixed(2)}%
          </div>
        </div>
        <div className="rounded-md bg-white/5 border border-white/10 p-2">
          <div className="text-[10px] uppercase tracking-wider text-text-secondary">
            Multiplier
          </div>
          <div
            data-testid="dice-multiplier"
            className="font-heading text-sm font-semibold text-accent-gold-light tabular-nums"
          >
            {multiplier.toFixed(2)}x
          </div>
        </div>
        <div className="rounded-md bg-white/5 border border-white/10 p-2">
          <div className="text-[10px] uppercase tracking-wider text-text-secondary">
            Payout
          </div>
          <div
            data-testid="dice-potential-payout"
            className="font-heading text-sm font-semibold text-text-primary tabular-nums"
          >
            {formatCredits(potentialPayout, { withUnit: false })}
          </div>
        </div>
      </div>
    </div>
  );

  const panel = (
    <BetPanel
      bet={betAmount}
      onBetChange={setBetAmount}
      min={MIN_BET}
      max={MAX_BET}
      balance={balance}
      recentWin={lastResult?.win === true}
      onPlaceBet={handleRoll}
      betLabel={isRolling ? 'Rolling...' : 'Roll Dice'}
      disabled={isRolling || status !== 'connected'}
      loading={isRolling}
      extra={extra}
      betInputId="dice-bet"
    />
  );

  const recentRolls = useMemo(() => history.slice(0, HISTORY_PILL_LIMIT), [history]);

  const stats = (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs uppercase tracking-[0.2em] text-text-secondary">
        Recent rolls
      </h2>
      {recentRolls.length === 0 ? (
        <p className="text-xs text-text-secondary italic">No rolls yet</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5" role="list" aria-label="Recent dice rolls">
          {recentRolls.map((h) => (
            <li
              key={h.id}
              role="listitem"
              className={[
                'inline-flex h-7 items-center rounded-full px-2.5 font-mono text-xs tabular-nums ring-1',
                h.win
                  ? 'bg-lime-400/10 text-lime-300 ring-lime-400/30'
                  : 'bg-accent-rose/10 text-accent-rose ring-accent-rose/30',
              ].join(' ')}
              title={`${h.direction} ${h.target.toFixed(2)} → ${h.result.toFixed(2)}`}
            >
              {h.result.toFixed(2)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <GameShell title="Dice" accent="teal" panel={panel} stats={stats}>
      {board}
      {/* Roll button shim — rendered at the GameShell root, outside the
          board overlay tree, so legacy E2E selectors can click it without
          a parent overlay intercepting pointer events. */}
      <RollButtonTestidShim
        onClick={handleRoll}
        disabled={isRolling || status !== 'connected'}
      />
    </GameShell>
  );
};

/**
 * RollButtonTestidShim — minimal-impact button mirroring the primary CTA so
 * legacy test selectors (`data-testid="dice-roll-button"`) keep working.
 *
 * Note: the button is offscreen-positioned rather than `sr-only` so
 * Playwright's actionability check (which treats `aria-hidden` + zero-size
 * elements as not visible) still considers it clickable. The visible CTA is
 * rendered by BetPanel.
 */
const RollButtonTestidShim = ({ onClick, disabled }) => (
  <TestShim>
    <button
      type="button"
      data-testid="dice-roll-button"
      onClick={onClick}
      disabled={disabled}
      tabIndex={-1}
    >
      Roll Dice
    </button>
  </TestShim>
);

export default DiceGame;
export { previewMultiplier, previewWinProb };
