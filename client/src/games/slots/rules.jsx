import React from 'react';
import { renderRules } from '../_shared/rulesSchema.jsx';

export const rulesData = {
  title: 'Slots',
  sections: [
    {
      heading: 'How to play',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Pick your bet per line and the number of active paylines (1 to 5). Each spin ' +
            'independently lands three visible symbols per reel across five reels. Active ' +
            'paylines are evaluated left-to-right; matching the same symbol on consecutive ' +
            'reels starting from the leftmost reel wins.',
        },
      ],
    },
    {
      heading: 'Paylines',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Five paylines are available. The first line runs along the middle row, the ' +
            'second across the top row, the third across the bottom row, and the last two ' +
            'zig-zag (V-shape and inverted V) across the grid.',
        },
      ],
    },
    {
      heading: 'Payouts',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Winnings depend on the matching symbol and how many consecutive reels it ' +
            'appears on (3, 4 or 5). Rarer symbols pay more. Each line pays independently ' +
            'and your total bet equals bet-per-line times the number of active lines.',
        },
      ],
    },
    {
      heading: 'Things to know',
      blocks: [
        {
          type: 'list',
          items: [
            'Every reel is sampled independently each spin.',
            'Only the leftmost-starting run on a line counts — breaks end the run.',
            'House edge applies to the overall return; individual spins can pay big.',
          ],
        },
      ],
    },
  ],
};

const rules = renderRules(rulesData);

export default rules;
