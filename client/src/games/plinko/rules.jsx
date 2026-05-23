import React from 'react';
import { renderRules } from '../_shared/rulesSchema.jsx';

export const rulesData = {
  title: 'Plinko',
  sections: [
    {
      heading: 'How to play',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Choose a risk level and the number of rows, set your bet, then drop a ball. The ball bounces through ' +
            'the pins and lands in one of the buckets at the bottom — the bucket it lands in determines your payout.',
        },
      ],
    },
    {
      heading: 'Payouts',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Buckets on the outside pay larger multipliers, buckets in the middle pay smaller ones (and sometimes ' +
            'less than your stake). The bigger the risk level, the larger the top-end multipliers — but the harder ' +
            'the outer buckets are to hit.',
        },
      ],
    },
    {
      heading: 'Things to know',
      blocks: [
        {
          type: 'list',
          items: [
            'More rows = more bounces and more variance.',
            "Each drop is independent — past results don't change the odds.",
          ],
        },
      ],
    },
  ],
};

const rules = renderRules(rulesData);

export default rules;
