import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import { getDifficultyLevel, calculateMultiplier, formatCurrency } from './landminesUtils';

const LandminesBettingPanel = ({ 
  onStartGame, 
  onCashOut, 
  isGameActive,
  isLoading, 
  potentialWin = 0,
  revealedCount = 0,
  remainingSafeCells = 0,
  mines = 5
}) => {
  // State for bet amount and number of mines
  const [betAmount, setBetAmount] = useState(10);
  const [mineCount, setMineCount] = useState(5);
  
  // Predefined bet amounts
  const betAmounts = [1, 5, 10, 25, 50, 100];
  
  // Difficulty level based on number of mines
  const difficultyLevel = getDifficultyLevel(mineCount);
  
  // Calculate base multiplier for display (without any revealed cells)
  const baseMultiplier = calculateMultiplier(mineCount, 0).toFixed(2);
  
  // Handle start game
  const handleStartGame = () => {
    if (onStartGame && !isLoading) {
      onStartGame({ betAmount, mines: mineCount });
    }
  };
  
  // Handle cashout
  const handleCashOut = () => {
    if (onCashOut && !isLoading) {
      onCashOut();
    }
  };
  
  return (
    <Card title="Landmines">
      <div className="space-y-4 p-2">
        {/* Game info section */}
        <div className="bg-gray-800 p-3 rounded-md">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-400 text-xs">Base Multiplier</span>
              <div className="font-bold">{baseMultiplier}x</div>
            </div>
            <div>
              <span className="text-gray-400 text-xs">Difficulty</span>
              <div className="font-bold capitalize">{difficultyLevel}</div>
            </div>
          </div>
        </div>
        
        {/* Show different panels based on game state */}
        {!isGameActive ? (
          // Betting panel (game not started)
          <div className="space-y-4">
            {/* Bet amount selection */}
            <div>
              <label className="text-gray-300 text-sm">Bet Amount</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {betAmounts.map(amount => (
                  <button
                    key={amount}
                    className={`py-1 rounded-md text-sm font-medium transition
                      ${betAmount === amount 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                      }`
                    }
                    onClick={() => setBetAmount(amount)}
                  >
                    {formatCurrency(amount)}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-gray-700 text-white p-2 rounded-md"
                />
              </div>
            </div>
            
            {/* Difficulty selection */}
            <div>
              <label className="text-gray-300 text-sm">Game Difficulty</label>
              <div className="flex justify-between mb-2">
                <span className="text-white font-medium">Mines: {mineCount}</span>
                <span className="text-white font-medium capitalize">{difficultyLevel}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  className={`py-2 rounded-md text-sm font-medium transition
                    ${mineCount === 3 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`
                  }
                  onClick={() => setMineCount(3)}
                >
                  Easy
                </button>
                <button
                  className={`py-2 rounded-md text-sm font-medium transition
                    ${mineCount === 5 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`
                  }
                  onClick={() => setMineCount(5)}
                >
                  Medium
                </button>
                <button
                  className={`py-2 rounded-md text-sm font-medium transition
                    ${mineCount === 10 
                      ? 'bg-yellow-600 text-white' 
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`
                  }
                  onClick={() => setMineCount(10)}
                >
                  Hard
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  className={`py-2 rounded-md text-sm font-medium transition
                    ${mineCount === 15 
                      ? 'bg-orange-600 text-white' 
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`
                  }
                  onClick={() => setMineCount(15)}
                >
                  Expert
                </button>
                <button
                  className={`py-2 rounded-md text-sm font-medium transition
                    ${mineCount === 20 
                      ? 'bg-red-600 text-white' 
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`
                  }
                  onClick={() => setMineCount(20)}
                >
                  Extreme
                </button>
              </div>
            </div>
            
            {/* Start button */}
            <button
              className={`
                w-full py-3 rounded-md font-bold text-white transition-colors
                ${isLoading ? 'bg-blue-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
              `}
              onClick={handleStartGame}
              disabled={isLoading}
            >
              {isLoading ? 'Starting...' : 'Start Game'}
            </button>
          </div>
        ) : (
          // Game active panel (with potential win and cashout)
          <div className="space-y-4">
            <div className="bg-gray-800 p-3 rounded-md">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-gray-400 text-xs">Revealed</span>
                  <div className="font-bold">{revealedCount}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">Diamonds Left</span>
                  <div className="font-bold">{remainingSafeCells}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">Mines</span>
                  <div className="font-bold">{mines}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">Bet</span>
                  <div className="font-bold">{formatCurrency(betAmount)}</div>
                </div>
              </div>
            </div>
            
            {/* Potential win display */}
            <div className="text-center">
              <div className="text-gray-300 text-sm">Potential Win</div>
              <div className="text-2xl font-bold text-green-500">
                {formatCurrency(potentialWin)}
              </div>
            </div>
            
            {/* Cashout button */}
            <button
              className={`
                w-full py-3 rounded-md font-bold transition-colors
                ${potentialWin === 0 ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}
                ${isLoading ? 'cursor-not-allowed opacity-80' : ''}
              `}
              onClick={handleCashOut}
              disabled={potentialWin === 0 || isLoading}
            >
              {isLoading ? 'Processing...' : 'Cash Out'}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
};

export default LandminesBettingPanel;
