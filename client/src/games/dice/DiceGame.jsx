import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import GameLayout from '../_shared/GameLayout';
import BetControls from '../_shared/BetControls';
import ProvablyFairPanel from '../_shared/ProvablyFairPanel';
import DisconnectOverlay from '../_shared/DisconnectOverlay';
import useGameSocket from '../_shared/useGameSocket';
import useAnnouncer from '../_shared/hooks/useAnnouncer';
import useAuth from '@/hooks/useAuth';
import { useAudio } from '@/contexts/AudioContext';
import { formatCredits } from '@/lib/formatCredits';
import rules from './rules';

const HOUSE_EDGE = 0.04;
const MAX_MULTIPLIER = 50;
const MIN_TARGET = 1;
const MAX_TARGET = 99;
const MIN_BET = 1;
const MAX_BET = 10000;

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
  return Math.max(MIN_TARGET, Math.min(MAX_TARGET, v));
};

const DiceGame = () => {
  const { user, updateBalance } = useAuth();
  const { play, stopAmbient, SFX } = useAudio();
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
  const targetInputRef = useRef(null);

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
    []
  );

  const { status, lastError, serverSeedHash, emit } = useGameSocket('dice', {
    events,
  });

  // Send a no-op join once the socket is connected. The server's
  // join handshake is the `gameState` emit; this :join event matches the
  // legacy contract and lets the server log the session.
  useEffect(() => {
    if (status !== 'connected') return;
    emit('dice:join', {}, () => {});
  }, [status, emit]);

  const multiplier = useMemo(
    () => previewMultiplier(target, direction),
    [target, direction]
  );
  const winProb = useMemo(
    () => previewWinProb(target, direction),
    [target, direction]
  );
  const potentialPayout = useMemo(() => {
    const b = Number(betAmount);
    if (!Number.isFinite(b) || b <= 0) return 0;
    return b * multiplier;
  }, [betAmount, multiplier]);

  const handleTargetChange = useCallback((e) => {
    setTarget(clampTarget(e.target.value));
  }, []);

  const handleTargetKey = useCallback((e) => {
    // Arrow keys step by 1; Shift+Arrow steps by 10. The native range input
    // already handles ArrowLeft/Right with step=1, but we want to override for
    // Shift modifiers and keep the number input in sync.
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const dir = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : -1;
      const step = e.shiftKey ? 10 : 1;
      e.preventDefault();
      setTarget((cur) => clampTarget(cur + dir * step));
    }
  }, []);

  const handleRoll = useCallback(() => {
    if (isRolling) return;
    if (status !== 'connected') return;
    const bet = Number(betAmount);
    if (!Number.isFinite(bet) || bet <= 0) return;
    const t = clampTarget(target);

    setIsRolling(true);
    play(SFX.BET);

    emit(
      'dice:roll',
      { betAmount: bet, target: t, direction },
      (resp) => {
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

            // Push to PF history. The server's roll ack does not always
            // include the seed reveal; include it when present so future
            // verification works.
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
              play(big ? SFX.BIG_WIN : SFX.WIN);
              announce(
                `Rolled ${resp.result.toFixed(2)} — won ${formatCredits(
                  resp.winAmount,
                  { withUnit: false }
                )} credits`
              );
            } else {
              play(SFX.LOSS);
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
      }
    );
  }, [
    isRolling,
    status,
    betAmount,
    target,
    direction,
    emit,
    play,
    SFX,
    updateBalance,
    announce,
    clientSeed,
  ]);

  // === Canvas slot: result display + range bar ===
  const resultColor = lastResult
    ? lastResult.win
      ? 'text-status-success'
      : 'text-status-error'
    : 'text-text-primary';

  // Position helpers for the range bar (percentages along 0..100).
  const targetPct = `${(clampTarget(target) / 100) * 100}%`;
  const resultPct = lastResult
    ? `${Math.max(0, Math.min(100, lastResult.result))}%`
    : null;

  // The "winning zone" highlight: 0..target (under) or target..100 (over).
  const winZoneStyle = direction === 'under'
    ? { left: '0%', right: `${100 - clampTarget(target)}%` }
    : { left: `${clampTarget(target)}%`, right: '0%' };

  const canvas = (
    <div className="relative w-full">
      <DisconnectOverlay status={status} lastError={lastError} />
      <div className="flex flex-col items-center justify-center gap-6 py-8 lg:py-12">
        <div className="text-xs uppercase tracking-wider text-text-secondary">
          Roll result
        </div>
        <div
          key={resultPulse}
          data-testid="dice-result"
          className={`text-6xl lg:text-7xl font-heading font-bold tabular-nums transition-transform duration-200 ${resultColor} ${
            lastResult ? 'animate-[pulse_0.4s_ease-out]' : ''
          }`}
          aria-live="polite"
        >
          {lastResult ? lastResult.result.toFixed(2) : '—'}
        </div>
        {lastResult ? (
          <div className="text-sm text-text-secondary">
            Target {lastResult.direction} {lastResult.target.toFixed(2)} ·{' '}
            {lastResult.win
              ? `Won ${formatCredits(lastResult.winAmount, {
                  withUnit: false,
                })} at ${lastResult.multiplier.toFixed(2)}x`
              : 'Loss'}
          </div>
        ) : (
          <div className="text-sm text-text-secondary italic">
            Place a bet to roll the dice
          </div>
        )}

        {/* Range bar */}
        <div className="w-full max-w-lg pt-4">
          <div
            className="relative h-3 rounded-full bg-bg-base border border-border-light overflow-visible"
            aria-hidden="true"
          >
            <div
              className="absolute top-0 bottom-0 bg-status-success/30 rounded-full"
              style={winZoneStyle}
            />
            {/* target marker */}
            <div
              className="absolute -top-1 -bottom-1 w-0.5 bg-accent-gold shadow-glow-gold"
              style={{ left: targetPct, transform: 'translateX(-50%)' }}
            />
            {/* result marker */}
            {resultPct ? (
              <div
                className={`absolute -top-2 -bottom-2 w-1 rounded-full ${
                  lastResult?.win ? 'bg-status-success' : 'bg-status-error'
                }`}
                style={{ left: resultPct, transform: 'translateX(-50%)' }}
              />
            ) : null}
          </div>
          <div className="flex justify-between text-[10px] text-text-secondary mt-1 font-mono tabular-nums">
            <span>0.00</span>
            <span>Target {clampTarget(target).toFixed(2)}</span>
            <span>99.99</span>
          </div>
        </div>
      </div>
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
    </div>
  );

  // === Controls slot ===
  const controls = (
    <BetControls
      value={Number(betAmount) || 0}
      onChange={(n) => setBetAmount(n)}
      min={MIN_BET}
      max={MAX_BET}
      balance={balance}
      halveDouble
      primaryAction={handleRoll}
      primaryDisabled={isRolling || status !== 'connected'}
      primaryLabel={isRolling ? 'Rolling…' : 'Roll Dice'}
    >
      <div className="flex flex-col gap-3">
        {/* Direction toggle */}
        <div className="flex flex-col gap-1.5">
          <span
            id="dice-direction-label"
            className="text-xs uppercase tracking-wider text-text-secondary"
          >
            Direction
          </span>
          <div
            role="radiogroup"
            aria-labelledby="dice-direction-label"
            className="flex gap-2"
          >
            <button
              type="button"
              role="radio"
              aria-checked={direction === 'under'}
              onClick={() => setDirection('under')}
              disabled={isRolling}
              className={`flex-1 py-2 rounded-md font-medium text-sm transition-colors focus-visible:ring-2 focus-visible:ring-accent-gold focus:outline-none disabled:opacity-50 ${
                direction === 'under'
                  ? 'bg-accent-gold/20 border border-accent-gold text-accent-gold'
                  : 'bg-bg-base border border-border-light text-text-secondary hover:text-text-primary'
              }`}
            >
              Roll Under
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={direction === 'over'}
              onClick={() => setDirection('over')}
              disabled={isRolling}
              className={`flex-1 py-2 rounded-md font-medium text-sm transition-colors focus-visible:ring-2 focus-visible:ring-accent-gold focus:outline-none disabled:opacity-50 ${
                direction === 'over'
                  ? 'bg-accent-gold/20 border border-accent-gold text-accent-gold'
                  : 'bg-bg-base border border-border-light text-text-secondary hover:text-text-primary'
              }`}
            >
              Roll Over
            </button>
          </div>
        </div>

        {/* Target slider + numeric input */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="dice-target"
            className="text-xs uppercase tracking-wider text-text-secondary"
          >
            Target ({clampTarget(target).toFixed(2)})
          </label>
          <div className="flex items-center gap-2">
            <input
              ref={targetInputRef}
              id="dice-target"
              type="range"
              min={MIN_TARGET}
              max={MAX_TARGET}
              step="0.01"
              value={target}
              onChange={handleTargetChange}
              onKeyDown={handleTargetKey}
              disabled={isRolling}
              aria-valuemin={MIN_TARGET}
              aria-valuemax={MAX_TARGET}
              aria-valuenow={clampTarget(target)}
              className="flex-1 accent-accent-gold"
            />
            <input
              type="number"
              min={MIN_TARGET}
              max={MAX_TARGET}
              step="0.01"
              value={target}
              onChange={handleTargetChange}
              disabled={isRolling}
              aria-label="Roll threshold (numeric)"
              className="w-20 bg-bg-base border border-border-light rounded-md px-2 py-1 text-sm text-text-primary font-mono tabular-nums focus-visible:ring-2 focus-visible:ring-accent-gold focus:outline-none disabled:opacity-50"
            />
          </div>
          <div className="flex justify-between text-[10px] text-text-secondary font-mono">
            <span>{MIN_TARGET.toFixed(2)}</span>
            <span>{MAX_TARGET.toFixed(2)}</span>
          </div>
        </div>

        {/* Win chance / multiplier / payout */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-bg-base border border-border-light rounded-md p-2">
            <div className="text-[10px] uppercase tracking-wider text-text-secondary">
              Win Chance
            </div>
            <div
              data-testid="dice-win-chance"
              className="text-sm font-heading font-bold text-text-primary tabular-nums"
            >
              {(winProb * 100).toFixed(2)}%
            </div>
          </div>
          <div className="bg-bg-base border border-border-light rounded-md p-2">
            <div className="text-[10px] uppercase tracking-wider text-text-secondary">
              Multiplier
            </div>
            <div
              data-testid="dice-multiplier"
              className="text-sm font-heading font-bold text-accent-gold tabular-nums"
            >
              {multiplier.toFixed(2)}x
            </div>
          </div>
          <div className="bg-bg-base border border-border-light rounded-md p-2">
            <div className="text-[10px] uppercase tracking-wider text-text-secondary">
              Payout
            </div>
            <div
              data-testid="dice-potential-payout"
              className="text-sm font-heading font-bold text-text-primary tabular-nums"
            >
              {formatCredits(potentialPayout, { withUnit: false })}
            </div>
          </div>
        </div>

      </div>

      {/* The visible CTA is rendered by BetControls. We also expose a hidden
          shim button so legacy tests that select by `dice-roll-button` continue
          to work. */}
      <RollButtonTestidShim
        onClick={handleRoll}
        disabled={isRolling || status !== 'connected'}
      />
    </BetControls>
  );

  // === History slot ===
  const historyPanel = (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs uppercase tracking-wider text-text-secondary">
        Recent rolls
      </h2>
      {history.length === 0 ? (
        <p className="text-xs text-text-secondary italic">No rolls yet</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {history.map((h) => (
            <li
              key={h.id}
              className="flex items-center justify-between gap-2 bg-bg-base border border-border-light rounded-md px-2 py-1.5 text-xs"
            >
              <span className="text-text-secondary font-mono tabular-nums">
                {h.direction} {h.target.toFixed(2)}
              </span>
              <span
                className={`font-mono tabular-nums ${
                  h.win ? 'text-status-success' : 'text-status-error'
                }`}
              >
                {h.result.toFixed(2)}
              </span>
              <span
                className={`font-mono tabular-nums font-bold ${
                  h.profit >= 0 ? 'text-status-success' : 'text-status-error'
                }`}
              >
                {h.profit >= 0 ? '+' : ''}
                {formatCredits(h.profit, { withUnit: false })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <GameLayout
      title="Dice"
      gameType="dice"
      rules={rules}
      canvas={canvas}
      controls={controls}
      history={historyPanel}
      provablyFair={
        <ProvablyFairPanel
          currentHash={serverSeedHash}
          clientSeed={clientSeed}
          onClientSeedChange={setClientSeed}
          history={pfHistory}
        />
      }
    />
  );
};

/**
 * RollButtonTestidShim — a tiny invisible button that mirrors the primary CTA
 * for backward-compatible test selectors (`data-testid="dice-roll-button"`).
 * The visible CTA is rendered by BetControls inside GameLayout's right rail.
 */
const RollButtonTestidShim = ({ onClick, disabled }) => (
  <button
    type="button"
    data-testid="dice-roll-button"
    onClick={onClick}
    disabled={disabled}
    className="sr-only"
    tabIndex={-1}
    aria-hidden="true"
  >
    Roll Dice
  </button>
);

export default DiceGame;
export { previewMultiplier, previewWinProb };
