import React, { useEffect, useRef } from 'react';
import Card from './Card';
import { getHandStatus } from './blackjackUtils';
import { useSound } from '../../components/casino/SoundProvider';
import { useReducedMotion } from '../../components/casino/MotionSafe';

/**
 * BlackjackHand — renders a dealer's or player's hand of cards with
 * Framer-driven deal + flip animations (handled inside <Card />). The dealer's
 * hole card stays face-down until the reveal phase, at which point it flips.
 *
 * Props
 *   hand          Array<{rank, suit}>
 *   isDealer      boolean   — toggles label and hole-card behaviour
 *   hideHoleCard  boolean   — dealer-only; holds the 2nd card face-down
 *   label         string?   — override default label
 */
const BlackjackHand = ({
  hand = [],
  isDealer = false,
  hideHoleCard = false,
  label,
}) => {
  const { play } = useSound();
  const reduced = useReducedMotion();
  const prevLenRef = useRef(0);
  const prevHideRef = useRef(hideHoleCard);

  const handValue = hideHoleCard ? null : getHandStatus(hand);
  const heading = label || (isDealer ? "Dealer's Hand" : 'Your Hand');

  // Card-flip SFX — rate-limited per change (one play per new card or reveal).
  useEffect(() => {
    if (reduced) {
      prevLenRef.current = hand.length;
      prevHideRef.current = hideHoleCard;
      return;
    }
    const grew = hand.length > prevLenRef.current;
    const revealed = prevHideRef.current && !hideHoleCard;
    if (grew || revealed) {
      try {
        play('card-flip');
      } catch {
        /* ignore */
      }
    }
    prevLenRef.current = hand.length;
    prevHideRef.current = hideHoleCard;
  }, [hand.length, hideHoleCard, play, reduced]);

  return (
    <div className="my-4 flex flex-col items-center">
      <div className="mb-2 flex items-center gap-3">
        <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-text-secondary">
          {heading}
        </h3>
        {handValue ? (
          <span className="rounded-full bg-accent-gold/15 px-2 py-0.5 font-mono text-xs font-bold text-accent-gold-light ring-1 ring-accent-gold/40">
            {handValue}
          </span>
        ) : null}
      </div>

      <div
        className="flex min-h-[7.5rem] flex-wrap items-center justify-center gap-2 sm:min-h-[9rem]"
        aria-label={`${heading} cards`}
      >
        {hand.length === 0 ? (
          <span className="text-xs italic text-text-muted">Waiting for deal…</span>
        ) : (
          hand.map((card, index) => {
            if (!card) return null;
            const isHole = isDealer && hideHoleCard && index === 1;
            return (
              <Card
                key={`${card.rank}-${card.suit}-${index}`}
                rank={card.rank}
                suit={card.suit}
                index={index}
                faceDown={isHole}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default BlackjackHand;
