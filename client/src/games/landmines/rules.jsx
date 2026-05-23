import React from 'react';
import { renderRules } from '../_shared/rulesSchema.jsx';

export const rulesData = {
  title: 'Landmines',
  sections: [
    {
      heading: 'How to play',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Set your bet and choose how many mines to hide on the board. Reveal tiles one at a time — each safe ' +
            'tile raises your multiplier. Cash out at any point to claim your stake times the current multiplier.',
        },
      ],
    },
    {
      heading: 'Payouts',
      blocks: [
        {
          type: 'paragraph',
          text:
            'The more tiles you successfully reveal, the higher the multiplier climbs. More mines on the board ' +
            'means a larger multiplier per safe tile — but also a bigger chance of hitting one. Hit a mine and you ' +
            'lose the bet.',
        },
      ],
    },
    {
      heading: 'Things to know',
      blocks: [
        {
          type: 'list',
          items: [
            'Mines are placed at the start of the round and stay fixed.',
            "You can cash out after any safe tile — there's no minimum reveal count.",
          ],
        },
      ],
    },
  ],
};

const rules = renderRules(rulesData);

export default rules;
