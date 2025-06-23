import React, { useState, useEffect } from 'react';
import Button from '../../components/ui/Button';

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
        <div className="betting-controls">
          <div className="mb-4">
            <div className="font-bold mb-1">Select bet amount:</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {betOptions.map(amount => (
                <Button
                  key={amount}
                  onClick={() => handleBetChange(amount)}
                  disabled={amount > userBalance || disabled}
                  variant={betAmount === amount ? "primary" : "secondary"}
                  className={`px-2 py-1 ${betAmount === amount ? 'ring-2 ring-blue-500' : ''}`}
                >
                  ${amount}
                </Button>
              ))}
            </div>
          </div>
          
          <Button
            onClick={handlePlaceBet}
            disabled={disabled || betAmount > userBalance}
            variant="success"
            className="w-full"
          >
            Place Bet
          </Button>
        </div>
      );
    } else if (gamePhase === 'playerTurn') {
      return (
        <div className="action-controls flex flex-col gap-2">
          <Button onClick={onHit} disabled={disabled} variant="primary" className="w-full">
            Hit
          </Button>
          <Button onClick={onStand} disabled={disabled} variant="warning" className="w-full">
            Stand
          </Button>
          <Button onClick={onDoubleDown} disabled={disabled} variant="info" className="w-full">
            Double Down
          </Button>
        </div>
      );
    }
    
    // Game over state or dealer turn - no controls needed
    return null;
  };

  return (
    <div className="blackjack-betting-panel border border-gray-300 rounded-lg p-4 bg-gray-100">
      <div className="mb-4">
        <div className="text-lg font-bold">Balance: ${userBalance.toFixed(2)}</div>
        {gamePhase === 'betting' && (
          <div className="text-md">Bet Amount: ${betAmount.toFixed(2)}</div>
        )}
      </div>
      
      {renderGameControls()}
    </div>
  );
};

export default BlackjackBettingPanel;