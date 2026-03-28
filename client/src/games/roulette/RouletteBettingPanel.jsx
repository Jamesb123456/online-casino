import React, { useState } from 'react';
import Input from '../../components/ui/Input';
import { BET_TYPES, ROULETTE_NUMBERS } from './rouletteUtils';

const RouletteBettingPanel = ({
  betAmount,
  setBetAmount,
  onPlaceBet,
  isSpinning,
  balance = 1000
}) => {
  const [selectedBetType, setSelectedBetType] = useState('STRAIGHT');
  const [selectedNumber, setSelectedNumber] = useState(0);
  const [selectedValue, setSelectedValue] = useState('0');
  
  // Handle amount change
  const handleAmountChange = (event) => {
    const value = parseFloat(event.target.value);
    setBetAmount(isNaN(value) ? 0 : value);
  };
  
  // Handle bet type selection
  const handleBetTypeChange = (type) => {
    setSelectedBetType(type);
    
    // Reset selected value when bet type changes
    switch (type) {
      case 'STRAIGHT':
        setSelectedValue('0');
        setSelectedNumber(0);
        break;
      case 'DOZEN':
        setSelectedValue('1');
        break;
      case 'COLUMN':
        setSelectedValue('1');
        break;
      default:
        setSelectedValue('');
    }
  };
  
  // Handle number selection for straight bets
  const handleNumberSelect = (number) => {
    if (selectedBetType === 'STRAIGHT') {
      setSelectedNumber(number);
      setSelectedValue(number.toString());
    }
  };
  
  // Handle bet placement
  const handlePlaceBet = () => {
    if (betAmount <= 0 || isSpinning) return;
    
    onPlaceBet({
      type: selectedBetType,
      value: selectedValue,
      amount: betAmount
    });
  };
  
  // Preset bet amounts
  const betPresets = [5, 10, 25, 50, 100];
  
  // Group bet types by category
  const betTypeCategories = {
    'Inside Bets': ['STRAIGHT'],
    'Outside Bets': ['RED', 'BLACK', 'ODD', 'EVEN', 'LOW', 'HIGH', 'DOZEN', 'COLUMN']
  };
  
  return (
    <div className="bg-bg-card border border-border rounded-xl p-5 sticky top-20">
      <h3 className="text-lg font-heading font-bold text-text-primary mb-4">Place Your Bets</h3>
      <div className="space-y-5">
        {/* Bet amount section */}
        <div>
          <label htmlFor="roulette-bet-amount" className="block text-sm font-medium text-text-secondary mb-2">
            Bet Amount
          </label>
          <Input
            type="number"
            id="roulette-bet-amount"
            name="roulette-bet-amount"
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

          {/* Available balance */}
          <div className="mt-2 text-right text-sm">
            <span className="text-text-muted">Balance: </span>
            <span className="font-heading font-bold text-status-success">{balance.toFixed(2)}</span>
          </div>
        </div>
        
        {/* Bet type selection */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Bet Type
          </label>

          {Object.entries(betTypeCategories).map(([category, types]) => (
            <div key={category} className="mb-3">
              <h4 className="text-xs uppercase font-heading text-text-muted tracking-wider mb-1">{category}</h4>
              <div className="grid grid-cols-2 gap-2">
                {types.map(type => (
                  <button
                    key={type}
                    onClick={() => !isSpinning && handleBetTypeChange(type)}
                    disabled={isSpinning}
                    className={`
                      px-2 py-2 rounded-lg text-xs font-medium transition-colors duration-200
                      ${selectedBetType === type
                        ? 'bg-game-roulette text-white'
                        : 'bg-bg-elevated text-text-secondary hover:bg-bg-surface'}
                      ${isSpinning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    {BET_TYPES[type].name}
                    <div className="text-xs opacity-70">
                      {BET_TYPES[type].payout}:1
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        {/* Value selection based on bet type */}
        {selectedBetType === 'STRAIGHT' && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Select Number
            </label>
            <div className="grid grid-cols-6 gap-1 max-h-40 overflow-y-auto">
              {ROULETTE_NUMBERS.map((rouletteNumber) => (
                <button
                  key={rouletteNumber.number}
                  onClick={() => !isSpinning && handleNumberSelect(rouletteNumber.number)}
                  disabled={isSpinning}
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-bold
                    ${selectedNumber === rouletteNumber.number
                      ? 'ring-2 ring-white'
                      : ''}
                    ${rouletteNumber.color === 'red'
                      ? 'bg-red-600 text-white'
                      : rouletteNumber.color === 'black'
                      ? 'bg-gray-900 text-white'
                      : 'bg-green-600 text-white'}
                    ${isSpinning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {rouletteNumber.number}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {selectedBetType === 'DOZEN' && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Select Dozen
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map(dozen => (
                <button
                  key={dozen}
                  onClick={() => !isSpinning && setSelectedValue(dozen.toString())}
                  disabled={isSpinning}
                  className={`
                    py-2 rounded-lg text-center text-sm font-medium transition-colors duration-200
                    ${selectedValue === dozen.toString()
                      ? 'bg-game-roulette text-white'
                      : 'bg-bg-elevated text-text-secondary hover:bg-bg-surface'}
                    ${isSpinning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {dozen === 1 ? '1-12' : dozen === 2 ? '13-24' : '25-36'}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedBetType === 'COLUMN' && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Select Column
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map(column => (
                <button
                  key={column}
                  onClick={() => !isSpinning && setSelectedValue(column.toString())}
                  disabled={isSpinning}
                  className={`
                    py-2 rounded-lg text-center text-sm font-medium transition-colors duration-200
                    ${selectedValue === column.toString()
                      ? 'bg-game-roulette text-white'
                      : 'bg-bg-elevated text-text-secondary hover:bg-bg-surface'}
                    ${isSpinning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {column === 1 ? '1st' : column === 2 ? '2nd' : '3rd'} Column
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Potential win */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Potential Win
          </label>
          <div className="bg-bg-elevated rounded-lg p-3 text-center">
            <span className="text-sm text-text-muted">Potential Payout: </span>
            <span className="font-heading font-bold text-lg text-status-success">
              {((betAmount || 0) * (BET_TYPES[selectedBetType]?.payout || 0) + (betAmount || 0)).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Place bet button */}
        <button
          onClick={handlePlaceBet}
          disabled={isSpinning || betAmount <= 0}
          className="bg-game-roulette hover:bg-emerald-600 text-white font-bold rounded-lg py-3 px-6 w-full cursor-pointer transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSpinning ? 'Wheel Spinning...' : 'Place Bet'}
        </button>
      </div>
    </div>
  );
};

export default RouletteBettingPanel;