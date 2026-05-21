import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import GameShell from '@/components/casino/GameShell';
import BetPanel from '@/components/casino/BetPanel';
import { useWinBurst } from '@/components/casino/WinBurst';
import { useSound } from '@/components/casino/SoundProvider';
import { useReducedMotion } from '@/components/casino/MotionSafe';

import ProvablyFairPanel from '@/games/_shared/ProvablyFairPanel';
import DisconnectOverlay from '@/games/_shared/DisconnectOverlay';
import useGameSocket from '@/games/_shared/useGameSocket';
import useAnnouncer from '@/games/_shared/hooks/useAnnouncer';

import CrashHistory from './CrashHistory';
import CrashPlayersList from './CrashPlayersList';
import CrashActiveBets from './CrashActiveBets';
import CrashCurve from './CrashCurve';
import { formatMultiplier } from './crashUtils';
import { formatCredits } from '@/lib/formatCredits';

import { AuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAudio } from '@/contexts/AudioContext';

const PHASE = {
  CONNECTING: 'connecting',
  WAITING: 'waiting',
  RUNNING: 'running',
  CRASHED: 'crashed',
};

const MIN_BET = 1;
const MAX_BET = 5000;
const PF_HISTORY_LIMIT = 20;
const HISTORY_PILL_LIMIT = 8;
const SHAKE_MS = 550;
const FLASH_MS = 500;

/**
 * CrashGame — Phase 2.3 visual rebuild.
 *
 * Render layer rebuilt with `GameShell` + `BetPanel` + SVG curve renderer.
 * Socket transport (`useGameSocket('crash')`) and game logic are unchanged.
 */
const CrashGame = () => {
  const { user, isAuthenticated, loading } = useContext(AuthContext);
  const toast = useToast();
  const navigate = useNavigate();
  // Legacy audio context — kept so existing tests + the per-tick chime keep
  // working. New event-named SFX go through useSound() below.
  const { play: playLegacy, stopAmbient, SFX } = useAudio();
  const { play: playFx } = useSound();
  const { announcement, announce } = useAnnouncer();
  const { burst, WinBurst } = useWinBurst();
  const reduced = useReducedMotion();

  useEffect(() => {
    stopAmbient();
  }, [stopAmbient]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login', {
        state: { from: '/games/crash', message: 'You must be logged in to play games.' },
      });
    }
  }, [isAuthenticated, loading, navigate]);

  const [phase, setPhase] = useState(PHASE.CONNECTING);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [history, setHistory] = useState([]);
  const [players, setPlayers] = useState([]);
  const [activeBets, setActiveBets] = useState([]);

  const [betAmount, setBetAmount] = useState(1);
  const [autoCashoutAt, setAutoCashoutAt] = useState(2.0);

  // 'idle' | 'placing' | 'placed' | 'cashing_out' | 'cashed_out' | 'lost'
  const [betStatus, setBetStatus] = useState('idle');
  const [lastResult, setLastResult] = useState(null);

  const [clientSeed, setClientSeed] = useState('');
  const [pfHistory, setPfHistory] = useState([]);

  // Visual effect flags
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(null); // 'red' | 'green' | null

  const betStatusRef = useRef(betStatus);
  betStatusRef.current = betStatus;

  const balance = typeof user?.balance === 'number' ? user.balance : 0;

  const triggerShake = useCallback(() => {
    if (reduced) return;
    setShake(true);
    window.setTimeout(() => setShake(false), SHAKE_MS);
  }, [reduced]);

  const triggerFlash = useCallback(
    (tone) => {
      if (reduced) return;
      setFlash(tone);
      window.setTimeout(() => setFlash(null), FLASH_MS);
    },
    [reduced],
  );

  const events = useMemo(
    () => ({
      gameState: (payload) => {
        if (typeof payload?.isGameRunning === 'boolean') {
          if (payload.isGameRunning) setPhase(PHASE.RUNNING);
          else setPhase(PHASE.WAITING);
          if (typeof payload.currentMultiplier === 'number') {
            setCurrentMultiplier(payload.currentMultiplier);
          }
        }
      },
      gameStarting: (data) => {
        setPhase(PHASE.WAITING);
        setCountdown(Math.round(data?.startingIn ?? 5));
        setCurrentMultiplier(1.0);
        setCrashPoint(null);
        setBetStatus((prev) => (prev === 'cashed_out' || prev === 'lost' ? 'idle' : prev));
      },
      gameStarted: () => {
        setPhase(PHASE.RUNNING);
        setCurrentMultiplier(1.0);
      },
      multiplierUpdate: (data) => {
        if (typeof data?.multiplier === 'number') setCurrentMultiplier(data.multiplier);
      },
      gameCrashed: (data) => {
        setPhase(PHASE.CRASHED);
        if (typeof data?.crashPoint === 'number') {
          setCrashPoint(data.crashPoint);
          setCurrentMultiplier(data.crashPoint);
          announce(`Crashed at ${data.crashPoint.toFixed(2)}x`);
        } else {
          announce('Crashed');
        }
        // Universal bust feedback — independent of whether the player was in.
        playFx('crash-bust');
        triggerShake();
        triggerFlash('red');
      },
      gameHistory: (rows) => {
        if (!Array.isArray(rows)) return;
        const next = rows
          .slice()
          .reverse()
          .map((r, idx) => ({
            id: r.gameId || `${r.timestamp || idx}`,
            crashPoint: r.crashPoint,
            timestamp: r.timestamp || Date.now(),
          }));
        setHistory(next);
      },
      currentBets: (bets) => {
        if (Array.isArray(bets)) setActiveBets(bets);
      },
      activePlayers: (list) => {
        if (Array.isArray(list)) setPlayers(list);
      },
      playerJoined: (player) => {
        if (!player?.id) return;
        setPlayers((prev) => (prev.some((p) => p.id === player.id) ? prev : [...prev, player]));
      },
      playerLeft: (player) => {
        if (!player?.id) return;
        setPlayers((prev) => prev.filter((p) => p.id !== player.id));
      },
      playerBet: (bet) => {
        if (!bet?.userId) return;
        setActiveBets((prev) => {
          const idx = prev.findIndex((b) => b.userId === bet.userId);
          if (idx >= 0) {
            const next = prev.slice();
            next[idx] = { ...next[idx], ...bet };
            return next;
          }
          return [...prev, bet];
        });
      },
      playerCashout: (cashout) => {
        if (!cashout?.userId) return;
        setActiveBets((prev) =>
          prev.map((b) =>
            b.userId === cashout.userId
              ? {
                  ...b,
                  cashedOut: true,
                  cashedOutAt: cashout.multiplier,
                  profit: cashout.profit,
                }
              : b,
          ),
        );
      },
      autoCashoutSuccess: (data) => {
        if (typeof data?.multiplier === 'number' && typeof data?.profit === 'number') {
          setBetStatus('cashed_out');
          setLastResult({ type: 'win', multiplier: data.multiplier, profit: data.profit });
          playLegacy(data.profit > betAmount * 5 ? SFX.BIG_WIN : SFX.WIN);
          playFx('cashout');
          triggerFlash('green');
          burst({ multiplier: data.multiplier, amount: data.profit });
          announce(
            `Auto cashed out at ${data.multiplier.toFixed(2)}x for ${data.profit.toFixed(2)}`,
          );
        }
      },
      betLost: () => {
        if (betStatusRef.current === 'placed' || betStatusRef.current === 'placing') {
          setBetStatus('lost');
          playLegacy(SFX.LOSS);
          playFx('lose');
          announce('Bet lost');
        }
      },
      roundComplete: (row) => {
        if (!row) return;
        setPfHistory((prev) =>
          [
            {
              id: row.roundId || row.id || `${Date.now()}`,
              gameType: 'crash',
              serverSeed: row.serverSeed,
              serverSeedHash: row.serverSeedHash,
              clientSeed: row.clientSeed,
              nonce: row.nonce ?? 0,
              outcome: row.outcome,
              multiplier: row.multiplier ?? row.crashPoint,
              timestamp: row.timestamp || Date.now(),
            },
            ...prev,
          ].slice(0, PF_HISTORY_LIMIT),
        );
      },
      error: (payload) => {
        const code = payload?.code || payload?.message;
        if (code) toast.error(String(code));
      },
    }),
    [SFX, announce, betAmount, burst, playFx, playLegacy, toast, triggerFlash, triggerShake],
  );

  const { status, lastError, serverSeedHash, emit } = useGameSocket('crash', { events });

  const canPlaceBet =
    isAuthenticated &&
    status === 'connected' &&
    phase === PHASE.WAITING &&
    betStatus === 'idle' &&
    balance >= betAmount;

  const canCashout =
    status === 'connected' && phase === PHASE.RUNNING && betStatus === 'placed';

  const placeBet = useCallback(() => {
    if (!canPlaceBet) return;
    setBetStatus('placing');
    playLegacy(SFX.BET);
    playFx('bet');
    emit('placeBet', { amount: betAmount, autoCashoutAt }, (resp) => {
      if (resp?.success) {
        setBetStatus('placed');
        setLastResult(null);
      } else {
        setBetStatus('idle');
        toast.error(resp?.error || resp?.message || 'Failed to place bet');
      }
    });
  }, [canPlaceBet, emit, betAmount, autoCashoutAt, playLegacy, playFx, SFX, toast]);

  const cashOut = useCallback(() => {
    if (!canCashout) return;
    setBetStatus('cashing_out');
    emit('cashOut', {}, (resp) => {
      if (resp?.success) {
        const m = resp.finalMultiplier ?? currentMultiplier;
        const profit = resp.resultDetails?.profit ?? (betAmount * m - betAmount);
        setBetStatus('cashed_out');
        setLastResult({ type: 'win', multiplier: m, profit });
        playLegacy(profit > betAmount * 5 ? SFX.BIG_WIN : SFX.WIN);
        playFx('cashout');
        triggerFlash('green');
        burst({ multiplier: m, amount: profit });
        announce(`Cashed out at ${m.toFixed(2)}x for ${profit.toFixed(2)}`);
      } else {
        setBetStatus('placed');
        toast.error(resp?.error || resp?.message || 'Failed to cash out');
      }
    });
  }, [
    canCashout,
    emit,
    currentMultiplier,
    betAmount,
    playLegacy,
    playFx,
    SFX,
    toast,
    announce,
    burst,
    triggerFlash,
  ]);

  // Loss feedback when the round crashes while the player is still in.
  useEffect(() => {
    if (phase === PHASE.CRASHED && betStatus === 'placed') {
      setBetStatus('lost');
      playLegacy(SFX.LOSS);
      playFx('lose');
      if (typeof crashPoint === 'number') {
        setLastResult({ type: 'loss', crashPoint, lost: betAmount });
      }
    }
  }, [phase, betStatus, crashPoint, betAmount, playLegacy, playFx, SFX]);

  // Spacebar cashout — works anywhere except inside form fields.
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space') return;
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (canCashout) {
        e.preventDefault();
        cashOut();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canCashout, cashOut]);

  // Per-tick chime while flying (legacy — preserved for parity with tests).
  useEffect(() => {
    if (phase !== PHASE.RUNNING) return undefined;
    const id = window.setInterval(() => playLegacy(SFX.TICK), 500);
    return () => window.clearInterval(id);
  }, [phase, playLegacy, SFX]);

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
