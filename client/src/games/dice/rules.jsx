import React from 'react';
import { renderRules } from '../_shared/rulesSchema.jsx';

export const rulesData = {
  title: 'Dice',
  sections: [
    {
      heading: 'How to play',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Set your bet, pick a target between 1.00 and 99.00, and choose to roll under or over. ' +
            'The server picks a fair random number between 0.00 and 99.99. If the roll lands on ' +
            'your side of the target, you win your bet times the multiplier.',
        },
      ],
    },
    {
      heading: 'Payouts',
      blocks: [
        {
          type: 'paragraph',
          text:
            'The multiplier is determined by the chance of winning. A coin-flip target (50.00) ' +
            'pays ~1.92x at the default 4% house edge. The smaller your chance of winning, ' +
            'the bigger the multiplier — capped at 50x.',
        },
      ],
    },
    {
      heading: 'Things to know',
      blocks: [
        {
          type: 'list',
          items: [
            'Each roll is independent — there is no streak memory.',
            'Result is a 2-decimal number sampled uniformly from 0.00 to 99.99.',
            'A result exactly equal to the target counts as a loss.',
          ],
        },
      ],
    },
  ],
};

const rules = renderRules(rulesData);

export default rules;
