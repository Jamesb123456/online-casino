import React from 'react';
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
    <div className="bg-bg-card border border-border rounded-xl p-5 sticky top-20">
      <h3 className="text-lg font-heading font-bold text-text-primary mb-4">Place Your Bet</h3>
      <div className="space-y-6">
        {/* Bet amount section */}
        <div>
          <label htmlFor="crash-bet-amount" className="block text-sm font-medium text-text-secondary mb-2">Bet Amount</label>
          <Input
            type="number"
            name="amount"
            id="crash-bet-amount"
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
              <button
                key={amount}
                type="button"
                disabled={!!activeBet}
                onClick={() => setBet(prev => ({ ...prev, amount }))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  bet.amount === amount
                    ? 'bg-accent-gold text-bg-base'
                    : 'bg-bg-elevated text-text-secondary hover:bg-bg-surface'
                }`}
              >
                {amount}
              </button>
            ))}
          </div>
        </div>
        
        {/* Auto cashout section */}
        <div>
          <label htmlFor="crash-auto-cashout" className="block text-sm font-medium text-text-secondary mb-2">Auto Cashout at</label>
          <Input
            type="number"
            name="autoCashout"
            id="crash-auto-cashout"
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
              <button
                key={multiplier}
                type="button"
                disabled={!!activeBet}
                onClick={() => setBet(prev => ({ ...prev, autoCashout: multiplier }))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  bet.autoCashout === multiplier
                    ? 'bg-accent-gold text-bg-base'
                    : 'bg-bg-elevated text-text-secondary hover:bg-bg-surface'
                }`}
              >
                {multiplier}x
              </button>
            ))}
          </div>
        </div>
        
        {/* Profit calculation */}
        <div className="bg-bg-elevated rounded-lg p-3">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Potential Profit:</span>
            <span className="text-status-success font-bold">
              +{calculateProfit().toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between text-sm mt-1">
            <span className="text-text-secondary">Auto Cashout:</span>
            <span className="text-accent-gold font-heading font-bold">
              {formatMultiplier(bet.autoCashout)}
            </span>
          </div>

          {activeBet && gameStatus === 'running' && (
            <div className="flex justify-between text-sm mt-2 pt-2 border-t border-border">
              <span className="text-text-secondary">Current Multiplier:</span>
              <span
                className={`font-heading font-bold ${currentMultiplier >= 2 ? 'text-accent-gold' : 'text-text-primary'}`}
              >
                {formatMultiplier(currentMultiplier)}
              </span>
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex gap-3">
          {canBet && (
            <button
              type="button"
              onClick={onPlaceBet}
              disabled={!canBet}
              className="bg-game-crash hover:bg-red-600 text-white font-bold rounded-lg py-3 px-6 w-full cursor-pointer transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Place Bet
            </button>
          )}

          {canCashout && (
            <button
              type="button"
              onClick={onCashout}
              disabled={!canCashout}
              className="bg-status-success hover:bg-emerald-600 text-white font-bold rounded-lg py-3 px-6 w-full cursor-pointer transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cash Out ({formatMultiplier(currentMultiplier)})
            </button>
          )}

          {activeBet && !canCashout && gameStatus !== 'waiting' && (
            <button
              type="button"
              disabled
              className={`font-bold rounded-lg py-3 px-6 w-full disabled:opacity-50 disabled:cursor-not-allowed ${
                activeBet.status === 'cashed_out'
                  ? 'bg-status-success text-white'
                  : 'bg-status-error text-white'
              }`}
            >
              {activeBet.status === 'cashed_out'
                ? `Cashed Out @ ${formatMultiplier(activeBet.cashedOutAt)}`
                : activeBet.status === 'lost'
                ? 'Busted!'
                : 'Placing Bet...'
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CrashBettingPanel;