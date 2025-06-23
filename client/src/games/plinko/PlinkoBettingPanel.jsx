import React from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
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
          <div className="text-gray-400">Min Multiplier</div>
          <div className="font-bold text-blue-400">{minMultiplier.toFixed(2)}x</div>
        </div>
        <div>
          <div className="text-gray-400">Max Multiplier</div>
          <div className="font-bold text-pink-500">{maxMultiplier.toFixed(2)}x</div>
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
  const betPresets = [10, 25, 50, 100, 200];
  
  return (
    <Card title="Place Your Bet">
      <div className="space-y-5">
        {/* Amount section */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Bet Amount
          </label>
          <Input
            type="number"
            min="1"
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
                  px-2 py-1 rounded text-xs font-medium
                  ${betAmount === preset
                    ? 'bg-amber-500 text-gray-900'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
                `}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        
        {/* Risk selection */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Risk Level
          </label>
          <div className="grid grid-cols-3 gap-2">
            {['low', 'medium', 'high'].map((riskLevel) => (
              <button
                key={riskLevel}
                onClick={() => setRisk(riskLevel)}
                className={`
                  px-3 py-2 rounded text-sm font-medium uppercase
                  ${risk === riskLevel
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
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
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Potential Win
          </label>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-gray-800 p-2 rounded">
              <div className="text-xs text-gray-400">Min Win</div>
              <div className="font-bold text-blue-400">
                {(betAmount * Math.min(...getPlinkoMultipliers(risk))).toFixed(2)}
              </div>
            </div>
            <div className="bg-gray-800 p-2 rounded">
              <div className="text-xs text-gray-400">Max Win</div>
              <div className="font-bold text-pink-500">
                {(betAmount * Math.max(...getPlinkoMultipliers(risk))).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
        
        {/* Play button */}
        <Button
          variant="primary"
          className="w-full"
          onClick={onPlaceBet}
          disabled={isAnimating || betAmount <= 0}
        >
          {isAnimating ? 'Ball Dropping...' : 'Drop Ball'}
        </Button>
      </div>
    </Card>
  );
};

export default PlinkoBettingPanel;