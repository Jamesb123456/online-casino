import React, { useState, useEffect, useCallback, useContext } from 'react';
import WheelBoard from './WheelBoard';
import WheelBettingPanel from './WheelBettingPanel';
import WheelPlayersList from './WheelPlayersList';
import WheelActiveBets from './WheelActiveBets';
import Badge from '../../components/ui/Badge';
import { AuthContext } from '../../contexts/AuthContext';
import wheelSocketService from '../../services/socket/wheelSocketService';
import { 
  getWheelSegments, 
  generateWheelResult,
  calculateRotationAngle,
  formatMultiplier,
  calculateProfit
} from './wheelUtils';

const WheelGame = () => {
  const { user } = useContext(AuthContext);
  
  // Game state
  const [betAmount, setBetAmount] = useState(10);
  const [difficulty, setDifficulty] = useState('medium');
  const [segments, setSegments] = useState(() => getWheelSegments('medium'));
  const [isSpinning, setIsSpinning] = useState(false);
  const [targetAngle, setTargetAngle] = useState(0);
  const [gameResult, setGameResult] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [maxMultiplier, setMaxMultiplier] = useState(0);
  const [spins, setSpins] = useState(0);
  
  // Multiplayer state
  const [activePlayers, setActivePlayers] = useState([]);
  const [currentBets, setCurrentBets] = useState([]);

  // Helper function for formatting numbers with English locale
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (number) => {
    return new Intl.NumberFormat('en-US').format(number);
  };

  // Update segments when difficulty changes
  useEffect(() => {
    const newSegments = getWheelSegments(difficulty);
    setSegments(newSegments);
    
    // Find max multiplier in the segments
    const max = Math.max(...newSegments.map(s => s.multiplier));
    setMaxMultiplier(max);
  }, [difficulty]);
  
  // Initialize socket connection and event listeners
  useEffect(() => {
    // Set user information for socket authentication
    if (user) {
      wheelSocketService.setUser({
        userId: user.id,
        username: user.username,
        avatar: user.avatar
      });
    }
    
    // Connect to socket
    wheelSocketService.connect();
    
    // Set up multiplayer event listeners
    wheelSocketService.onActivePlayers((players) => {
      setActivePlayers(players);
    });

    wheelSocketService.onPlayerJoined((player) => {
      setActivePlayers(prev => [...prev, player]);
    });

    wheelSocketService.onPlayerLeft((player) => {
      setActivePlayers(prev => prev.filter(p => p.id !== player.id));
    });

    wheelSocketService.onCurrentBets((bets) => {
      setCurrentBets(bets);
    });

    wheelSocketService.onPlayerBet((bet) => {
      setCurrentBets(prev => [...prev, bet]);
    });
    
    // Cleanup on unmount
    return () => {
      wheelSocketService.disconnect();
    };
  }, [user]);

  // Handle wheel spin
  const handleSpin = useCallback(async () => {
    if (isSpinning || betAmount <= 0) return;

    setIsSpinning(true);
    setGameResult(null);

    try {
      // Send bet to server and wait for authoritative result
      const response = await wheelSocketService.placeBet({
        amount: betAmount,
        difficulty,
        segments: segments.length,
      });

      // Use server-provided segment index and angle
      const segmentIndex = response.segmentIndex;
      const angle = response.angle || calculateRotationAngle(segmentIndex, segments.length);
      setTargetAngle(angle);

      setSpins(prev => prev + 1);
    } catch (error) {
      // Fallback to local generation if server is unavailable
      const result = generateWheelResult('', segments);
      const angle = calculateRotationAngle(result.segmentIndex, segments.length);
      setTargetAngle(angle);
      setSpins(prev => prev + 1);
    }
  }, [isSpinning, betAmount, difficulty, segments]);

  // Handle spin completion
  const handleSpinComplete = useCallback(() => {
    // Use target angle to determine the winning segment
    // We convert back from the angle to find the segment index
    const normalizedAngle = targetAngle % 360;
    const segmentAngle = 360 / segments.length;
    const segmentIndex = Math.round(normalizedAngle / segmentAngle) % segments.length;
    
    // Get winning multiplier
    const winMultiplier = segments[segmentIndex].multiplier;
    const winnings = betAmount * winMultiplier;
    const profit = calculateProfit(betAmount, winMultiplier);
    
    // Create result object
    const result = {
      id: Date.now(),
      timestamp: new Date(),
      betAmount,
      difficulty,
      segmentIndex,
      multiplier: winMultiplier,
      winnings,
      profit
    };
    
    // Update game history
    setGameHistory(prev => [result, ...prev]);
    
    // Set game result to display
    setGameResult(result);
    
    // Reset spinning state
    setIsSpinning(false);
  }, [targetAngle, segments, betAmount, difficulty]);

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
        <div className="relative">
          {/* Multiplayer components */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <WheelPlayersList players={activePlayers} />
            <WheelActiveBets bets={currentBets} />
          </div>
          <div className="bg-bg-card border border-border rounded-xl p-4">
            <WheelBoard
              segments={segments}
              spinning={isSpinning}
              targetAngle={targetAngle}
              onSpinComplete={handleSpinComplete}
            />
            
            {/* Game result popup */}
            {gameResult && (
              <div className={`
                absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2
                rounded-xl p-6 shadow-lg backdrop-blur-xl
                ${gameResult.profit >= 0
                  ? 'bg-bg-card/95 border border-status-success/30'
                  : 'bg-bg-card/95 border border-status-error/30'}
              `}>
                <div className={`text-3xl font-heading font-bold ${
                  gameResult.profit >= 0 ? 'text-status-success' : 'text-status-error'
                }`}>
                  {gameResult.profit >= 0 ?
                    `+${formatCurrency(gameResult.profit)}` :
                    `-${formatCurrency(Math.abs(gameResult.profit))}`
                  }
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Game history */}
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden mt-4">
          <div className="p-4 pb-0">
            <h3 className="text-lg font-heading font-bold text-text-primary mb-3">Spin History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-elevated text-text-muted text-xs font-heading uppercase tracking-wider">
                  <th className="py-2 px-4 text-left">Time</th>
                  <th className="py-2 px-4 text-left">Bet</th>
                  <th className="py-2 px-4 text-left">Difficulty</th>
                  <th className="py-2 px-4 text-left">Multiplier</th>
                  <th className="py-2 px-4 text-left">Profit</th>
                </tr>
              </thead>
              <tbody>
                {gameHistory.length > 0 ? (
                  gameHistory.slice(0, 10).map(game => (
                    <tr key={game.id} className="border-b border-border">
                      <td className="py-2 px-4 text-text-secondary">{formatTime(game.timestamp)}</td>
                      <td className="py-2 px-4 text-text-secondary">{formatCurrency(game.betAmount)}</td>
                      <td className="py-2 px-4 capitalize">
                        <Badge
                          color={
                            game.difficulty === 'easy' ? 'green' :
                            game.difficulty === 'medium' ? 'blue' : 'red'
                          }
                        >
                          {game.difficulty}
                        </Badge>
                      </td>
                      <td className="py-2 px-4 font-heading font-bold text-text-primary">{formatMultiplier(game.multiplier)}</td>
                      <td className={`py-2 px-4 font-bold ${
                        game.profit >= 0 ? 'text-status-success' : 'text-status-error'
                      }`}>
                        {game.profit >= 0 ? '+' : ''}{formatCurrency(game.profit)}
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
        <WheelBettingPanel
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          onSpin={handleSpin}
          isSpinning={isSpinning}
          maxMultiplier={maxMultiplier}
        />
        
        {/* Game statistics */}
        <div className="bg-bg-card border border-border rounded-xl p-5 mt-4">
          <h3 className="text-lg font-heading font-bold text-text-primary mb-3">Game Stats</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="text-xs text-text-muted">Spins</div>
              <div className="text-lg font-heading font-bold text-text-primary">{formatNumber(gameHistory.length)}</div>
            </div>
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="text-xs text-text-muted">Total Wagered</div>
              <div className="text-lg font-heading font-bold text-text-primary">
                {formatCurrency(gameHistory.reduce((sum, game) => sum + game.betAmount, 0))}
              </div>
            </div>
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="text-xs text-text-muted">Total Profit</div>
              <div className={`text-lg font-heading font-bold ${
                gameHistory.reduce((sum, game) => sum + game.profit, 0) >= 0
                  ? 'text-status-success'
                  : 'text-status-error'
              }`}>
                {formatCurrency(gameHistory.reduce((sum, game) => sum + game.profit, 0))}
              </div>
            </div>
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="text-xs text-text-muted">Best Win</div>
              <div className="text-lg font-heading font-bold text-status-success">
                {gameHistory.length > 0
                  ? formatCurrency(Math.max(...gameHistory.map(g => g.profit)))
                  : formatCurrency(0)
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WheelGame;