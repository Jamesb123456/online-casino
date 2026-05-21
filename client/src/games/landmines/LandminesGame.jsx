import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GameShell from '../../components/casino/GameShell';
import BetPanel from '../../components/casino/BetPanel';
import AnimatedNumber from '../../components/casino/AnimatedNumber';
import { useWinBurst } from '../../components/casino/WinBurst';
import { useSound } from '../../components/casino/SoundProvider';
import { useReducedMotion } from '../../components/casino/MotionSafe';
import DisconnectOverlay from '../../games/_shared/DisconnectOverlay';
import useGameSocket from '../../games/_shared/useGameSocket';
import useAnnouncer from '../../games/_shared/hooks/useAnnouncer';
import Button from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { formatCredits } from '../../lib/formatCredits';
import LandminesBoard from './LandminesBoard';
import { getDifficultyLevel } from './landminesUtils';
import TestShim from '../_shared/TestShim';

const GRID_SIZE = 5;
const MIN_MINES = 1;
const MAX_MINES = 24;
const DEFAULT_MINES = 3;
const DEFAULT_BET = 10;
const MIN_BET = 1;
const MAX_BET = 1000;
const HISTORY_LIMIT = 10;

const CELL_HIDDEN = 'hidden';
const CELL_SAFE = 'safe';
const CELL_MINE = 'mine';

function makeEmptyBoard() {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ state: CELL_HIDDEN, multiplier: null })),
  );
}

function fmtMult(m) {
  if (typeof m !== 'number' || Number.isNaN(m)) return '-';
  return `${m.toFixed(2)}x`;
}

function difficultyLabel(mines) {
  const lvl = getDifficultyLevel(mines);
  if (lvl === 'easy') return 'Easy';
  if (lvl === 'medium') return 'Medium';
  if (lvl === 'hard') return 'Hard';
  return 'Extreme';
}

/**
 * LandminesGame — premium render-layer rebuild.
 *
 * Socket contract and game logic are preserved verbatim from the previous
 * implementation. Only the render layer (GameShell + BetPanel + Framer/Pixi
 * board + sound + WinBurst) is new.
 */
const LandminesGame = () => {
  const { user } = useAuth();
  const balance = Number(user?.balance) || 0;
  const { play } = useSound();
  const { burst, WinBurst: WinBurstNode } = useWinBurst();
  const reduced = useReducedMotion();

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
  const resultHeadingRef = useRef(null);

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

  useEffect(() => {
    if (result && resultHeadingRef.current) {
      resultHeadingRef.current.focus();
    }
  }, [result]);

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
      play('bet');
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
      play('cashout');
      // WinBurst handles small/big/jackpot tiers above 2x.
      burst({ multiplier, amount: winAmount });
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
          play('cashout');
          burst({ multiplier, amount: winAmount });
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

  // Glow strength of the multiplier display grows with the multiplier.
  const multiplierGlow = useMemo(() => {
    if (reduced) return '';
    const m = Number(currentMultiplier) || 1;
    if (m >= 10) return 'ring-2 ring-amber-300 shadow-[0_0_28px_rgba(251,191,36,0.55)]';
    if (m >= 5) return 'ring-2 ring-lime-300 shadow-[0_0_22px_rgba(163,230,53,0.45)]';
    if (m >= 2) return 'ring-1 ring-lime-300 shadow-[0_0_16px_rgba(163,230,53,0.30)]';
    return 'ring-1 ring-white/10';
  }, [currentMultiplier, reduced]);

  const minesValid = mines >= MIN_MINES && mines <= MAX_MINES;
  const primaryDisabled = isPending || !minesValid;

  const primaryAction = isGameActive ? handleCashout : startGame;
  const primaryLabel = isGameActive
    ? `Cash Out @ ${fmtMult(currentMultiplier)} (${formatCredits(potentialWin, { withUnit: false })})`
    : 'Start Game';
  const primaryVariant = isGameActive ? 'success' : 'primary';

  const minesExtras = (
    <div className="flex flex-col gap-2">
      {isGameActive ? (
        <div className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-xs ring-1 ring-white/10">
          <span className="uppercase tracking-wider text-text-secondary">In progress</span>
          <span className="font-mono text-text-primary">
            {sessionRef.current.mines} mines · {sessionRef.current.revealed} revealed
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="lm-mines"
            className="text-xs uppercase tracking-wider text-text-secondary"
          >
            Mines
          </label>
          <div className="flex items-center gap-2">
            <input
              id="lm-mines"
              type="range"
              min={MIN_MINES}
              max={MAX_MINES}
              step={1}
              value={mines}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isFinite(next)) {
                  setMines(Math.min(MAX_MINES, Math.max(MIN_MINES, Math.floor(next))));
                }
              }}
              className="flex-1 accent-accent-gold"
              aria-describedby="lm-mines-difficulty"
            />
            <input
              type="number"
              min={MIN_MINES}
              max={MAX_MINES}
              step={1}
              value={mines}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') return;
                const next = Number(raw);
                if (!Number.isFinite(next)) return;
                setMines(Math.min(MAX_MINES, Math.max(MIN_MINES, Math.floor(next))));
              }}
              className="w-16 bg-bg-base border border-border-light rounded-md px-2 py-1 text-sm font-mono tabular-nums text-text-primary focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:border-accent-gold focus:outline-none"
              aria-label="Mines count"
            />
          </div>
          <p id="lm-mines-difficulty" className="text-[11px] text-text-secondary">
            Difficulty: <span className="text-accent-gold">{difficultyLabel(mines)}</span>
          </p>
        </div>
      )}
      {errorMsg ? (
        <p className="text-xs text-status-error" role="alert">
          {errorMsg}
        </p>
      ) : null}
    </div>
  );

  // Test-shim difficulty presets — legacy E2E specs select difficulty via
  // "easy"/"medium"/"hard" buttons that map to the underlying mines slider.
  // Rendered offscreen so the visual layout (custom slider) is untouched.
  //
  // The "Start Game" / "Cash Out" CTAs are produced by the visible BetPanel
  // (see `primaryLabel`) — no alias needed.
  const difficultyShims = (
    <TestShim>
      <button type="button" tabIndex={-1} onClick={() => setMines(3)}>easy</button>
      <button type="button" tabIndex={-1} onClick={() => setMines(7)}>medium</button>
      <button type="button" tabIndex={-1} onClick={() => setMines(14)}>hard</button>
    </TestShim>
  );

  const panel = (
    <BetPanel
      bet={betAmount}
      onBetChange={setBetAmount}
      min={MIN_BET}
      max={MAX_BET}
      balance={balance}
      onPlaceBet={primaryAction}
      betLabel={primaryLabel}
      primaryVariant={primaryVariant}
      disabled={primaryDisabled}
      loading={isPending && !isGameActive}
      extra={
        <>
          {difficultyShims}
          {minesExtras}
        </>
      }
      betInputId="landmines-bet-amount"
    />
  );

  // Recent cashout multipliers (last 8 winning rounds) as pills.
  const recentPills = useMemo(
    () => history.filter((h) => h.win).slice(0, 8),
    [history],
  );

  const stats = (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-xs uppercase tracking-wider text-text-secondary mb-1.5">
          Recent cashouts
        </h2>
        <div className="flex flex-wrap gap-1.5" aria-label="Recent cashouts">
          {recentPills.length === 0 ? (
            <span className="text-xs text-text-muted">No cashouts yet.</span>
          ) : (
            recentPills.map((row) => (
              <span
                key={row.id}
                className="inline-flex h-7 items-center justify-center rounded-full bg-lime-400/10 px-2 font-mono text-[11px] font-semibold tabular-nums text-lime-300 ring-1 ring-lime-400/30"
                title={`+${formatCredits(row.profit, { withUnit: false })} · ${row.mines}m`}
              >
                {fmtMult(row.multiplier || 1)}
              </span>
            ))
          )}
        </div>
      </div>
      <div>
        <h2 className="text-xs uppercase tracking-wider text-text-secondary mb-1.5">
          Recent rounds
        </h2>
        {history.length === 0 ? (
          <p className="text-xs text-text-muted italic">No rounds yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {history.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1.5"
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="uppercase tracking-wider text-text-secondary">
                    {row.mines}m
                  </span>
                  <span className="font-mono text-text-secondary">·{row.revealed}r</span>
                  {row.win ? (
                    <span className="font-mono text-accent-gold">
                      {fmtMult(row.multiplier || 1)}
                    </span>
                  ) : (
                    <span className="font-mono text-status-error">MINE</span>
                  )}
                </div>
                <span
                  className={`font-mono text-xs ${
                    row.profit >= 0 ? 'text-status-success' : 'text-status-error'
                  }`}
                >
                  {row.profit >= 0 ? '+' : ''}
                  {formatCredits(row.profit, { withUnit: false })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  // Provably-fair hash + server seed surface (compact — full panel lives in the
  // game-specific verify view if needed).
  const banner = serverSeedHash ? (
    <p className="text-[11px] text-text-muted font-mono truncate" title={serverSeedHash}>
      Server seed hash: {String(serverSeedHash).slice(0, 18)}...
    </p>
  ) : null;

  return (
    <GameShell
      title="Landmines"
      accent="orange"
      panel={panel}
      stats={stats}
      banner={banner}
    >
      <div className="relative">
        <DisconnectOverlay status={status} lastError={lastError} />

        <div className="flex flex-col gap-3">
          <div
            className={[
              'mx-auto flex w-full max-w-md items-center justify-between rounded-xl bg-white/5 px-4 py-2.5 transition-shadow',
              multiplierGlow,
            ].join(' ')}
            aria-label="Current multiplier"
          >
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-text-secondary">
                {isGameActive ? 'Multiplier' : 'Mines'}
              </span>
              <span className="font-heading text-2xl font-semibold tabular-nums text-accent-gold-light">
                {isGameActive ? (
                  <>
                    &times;
                    <AnimatedNumber value={Number(currentMultiplier) || 1} duration={0.25} />
                  </>
                ) : (
                  <span className="font-mono text-base text-text-primary">
                    {mines} · {difficultyLabel(mines)}
                  </span>
                )}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-wider text-text-secondary">
                {isGameActive ? 'Cash out' : 'Bet'}
              </span>
              <span className="font-mono text-base text-text-primary">
                {isGameActive
                  ? `${formatCredits(potentialWin, { withUnit: false })}`
                  : `${formatCredits(betAmount, { withUnit: false })}`}
              </span>
            </div>
          </div>

          <LandminesBoard
            board={board}
            isGameActive={isGameActive}
            isPending={isPending}
            focusedCell={focusedCell}
            onFocusCell={handleFocusCell}
            onReveal={handleReveal}
            onCellKeyDown={handleCellKeyDown}
            setCellRef={setCellRef}
          />

          {result ? (
            <div
              className={[
                'mx-auto mt-1 flex w-full max-w-md items-center justify-between gap-3 rounded-xl border p-3 text-sm',
                result.win
                  ? 'border-status-success/40 bg-status-success/10'
                  : 'border-status-error/40 bg-status-error/10',
              ].join(' ')}
              role="status"
            >
              <h2
                ref={resultHeadingRef}
                tabIndex={-1}
                className={`font-semibold focus:outline-none ${
                  result.win ? 'text-status-success' : 'text-status-error'
                }`}
              >
                {result.message}
                {result.multiplier ? (
                  <span className="ml-2 font-mono text-xs opacity-80">
                    @ {fmtMult(result.multiplier)}
                  </span>
                ) : null}
              </h2>
              <div className="flex items-center gap-3">
                <span
                  className={`font-mono text-sm ${
                    result.profit >= 0 ? 'text-status-success' : 'text-status-error'
                  }`}
                >
                  {result.profit >= 0 ? '+' : ''}
                  {formatCredits(result.profit, { withUnit: false })}
                </span>
                <Button
                  variant="outlineAccent"
                  size="sm"
                  onClick={() => setResult(null)}
                >
                  New Game
                </Button>
              </div>
            </div>
          ) : null}

          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {announcement}
          </div>
        </div>
      </div>

      <WinBurstNode />
    </GameShell>
  );
};

export default LandminesGame;
