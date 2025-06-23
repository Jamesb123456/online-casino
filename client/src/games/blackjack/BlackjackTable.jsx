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
        resultStyle = 'text-green-600';
        resultText = `You Win $${winAmount ? winAmount.toFixed(2) : '0.00'}!`;
        break;
      case 'dealer':
        resultStyle = 'text-red-600';
        resultText = 'Dealer Wins!';
        break;
      case 'push':
        resultStyle = 'text-blue-600';
        resultText = 'Push!';
        break;
      default:
        return null;
    }

    return (
      <div className={`game-result text-center my-4 text-2xl font-bold ${resultStyle}`}>
        {resultText}
      </div>
    );
  };

  return (
    <div className="blackjack-table bg-green-800 rounded-3xl p-6 shadow-lg border-8 border-brown-700">
      <div className="table-inner flex flex-col">
        {/* Dealer's area */}
        <div className="dealer-area mb-8">
          <BlackjackHand 
            hand={dealerHand} 
            isDealer={true}
            hideHoleCard={hideHoleCard}
          />
        </div>
        
        {/* Game result area */}
        {renderResult()}
        
        {/* Player's area */}
        <div className="player-area">
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