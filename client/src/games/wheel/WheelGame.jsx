import React, { useState, useEffect, useCallback } from 'react';
import WheelBoard from './WheelBoard';
import WheelBettingPanel from './WheelBettingPanel';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { 
  getWheelSegments, 
  generateWheelResult,
  calculateRotationAngle,
  formatMultiplier,
  calculateProfit
} from './wheelUtils';

const WheelGame = () => {
  // Game state
  const [betAmount, setBetAmount] = useState(10);
  const [difficulty, setDifficulty] = useState('medium');
  const [segments, setSegments] = useState(() => getWheelSegments('medium'));
  const [isSpinning, setIsSpinning] = useState(false);
  const [targetAngle, setTargetAngle] = useState(0);
  const [gameResult, setGameResult] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [maxMultiplier, setMaxMultiplier] = useState(0);

  // Update segments when difficulty changes
  useEffect(() => {
    const newSegments = getWheelSegments(difficulty);
    setSegments(newSegments);
    
    // Find max multiplier in the segments
    const max = Math.max(...newSegments.map(s => s.multiplier));
    setMaxMultiplier(max);
  }, [difficulty]);

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
    setGameHistory(prev => [result, ...prev.slice(0, 9)]);
    
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
                  `+${gameResult.profit.toFixed(2)}` : 
                  `${gameResult.profit.toFixed(2)}`
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
                  gameHistory.map(game => (
                    <tr key={game.id} className="border-b border-gray-800">
                      <td className="py-2">{formatTime(game.timestamp)}</td>
                      <td className="py-2">{game.betAmount.toFixed(2)}</td>
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
                        {game.profit >= 0 ? '+' : ''}{game.profit.toFixed(2)}
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
              <div className="text-lg font-bold">{gameHistory.length}</div>
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-xs text-gray-400">Total Wagered</div>
              <div className="text-lg font-bold">
                {gameHistory.reduce((sum, game) => sum + game.betAmount, 0).toFixed(2)}
              </div>
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-xs text-gray-400">Total Profit</div>
              <div className={`text-lg font-bold ${
                gameHistory.reduce((sum, game) => sum + game.profit, 0) >= 0 
                  ? 'text-green-500' 
                  : 'text-red-500'
              }`}>
                {gameHistory.reduce((sum, game) => sum + game.profit, 0).toFixed(2)}
              </div>
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-xs text-gray-400">Best Win</div>
              <div className="text-lg font-bold text-green-500">
                {gameHistory.length > 0
                  ? Math.max(...gameHistory.map(g => g.profit)).toFixed(2)
                  : '0.00'
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