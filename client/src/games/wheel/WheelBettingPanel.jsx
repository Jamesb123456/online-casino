import React from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
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
  const betPresets = [10, 25, 50, 100, 200];
  
  return (
    <Card title="Spin the Wheel">
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
                  px-2 py-1 rounded text-xs font-medium
                  ${betAmount === preset
                    ? 'bg-amber-500 text-gray-900'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
                  ${isSpinning ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        
        {/* Difficulty selection */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Difficulty Level
          </label>
          <div className="grid grid-cols-3 gap-2">
            {['easy', 'medium', 'hard'].map((level) => (
              <button
                key={level}
                onClick={() => !isSpinning && setDifficulty(level)}
                disabled={isSpinning}
                className={`
                  px-3 py-2 rounded text-sm font-medium uppercase
                  ${difficulty === level
                    ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
                  ${isSpinning ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {level}
              </button>
            ))}
          </div>
          
          {/* Max multiplier info */}
          <div className="mt-2 text-center">
            <span className="text-gray-400 text-sm">Max Multiplier: </span>
            <span className="text-pink-500 font-bold">
              {formatMultiplier(maxMultiplier || 0)}
            </span>
          </div>
        </div>
        
        {/* Potential win */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Potential Win
          </label>
          <div className="bg-gray-800 p-3 rounded text-center">
            <span className="text-sm text-gray-400">Max Payout: </span>
            <span className="font-bold text-lg text-green-500">
              {((betAmount || 0) * (maxMultiplier || 0)).toFixed(2)}
            </span>
          </div>
        </div>
        
        {/* Spin button */}
        <Button
          variant="primary"
          className="w-full"
          onClick={onSpin}
          disabled={isSpinning || betAmount <= 0}
        >
          {isSpinning ? 'Spinning...' : 'Spin the Wheel'}
        </Button>
      </div>
    </Card>
  );
};

export default WheelBettingPanel;