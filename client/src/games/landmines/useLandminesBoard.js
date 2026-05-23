import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useGameSocket from '../_shared/useGameSocket';
import useAnnouncer from '../_shared/hooks/useAnnouncer';
import { formatCredits } from '../../lib/formatCredits';

export const GRID_SIZE = 5;
export const MIN_MINES = 1;
export const MAX_MINES = 24;
export const DEFAULT_MINES = 3;
export const DEFAULT_BET = 10;
export const MIN_BET = 1;
export const MAX_BET = 1000;
export const HISTORY_LIMIT = 10;

export const CELL_HIDDEN = 'hidden';
export const CELL_SAFE = 'safe';
export const CELL_MINE = 'mine';

export function makeEmptyBoard() {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ state: CELL_HIDDEN, multiplier: null })),
  );
}

function fmtMult(m) {
  if (typeof m !== 'number' || Number.isNaN(m)) return '-';
  return `${m.toFixed(2)}x`;
}

/**
 * useLandminesBoard — pure state-machine + socket I/O hook for Landmines.
 *
 * Owns: board grid, phase (waiting/playing/ended via isGameActive + result),
 * current multiplier, potential win, round history, focused-cell tracking,
 * and the socket emit lifecycle for start / pick / cashout.
 *
 * Render-only concerns (sound, burst, motion, JSX) remain in LandminesGame.
 * Side-effects that are visual-only (play sound, fire WinBurst) are injected
 * via `options.play` and `options.burst`, both safe to omit.
 *
 * Socket contract, ack payload shapes, and emit names are preserved verbatim.
 */
export function useLandminesBoard(options = {}) {
  const { play, burst } = options;

  const [betAmount, setBetAmount] = useState(DEFAULT_BET);
  const [mines, setMines] = useState(DEFAULT_MINES);

  const [isGameActive, setIsGameActive] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [board, setBoard] = useState(makeEmptyBoard);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [potentialWin, setPotentialWin] = useState(0);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const [history, setHistory] = useState([]);

  const [focusedCell, setFocusedCell] = useState({ row: 0, col: 0 });
  const cellRefs = useRef({});

  const { announcement, announce } = useAnnouncer(2000);

  const sessionRef = useRef({ betAmount: DEFAULT_BET, mines: DEFAULT_MINES, revealed: 0 });

  const events = useMemo(
    () => ({
      'landmines:player_cashout': () => {},
      gameState: () => {},
    }),
    [],
  );

  const { emit, status, lastError, serverSeedHash } = useGameSocket('landmines', { events });

  const resetBoard = useCallback(() => {
    setBoard(makeEmptyBoard());
    setCurrentMultiplier(1);
    setPotentialWin(0);
    setFocusedCell({ row: 0, col: 0 });
  }, []);

  const pushHistory = useCallback((entry) => {
    setHistory((prev) => [entry, ...prev].slice(0, HISTORY_LIMIT));
  }, []);

  const setCellRef = useCallback((row, col, node) => {
    cellRefs.current[`${row},${col}`] = node;
  }, []);

  const focusCell = useCallback((row, col) => {
    const key = `${row},${col}`;
    const node = cellRefs.current[key];
    if (node && typeof node.focus === 'function') node.focus();
  }, []);

  const startGame = useCallback(() => {
    if (isGameActive || isPending) return;
    if (typeof betAmount !== 'number' || betAmount < MIN_BET) return;
    if (typeof mines !== 'number' || mines < MIN_MINES || mines > MAX_MINES) return;

    setErrorMsg(null);
    setResult(null);
    setIsPending(true);

    sessionRef.current = { betAmount, mines, revealed: 0 };

    emit('landmines:start', { betAmount, mines }, (resp) => {
      setIsPending(false);
      if (!resp || resp.success === false) {
        setErrorMsg(resp?.error || 'Unable to start round.');
        return;
      }
      resetBoard();
      setIsGameActive(true);
      if (typeof play === 'function') play('bet');
      announce(`Round started with ${mines} mine${mines === 1 ? '' : 's'}.`);
    });
  }, [isGameActive, isPending, betAmount, mines, emit, resetBoard, announce, play]);

  const handleCashout = useCallback(() => {
    if (!isGameActive || isPending) return;
    setIsPending(true);
    emit('landmines:cashout', {}, (resp) => {
      setIsPending(false);
      if (!resp || resp.success === false) {
        setErrorMsg(resp?.error || 'Unable to cash out.');
        return;
      }
      const winAmount = Number(resp.winAmount) || 0;
      const multiplier = Number(resp.multiplier) || 1;
      const profit = Number(resp.profit) || 0;
      setIsGameActive(false);
      setResult({
        win: true,
        message: 'Cashed out',
        amount: winAmount,
        profit,
        multiplier,
        mines: sessionRef.current.mines,
      });
      pushHistory({
        id: `lm-${Date.now()}`,
        timestamp: Date.now(),
        betAmount: sessionRef.current.betAmount,
        mines: sessionRef.current.mines,
        revealed: sessionRef.current.revealed,
        win: true,
        multiplier,
        profit,
      });
      if (typeof play === 'function') play('cashout');
      if (typeof burst === 'function') burst({ multiplier, amount: winAmount });
      announce(`Cashed out ${formatCredits(winAmount, { withUnit: false })} credits.`);
    });
  }, [isGameActive, isPending, emit, pushHistory, announce, play, burst]);

  const handleReveal = useCallback(
    (row, col) => {
      if (!isGameActive || isPending) return;
      if (board[row][col].state !== CELL_HIDDEN) return;

      setIsPending(true);
      emit('landmines:pick', { row, col }, (resp) => {
        setIsPending(false);
        if (!resp || resp.success === false) {
          setErrorMsg(resp?.error || 'Unable to reveal cell.');
          return;
        }

        const hit = !!resp.hit;
        const gameOver = !!resp.gameOver;

        if (hit) {
          const full = Array.isArray(resp.fullGrid) ? resp.fullGrid : null;
          setBoard((prev) =>
            prev.map((r, rr) =>
              r.map((cell, cc) => {
                if (rr === row && cc === col) return { state: CELL_MINE, multiplier: null };
                if (full && full[rr]?.[cc] === true) return { state: CELL_MINE, multiplier: null };
                if (cell.state !== CELL_HIDDEN) return cell;
                return full ? { state: CELL_SAFE, multiplier: null } : cell;
              }),
            ),
          );
          setIsGameActive(false);
          setResult({
            win: false,
            message: 'Mine hit',
            profit: -sessionRef.current.betAmount,
            mines: sessionRef.current.mines,
          });
          pushHistory({
            id: `lm-${Date.now()}`,
            timestamp: Date.now(),
            betAmount: sessionRef.current.betAmount,
            mines: sessionRef.current.mines,
            revealed: sessionRef.current.revealed,
            win: false,
            multiplier: 0,
            profit: -sessionRef.current.betAmount,
          });
          announce('Boom! Game over.');
          return;
        }

        const multiplier = Number(resp.multiplier) || currentMultiplier;
        const newRevealed = sessionRef.current.revealed + 1;
        sessionRef.current = { ...sessionRef.current, revealed: newRevealed };
        setBoard((prev) =>
          prev.map((r, rr) =>
            r.map((cell, cc) =>
              rr === row && cc === col ? { state: CELL_SAFE, multiplier } : cell,
            ),
          ),
        );
        setCurrentMultiplier(multiplier);
        setPotentialWin(Number(resp.potentialWin) || 0);
        announce(`Safe! Multiplier now ${fmtMult(multiplier)}.`);

        if (gameOver) {
          const winAmount = Number(resp.winAmount) || Number(resp.potentialWin) || 0;
          const profit = Number(resp.profit) || winAmount - sessionRef.current.betAmount;
          setIsGameActive(false);
          setResult({
            win: true,
            message: 'All safe tiles revealed',
            amount: winAmount,
            profit,
            multiplier,
            mines: sessionRef.current.mines,
          });
          pushHistory({
            id: `lm-${Date.now()}`,
            timestamp: Date.now(),
            betAmount: sessionRef.current.betAmount,
            mines: sessionRef.current.mines,
            revealed: newRevealed,
            win: true,
            multiplier,
            profit,
            auto: true,
          });
          if (typeof play === 'function') play('cashout');
          if (typeof burst === 'function') burst({ multiplier, amount: winAmount });
          announce(`Auto cashout: ${formatCredits(winAmount, { withUnit: false })} credits.`);
        }
      });
    },
    [
      isGameActive,
      isPending,
      board,
      emit,
      currentMultiplier,
      pushHistory,
      announce,
      play,
      burst,
    ],
  );

  const handleCellKeyDown = useCallback(
    (e, row, col) => {
      let nextRow = row;
      let nextCol = col;
      switch (e.key) {
        case 'ArrowUp':
          nextRow = Math.max(0, row - 1);
          break;
        case 'ArrowDown':
          nextRow = Math.min(GRID_SIZE - 1, row + 1);
          break;
        case 'ArrowLeft':
          nextCol = Math.max(0, col - 1);
          break;
        case 'ArrowRight':
          nextCol = Math.min(GRID_SIZE - 1, col + 1);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          handleReveal(row, col);
          return;
        default:
          return;
      }
      e.preventDefault();
      if (nextRow !== row || nextCol !== col) {
        setFocusedCell({ row: nextRow, col: nextCol });
        focusCell(nextRow, nextCol);
      }
    },
    [handleReveal, focusCell],
  );

  const handleFocusCell = useCallback((row, col) => {
    setFocusedCell({ row, col });
  }, []);

  const dismissResult = useCallback(() => {
    setResult(null);
  }, []);

  // Track unmount so callers (e.g. tests) can observe a clean teardown signal.
  // useAnnouncer already clears its own timer on unmount.
  useEffect(() => () => {
    cellRefs.current = {};
  }, []);

  return {
    // bet config
    betAmount,
    setBetAmount,
    mines,
    setMines,

    // phase / round state
    isGameActive,
    isPending,
    board,
    currentMultiplier,
    potentialWin,
    result,
    errorMsg,
    history,

    // a11y / focus
    focusedCell,
    setCellRef,
    announcement,

    // actions
    startGame,
    handleCashout,
    handleReveal,
    handleCellKeyDown,
    handleFocusCell,
    dismissResult,

    // socket surface (passthrough)
    status,
    lastError,
    serverSeedHash,

    // session ref (read-only handle for renderers showing "in-progress" info)
    session: sessionRef,
  };
}

export default useLandminesBoard;
