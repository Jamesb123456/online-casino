import React from 'react';
import Input from '../../components/ui/Input';
import { formatMultiplier } from './wheelUtils';

const WheelBettingPanel = ({
  betAmount,
  setBetAmount,
  difficulty,
  setDifficulty,
  onSpin,
  isSpinning,
  maxMultiplier
}) => {
  // Handle amount change
  const handleAmountChange = (event) => {
    const value = parseFloat(event.target.value);
    setBetAmount(isNaN(value) ? 0 : value);
  };
  
  // Preset bet amounts
  const betPresets = [1, 5, 10, 25, 50, 100];
  
  return (
    <div className="bg-bg-card border border-border rounded-xl p-5 sticky top-20">
      <h3 className="text-lg font-heading font-bold text-text-primary mb-4">Spin the Wheel</h3>
      <div className="space-y-5">
        {/* Amount section */}
        <div>
          <label htmlFor="wheel-bet-amount" className="block text-sm font-medium text-text-secondary mb-2">
            Bet Amount
          </label>
          <Input
            type="number"
            id="wheel-bet-amount"
            name="wheel-bet-amount"
            min="0.10"
            value={betAmount}
            onChange={handleAmountChange}
            className="mb-2"
            disabled={isSpinning}
          />
          
          {/* Bet presets */}
          <div className="flex flex-wrap gap-2">
            {betPresets.map((preset) => (
              <button
                key={preset}
                onClick={() => !isSpinning && setBetAmount(preset)}
                disabled={isSpinning}
                className={`
                  px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-200
                  ${betAmount === preset
                    ? 'bg-accent-gold text-bg-base'
                    : 'bg-bg-elevated text-text-secondary hover:bg-bg-surface'}
                  ${isSpinning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        
        {/* Difficulty selection */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Difficulty Level
          </label>
          <div className="flex gap-2">
            {['easy', 'medium', 'hard'].map((level) => (
              <button
                key={level}
                onClick={() => !isSpinning && setDifficulty(level)}
                disabled={isSpinning}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 uppercase flex-1
                  ${difficulty === level
                    ? 'bg-game-wheel text-bg-base'
                    : 'bg-bg-elevated text-text-secondary hover:bg-bg-surface'}
                  ${isSpinning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {level}
              </button>
            ))}
          </div>

          {/* Max multiplier info */}
          <div className="mt-2 text-center">
            <span className="text-text-muted text-sm">Max Multiplier: </span>
            <span className="text-accent-gold font-heading font-bold">
              {formatMultiplier(maxMultiplier || 0)}
            </span>
          </div>
        </div>
        
        {/* Potential win */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Potential Win
          </label>
          <div className="bg-bg-elevated rounded-lg p-3 text-center">
            <span className="text-sm text-text-muted">Max Payout: </span>
            <span className="font-heading font-bold text-lg text-status-success">
              {((betAmount || 0) * (maxMultiplier || 0)).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Spin button */}
        <button
          onClick={onSpin}
          disabled={isSpinning || betAmount <= 0}
          className="bg-game-wheel hover:bg-amber-600 text-bg-base font-bold rounded-lg py-3 px-6 w-full cursor-pointer transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSpinning ? 'Spinning...' : 'Spin the Wheel'}
        </button>
      </div>
    </div>
  );
};

export default WheelBettingPanel;