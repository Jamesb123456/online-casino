import React from 'react';
import { renderRules } from '../_shared/rulesSchema.jsx';

export const rulesData = {
  title: 'Wheel',
  sections: [
    {
      heading: 'How to play',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Pick a difficulty (Easy, Medium, or Hard), set your bet, and spin the wheel. Where the pointer ' +
            'lands decides the multiplier applied to your stake.',
        },
      ],
    },
    {
      heading: 'Payouts',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Each segment carries a multiplier. Easy mode has more winning segments with smaller multipliers; ' +
            'Hard mode has fewer winning segments but much larger multipliers. The bigger the risk, the larger ' +
            'the top prize.',
        },
      ],
    },
    {
      heading: 'Things to know',
      blocks: [
        {
          type: 'list',
          items: [
            "Some segments may return less than your stake (or zero) — that's the trade-off for the big ones.",
            'Every spin is independent.',
          ],
        },
      ],
    },
  ],
};

const rules = renderRules(rulesData);

export default rules;
