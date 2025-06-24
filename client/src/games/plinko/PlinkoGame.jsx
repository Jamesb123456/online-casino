import React, { useState, useEffect, useCallback } from 'react';
import PlinkoBoard from './PlinkoBoard';
import PlinkoBettingPanel from './PlinkoBettingPanel';
import Card from '../../components/ui/Card';
import { 
  getPlinkoMultipliers, 
  generatePlinkoPath,
  getBucketFromPath
} from './plinkoUtils';
import plinkoSocketService from '../../services/socket/plinkoSocketService';

// For development, toggle between mock and real socket
const USE_MOCK_SOCKET = true;

const PlinkoGame = () => {
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
    if (!USE_MOCK_SOCKET) {
      // Join the Plinko game room
      joinPlinkoGame();
      
      // Listen for game results
      const unsubscribe = onGameResult((result) => {
        console.log('Received game result:', result);
        
        if (result && result.path) {
          setAnimationPath(result.path);
          setIsAnimating(true);
          
          // The actual game result will be processed when animation completes
          // See handleAnimationComplete function
        }
      });
      
      // Cleanup when component unmounts
      return () => {
        leavePlinkoGame();
        unsubscribe();
      };
    }
  }, []);
  
  // Debug logger for state changes
  useEffect(() => {
    console.log('Animation state changed:', { isAnimating, hasPath: animationPath !== null });
  }, [isAnimating, animationPath]);
  
  // Handle dropping the ball (placing a bet)
  const handlePlaceBet = () => {
    // Enhanced logging and safety checks
    console.log('Attempting to place bet. Current state:', { 
      isAnimating, 
      betAmount,
      'animationPath exists': animationPath !== null 
    });
    
    if (isAnimating || betAmount <= 0) {
      console.log('Cannot place bet: ' + (isAnimating ? 'Animation in progress' : 'Invalid bet amount'));
      return;
    }
    
    // Force reset animation state before starting a new one
    setAnimationPath(null);
    
    // Small delay to ensure previous state is cleared
    setTimeout(() => {
      if (USE_MOCK_SOCKET) {
        // Mock implementation for development
        console.log('Starting new mock game');
        setIsAnimating(true);
        setGameResult(null);
        
        // Generate new path for the ball
        const newPath = generatePlinkoPath();
        console.log('Setting new animation path');
        setAnimationPath(newPath);
        
        console.log('Mock game with bet:', betAmount, 'risk:', risk);
      } else {
        // Real socket implementation
        setGameResult(null);
        setIsAnimating(true); // Important: set this before making the request
        
        // Send drop ball request to server
        dropBall({
          betAmount,
          risk
        }, (response) => {
          if (response.success) {
            console.log('Ball dropped successfully, waiting for result');
            // The animation path will come from the server via the onGameResult event
            // The actual animation and result processing happens there
          } else {
            console.error('Error dropping ball:', response.error);
            // Reset animation state on error
            setIsAnimating(false);
            // TODO: Show error notification
          }
        });
      }
    }, 50); // Small delay to ensure clean state transition
  };
  
  // Handle when animation completes
  const handleAnimationComplete = (bucketIndex) => {
    console.log('Animation complete, ball landed in bucket:', bucketIndex);
    
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
    
    // Critical: Reset animation state and path to allow a new ball to be dropped
    // Use setTimeout to ensure state updates don't conflict
    console.log('Resetting animation state...');
    setTimeout(() => {
      setIsAnimating(false);
      setAnimationPath(null); // Reset the path so a new one can be set
      console.log('Animation state reset complete, ready for next ball');
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
        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
          <PlinkoBoard
            multipliers={multipliers}
            animationPath={animationPath}
            onAnimationComplete={handleAnimationComplete}
          />
          
          {/* Game result popup */}
          {gameResult && (
            <div className={`
              absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2
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
        
        {/* Game history */}
        <Card title="Game History">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Bet</th>
                  <th className="pb-2">Risk</th>
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
                      <td className="py-2 capitalize">{game.risk}</td>
                      <td className="py-2 font-medium">{game.multiplier.toFixed(2)}x</td>
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
        <PlinkoBettingPanel
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          risk={risk}
          setRisk={setRisk}
          onPlaceBet={handlePlaceBet}
          isAnimating={isAnimating}
        />
        
        {/* Game statistics */}
        <Card title="Game Stats" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-xs text-gray-400">Games Played</div>
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

export default PlinkoGame;