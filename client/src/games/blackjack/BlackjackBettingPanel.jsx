import React, { useState, useEffect } from 'react';

/**
 * Component for placing bets and controlling the blackjack game actions
 */
const BlackjackBettingPanel = ({ 
  onPlaceBet, 
  onHit, 
  onStand, 
  onDoubleDown,
  gamePhase, 
  userBalance = 0,
  disabled = false
}) => {
  const [betAmount, setBetAmount] = useState(10);
  const betOptions = [10, 25, 50, 100, 250, 500];
  
  // Reset bet amount if it exceeds balance
  useEffect(() => {
    if (betAmount > userBalance) {
      setBetAmount(Math.min(...betOptions.filter(amount => amount <= userBalance)) || betOptions[0]);
    }
  }, [userBalance, betOptions, betAmount]);

  const handleBetChange = (amount) => {
    if (amount <= userBalance) {
      setBetAmount(amount);
    }
  };

  const handlePlaceBet = () => {
    if (betAmount <= userBalance && onPlaceBet) {
      onPlaceBet(betAmount);
    }
  };

  // Determine which action buttons to show based on game phase
  const renderGameControls = () => {
    if (gamePhase === 'betting') {
      return (
        <div>
          <div className="mb-4">
            <div className="text-sm font-medium text-text-secondary mb-2">Select bet amount:</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {betOptions.map(amount => (
                <button
                  key={amount}
                  onClick={() => handleBetChange(amount)}
                  disabled={amount > userBalance || disabled}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-200 cursor-pointer
                    ${betAmount === amount
                      ? 'bg-accent-gold text-bg-base'
                      : 'bg-bg-elevated text-text-secondary hover:bg-bg-surface'}
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  ${amount}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handlePlaceBet}
            disabled={disabled || betAmount > userBalance}
            className="bg-game-blackjack hover:bg-blue-600 text-white font-bold rounded-lg py-3 px-6 w-full cursor-pointer transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Place Bet
          </button>
        </div>
      );
    } else if (gamePhase === 'playerTurn') {
      return (
        <div className="flex flex-col gap-2">
          <button onClick={onHit} disabled={disabled} className="bg-game-blackjack hover:bg-blue-600 text-white font-bold rounded-lg py-3 px-6 w-full cursor-pointer transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
            Hit
          </button>
          <button onClick={onStand} disabled={disabled} className="bg-accent-gold hover:bg-accent-gold-dark text-bg-base font-bold rounded-lg py-3 px-6 w-full cursor-pointer transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
            Stand
          </button>
          <button onClick={onDoubleDown} disabled={disabled} className="bg-accent-purple hover:bg-violet-600 text-white font-bold rounded-lg py-3 px-6 w-full cursor-pointer transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
            Double Down
          </button>
        </div>
      );
    }
    
    // Game over state or dealer turn - no controls needed
    return null;
  };

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5 sticky top-20">
      <h3 className="text-lg font-heading font-bold text-text-primary mb-1">Blackjack</h3>
      <div className="mb-4">
        <div className="text-sm text-text-muted">Balance: <span className="font-heading font-bold text-status-success">${userBalance.toFixed(2)}</span></div>
        {gamePhase === 'betting' && (
          <div className="text-sm text-text-muted mt-1">Bet Amount: <span className="font-heading font-bold text-accent-gold">${betAmount.toFixed(2)}</span></div>
        )}
      </div>

      {renderGameControls()}
    </div>
  );
};

export default BlackjackBettingPanel;