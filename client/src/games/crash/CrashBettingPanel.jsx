import React from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { formatMultiplier } from './crashUtils';

const CrashBettingPanel = ({
  bet,
  setBet,
  activeBet,
  canBet,
  canCashout,
  onPlaceBet,
  onCashout,
  currentMultiplier,
  gameStatus
}) => {
  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Convert to number values
    const numValue = name === 'amount' ? 
      Math.max(1, Math.min(10000, Number(value))) : // Amount between 1-10000
      Math.max(1.01, Number(value)); // Auto cashout minimum 1.01x
    
    setBet({
      ...bet,
      [name]: numValue
    });
  };

  // Preset bet amounts
  const presetAmounts = [10, 50, 100, 500];
  
  // Preset auto cashout multipliers
  const presetMultipliers = [1.5, 2, 5, 10];

  // Calculate potential profit
  const calculateProfit = () => {
    return bet.amount * bet.autoCashout - bet.amount;
  };

  return (
    <Card title="Place Your Bet" className="sticky top-4">
      <div className="space-y-6">
        {/* Bet amount section */}
        <div>
          <label className="block text-gray-300 mb-2 font-bold">Bet Amount</label>
          <Input
            type="number"
            name="amount"
            value={bet.amount}
            onChange={handleChange}
            disabled={!!activeBet}
            min={1}
            max={10000}
            step={1}
            className="mb-2"
          />
          
          {/* Preset amounts */}
          <div className="grid grid-cols-4 gap-2">
            {presetAmounts.map((amount) => (
              <Button
                key={amount}
                size="sm"
                variant={bet.amount === amount ? "primary" : "secondary"}
                disabled={!!activeBet}
                onClick={() => setBet(prev => ({ ...prev, amount }))}
              >
                {amount}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Auto cashout section */}
        <div>
          <label className="block text-gray-300 mb-2 font-bold">Auto Cashout at</label>
          <Input
            type="number"
            name="autoCashout"
            value={bet.autoCashout}
            onChange={handleChange}
            disabled={!!activeBet}
            min={1.01}
            max={1000}
            step={0.01}
            className="mb-2"
          />
          
          {/* Preset multipliers */}
          <div className="grid grid-cols-4 gap-2">
            {presetMultipliers.map((multiplier) => (
              <Button
                key={multiplier}
                size="sm"
                variant={bet.autoCashout === multiplier ? "primary" : "secondary"}
                disabled={!!activeBet}
                onClick={() => setBet(prev => ({ ...prev, autoCashout: multiplier }))}
              >
                {multiplier}x
              </Button>
            ))}
          </div>
        </div>
        
        {/* Profit calculation */}
        <div className="bg-gray-700 p-3 rounded">
          <div className="flex justify-between text-sm">
            <span className="text-gray-300">Potential Profit:</span>
            <span className="text-green-400 font-bold">
              +{calculateProfit().toFixed(2)}
            </span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-gray-300">Auto Cashout:</span>
            <span className="text-amber-400 font-bold">
              {formatMultiplier(bet.autoCashout)}
            </span>
          </div>
          
          {activeBet && gameStatus === 'running' && (
            <div className="flex justify-between text-sm mt-2 pt-2 border-t border-gray-600">
              <span className="text-gray-300">Current Multiplier:</span>
              <span 
                className="font-bold"
                style={{ color: currentMultiplier >= 2 ? '#f59e0b' : '#fff' }}
              >
                {formatMultiplier(currentMultiplier)}
              </span>
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex gap-3">
          {canBet && (
            <Button
              fullWidth
              type="button"
              onClick={onPlaceBet}
              disabled={!canBet}
            >
              Place Bet
            </Button>
          )}
          
          {canCashout && (
            <Button
              fullWidth
              variant="success"
              type="button"
              onClick={onCashout}
              disabled={!canCashout}
            >
              Cash Out ({formatMultiplier(currentMultiplier)})
            </Button>
          )}
          
          {activeBet && !canCashout && gameStatus !== 'waiting' && (
            <Button
              fullWidth
              variant={activeBet.status === 'cashed_out' ? 'success' : 'danger'}
              type="button"
              disabled
            >
              {activeBet.status === 'cashed_out' 
                ? `Cashed Out @ ${formatMultiplier(activeBet.cashedOutAt)}` 
                : activeBet.status === 'lost'
                ? 'Busted!'
                : 'Placing Bet...'
              }
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default CrashBettingPanel;