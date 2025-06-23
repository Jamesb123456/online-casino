import React, { useState, useEffect, useCallback, useContext } from 'react';
import WheelBoard from './WheelBoard';
import WheelBettingPanel from './WheelBettingPanel';
import WheelPlayersList from './WheelPlayersList';
import WheelActiveBets from './WheelActiveBets';
import Card from '../../components/ui/Card';
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
      console.log('Received active players:', players);
      setActivePlayers(players);
    });
    
    wheelSocketService.onPlayerJoined((player) => {
      console.log('Player joined:', player);
      setActivePlayers(prev => [...prev, player]);
    });
    
    wheelSocketService.onPlayerLeft((player) => {
      console.log('Player left:', player);
      setActivePlayers(prev => prev.filter(p => p.id !== player.id));
    });
    
    wheelSocketService.onCurrentBets((bets) => {
      console.log('Received current bets:', bets);
      setCurrentBets(bets);
    });
    
    wheelSocketService.onPlayerBet((bet) => {
      console.log('Player bet:', bet);
      setCurrentBets(prev => [...prev, bet]);
    });
    
    // Cleanup on unmount
    return () => {
      wheelSocketService.disconnect();
    };
  }, [user]);

  // Handle wheel spin
  const handleSpin = useCallback(() => {
    if (isSpinning || betAmount <= 0) return;
    
    setIsSpinning(true);
    setGameResult(null);
    
    // Generate new wheel result
    const result = generateWheelResult('', segments);
    
    // Calculate target angle for animation
    const angle = calculateRotationAngle(result.segmentIndex, segments.length);
    setTargetAngle(angle);
    
    console.log('Spinning wheel with bet:', betAmount, 'difficulty:', difficulty);
    console.log('Result:', result);
    
    // In a real implementation, we would send the bet to the server 
    // and get the result back, using socket.io
    setSpins(spins + 1);
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
          <div className="bg-gray-800 rounded-lg p-4">
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
                px-6 py-3 rounded-lg font-bold text-white text-2xl
                ${gameResult.profit >= 0 ? 'bg-green-600' : 'bg-red-600'}
              `}>
                {gameResult.profit >= 0 ? 
                  `+${formatCurrency(gameResult.profit)}` : 
                  `-${formatCurrency(Math.abs(gameResult.profit))}`
                }
              </div>
            )}
          </div>
        </div>
        
        {/* Game history */}
        <Card title="Spin History">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Bet</th>
                  <th className="pb-2">Difficulty</th>
                  <th className="pb-2">Multiplier</th>
                  <th className="pb-2">Profit</th>
                </tr>
              </thead>
              <tbody>
                {gameHistory.length > 0 ? (
                  gameHistory.slice(0, 10).map(game => (
                    <tr key={game.id} className="border-b border-gray-800">
                      <td className="py-2">{formatTime(game.timestamp)}</td>
                      <td className="py-2">{formatCurrency(game.betAmount)}</td>
                      <td className="py-2 capitalize">
                        <Badge 
                          color={
                            game.difficulty === 'easy' ? 'green' :
                            game.difficulty === 'medium' ? 'blue' : 'red'
                          }
                        >
                          {game.difficulty}
                        </Badge>
                      </td>
                      <td className="py-2 font-medium">{formatMultiplier(game.multiplier)}</td>
                      <td className={`py-2 font-bold ${
                        game.profit >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {game.profit >= 0 ? '+' : ''}{formatCurrency(game.profit)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center py-4 text-gray-400">
                      No games played yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
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
        <Card title="Game Stats" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-xs text-gray-400">Spins</div>
              <div className="text-lg font-bold">{formatNumber(gameHistory.length)}</div>
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-xs text-gray-400">Total Wagered</div>
              <div className="text-lg font-bold">
                {formatCurrency(gameHistory.reduce((sum, game) => sum + game.betAmount, 0))}
              </div>
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-xs text-gray-400">Total Profit</div>
              <div className={`text-lg font-bold ${
                gameHistory.reduce((sum, game) => sum + game.profit, 0) >= 0 
                  ? 'text-green-500' 
                  : 'text-red-500'
              }`}>
                {formatCurrency(gameHistory.reduce((sum, game) => sum + game.profit, 0))}
              </div>
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-xs text-gray-400">Best Win</div>
              <div className="text-lg font-bold text-green-500">
                {gameHistory.length > 0
                  ? formatCurrency(Math.max(...gameHistory.map(g => g.profit)))
                  : formatCurrency(0)
                }
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default WheelGame;