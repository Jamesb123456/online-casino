import React from 'react';
import { getHandStatus } from './blackjackUtils';

/**
 * Component to render a single blackjack hand (player's or dealer's)
 */
const BlackjackHand = ({ hand = [], isDealer = false, hideHoleCard = false }) => {
  // If this is a dealer hand and we need to hide the hole card
  const displayedHand = hideHoleCard ? [hand[0]] : hand;
  const handValue = hideHoleCard ? null : getHandStatus(hand);

  // Generate card image URLs
  const renderCards = () => {
    return displayedHand.map((card, index) => {
      // If this is the dealer's hidden card
      if (isDealer && hideHoleCard && index === 1) {
        return (
          <div key="hidden" className="card card-back relative w-20 h-28 sm:w-24 sm:h-32 bg-blue-900 rounded-lg shadow-md m-1 flex items-center justify-center">
            <div className="back-design text-white">
              <span className="text-2xl">♣♠♥♦</span>
            </div>
          </div>
        );
      }
      
      const { suit, rank } = card;
      const color = suit === 'hearts' || suit === 'diamonds' ? 'text-red-600' : 'text-black';
      
      return (
        <div
          key={`${rank}-${suit}-${index}`}
          className="card relative w-20 h-28 sm:w-24 sm:h-32 bg-white rounded-lg shadow-md m-1 flex flex-col border border-gray-300"
        >
          <div className={`card-corner top-0 left-0 m-1 ${color}`}>
            <div className="rank text-lg font-bold">{rank}</div>
            <div className="suit text-lg">
              {suit === 'hearts' && '♥'}
              {suit === 'diamonds' && '♦'}
              {suit === 'clubs' && '♣'}
              {suit === 'spades' && '♠'}
            </div>
          </div>
          
          <div className={`card-center flex-grow flex items-center justify-center ${color}`}>
            <span className="text-4xl">
              {suit === 'hearts' && '♥'}
              {suit === 'diamonds' && '♦'}
              {suit === 'clubs' && '♣'}
              {suit === 'spades' && '♠'}
            </span>
          </div>
          
          <div className={`card-corner bottom-0 right-0 m-1 rotate-180 ${color}`}>
            <div className="rank text-lg font-bold">{rank}</div>
            <div className="suit text-lg">
              {suit === 'hearts' && '♥'}
              {suit === 'diamonds' && '♦'}
              {suit === 'clubs' && '♣'}
              {suit === 'spades' && '♠'}
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="blackjack-hand my-4">
      <div className="flex flex-col items-center">
        <h3 className="text-xl mb-2">{isDealer ? "Dealer's Hand" : "Your Hand"}</h3>
        {handValue && (
          <div className="hand-value text-lg mb-2">
            {handValue}
          </div>
        )}
        
        <div className="cards-container flex flex-wrap justify-center">
          {hand.length > 0 ? renderCards() : (
            <div className="empty-hand text-gray-400">Waiting for deal...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlackjackHand;