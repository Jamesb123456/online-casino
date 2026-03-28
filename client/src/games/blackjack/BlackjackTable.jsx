import React from 'react';
import BlackjackHand from './BlackjackHand';

/**
 * Component to render the blackjack table with dealer and player hands
 */
const BlackjackTable = ({ 
  playerHand, 
  dealerHand, 
  gamePhase,
  result,
  winAmount
}) => {
  // Only show dealer's hole card if game is complete
  const hideHoleCard = gamePhase === 'playerTurn';
  
  // Display the game result if available
  const renderResult = () => {
    if (!result || gamePhase !== 'complete') return null;

    let resultStyle = '';
    let resultText = '';

    switch (result) {
      case 'player':
        resultStyle = 'text-status-success';
        resultText = `You Win $${winAmount ? winAmount.toFixed(2) : '0.00'}!`;
        break;
      case 'dealer':
        resultStyle = 'text-status-error';
        resultText = 'Dealer Wins!';
        break;
      case 'push':
        resultStyle = 'text-accent-gold';
        resultText = 'Push!';
        break;
      default:
        return null;
    }

    return (
      <div className={`text-center my-4 rounded-xl p-4 backdrop-blur-xl bg-bg-card/95 border ${
        result === 'player' ? 'border-status-success/30' : result === 'dealer' ? 'border-status-error/30' : 'border-accent-gold/30'
      }`}>
        <div className={`text-3xl font-heading font-bold ${resultStyle}`}>
          {resultText}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-bg-card border border-border rounded-xl p-6 shadow-card" style={{ background: 'linear-gradient(135deg, #141827, #1a2a1a)' }}>
      <div className="flex flex-col">
        {/* Dealer's area */}
        <div className="mb-8">
          <BlackjackHand 
            hand={dealerHand} 
            isDealer={true}
            hideHoleCard={hideHoleCard}
          />
        </div>
        
        {/* Game result area */}
        {renderResult()}
        
        {/* Player's area */}
        <div>
          <BlackjackHand 
            hand={playerHand}
            isDealer={false}
          />
        </div>
      </div>
    </div>
  );
};

export default BlackjackTable;