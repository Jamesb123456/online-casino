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
          <div key="hidden" className="relative w-20 h-28 sm:w-24 sm:h-32 bg-game-blackjack rounded-lg shadow-card m-1 flex items-center justify-center border border-border-light">
            <div className="text-white">
              <span className="text-2xl">♣♠♥♦</span>
            </div>
          </div>
        );
      }

      const { suit, rank } = card;
      const color = suit === 'hearts' || suit === 'diamonds' ? 'text-red-500' : 'text-text-primary';

      return (
        <div
          key={`${rank}-${suit}-${index}`}
          className="relative w-20 h-28 sm:w-24 sm:h-32 bg-bg-surface rounded-lg shadow-card m-1 flex flex-col border border-border-light"
        >
          <div className={`top-0 left-0 m-1 ${color}`}>
            <div className="text-lg font-bold">{rank}</div>
            <div className="text-lg">
              {suit === 'hearts' && '♥'}
              {suit === 'diamonds' && '♦'}
              {suit === 'clubs' && '♣'}
              {suit === 'spades' && '♠'}
            </div>
          </div>

          <div className={`flex-grow flex items-center justify-center ${color}`}>
            <span className="text-4xl">
              {suit === 'hearts' && '♥'}
              {suit === 'diamonds' && '♦'}
              {suit === 'clubs' && '♣'}
              {suit === 'spades' && '♠'}
            </span>
          </div>

          <div className={`bottom-0 right-0 m-1 rotate-180 ${color}`}>
            <div className="text-lg font-bold">{rank}</div>
            <div className="text-lg">
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
    <div className="my-4">
      <div className="flex flex-col items-center">
        <h3 className="text-lg font-heading font-bold text-text-primary mb-2">{isDealer ? "Dealer's Hand" : "Your Hand"}</h3>
        {handValue && (
          <div className="text-lg font-heading font-bold text-accent-gold mb-2">
            {handValue}
          </div>
        )}

        <div className="flex flex-wrap justify-center">
          {hand.length > 0 ? renderCards() : (
            <div className="text-text-muted">Waiting for deal...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlackjackHand;