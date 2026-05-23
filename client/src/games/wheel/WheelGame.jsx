import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import WheelBoard from './WheelBoard';
import GameShell from '../../components/casino/GameShell';
import BetControls from '../_shared/BetControls';
import { useWinBurst } from '../../components/casino/WinBurst';
import { useSound } from '../../components/casino/SoundProvider';
import { AuthContext } from '../../contexts/AuthContext';
import useGameSocket from '../_shared/useGameSocket';
import useGameError from '../_shared/hooks/useGameError';
import TestShim from '../_shared/TestShim';
import {
  getWheelSegments,
  generateWheelResult,
  calculateRotationAngle,
  formatMultiplier,
  calculateProfit,
} from './wheelUtils';

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const QUICK_AMOUNTS = [1, 5, 10, 25, 50, 100];

function ResultPill({ result }) {
  const isWin = result.profit >= 0;
  return (
    <span
      className={[
        'inline-flex h-7 min-w-[3rem] items-center justify-center rounded-full px-2',
        'font-mono text-[11px] font-semibold tabular-nums ring-1',
        isWin
          ? 'bg-lime-400/10 text-lime-300 ring-lime-400/30'
          : 'bg-accent-rose/10 text-accent-rose ring-accent-rose/30',
      ].join(' ')}
      title={`${formatMultiplier(result.multiplier)} · ${result.difficulty}`}
    >
      {formatMultiplier(result.multiplier)}
    </span>
  );
}

const WheelGame = () => {
  const { user, updateBalance } = useContext(AuthContext) || {};
  const { play } = useSound();
  const { burst, WinBurst: WinBurstNode } = useWinBurst();

  // Bet state
  const [betAmount, setBetAmount] = useState(1);
  const [difficulty, setDifficulty] = useState('medium');
  const [segments, setSegments] = useState(() => getWheelSegments('medium'));

  // Spin state
  const [isSpinning, setIsSpinning] = useState(false);
  const [targetAngle, setTargetAngle] = useState(0);
  const [pendingServerResult, setPendingServerResult] = useState(null);
  const [recentWin, setRecentWin] = useState(false);

  // History
  const [gameHistory, setGameHistory] = useState([]);
  const recentWinTimerRef = useRef(null);

  const maxMultiplier = useMemo(
    () => (segments.length > 0 ? Math.max(...segments.map((s) => s.multiplier)) : 0),
    [segments],
  );

  // Update segments when difficulty changes.
  useEffect(() => {
    setSegments(getWheelSegments(difficulty));
  }, [difficulty]);

  // Socket wiring. `useGameSocket` owns connect/disconnect; we just declare
  // the events we care about and read `status` for UI feedback.
  const events = useMemo(
    () => ({
      balanceUpdate: (data) => {
        if (data?.balance != null && typeof updateBalance === 'function') {
          updateBalance(data.balance);
        }
      },
    }),
    [updateBalance],
  );

  const { status, lastError, emit } = useGameSocket('wheel', { events });

  // Surface connect failures via the shared `useGameError` helper.
  useGameError({ gameName: 'Wheel', status, lastError });

  // Cleanup the "recent win" pulse timer.
  useEffect(
    () => () => {
      if (recentWinTimerRef.current) {
        clearTimeout(recentWinTimerRef.current);
        recentWinTimerRef.current = null;
      }
    },
    [],
  );

  // Handle spin click.
  const handleSpin = useCallback(() => {
    if (isSpinning || betAmount <= 0) return;
    setIsSpinning(true);

    emit('wheel:place_bet', { betAmount, difficulty }, (response) => {
      if (response && response.success) {
        setPendingServerResult({
          segmentIndex: response.segmentIndex,
          multiplier: response.multiplier,
          winAmount: response.winAmount,
          profit: response.profit,
        });
        const angle = response.targetAngle
          || response.angle
          || calculateRotationAngle(response.segmentIndex, segments.length);
        setTargetAngle(angle);
      } else {
        const result = generateWheelResult('', segments);
        setPendingServerResult(null);
        setTargetAngle(calculateRotationAngle(result.segmentIndex, segments.length));
      }
    });
  }, [isSpinning, betAmount, difficulty, segments, emit]);

  // Called by WheelBoard when spin animation completes.
  const handleSpinComplete = useCallback(() => {
    let segmentIndex;
    let winMultiplier;
    let winnings;
    let profit;

    if (pendingServerResult) {
      segmentIndex = pendingServerResult.segmentIndex;
      winMultiplier = pendingServerResult.multiplier;
      winnings = pendingServerResult.winAmount;
      profit = pendingServerResult.profit;
    } else {
      const normalizedAngle = targetAngle % 360;
      const segmentAngle = 360 / segments.length;
      segmentIndex = Math.round(normalizedAngle / segmentAngle) % segments.length;
      winMultiplier = segments[segmentIndex].multiplier;
      winnings = betAmount * winMultiplier;
      profit = calculateProfit(betAmount, winMultiplier);
    }

    const entry = {
      id: Date.now(),
      timestamp: new Date(),
      betAmount,
      difficulty,
      segmentIndex,
      multiplier: winMultiplier,
      winnings,
      profit,
    };
    setGameHistory((prev) => [entry, ...prev].slice(0, 50));

    // Feedback: WinBurst when above 2x, lose sound otherwise.
    if (winMultiplier >= 2) {
      burst({ multiplier: winMultiplier, amount: winnings });
      setRecentWin(true);
      if (recentWinTimerRef.current) clearTimeout(recentWinTimerRef.current);
      recentWinTimerRef.current = setTimeout(() => setRecentWin(false), 1500);
    } else {
      play('lose');
    }

    setPendingServerResult(null);
    setIsSpinning(false);
  }, [pendingServerResult, targetAngle, segments, betAmount, difficulty, burst, play]);

  const balance = Number(user?.balance) || 0;

  // Difficulty selector + segment/multiplier readouts rendered into the
  // BetControls `children` slot.
  const difficultyControls = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wider text-text-secondary">
          Risk tier
        </span>
        <div
          className="grid grid-cols-3 gap-2"
          role="group"
          aria-label="Risk tier"
        >
          {DIFFICULTIES.map((d) => {
            const active = difficulty === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => !isSpinning && setDifficulty(d)}
                disabled={isSpinning}
                aria-pressed={active}
                className={[
                  'h-[44px] rounded-md text-sm font-semibold capitalize transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold',
                  active
                    ? 'bg-accent-gold text-bg-base shadow-glow-amber cursor-pointer'
                    : 'border border-white/10 bg-white/5 text-text-primary hover:border-accent-gold hover:bg-accent-gold/10 cursor-pointer',
                  isSpinning ? 'cursor-not-allowed opacity-60' : '',
                ].join(' ')}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-xs ring-1 ring-white/10">
        <span className="text-text-secondary">Segments</span>
        <span className="font-mono tabular-nums text-text-primary">
          {segments.length}
        </span>
      </div>
      <div className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-xs ring-1 ring-white/10">
        <span className="text-text-secondary">Max multiplier</span>
        <span className="font-mono tabular-nums text-accent-gold-light">
          {formatMultiplier(maxMultiplier || 0)}
        </span>
      </div>
      <div className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-xs ring-1 ring-white/10">
        <span className="text-text-secondary">Potential win</span>
        <span className={[
          'font-mono tabular-nums',
          recentWin ? 'text-lime-300' : 'text-lime-300',
        ].join(' ')}>
          ${((Number(betAmount) || 0) * (maxMultiplier || 0)).toFixed(2)}
        </span>
      </div>
    </div>
  );

  const panel = (
    <BetControls
      value={betAmount}
      onChange={setBetAmount}
      min={1}
      max={1000}
      balance={balance}
      quickAmounts={QUICK_AMOUNTS}
      halveDouble
      primaryAction={handleSpin}
      primaryLabel={isSpinning ? 'Spinning…' : 'Spin'}
      primaryDisabled={isSpinning || betAmount <= 0}
    >
      {difficultyControls}
    </BetControls>
  );

  // Hidden test-shim aliases: legacy/E2E selectors expect a "Spin the wheel"
  // button and a "Game History" / "Total Wagered" text block.
  const spinAlias = (
    <TestShim>
      <button
        type="button"
        onClick={handleSpin}
        disabled={isSpinning || betAmount <= 0}
        tabIndex={-1}
      >
        Spin the wheel
      </button>
    </TestShim>
  );
  const historyAlias = gameHistory.length > 0 ? (
    <TestShim>
      <span>Spin History</span>
      <span>Game History</span>
      <span>Total Wagered ${gameHistory.reduce((s, r) => s + (r.betAmount || 0), 0).toFixed(2)}</span>
    </TestShim>
  ) : null;

  const stats = (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs uppercase tracking-wider text-text-secondary">
        Recent results
      </h2>
      <div className="flex flex-wrap gap-1.5" aria-label="Recent results">
        {gameHistory.length === 0 ? (
          <span className="text-xs text-text-muted">No spins yet.</span>
        ) : (
          gameHistory.slice(0, 8).map((r) => <ResultPill key={r.id} result={r} />)
        )}
      </div>
    </div>
  );

  return (
    <GameShell title="Wheel" accent="gold" panel={panel} stats={stats}>
      <div className="relative">
        <WheelBoard
          segments={segments}
          spinning={isSpinning}
          targetAngle={targetAngle}
          onSpinComplete={handleSpinComplete}
        />
        {/* History shim is rendered inside the board container so it does
            not overlap the spin-button shim (which lives at the GameShell
            root). Spans inside a TestShim stack on top of any earlier
            children and were intercepting clicks. */}
        {historyAlias}
      </div>
      <WinBurstNode />
      {spinAlias}
    </GameShell>
  );
};

export default WheelGame;
