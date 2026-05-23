import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import RouletteWheel from './RouletteWheel';
import RouletteBettingPanel from './RouletteBettingPanel';
import RoulettePlayersList from './RoulettePlayersList';
import RouletteActiveBets from './RouletteActiveBets';
import GameShell from '../../components/casino/GameShell';
import BetPanel from '../../components/casino/BetPanel';
import TestShim from '../_shared/TestShim';
import { useWinBurst } from '../../components/casino/WinBurst';
import { useSound } from '../../components/casino/SoundProvider';
import { AuthContext } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import useGameSocket from '../_shared/useGameSocket';
import useGameError from '../_shared/hooks/useGameError';
import { BET_TYPES, ROULETTE_NUMBERS } from './rouletteUtils';

const numberColor = (n) =>
  ROULETTE_NUMBERS.find((x) => x.number === Number(n))?.color || 'green';

function ResultPill({ result }) {
  const color = numberColor(result.winningNumber);
  const classes = [
    'inline-flex h-7 min-w-[2.5rem] items-center justify-center rounded-full px-2',
    'font-mono text-xs font-bold tabular-nums ring-1',
    color === 'red'
      ? 'bg-red-500/15 text-red-300 ring-red-400/30'
      : color === 'black'
      ? 'bg-white/5 text-text-primary ring-white/20'
      : 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
  ].join(' ');
  return (
    <span className={classes} title={`Spin ${result.id}`}>
      {result.winningNumber}
    </span>
  );
}

const RouletteGame = () => {
  const { user, updateBalance } = useContext(AuthContext) || {};
  const toast = useToast();
  const { play } = useSound();
  const { burst, WinBurst: WinBurstNode } = useWinBurst();

  // Balance comes from AuthContext (single source of truth). Server pushes
  // via balanceUpdate / join / placeBet acks call updateBalance(), which
  // propagates here automatically.
  const balance = Number(user?.balance ?? 0);
  const [betAmount, setBetAmount] = useState(10);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinPhase, setSpinPhase] = useState(null);
  const [spinData, setSpinData] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [winningNumber, setWinningNumber] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [currentBets, setCurrentBets] = useState([]);

  // Multiplayer state
  const [activePlayers, setActivePlayers] = useState([]);
  const [multiplayerBets, setMultiplayerBets] = useState([]);

  // Socket wiring via the shared hook. Subscribe to all twelve server events
  // by name; the hook handles connect / reconnect / cleanup automatically.
  const events = useMemo(
    () => ({
      'roulette:activePlayers': (players) => {
        setActivePlayers(players);
      },
      'roulette:playerJoined': (player) => {
        setActivePlayers((prev) => [...prev, player]);
      },
      'roulette:playerLeft': (player) => {
        setActivePlayers((prev) => prev.filter((p) => p.id !== player.id));
      },
      'roulette:currentBets': (bets) => {
        setMultiplayerBets(bets);
      },
      'roulette:playerBet': (bet) => {
        setMultiplayerBets((prev) => [...prev, bet]);
      },
      balanceUpdate: (data) => {
        if (data?.balance != null && typeof updateBalance === 'function') {
          updateBalance(data.balance);
        }
      },
      bettingStart: () => {
        setIsSpinning(false);
        setSpinPhase(null);
        setShowResult(false);
        setCurrentBets([]);
        setMultiplayerBets([]);
      },
      bettingEnd: () => {
        // betting closed, spin pending
      },
      'roulette:spin_started': (data) => {
        setIsSpinning(true);
        setSpinPhase('start');
        setSpinData(data?.spinData);
        setShowResult(false);
      },
      'roulette:spin_result': (data) => {
        setSpinPhase('result');
        setWinningNumber(data?.winningNumber);
        setTimeout(() => setShowResult(true), 800);
      },
      'roulette:personal_result': (data) => {
        const totalBet = data?.bets
          ? data.bets.reduce((sum, b) => sum + Number(b.amount || 0), 0)
          : 0;
        const profit = Number(data?.totalProfit) || 0;
        const winnings = Number(data?.totalWinnings) || 0;
        const wn = data?.winningNumber ?? winningNumber;
        const entry = {
          id: Date.now(),
          winningNumber: wn,
          winningColor: data?.winningColor || numberColor(wn),
          bets: data?.bets || [],
          totalBetAmount: totalBet,
          totalWinnings: winnings,
          totalProfit: profit,
          timestamp: new Date(),
        };
        setGameResult(entry);
        setGameHistory((prev) => [entry, ...prev].slice(0, 50));
        setCurrentBets([]);

        // Win/loss feedback
        if (profit > 0 && totalBet > 0) {
          const multiplier = (winnings || 0) / Math.max(0.01, totalBet);
          burst({ multiplier, amount: winnings });
        } else if (totalBet > 0) {
          try {
            play('lose');
          } catch {
            /* ignore */
          }
        }
      },
      'roulette:round_complete': () => {
        setIsSpinning(false);
      },
    }),
    [updateBalance, burst, play, winningNumber],
  );

  const { status, emit } = useGameSocket('roulette', { events });
  const isConnected = status === 'connected';

  // No connect-failure toast effect historically — `gameName` is omitted so
  // `useGameError` only provides the stable `reportError` helper. Per-action
  // toasts below preserve their original copy.
  const { reportError } = useGameError();

  // Tiny helper: wrap `emit` in a Promise that resolves on a success-ack and
  // rejects on an error-ack. Local-only; not promoted to the hook because most
  // games don't need it.
  const emitWithAck = useCallback(
    (event, payload) =>
      new Promise((resolve, reject) => {
        emit(event, payload, (response) => {
          if (response && response.success) resolve(response);
          else reject(new Error(response?.error || `Request failed: ${event}`));
        });
      }),
    [emit],
  );

  // Join the room once the socket is up. Mirrors the legacy
  // `await rouletteSocketService.joinGame()` lifecycle but driven by status.
  useEffect(() => {
    if (status !== 'connected') return;
    emit('roulette:join', {}, (gameData) => {
      if (gameData?.success) {
        if (gameData.balance != null && typeof updateBalance === 'function') {
          updateBalance(gameData.balance);
        }
        setGameHistory(gameData.history || []);
      }
    });
  }, [status, emit, updateBalance]);

  const handlePlaceBet = useCallback(
    (bet) => {
      if (isSpinning) return;
      const amt = Number(bet?.amount || 0);
      if (amt <= 0) return;
      if (amt > balance) {
        reportError(null, 'Insufficient balance');
        return;
      }

      emitWithAck('roulette:place_bet', { type: bet.type, value: bet.value, amount: amt })
        .then((response) => {
          if (response?.success) {
            if (response.balance != null && typeof updateBalance === 'function') {
              updateBalance(response.balance);
            }
            setCurrentBets(response.currentBets || []);
          } else {
            reportError(response?.error, 'Failed to place bet');
          }
        })
        .catch((err) => {
          reportError(err, 'Failed to place bet');
        });
    },
    [isSpinning, balance, toast, reportError, emitWithAck, updateBalance],
  );

  const handleSpin = useCallback(async () => {
    if (isSpinning) return;
    if (currentBets.length === 0) {
      toast.warning?.('Place at least one bet before spinning');
      return;
    }
    if (status !== 'connected') {
      reportError(null, 'Cannot connect to game server. Please refresh the page.');
      return;
    }

    const formattedBets = currentBets.map((bet) => ({
      ...bet,
      value: String(bet.value),
    }));

    // 10s safety timeout guards against a silent server hang — matches the
    // legacy behaviour exactly.
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      reportError(null, 'Spin request timed out');
      setIsSpinning(false);
    }, 10000);

    try {
      const response = await new Promise((resolve, reject) => {
        emit('roulette:spin', { bets: formattedBets }, (resp) => {
          if (resp && resp.success) resolve(resp);
          else reject(new Error(resp?.error || 'Error spinning wheel'));
        });
      });

      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);

      if (!response?.success) {
        reportError(null, 'Error spinning the wheel. Please try again.');
      }
    } catch (error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      reportError(error, 'An unexpected error occurred.');
      setIsSpinning(false);
    }
  }, [isSpinning, currentBets, status, toast, reportError, emit]);

  const totalPlaced = currentBets.reduce((sum, b) => sum + Number(b.amount || 0), 0);

  const extras = (
    <div className="flex flex-col gap-2">
      <div className="rounded-md bg-white/5 px-3 py-2 ring-1 ring-white/10">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-secondary">Bets placed</span>
          <span className="font-mono tabular-nums text-text-primary">
            {currentBets.length}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-text-secondary">Total wagered</span>
          <span className="font-mono tabular-nums text-accent-gold-light">
            ${totalPlaced.toFixed(2)}
          </span>
        </div>
      </div>
      {gameResult ? (
        <div className="rounded-md bg-white/5 px-3 py-2 text-xs ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Last result</span>
            <span
              className={[
                'font-mono font-bold tabular-nums',
                (gameResult.totalProfit || 0) >= 0 ? 'text-lime-300' : 'text-accent-rose',
              ].join(' ')}
            >
              {(gameResult.totalProfit || 0) >= 0 ? '+' : ''}
              {(gameResult.totalProfit || 0).toFixed(2)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );

  const panel = (
    <div className="flex flex-col gap-4">
      <RouletteBettingPanel
        betAmount={betAmount}
        setBetAmount={setBetAmount}
        onPlaceBet={handlePlaceBet}
        isSpinning={isSpinning}
        balance={balance}
        placedBets={currentBets}
      />
      <BetPanel
        bet={betAmount}
        onBetChange={setBetAmount}
        min={0.1}
        max={1000}
        balance={balance}
        onPlaceBet={handleSpin}
        betLabel={isSpinning ? 'Wait…' : 'Spin'}
        loading={isSpinning}
        disabled={isSpinning || currentBets.length === 0}
        primaryVariant="primary"
        extra={extras}
        betInputId="roulette-stake-amount"
      />
      {/* Hidden test-shim alias: legacy E2E specs look for a "Place Bet"
          button; treat it as a click-through to the spin handler. Enabled
          whenever a spin is not in flight — the spec clicks a chip first
          (which queues a bet), then clicks Place Bet to commit. */}
      <TestShim>
        <button
          type="button"
          onClick={handleSpin}
          disabled={isSpinning}
          tabIndex={-1}
        >
          Place Bet
        </button>
      </TestShim>
      <RouletteActiveBets bets={multiplayerBets} />
      <div className="border-t border-white/10 pt-3">
        <RoulettePlayersList players={activePlayers} />
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            isConnected ? 'bg-status-success' : 'bg-status-error'
          }`}
        />
        <span className="text-xs text-text-muted">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
    </div>
  );

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
    <GameShell title="Roulette" accent="emerald" panel={panel} stats={stats}>
      <div className="flex flex-col items-center gap-3">
        <RouletteWheel
          isSpinning={isSpinning}
          spinData={spinData}
          spinPhase={spinPhase}
          winningNumber={winningNumber}
          showResult={showResult}
          onSpinComplete={() => {
            // Server drives state; render-only callback.
          }}
        />
        {gameResult && !isSpinning ? (
          <div
            role="status"
            className="w-full max-w-md rounded-xl border border-white/10 bg-bg-card/70 p-3 backdrop-blur"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">Winning number</span>
              <span className="font-heading text-base font-bold text-text-primary">
                {gameResult.winningNumber}
              </span>
            </div>
            {(gameResult.bets || []).length > 0 ? (
              <div className="mt-2 space-y-1">
                {(gameResult.bets || []).map((b, i) => (
                  <div
                    key={`${b.type}-${b.value}-${i}`}
                    className="flex items-center justify-between text-[11px]"
                  >
                    <span className="text-text-secondary">
                      {BET_TYPES[b.type]?.name || b.type}
                      {b.value ? ` · ${b.value}` : ''}
                      <span className="text-text-muted"> (${Number(b.amount).toFixed(2)})</span>
                    </span>
                    <span
                      className={
                        b.isWinner
                          ? 'font-mono font-bold tabular-nums text-lime-300'
                          : 'font-mono tabular-nums text-accent-rose'
                      }
                    >
                      {b.isWinner
                        ? `+${Number(b.profit || 0).toFixed(2)}`
                        : `-${Number(b.amount || 0).toFixed(2)}`}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <WinBurstNode />
    </GameShell>
  );
};

export default RouletteGame;
