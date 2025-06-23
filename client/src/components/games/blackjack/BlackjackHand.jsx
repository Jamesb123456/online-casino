import React from 'react';
import { calculateHandValue } from './blackjackUtils';

/**
 * BlackjackHand Component
 * Displays a hand of cards in the blackjack game
 */
const BlackjackHand = ({ cards = [], isDealer = false, hideHoleCard = false }) => {
  // Calculate the hand value
  const handValue = calculateHandValue(cards);
  
  // For dealer's hand, if hideHoleCard is true, only show the first card value
  const displayValue = (isDealer && hideHoleCard) 
    ? calculateHandValue([cards[0]])
    : handValue;
  
  return (
    <div className="flex flex-col items-center">
      <div className="mb-2 text-lg font-semibold text-white">
        {isDealer ? 'Dealer' : 'Your Hand'}: 
        <span className="ml-2">{displayValue}</span>
      </div>
      
      <div className="flex flex-wrap justify-center">
        {cards.map((card, index) => (
          <div 
            key={`${card.suit}-${card.value}-${index}`} 
            className="m-1 relative"
            style={{ transition: 'transform 0.3s ease-in-out' }}
          >
            {/* Hide the second card if it's dealer's hand and hideHoleCard is true */}
            {isDealer && hideHoleCard && index === 1 ? (
              <div className="w-24 h-36 bg-blue-800 rounded-lg shadow-lg flex items-center justify-center">
                <div className="w-20 h-32 bg-blue-700 rounded-lg border-2 border-blue-300 flex items-center justify-center">
                  <span className="text-2xl text-blue-300">?</span>
                </div>
              </div>
            ) : (
              <img 
                src={card.image}
                alt={`${card.value} of ${card.suit}`}
                className="w-24 h-36 rounded-lg shadow-lg object-cover"
                style={{
                  transform: `rotate(${Math.random() * 6 - 3}deg)`,
                  transformOrigin: 'center'
                }}
              />
            )}
          </div>
        ))}
        
        {/* Empty placeholder when no cards */}
        {cards.length === 0 && (
          <div className="w-24 h-36 bg-gray-700 rounded-lg border border-gray-600 opacity-30"></div>
        )}
      </div>
    </div>
  );
};

export default BlackjackHand;