import React, { useState, useEffect } from 'react';
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
    <div className="bg-bg-card border border-border rounded-xl p-5 sticky top-20">
      <h3 className="text-lg font-heading font-bold text-text-primary mb-4">Landmines</h3>
      <div className="space-y-4">
        {/* Game info section */}
        <div className="bg-bg-elevated rounded-lg p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-text-muted text-xs">Base Multiplier</span>
              <div className="font-heading font-bold text-text-primary">{baseMultiplier}x</div>
            </div>
            <div>
              <span className="text-text-muted text-xs">Difficulty</span>
              <div className="font-heading font-bold text-text-primary capitalize">{difficultyLevel}</div>
            </div>
          </div>
        </div>
        
        {/* Show different panels based on game state */}
        {!isGameActive ? (
          // Betting panel (game not started)
          <div className="space-y-4">
            {/* Bet amount selection */}
            <div>
              <label htmlFor="landmines-bet-amount" className="text-sm font-medium text-text-secondary">Bet Amount</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {betAmounts.map(amount => (
                  <button
                    key={amount}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-200 cursor-pointer
                      ${betAmount === amount
                        ? 'bg-accent-gold text-bg-base'
                        : 'bg-bg-elevated text-text-secondary hover:bg-bg-surface'
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
                  id="landmines-bet-amount"
                  min="0.10"
                  step="0.10"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(0.10, parseFloat(e.target.value) || 0))}
                  className="w-full bg-bg-surface border border-border rounded-lg text-text-primary p-2 focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold"
                />
              </div>
            </div>
            
            {/* Difficulty selection */}
            <div>
              <span className="text-sm font-medium text-text-secondary" id="landmines-difficulty-label">Game Difficulty</span>
              <div className="flex justify-between mb-2 mt-1">
                <span className="text-text-primary font-medium text-sm">Mines: {mineCount}</span>
                <span className="text-text-primary font-medium text-sm capitalize">{difficultyLevel}</span>
              </div>
              <div className="flex gap-2" role="group" aria-labelledby="landmines-difficulty-label">
                <button
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 flex-1 cursor-pointer
                    ${mineCount === 3
                      ? 'bg-game-landmines text-white'
                      : 'bg-bg-elevated text-text-secondary hover:bg-bg-surface'
                    }`
                  }
                  onClick={() => setMineCount(3)}
                >
                  Easy
                </button>
                <button
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 flex-1 cursor-pointer
                    ${mineCount === 5
                      ? 'bg-game-landmines text-white'
                      : 'bg-bg-elevated text-text-secondary hover:bg-bg-surface'
                    }`
                  }
                  onClick={() => setMineCount(5)}
                >
                  Medium
                </button>
                <button
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 flex-1 cursor-pointer
                    ${mineCount === 10
                      ? 'bg-game-landmines text-white'
                      : 'bg-bg-elevated text-text-secondary hover:bg-bg-surface'
                    }`
                  }
                  onClick={() => setMineCount(10)}
                >
                  Hard
                </button>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 flex-1 cursor-pointer
                    ${mineCount === 15
                      ? 'bg-game-landmines text-white'
                      : 'bg-bg-elevated text-text-secondary hover:bg-bg-surface'
                    }`
                  }
                  onClick={() => setMineCount(15)}
                >
                  Expert
                </button>
                <button
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 flex-1 cursor-pointer
                    ${mineCount === 20
                      ? 'bg-game-landmines text-white'
                      : 'bg-bg-elevated text-text-secondary hover:bg-bg-surface'
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
              className="bg-game-landmines hover:bg-orange-600 text-white font-bold rounded-lg py-3 px-6 w-full cursor-pointer transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleStartGame}
              disabled={isLoading}
            >
              {isLoading ? 'Starting...' : 'Start Game'}
            </button>
          </div>
        ) : (
          // Game active panel (with potential win and cashout)
          <div className="space-y-4">
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-text-muted text-xs">Revealed</span>
                  <div className="font-heading font-bold text-text-primary">{revealedCount}</div>
                </div>
                <div>
                  <span className="text-text-muted text-xs">Diamonds Left</span>
                  <div className="font-heading font-bold text-text-primary">{remainingSafeCells}</div>
                </div>
                <div>
                  <span className="text-text-muted text-xs">Mines</span>
                  <div className="font-heading font-bold text-text-primary">{mines}</div>
                </div>
                <div>
                  <span className="text-text-muted text-xs">Bet</span>
                  <div className="font-heading font-bold text-text-primary">{formatCurrency(betAmount)}</div>
                </div>
              </div>
            </div>

            {/* Potential win display */}
            <div className="text-center">
              <div className="text-text-secondary text-sm">Potential Win</div>
              <div className="text-2xl font-heading font-bold text-status-success">
                {formatCurrency(potentialWin)}
              </div>
            </div>

            {/* Cashout button */}
            <button
              className={`
                font-bold rounded-lg py-3 px-6 w-full cursor-pointer transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
                ${potentialWin === 0 ? 'bg-bg-elevated text-text-muted' : 'bg-game-landmines hover:bg-orange-600 text-white'}
              `}
              onClick={handleCashOut}
              disabled={potentialWin === 0 || isLoading}
            >
              {isLoading ? 'Processing...' : 'Cash Out'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LandminesBettingPanel;
