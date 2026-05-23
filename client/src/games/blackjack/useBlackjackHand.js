import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import useGameSocket from '../_shared/useGameSocket';
import { calculateHandValue, getHandStatus } from './blackjackUtils';
import { formatCredits } from '../../lib/formatCredits';

export const MIN_BET = 1;
export const MAX_BET = 10_000;
export const HISTORY_LIMIT = 10;

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

const noop = () => {};

/**
 * useBlackjackHand — pure state machine for a single blackjack hand session.
 *
 * Owns:
 *   - hand state: playerHand, dealerHand, serverPlayerScore, activeBet, gameId,
 *     canDouble, result, winAmount, errorMsg, history
 *   - phase: 'betting' | 'active' | 'completed'
 *   - action handlers: deal, hit, stand, doubleDown, newHand
 *   - socket wiring via useGameSocket('blackjack', ...)
 *   - keyboard shortcuts (H / S / D) during the active phase
 *   - auto-focus of the primary action when a round starts
 *
 * Side-effects (sound, win burst, screen-reader announcements) are injected
 * via the `play`, `burst`, and `announce` options so the hook stays
 * render-agnostic and unit-testable.
 *
 * Server contract preserved verbatim:
 *   outbound  blackjack_start { betAmount }, blackjack_hit {},
 *             blackjack_stand {}, blackjack_double {}
 *   inbound   gameState, blackjack_game_state, blackjack_error
 */
export function useBlackjackHand({
  play = noop,
  burst = noop,
  announce = noop,
} = {}) {
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

  const playerScoreDisplay = useMemo(() => {
    if (serverPlayerScore != null) return String(serverPlayerScore);
    if (playerHand.length > 0) return getHandStatus(playerHand);
    return null;
  }, [serverPlayerScore, playerHand]);

  return {
    // state
    betAmount,
    setBetAmount,
    phase,
    gameId,
    playerHand,
    dealerHand,
    serverPlayerScore,
    result,
    winAmount,
    activeBet,
    canDouble,
    errorMsg,
    history,
    playerScoreDisplay,
    // socket
    socketStatus,
    lastError,
    // actions
    deal,
    hit,
    stand,
    doubleDown,
    newHand,
    // constants (so the component doesn't redeclare them)
    MIN_BET,
    MAX_BET,
    HISTORY_LIMIT,
  };
}

export default useBlackjackHand;
