import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useWinBurst } from '@/components/casino/WinBurst';
import { useSound } from '@/components/casino/SoundProvider';
import { useReducedMotion } from '@/components/casino/MotionSafe';

import useGameSocket from '@/games/_shared/useGameSocket';
import useAnnouncer from '@/games/_shared/hooks/useAnnouncer';

import { AuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAudio } from '@/contexts/AudioContext';

/**
 * Phase constants for the Crash game state machine.
 *
 * - CONNECTING: socket not yet reporting a round
 * - WAITING:    countdown to next round / between rounds
 * - RUNNING:    multiplier is climbing
 * - CRASHED:    round just crashed; brief display before the next WAITING
 */
export const PHASE = {
  CONNECTING: 'connecting',
  WAITING: 'waiting',
  RUNNING: 'running',
  CRASHED: 'crashed',
};

const PF_HISTORY_LIMIT = 20;
const SHAKE_MS = 550;
const FLASH_MS = 500;

/**
 * useCrashPhaseLogic
 *
 * Owns the Crash game state machine: phase transitions, bet/cashout flow,
 * round history, players/active bets, provably-fair history, and the visual
 * effect flags (shake, flash). Wires socket events from `useGameSocket` to
 * state. The render layer (`CrashGame.jsx`) is purely a function of what this
 * hook returns.
 *
 * Returns (object):
 * @returns {object} state
 * @returns {string} state.phase             - one of PHASE.*
 * @returns {number} state.currentMultiplier - latest multiplier (>= 1.0)
 * @returns {?number} state.crashPoint       - multiplier at crash, or null
 * @returns {number} state.countdown         - seconds until round starts
 * @returns {Array} state.history            - recent rounds (newest first)
 * @returns {Array} state.players            - active players in the room
 * @returns {Array} state.activeBets         - bets placed for the current round
 * @returns {number} state.betAmount         - current bet input
 * @returns {(n:number)=>void} state.setBetAmount
 * @returns {number} state.autoCashoutAt     - target multiplier for auto cashout
 * @returns {(n:number)=>void} state.setAutoCashoutAt
 * @returns {string} state.betStatus         - 'idle'|'placing'|'placed'|'cashing_out'|'cashed_out'|'lost'
 * @returns {?object} state.lastResult       - {type:'win'|'loss', ...}
 * @returns {string} state.clientSeed
 * @returns {(s:string)=>void} state.setClientSeed
 * @returns {Array} state.pfHistory          - provably-fair history rows
 * @returns {boolean} state.shake            - visual shake flag
 * @returns {?string} state.flash            - 'red' | 'green' | null
 * @returns {boolean} state.canPlaceBet      - derived gate for the place-bet CTA
 * @returns {boolean} state.canCashout       - derived gate for the cash-out CTA
 * @returns {()=>void} state.placeBet
 * @returns {()=>void} state.cashOut
 * @returns {string} state.status            - socket connection status
 * @returns {?object} state.lastError        - last socket error payload
 * @returns {?string} state.serverSeedHash   - latest server seed hash
 * @returns {object} state.auth              - { user, isAuthenticated, loading, balance }
 * @returns {string} state.announcement      - polite-region message
 * @returns {React.FC} state.WinBurst        - burst overlay component
 * @returns {boolean} state.reduced          - reduced-motion preference
 */
export function useCrashPhaseLogic() {
  const { user, isAuthenticated, loading } = useContext(AuthContext);
  const toast = useToast();
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

  return {
    // Phase / round state
    phase,
    currentMultiplier,
    crashPoint,
    countdown,
    history,
    players,
    activeBets,

    // Bet inputs
    betAmount,
    setBetAmount,
    autoCashoutAt,
    setAutoCashoutAt,

    // Bet status + result
    betStatus,
    lastResult,

    // Provably-fair
    clientSeed,
    setClientSeed,
    pfHistory,

    // Visual effects
    shake,
    flash,
    reduced,

    // Derived gates
    canPlaceBet,
    canCashout,

    // Handlers
    placeBet,
    cashOut,

    // Socket passthrough
    status,
    lastError,
    serverSeedHash,

    // Auth passthrough (render layer uses this to redirect)
    auth: { user, isAuthenticated, loading, balance },

    // Announcer + burst overlay for the render layer
    announcement,
    WinBurst,
  };
}

export default useCrashPhaseLogic;
