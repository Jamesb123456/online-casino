import React, { useState, useEffect, useCallback, useContext } from 'react';
import PlinkoBoard from './PlinkoBoard';
import PlinkoBettingPanel from './PlinkoBettingPanel';
import {
  getPlinkoMultipliers
} from './plinkoUtils';
import plinkoSocketService from '../../services/socket/plinkoSocketService';
import { useToast } from '../../contexts/ToastContext';
import { AuthContext } from '../../contexts/AuthContext';

const PlinkoGame = () => {
  const toast = useToast();
  const { updateBalance } = useContext(AuthContext);
  // Game state
  const [betAmount, setBetAmount] = useState(10);
  const [risk, setRisk] = useState('medium');
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationPath, setAnimationPath] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [gameResult, setGameResult] = useState(null);
  const [multipliers, setMultipliers] = useState(() => getPlinkoMultipliers('medium'));
  
  // Update multipliers when risk changes
  useEffect(() => {
    setMultipliers(getPlinkoMultipliers(risk));
  }, [risk]);

  // Connect to socket when component mounts
  useEffect(() => {
    // Connect and join the Plinko game room
    plinkoSocketService.connect();

    // Listen for game results
    plinkoSocketService.onGameResult((result) => {
      if (result && result.path) {
        setAnimationPath(result.path);
        setIsAnimating(true);

        // The actual game result will be processed when animation completes
        // See handleAnimationComplete function
      }
    });

    plinkoSocketService.onError?.((error) => {
      setIsAnimating(false);
      toast.error(error?.message || 'An error occurred. Please try again.');
    });

    const unsubBalance = plinkoSocketService.onBalanceUpdate((data) => {
      if (data?.balance != null) updateBalance(data.balance);
    });

    // Cleanup when component unmounts
    return () => {
      unsubBalance();
      plinkoSocketService.disconnect();
    };
  }, [updateBalance]);
  
  // Handle dropping the ball (placing a bet)
  const handlePlaceBet = () => {
    if (isAnimating || betAmount <= 0) return;

    // Force reset animation state before starting a new one
    setAnimationPath(null);

    // Small delay to ensure previous state is cleared
    setTimeout(() => {
      setGameResult(null);
      setIsAnimating(true);
      plinkoSocketService.startGame(betAmount, 16, risk, (result) => {
        if (result && result.success && result.path) {
          setAnimationPath(result.path);
        } else {
          setIsAnimating(false);
          toast.error(result?.error || 'Failed to start game. Please try again.');
        }
      });
    }, 50);
  };
  
  const handleAnimationComplete = (bucketIndex) => {
    
    // Calculate winnings based on the bucket the ball landed in
    const winMultiplier = multipliers[bucketIndex];
    const winnings = betAmount * winMultiplier;
    const profit = winnings - betAmount;
    
    // Create result object
    const result = {
      id: Date.now(),
      timestamp: new Date(),
      betAmount,
      risk,
      bucketIndex,
      multiplier: winMultiplier,
      winnings,
      profit
    };
    
    // Update game history
    setGameHistory(prev => [result, ...prev.slice(0, 9)]);
    
    // Set game result to display
    setGameResult(result);
    
    setTimeout(() => {
      setIsAnimating(false);
      setAnimationPath(null);
    }, 100);
  };
  
  // Format timestamp for display
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-8/12 space-y-4">
        {/* Game board */}
        <div className="relative bg-bg-card border border-border rounded-xl overflow-hidden">
          <PlinkoBoard
            multipliers={multipliers}
            animationPath={animationPath}
            onAnimationComplete={handleAnimationComplete}
          />
          
          {/* Game result popup */}
          {gameResult && (
            <div role="alert" className={`
              absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2
              rounded-xl p-6 shadow-lg backdrop-blur-xl
              ${gameResult.profit >= 0
                ? 'bg-bg-card/95 border border-status-success/30'
                : 'bg-bg-card/95 border border-status-error/30'}
            `}>
              <div className={`text-3xl font-heading font-bold ${
                gameResult.profit >= 0 ? 'text-status-success' : 'text-status-error'
              }`}>
                {gameResult.profit >= 0 ?
                  `+${gameResult.profit.toFixed(2)}` :
                  `${gameResult.profit.toFixed(2)}`
                }
              </div>
            </div>
          )}
        </div>
        
        {/* Game history */}
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden mt-4">
          <div className="p-4 pb-0">
            <h3 className="text-lg font-heading font-bold text-text-primary mb-3">Game History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-elevated text-text-muted text-xs font-heading uppercase tracking-wider">
                  <th className="py-2 px-4 text-left">Time</th>
                  <th className="py-2 px-4 text-left">Bet</th>
                  <th className="py-2 px-4 text-left">Risk</th>
                  <th className="py-2 px-4 text-left">Multiplier</th>
                  <th className="py-2 px-4 text-left">Profit</th>
                </tr>
              </thead>
              <tbody>
                {gameHistory.length > 0 ? (
                  gameHistory.map(game => (
                    <tr key={game.id} className="border-b border-border">
                      <td className="py-2 px-4 text-text-secondary">{formatTime(game.timestamp)}</td>
                      <td className="py-2 px-4 text-text-secondary">{game.betAmount.toFixed(2)}</td>
                      <td className="py-2 px-4 text-text-secondary capitalize">{game.risk}</td>
                      <td className="py-2 px-4 font-heading font-bold text-text-primary">{game.multiplier.toFixed(2)}x</td>
                      <td className={`py-2 px-4 font-bold ${
                        game.profit >= 0 ? 'text-status-success' : 'text-status-error'
                      }`}>
                        {game.profit >= 0 ? '+' : ''}{game.profit.toFixed(2)}
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
      </div>
      
      <div className="lg:w-4/12">
        <PlinkoBettingPanel
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          risk={risk}
          setRisk={setRisk}
          onPlaceBet={handlePlaceBet}
          isAnimating={isAnimating}
        />
        
        {/* Game statistics */}
        <div className="bg-bg-card border border-border rounded-xl p-5 mt-4">
          <h3 className="text-lg font-heading font-bold text-text-primary mb-3">Game Stats</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="text-xs text-text-muted">Games Played</div>
              <div className="text-lg font-heading font-bold text-text-primary">{gameHistory.length}</div>
            </div>
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="text-xs text-text-muted">Total Wagered</div>
              <div className="text-lg font-heading font-bold text-text-primary">
                {gameHistory.reduce((sum, game) => sum + game.betAmount, 0).toFixed(2)}
              </div>
            </div>
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="text-xs text-text-muted">Total Profit</div>
              <div className={`text-lg font-heading font-bold ${
                gameHistory.reduce((sum, game) => sum + game.profit, 0) >= 0
                  ? 'text-status-success'
                  : 'text-status-error'
              }`}>
                {gameHistory.reduce((sum, game) => sum + game.profit, 0).toFixed(2)}
              </div>
            </div>
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="text-xs text-text-muted">Best Win</div>
              <div className="text-lg font-heading font-bold text-status-success">
                {gameHistory.length > 0
                  ? Math.max(...gameHistory.map(g => g.profit)).toFixed(2)
                  : '0.00'
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlinkoGame;