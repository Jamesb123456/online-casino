import React from 'react';
import { renderRules } from '../_shared/rulesSchema.jsx';

export const rulesData = {
  title: 'Roulette',
  sections: [
    {
      heading: 'How to play',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Place one or more bets on the table before the betting timer ends — single numbers, colours, columns, ' +
            'dozens, or odd/even. When the wheel stops on a pocket, all bets that cover that pocket win.',
        },
      ],
    },
    {
      heading: 'Payouts',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Inside bets (straight, split, street, corner, line) cover fewer numbers and pay much more. Outside bets ' +
            '(red/black, odd/even, columns, dozens) cover many numbers and pay less. The narrower the bet, the ' +
            'larger the multiplier.',
        },
      ],
    },
    {
      heading: 'Things to know',
      blocks: [
        {
          type: 'list',
          items: [
            'European wheel — single zero, no double-zero pocket.',
            'If the ball lands on zero, even-money outside bets simply lose (no la-partage rule here).',
            'You can place multiple bets in the same round.',
          ],
        },
      ],
    },
  ],
};

const rules = renderRules(rulesData);

export default rules;
