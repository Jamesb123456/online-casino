import React from 'react';
import { renderRules } from '../_shared/rulesSchema.jsx';

export const rulesData = {
  title: 'Blackjack',
  sections: [
    {
      heading: 'How to play',
      blocks: [
        {
          type: 'paragraph',
          text:
            "Place a bet and you're dealt two cards face-up while the dealer takes one face-up and one face-down. " +
            'Hit to take another card, stand to keep your total. Get closer to 21 than the dealer without busting ' +
            '(going over 21).',
        },
      ],
    },
    {
      heading: 'Payouts',
      blocks: [
        {
          type: 'paragraph',
          text:
            'A regular win pays even money on your stake. A natural blackjack (Ace + 10-value card on your first two ' +
            'cards) pays more. A push (tie with the dealer) returns your stake. Busting loses the bet immediately.',
        },
      ],
    },
    {
      heading: 'Things to know',
      blocks: [
        {
          type: 'list',
          items: [
            'Face cards are worth 10. Aces are worth 1 or 11 — whichever helps your hand.',
            'The dealer hits on 16 and stands on 17 (including soft 17 unless otherwise indicated).',
            'One hand per round.',
          ],
        },
      ],
    },
  ],
};

const rules = renderRules(rulesData);

export default rules;
