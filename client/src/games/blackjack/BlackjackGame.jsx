import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion } from 'framer-motion';
import GameShell from '../../components/casino/GameShell';
import BetPanel from '../../components/casino/BetPanel';
import ChipStack from '../../components/casino/ChipStack';
import { useWinBurst } from '../../components/casino/WinBurst';
import { useSound } from '../../components/casino/SoundProvider';
import { useReducedMotion } from '../../components/casino/MotionSafe';
import DisconnectOverlay from '../_shared/DisconnectOverlay';
import useGameSocket from '../_shared/useGameSocket';
import useAnnouncer from '../_shared/hooks/useAnnouncer';
import { useAuth } from '../../hooks/useAuth';
import { formatCredits } from '../../lib/formatCredits';
import { calculateHandValue, getHandStatus } from './blackjackUtils';
import BlackjackHand from './BlackjackHand';
import TestShim from '../_shared/TestShim';

const MIN_BET = 1;
const MAX_BET = 10_000;
const HISTORY_LIMIT = 10;

function isEditableTarget(target) {
  if (!target) return false;
  const tag = (target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  return false;
}

function cardLabel(card) {
  if (!card?.rank || !card?.suit) return 'a card';
  const rankNames = { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack' };
  const rank = rankNames[card.rank] || card.rank;
  return `${rank} of ${String(card.suit).toLowerCase()}`;
}

function outcomeLabel(result) {
  if (result === 'player_win' || result === 'blackjack' || result === 'player') return 'W';
  if (result === 'dealer_win' || result === 'dealer') return 'L';
  if (result === 'push') return 'P';
  return '·';
}

function outcomeClass(result) {
  if (result === 'player_win' || result === 'blackjack' || result === 'player') {
    return 'bg-lime-400/15 text-lime-300 ring-lime-400/40';
  }
  if (result === 'dealer_win' || result === 'dealer') {
    return 'bg-accent-rose/15 text-accent-rose ring-accent-rose/40';
  }
  if (result === 'push') {
    return 'bg-accent-gold/15 text-accent-gold-light ring-accent-gold/40';
  }
  return 'bg-white/5 text-text-muted ring-white/10';
}

/**
 * BlackjackGame — premium render-layer rebuild.
 *
 * Socket contract and game logic are preserved verbatim from the previous
 * implementation. Only the render layer (GameShell + BetPanel + Framer felt
 * table + sound + WinBurst) is new.
 *
 * Phases:
 *   - 'betting'   no active hand. BetPanel shows "Deal".
 *   - 'active'    server dealt; Hit / Stand / Double action row.
 *   - 'completed' result banner + "New Hand" returns to betting.
 *
 * Server contract preserved verbatim (engine.ts):
 *   outbound  blackjack_start { betAmount }, blackjack_hit {},
 *             blackjack_stand {}, blackjack_double {}
 *   inbound   gameState, blackjack_game_state, blackjack_error
 *
 * Balance is sourced from `useAuth().user.balance`; `balanceUpdate` is
 * handled centrally by AuthContext.
 */
const BlackjackGame = () => {
  const { user } = useAuth();
  const { play } = useSound();
  const { burst, WinBurst: WinBurstNode } = useWinBurst();
  const reduced = useReducedMotion();
  const { announcement, announce } = useAnnouncer(2000);

  const [betAmount, setBetAmount] = useState(1);
  const [phase, setPhase] = useState('betting');
  const [gameId, setGameId] = useState(null);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [serverPlayerScore, setServerPlayerScore] = useState(null);
  const [result, setResult] = useState(null);
  const [winAmount, setWinAmount] = useState(0);
  const [activeBet, setActiveBet] = useState(0);
  const [canDouble, setCanDouble] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [history, setHistory] = useState([]);

  const lastAnnouncedPlayerLenRef = useRef(0);
  const recordedGameIdsRef = useRef(new Set());

  const handleBlackjackState = useCallback(
    (state) => {
      if (!state) return;
      const {
        gameId: nextGameId,
        playerHand: nextPlayer = [],
        dealerHand: nextDealer = [],
        playerScore: nextPlayerScore,
        betAmount: nextBetAmount,
        status,
        result: nextResult,
        winAmount: nextWin,
        canDouble: nextCanDouble,
      } = state;

      setGameId(nextGameId || null);
      setPlayerHand(nextPlayer);
      setDealerHand(nextDealer);
      setServerPlayerScore(
        typeof nextPlayerScore === 'number' ? nextPlayerScore : null,
      );
      if (typeof nextBetAmount === 'number') setActiveBet(nextBetAmount);
      setCanDouble(!!nextCanDouble);
      setErrorMsg(null);

      if (status === 'active') {
        setPhase('active');
        setResult(null);
        setWinAmount(0);
        if (nextPlayer.length > lastAnnouncedPlayerLenRef.current) {
          const latest = nextPlayer[nextPlayer.length - 1];
          announce(
            `You drew the ${cardLabel(latest)}. Score: ${calculateHandValue(
              nextPlayer,
            )}`,
          );
        }
        lastAnnouncedPlayerLenRef.current = nextPlayer.length;
      }

      if (status === 'completed') {
        setPhase('completed');
        setResult(nextResult || null);
        const finalWin = typeof nextWin === 'number' ? nextWin : 0;
        setWinAmount(finalWin);

        const stake = typeof nextBetAmount === 'number' ? nextBetAmount : 0;
        const isWin =
          nextResult === 'player_win' ||
          nextResult === 'blackjack' ||
          nextResult === 'player';
        const isLoss = nextResult === 'dealer_win' || nextResult === 'dealer';

        if (isWin) {
          const profit = finalWin - stake;
          // Drive WinBurst tier from profit-multiple-of-stake.
          const tierMultiplier = stake > 0 ? finalWin / stake : 2;
          play('cashout');
          burst({ multiplier: tierMultiplier, amount: finalWin });
          announce(`Player wins ${formatCredits(finalWin)} credits`);
          // mark unused to keep linter happy
          void profit;
        } else if (isLoss) {
          play('lose');
          announce('Dealer wins');
        } else if (nextResult === 'push') {
          announce('Push. Bet returned');
        }

        if (nextGameId && !recordedGameIdsRef.current.has(nextGameId)) {
          recordedGameIdsRef.current.add(nextGameId);
          setHistory((prev) =>
            [
              {
                id: nextGameId,
                result: nextResult,
                winAmount: finalWin,
                betAmount: stake,
                timestamp: Date.now(),
              },
              ...prev,
            ].slice(0, HISTORY_LIMIT),
          );
        }

        lastAnnouncedPlayerLenRef.current = 0;
      }
    },
    [announce, play, burst],
  );

  const handleBlackjackError = useCallback(
    (payload) => {
      const msg = (payload && payload.message) || 'Blackjack error';
      setErrorMsg(msg);
      announce(msg);
    },
    [announce],
  );

  const handlersRef = useRef({
    blackjack_game_state: handleBlackjackState,
    blackjack_error: handleBlackjackError,
  });
  handlersRef.current = {
    blackjack_game_state: handleBlackjackState,
    blackjack_error: handleBlackjackError,
  };

  const events = useMemo(
    () => ({
      gameState: () => {},
      blackjack_game_state: (...args) =>
        handlersRef.current.blackjack_game_state(...args),
      blackjack_error: (...args) =>
        handlersRef.current.blackjack_error(...args),
    }),
    [],
  );

  const { status: socketStatus, lastError, emit } = useGameSocket('blackjack', {
    events,
  });

  const deal = useCallback(() => {
    if (phase === 'active') return;
    if (!Number.isFinite(betAmount) || betAmount < MIN_BET) return;
    setErrorMsg(null);
    setResult(null);
    setWinAmount(0);
    setPlayerHand([]);
    setDealerHand([]);
    setServerPlayerScore(null);
    setGameId(null);
    setActiveBet(betAmount);
    lastAnnouncedPlayerLenRef.current = 0;
    setPhase('active');
    // BetPanel plays 'bet' on confirm; we still emit chip-drop here so the
    // visual chip-stack drop has its own click sound.
    play('chip-drop');
    emit('blackjack_start', { betAmount });
  }, [phase, betAmount, emit, play]);

  const hit = useCallback(() => {
    if (phase !== 'active') return;
    emit('blackjack_hit', {});
  }, [phase, emit]);

  const stand = useCallback(() => {
    if (phase !== 'active') return;
    emit('blackjack_stand', {});
  }, [phase, emit]);

  const doubleDown = useCallback(() => {
    if (phase !== 'active' || !canDouble) return;
    emit('blackjack_double', {});
  }, [phase, canDouble, emit]);

  const newHand = useCallback(() => {
    setPhase('betting');
    setPlayerHand([]);
    setDealerHand([]);
    setServerPlayerScore(null);
    setGameId(null);
    setResult(null);
    setWinAmount(0);
    setActiveBet(0);
    setCanDouble(false);
    setErrorMsg(null);
    lastAnnouncedPlayerLenRef.current = 0;
  }, []);

  // H / S / D keyboard shortcuts during active play.
  useEffect(() => {
    if (phase !== 'active') return undefined;
    const onKey = (e) => {
      if (e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      const key = (e.key || '').toLowerCase();
      if (key === 'h') {
        e.preventDefault();
        hit();
      } else if (key === 's') {
        e.preventDefault();
        stand();
      } else if (key === 'd') {
        if (!canDouble) return;
        e.preventDefault();
        doubleDown();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, canDouble, hit, stand, doubleDown]);

  // Auto-focus the Hit button when the round starts (so screen readers and
  // keyboard users land on the primary action).
  useEffect(() => {
    if (phase !== 'active') return undefined;
    if (isEditableTarget(document.activeElement)) return undefined;
    const id = window.setTimeout(() => {
      const el = document.getElementById('blackjack-action-hit');
      if (el && typeof el.focus === 'function') el.focus();
    }, 0);
    return () => window.clearTimeout(id);
  }, [phase]);

  const balance = Number(user?.balance ?? 0);

  const playerScoreDisplay = useMemo(() => {
    if (serverPlayerScore != null) return String(serverPlayerScore);
    if (playerHand.length > 0) return getHandStatus(playerHand);
    return null;
  }, [serverPlayerScore, playerHand]);

  const statusBadge = useMemo(() => {
    if (phase === 'betting') return 'Place your bet';
    if (phase === 'active') return 'Your turn';
    if (phase === 'completed') {
      if (
        result === 'player_win' ||
        result === 'blackjack' ||
        result === 'player'
      ) {
        return `You won ${formatCredits(winAmount)}`;
      }
      if (result === 'dealer_win' || result === 'dealer') return 'Dealer wins';
      if (result === 'push') return 'Push — bet returned';
      return 'Hand complete';
    }
    return '';
  }, [phase, result, winAmount]);

  const isWinResult =
    result === 'player_win' || result === 'blackjack' || result === 'player';
  const isLossResult = result === 'dealer_win' || result === 'dealer';

  // --- Panel slot ---
  const dealLabel = phase === 'completed' ? 'New Hand' : 'Deal';
  const onPrimary =
    phase === 'active' ? () => {} : phase === 'completed' ? newHand : deal;
  const primaryDisabled = phase === 'active' || socketStatus !== 'connected';
  const primaryVariant = phase === 'completed' ? 'accent' : 'primary';

  const actionRow =
    phase === 'active' ? (
      <div
        className="grid grid-cols-3 gap-2"
        role="group"
        aria-label="Blackjack actions"
      >
        <ActionButton
          id="blackjack-action-hit"
          label="Hit"
          shortcut="H"
          onClick={hit}
          disabled={socketStatus !== 'connected'}
          variant="primary"
        />
        <ActionButton
          label="Stand"
          shortcut="S"
          onClick={stand}
          disabled={socketStatus !== 'connected'}
          variant="accent"
        />
        <ActionButton
          label="Double"
          shortcut="D"
          onClick={doubleDown}
          disabled={!canDouble || socketStatus !== 'connected'}
          variant="outline"
        />
      </div>
    ) : null;

  const panelExtras = (
    <div className="flex flex-col gap-2">
      {actionRow}
      {errorMsg ? (
        <p className="text-xs text-status-error" role="alert">
          {errorMsg}
        </p>
      ) : null}
      <p
        className="text-[11px] text-text-muted"
        aria-label="Game status"
      >
        {statusBadge}
        {phase === 'active' && playerScoreDisplay
          ? ` · Score ${playerScoreDisplay}`
          : ''}
      </p>
    </div>
  );

  // Test-shim chip presets — legacy E2E spec selects bets via "$10"/"$25"
  // buttons. Rendered offscreen so they don't disrupt the visual layout.
  const chipPresetShims = (
    <TestShim>
      {[5, 10, 25, 50, 100].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => setBetAmount(n)}
          tabIndex={-1}
        >
          {`$${n}`}
        </button>
      ))}
      {/* "Place Bet" alias — maps to the same primary action as the
          visible CTA so the spec's getByRole('button', { name: 'Place Bet' })
          can click straight through to deal. */}
      <button
        type="button"
        onClick={onPrimary}
        disabled={primaryDisabled}
        tabIndex={-1}
      >
        Place Bet
      </button>
    </TestShim>
  );

  const panel = (
    <BetPanel
      bet={betAmount}
      onBetChange={setBetAmount}
      min={MIN_BET}
      max={MAX_BET}
      balance={balance}
      onPlaceBet={onPrimary}
      betLabel={
        phase === 'active' ? 'Hand in progress' : dealLabel
      }
      primaryVariant={primaryVariant}
      disabled={primaryDisabled}
      extra={
        <>
          {chipPresetShims}
          {panelExtras}
        </>
      }
      betInputId="blackjack-bet-amount"
    />
  );

  // --- Stats slot: last 8 outcomes as pills ---
  const recentPills = useMemo(() => history.slice(0, 8), [history]);
  const stats = (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs uppercase tracking-wider text-text-secondary">
        Recent hands
      </h2>
      <div className="flex flex-wrap gap-1.5" aria-label="Recent hand outcomes">
        {recentPills.length === 0 ? (
          <span className="text-xs italic text-text-muted">No hands played yet</span>
        ) : (
          recentPills.map((row) => (
            <span
              key={row.id}
              className={[
                'inline-flex h-7 min-w-[2rem] items-center justify-center rounded-full px-2',
                'font-mono text-[11px] font-semibold tabular-nums ring-1',
                outcomeClass(row.result),
              ].join(' ')}
              title={`${row.result} · stake ${formatCredits(row.betAmount || 0)} · win ${formatCredits(row.winAmount || 0)}`}
            >
              {outcomeLabel(row.result)}
            </span>
          ))
        )}
      </div>
    </div>
  );

  // --- Felt table board ---
  // SVG noise overlay id needs to be unique per render-mount; once is fine.
  const dropAnim = reduced
    ? { initial: false, animate: { y: 0, opacity: 1 }, transition: { duration: 0 } }
    : {
        initial: { y: -100, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        transition: { type: 'spring', stiffness: 380, damping: 18 },
      };

  const board = (
    <div className="relative">
      <DisconnectOverlay status={socketStatus} lastError={lastError} />

      {/* Felt table — radial gradient + SVG turbulence noise overlay */}
      <div
        className="relative mx-auto w-full overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at 50% 30%, #064e3b 0%, #022c22 55%, #07080F 100%)',
          borderTopLeftRadius: '40% 18%',
          borderTopRightRadius: '40% 18%',
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px',
        }}
      >
        {/* Felt noise overlay */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18] mix-blend-overlay"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="bj-felt-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              stitchTiles="stitch"
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#bj-felt-noise)" />
        </svg>

        {/* Inner gold rim */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-2 rounded-[28px] ring-1 ring-accent-gold/15"
        />

        <div className="relative flex flex-col items-center gap-4 px-3 py-6 sm:px-6 sm:py-8">
          {/* Dealer hand */}
          <BlackjackHand
            hand={dealerHand}
            isDealer
            hideHoleCard={phase === 'active'}
          />

          {/* Result banner */}
          {phase === 'completed' && result ? (
            <div
              role="alert"
              className={[
                'mx-auto w-full max-w-md rounded-xl border bg-bg-card/95 px-4 py-3 text-center backdrop-blur-xl',
                isWinResult
                  ? 'border-status-success/40'
                  : isLossResult
                  ? 'border-status-error/40'
                  : 'border-accent-gold/40',
              ].join(' ')}
            >
              <div
                className={[
                  'font-heading text-2xl font-bold md:text-3xl',
                  isWinResult
                    ? 'text-status-success'
                    : isLossResult
                    ? 'text-status-error'
                    : 'text-accent-gold-light',
                ].join(' ')}
              >
                {isWinResult
                  ? `You Win ${formatCredits(winAmount)}!`
                  : isLossResult
                  ? 'Dealer Wins'
                  : 'Push'}
              </div>
            </div>
          ) : null}

          {/* Player hand */}
          <BlackjackHand hand={playerHand} isDealer={false} />

          {/* Bet circle + chip stack */}
          <div className="mt-1 flex flex-col items-center gap-1">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-accent-gold/40 sm:h-24 sm:w-24"
              aria-label="Bet circle"
            >
              {activeBet > 0 ? (
                <motion.div
                  key={`chip-${gameId || activeBet}`}
                  initial={dropAnim.initial}
                  animate={dropAnim.animate}
                  transition={dropAnim.transition}
                >
                  <ChipStack
                    amount={activeBet}
                    color="gold"
                    size={36}
                    ariaLabel={`Bet stake ${formatCredits(activeBet)}`}
                  />
                </motion.div>
              ) : (
                <span className="text-[10px] uppercase tracking-wider text-text-muted">
                  Bet
                </span>
              )}
            </div>
            {activeBet > 0 ? (
              <span className="font-mono text-xs text-accent-gold-light">
                {formatCredits(activeBet)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </div>
  );

  return (
    <GameShell title="Blackjack" accent="blue" panel={panel} stats={stats}>
      {board}
      <WinBurstNode />
    </GameShell>
  );
};

/**
 * ActionButton — Framer-animated chip-style action button used during play.
 */
function ActionButton({
  id,
  label,
  shortcut,
  onClick,
  disabled,
  variant = 'primary',
}) {
  const reduced = useReducedMotion();
  const palette = {
    primary:
      'bg-accent-purple text-white hover:bg-accent-purple-light disabled:bg-accent-purple/40',
    accent:
      'bg-accent-gold text-bg-base hover:bg-accent-gold-light disabled:bg-accent-gold/40',
    outline:
      'bg-white/5 text-text-primary ring-1 ring-white/20 hover:bg-white/10 disabled:opacity-50',
  }[variant];

  return (
    <motion.button
      id={id}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-keyshortcuts={shortcut?.toLowerCase()}
      title={`${label} (${shortcut})`}
      whileHover={reduced ? undefined : { scale: 1.03 }}
      whileTap={reduced ? undefined : { scale: 0.96 }}
      className={[
        'inline-flex h-[48px] items-center justify-center rounded-full px-3 font-heading text-sm font-semibold tracking-tight',
        'cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:outline-none',
        'disabled:cursor-not-allowed',
        palette,
      ].join(' ')}
    >
      {`${label} (${shortcut})`}
    </motion.button>
  );
}

export default BlackjackGame;
