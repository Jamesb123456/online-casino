import React from 'react';
import Input from '../../components/ui/Input';
import { getPlinkoMultipliers } from './plinkoUtils';

const PlinkoBettingPanel = ({
  betAmount,
  setBetAmount,
  risk,
  setRisk,
  onPlaceBet,
  isAnimating
}) => {
  // Helper to render multipliers based on risk level
  const renderMultiplierInfo = () => {
    const multipliers = getPlinkoMultipliers(risk);
    const maxMultiplier = Math.max(...multipliers);
    const minMultiplier = Math.min(...multipliers);

    return (
      <div className="flex justify-between text-sm">
        <div>
          <div className="text-text-muted">Min Multiplier</div>
          <div className="font-heading font-bold text-accent-purple-light">{minMultiplier.toFixed(2)}x</div>
        </div>
        <div>
          <div className="text-text-muted">Max Multiplier</div>
          <div className="font-heading font-bold text-accent-gold">{maxMultiplier.toFixed(2)}x</div>
        </div>
      </div>
    );
  };
  
  // Handle amount change
  const handleAmountChange = (event) => {
    const value = parseFloat(event.target.value);
    setBetAmount(isNaN(value) ? 0 : value);
  };
  
  // Preset bet amounts
  const betPresets = [1, 5, 10, 25, 50, 100];
  
  return (
    <div className="bg-bg-card border border-border rounded-xl p-5 sticky top-20">
      <h3 className="text-lg font-heading font-bold text-text-primary mb-4">Place Your Bet</h3>
      <div className="space-y-5">
        {/* Amount section */}
        <div>
          <label htmlFor="plinko-bet-amount" className="block text-sm font-medium text-text-secondary mb-2">
            Bet Amount
          </label>
          <Input
            type="number"
            id="plinko-bet-amount"
            name="plinko-bet-amount"
            min="0.10"
            step="0.01"
            value={betAmount}
            onChange={handleAmountChange}
            className="mb-2"
          />
          
          {/* Bet presets */}
          <div className="flex flex-wrap gap-2">
            {betPresets.map((preset) => (
              <button
                key={preset}
                onClick={() => setBetAmount(preset)}
                className={`
                  px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-200 cursor-pointer
                  ${betAmount === preset
                    ? 'bg-accent-gold text-bg-base'
                    : 'bg-bg-elevated text-text-secondary hover:bg-bg-surface'}
                `}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        
        {/* Risk selection */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Risk Level
          </label>
          <div className="flex gap-2">
            {['low', 'medium', 'high'].map((riskLevel) => (
              <button
                key={riskLevel}
                onClick={() => setRisk(riskLevel)}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 uppercase flex-1 cursor-pointer
                  ${risk === riskLevel
                    ? 'bg-game-plinko text-white'
                    : 'bg-bg-elevated text-text-secondary hover:bg-bg-surface'}
                `}
              >
                {riskLevel}
              </button>
            ))}
          </div>
          
          {/* Multiplier info */}
          <div className="mt-2">
            {renderMultiplierInfo()}
          </div>
        </div>
        
        {/* Game prediction */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Potential Win
          </label>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="text-xs text-text-muted">Min Win</div>
              <div className="font-heading font-bold text-accent-purple-light">
                {(betAmount * Math.min(...getPlinkoMultipliers(risk))).toFixed(2)}
              </div>
            </div>
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="text-xs text-text-muted">Max Win</div>
              <div className="font-heading font-bold text-accent-gold">
                {(betAmount * Math.max(...getPlinkoMultipliers(risk))).toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Play button */}
        <button
          onClick={onPlaceBet}
          disabled={isAnimating || betAmount <= 0}
          className="bg-game-plinko hover:bg-violet-600 text-white font-bold rounded-lg py-3 px-6 w-full cursor-pointer transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAnimating ? 'Ball Dropping...' : 'Drop Ball'}
        </button>
      </div>
    </div>
  );
};

export default PlinkoBettingPanel;