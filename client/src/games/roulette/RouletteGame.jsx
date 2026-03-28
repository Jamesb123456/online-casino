import React, { useState, useEffect, useCallback, useContext } from 'react';
import RouletteWheel from './RouletteWheel';
import RouletteBettingPanel from './RouletteBettingPanel';
import RoulettePlayersList from './RoulettePlayersList';
import RouletteActiveBets from './RouletteActiveBets';
import Badge from '../../components/ui/Badge';
import { AuthContext } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import rouletteSocketService from '../../services/socket/rouletteSocketService';
import { BET_TYPES } from './rouletteUtils';

const RouletteGame = () => {
  const { user } = useContext(AuthContext);
  const toast = useToast();

  // Game state
  const [balance, setBalance] = useState(1000);
  const [betAmount, setBetAmount] = useState(10);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinPhase, setSpinPhase] = useState(null); // null, 'start', 'result', 'complete'
  const [spinData, setSpinData] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [winningNumber, setWinningNumber] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [currentBets, setCurrentBets] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  
  // Multiplayer state
  const [activePlayers, setActivePlayers] = useState([]);
  const [multiplayerBets, setMultiplayerBets] = useState([]);

  // Socket connection effect
  useEffect(() => {
    const unsubs = [];

    const connectSocket = async () => {
      try {
        // Use authenticated user for multiplayer identity
        const userInfo = user ? {
          userId: user.id,
          username: user.username,
          avatar: user.avatar || null
        } : null;

        if (userInfo) rouletteSocketService.setUser(userInfo);
        await rouletteSocketService.connect(userInfo);
        setIsConnected(true);

        // Join roulette game
        const gameData = await rouletteSocketService.joinGame();
        if (gameData.success) {
          setBalance(gameData.balance);
          setGameHistory(gameData.history || []);
        }

        // Set up multiplayer event listeners
        unsubs.push(rouletteSocketService.onActivePlayers((players) => {
          setActivePlayers(players);
        }));

        unsubs.push(rouletteSocketService.onPlayerJoined((player) => {
          setActivePlayers(prev => [...prev, player]);
        }));

        unsubs.push(rouletteSocketService.onPlayerLeft((player) => {
          setActivePlayers(prev => prev.filter(p => p.id !== player.id));
        }));

        unsubs.push(rouletteSocketService.onCurrentBets((bets) => {
          setMultiplayerBets(bets);
        }));

        unsubs.push(rouletteSocketService.onPlayerBet((bet) => {
          setMultiplayerBets(prev => [...prev, bet]);
        }));

        unsubs.push(rouletteSocketService.onSpinStarted((data) => {
          setIsSpinning(true);
          setSpinPhase('start');
          setSpinData(data.spinData);
          setShowResult(false);
        }));

        unsubs.push(rouletteSocketService.onSpinResult((data) => {
          setSpinPhase('result');
          setWinningNumber(data.winningNumber);
          setBalance(prevBalance => prevBalance + data.totalProfit);

          const gameResultObj = {
            id: data.gameId,
            winningNumber: data.winningNumber,
            winningColor: data.winningColor,
            bets: data.bets,
            totalBetAmount: data.bets ? data.bets.reduce((sum, bet) => sum + bet.amount, 0) : 0,
            totalWinnings: data.totalWinnings,
            totalProfit: data.totalProfit,
            timestamp: new Date()
          };

          setGameResult(gameResultObj);
          setGameHistory(prevHistory => [gameResultObj, ...prevHistory]);

          setTimeout(() => {
            setShowResult(true);
          }, 1000);
        }));

        unsubs.push(rouletteSocketService.onRoundComplete(() => {
          setIsSpinning(false);
        }));

      } catch (error) {
        console.error('Error connecting to roulette game:', error);
      }
    };

    connectSocket();

    // Cleanup on unmount
    return () => {
      unsubs.forEach(unsub => unsub());
      rouletteSocketService.disconnect();
      setIsConnected(false);
    };
  }, []);

  // Handle placing a bet
  const handlePlaceBet = useCallback((bet) => {
    if (isSpinning || betAmount <= 0) return;
    
    // Validate bet amount doesn't exceed balance
    if (betAmount > balance) {
      toast.error('Insufficient balance');
      return;
    }
    
    // Add bet to current bets
    const newBet = {
      id: Date.now(),
      type: bet.type,
      value: bet.value,
      amount: betAmount,
      payout: BET_TYPES[bet.type].payout
    };
    
    // Send bet to server via socket
    rouletteSocketService.placeBet({
      type: bet.type,
      value: bet.value,
      amount: betAmount
    }).then(response => {
      if (response.success) {
        setBalance(response.balance);
        setCurrentBets(response.currentBets);
      } else {
        toast.error(response.error || 'Failed to place bet');
      }
    });
  }, [isSpinning, betAmount, balance]);

  // Handle spin
  const handleSpin = async () => {
    try {
      if (isSpinning) return;
      
      // Check if there are active bets
      if (currentBets.length === 0) {
        toast.warning('Place at least one bet before spinning');
        return;
      }
      
      try {
        await rouletteSocketService.ensureConnected();
      } catch (connError) {
        toast.error('Cannot connect to game server. Please refresh the page.');
        return;
      }

      const response = await rouletteSocketService.spin(currentBets);

      if (!response.success) {
        toast.error('Error spinning the wheel. Please try again.');
        return;
      }
    } catch (error) {
      console.error('Error spinning wheel:', error);
      toast.error(error.message || 'An unexpected error occurred.');
      setIsSpinning(false);
    }      
  };

  // Format timestamp for display
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  // Get color badge for a number
  const getNumberColorBadge = (number) => {
    if (number === 0) {
      return <Badge color="green">{number}</Badge>;
    } else if ((number % 2) === 0) {
      return <Badge color="black">{number}</Badge>;
    } else {
      return <Badge color="red">{number}</Badge>;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-8/12 space-y-4">
        {/* Roulette wheel */}
        <div className="relative">
          <RouletteWheel
            spinning={isSpinning}
            spinData={spinData}
            winningNumber={winningNumber}
            showResult={showResult}
            onSpinComplete={() => {
              // This callback is triggered when the local animation completes
              // We don't set isSpinning=false here because we follow the server states
            }}
          />
          
          {/* Spin button */}
          <div className="mt-4 flex justify-center">
            <button
              onClick={handleSpin}
              disabled={isSpinning || currentBets.length === 0}
              className="bg-game-roulette hover:bg-emerald-600 text-white font-bold rounded-lg py-3 px-6 w-full max-w-xs cursor-pointer transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            >
              {isSpinning ? 'Spinning...' : 'SPIN'}
            </button>
          </div>
          
          {/* Current bets display */}
          {currentBets.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-heading font-medium text-text-secondary mb-2">Current Bets</h3>
              <div className="flex flex-wrap gap-2">
                {currentBets.map(bet => (
                  <div key={bet.id} className="bg-bg-elevated rounded-lg px-3 py-1.5 text-sm border border-border">
                    <span className="text-accent-gold">{BET_TYPES[bet.type].name}</span>
                    {bet.value && <span className="text-text-secondary"> - {bet.value}</span>}
                    <span className="text-text-muted"> ({bet.amount})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Game results and history */}
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden mt-4">
          <div className="p-4 pb-0">
            <h3 className="text-lg font-heading font-bold text-text-primary mb-3">Spin History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-elevated text-text-muted text-xs font-heading uppercase tracking-wider">
                  <th className="py-2 px-4 text-left">Time</th>
                  <th className="py-2 px-4 text-left">Number</th>
                  <th className="py-2 px-4 text-left">Bets</th>
                  <th className="py-2 px-4 text-left">Wagered</th>
                  <th className="py-2 px-4 text-left">Profit</th>
                </tr>
              </thead>
              <tbody>
                {gameHistory.length > 0 ? (
                  gameHistory.map(game => (
                    <tr key={game.id} className="border-b border-border">
                      <td className="py-2 px-4 text-text-secondary">{formatTime(game.timestamp)}</td>
                      <td className="py-2 px-4">{getNumberColorBadge(game.winningNumber)}</td>
                      <td className="py-2 px-4 text-text-secondary">{game.bets.length}</td>
                      <td className="py-2 px-4 text-text-secondary">{game.totalBetAmount.toFixed(2)}</td>
                      <td className={`py-2 px-4 font-bold ${
                        game.totalProfit >= 0 ? 'text-status-success' : 'text-status-error'
                      }`}>
                        {game.totalProfit >= 0 ? '+' : ''}{game.totalProfit.toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center py-4 text-text-muted">
                      No games played yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Last result details */}
        {gameResult && !isSpinning && (
          <div role="alert" className="bg-bg-card border border-border rounded-xl p-5 mt-4">
            <h3 className="text-lg font-heading font-bold text-text-primary mb-3">Last Spin Results</h3>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-text-muted">Winning Number:</span>
                <div className="flex items-center">
                  {getNumberColorBadge(gameResult.winningNumber)}
                  <span className="font-heading font-bold text-text-primary ml-2">{gameResult.winningNumber}</span>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-text-muted mb-1">Bets</h4>
                <div className="space-y-2">
                  {gameResult.bets.map((bet, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <div>
                        <span className="text-text-secondary">{bet.type}</span>
                        {bet.value && <span className="text-text-muted"> - {bet.value}</span>}
                        <span className="text-text-muted"> (${bet.amount.toFixed(2)})</span>
                      </div>
                      <div className={bet.isWinner ? 'text-status-success font-bold' : 'text-status-error'}>
                        {bet.isWinner ? `+${bet.profit.toFixed(2)}` : `-${bet.amount.toFixed(2)}`}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-2 border-t border-border flex justify-between">
                  <div className="text-text-secondary">Total</div>
                  <div className={`font-heading font-bold ${gameResult.totalProfit >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                    {gameResult.totalProfit >= 0 ? '+' : ''}{gameResult.totalProfit.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="lg:w-4/12">
        {/* Betting panel */}
        <RouletteBettingPanel
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          onPlaceBet={handlePlaceBet}
          isSpinning={isSpinning}
          balance={balance}
        />
        
        {/* Active bets from all players */}
        <div className="mt-4">
          <RouletteActiveBets bets={multiplayerBets} />
        </div>
        
        {/* Game statistics */}
        <div className="bg-bg-card border border-border rounded-xl p-5 mt-4">
          <h3 className="text-lg font-heading font-bold text-text-primary mb-3">Statistics</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="text-xs text-text-muted">Spins</div>
              <div className="text-lg font-heading font-bold text-text-primary">{gameHistory.length}</div>
            </div>
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="text-xs text-text-muted">Total Wagered</div>
              <div className="text-lg font-heading font-bold text-text-primary">
                {gameHistory.reduce((sum, game) => sum + game.totalBetAmount, 0).toFixed(2)}
              </div>
            </div>
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="text-xs text-text-muted">Total Profit</div>
              <div className={`text-lg font-heading font-bold ${
                gameHistory.reduce((sum, game) => sum + game.totalProfit, 0) >= 0
                  ? 'text-status-success'
                  : 'text-status-error'
              }`}>
                {gameHistory.reduce((sum, game) => sum + game.totalProfit, 0).toFixed(2)}
              </div>
            </div>
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="text-xs text-text-muted">Best Win</div>
              <div className="text-lg font-heading font-bold text-status-success">
                {gameHistory.length > 0
                  ? Math.max(...gameHistory.map(g => g.totalProfit)).toFixed(2)
                  : '0.00'
                }
              </div>
            </div>
          </div>

          {/* Active players list */}
          <div className="mt-4 border-t border-border pt-4">
            <RoulettePlayersList players={activePlayers} />
          </div>

          {/* Connection status */}
          <div className="mt-4 border-t border-border pt-4">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-status-success' : 'bg-status-error'}`}></span>
              <span className="text-xs text-text-muted">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouletteGame;