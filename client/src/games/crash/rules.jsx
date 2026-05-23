import React from 'react';
import { renderRules } from '../_shared/rulesSchema.jsx';

export const rulesData = {
  title: 'Crash',
  sections: [
    {
      heading: 'How to play',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Place a bet before the round starts and watch the multiplier climb from 1.00x. Cash out at any moment ' +
            'to lock in your bet times the current multiplier. If the round crashes before you cash out, your bet is lost.',
        },
      ],
    },
    {
      heading: 'Payouts',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Your payout is your stake multiplied by the multiplier at the moment you cash out. You can set an ' +
            'automatic cash-out target so the game pulls you out as soon as the multiplier reaches it.',
        },
      ],
    },
    {
      heading: 'Things to know',
      blocks: [
        {
          type: 'list',
          items: [
            'Every round can crash at any time — even at 1.00x.',
            'The longer you wait, the bigger the potential win and the bigger the risk.',
            'Auto cash-out only triggers if the round reaches your target before crashing.',
          ],
        },
      ],
    },
  ],
};

const rules = renderRules(rulesData);

export default rules;
