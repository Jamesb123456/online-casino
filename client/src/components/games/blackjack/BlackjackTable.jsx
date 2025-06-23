import React from 'react';
import BlackjackHand from './BlackjackHand';

/**
 * BlackjackTable Component
 * Displays the blackjack game table including dealer and player hands
 */
const BlackjackTable = ({
  playerHands = [[]],
  dealerHand = [],
  currentHandIndex = 0,
  gameState = 'betting',
  result = null,
  payout = 0,
  hideHoleCard = true
}) => {
  // Determine if we should show the dealer's hole card
  const shouldHideHoleCard = hideHoleCard && gameState !== 'gameOver' && gameState !== 'dealerTurn';
  
  return (
    <div className="bg-green-800 p-8 rounded-lg shadow-lg relative overflow-hidden">
      {/* Decorative table border */}
      <div className="absolute inset-0 border-8 border-yellow-800 rounded-lg pointer-events-none"></div>
      
      {/* Dealer area */}
      <div className="mb-10">
        <BlackjackHand 
          cards={dealerHand} 
          isDealer={true} 
          hideHoleCard={shouldHideHoleCard}
        />
      </div>
      
      {/* Center of table - game status and results */}
      <div className="text-center mb-10">
        {gameState === 'gameOver' && (
          <div className="mb-4">
            <div className={`text-2xl font-bold ${
              result === 'player' || result === 'blackjack' 
                ? 'text-green-400' 
                : result === 'dealer' 
                  ? 'text-red-400' 
                  : 'text-white'
            }`}>
              {result === 'player' && 'You Win!'}
              {result === 'blackjack' && 'Blackjack!'}
              {result === 'dealer' && 'Dealer Wins'}
              {result === 'push' && 'Push'}
            </div>
            
            {payout !== 0 && (
              <div className={`text-xl ${payout > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {payout > 0 ? `+$${payout.toFixed(2)}` : `-$${Math.abs(payout).toFixed(2)}`}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Player area */}
      <div>
        {playerHands.map((hand, index) => (
          <div 
            key={`hand-${index}`}
            className={`mb-4 ${index === currentHandIndex ? 'relative' : 'opacity-70'}`}
          >
            {index === currentHandIndex && (
              <div className="absolute -left-4 top-1/2 transform -translate-y-1/2">
                <div className="w-2 h-8 bg-yellow-400 rounded-full animate-pulse"></div>
              </div>
            )}
            <BlackjackHand cards={hand} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default BlackjackTable;