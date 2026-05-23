import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import React from 'react';

import blackjackRules, { rulesData as blackjackData } from '@/games/blackjack/rules.jsx';
import crashRules, { rulesData as crashData } from '@/games/crash/rules.jsx';
import diceRules, { rulesData as diceData } from '@/games/dice/rules.jsx';
import landminesRules, { rulesData as landminesData } from '@/games/landmines/rules.jsx';
import plinkoRules, { rulesData as plinkoData } from '@/games/plinko/rules.jsx';
import rouletteRules, { rulesData as rouletteData } from '@/games/roulette/rules.jsx';
import slotsRules, { rulesData as slotsData } from '@/games/slots/rules.jsx';
import wheelRules, { rulesData as wheelData } from '@/games/wheel/rules.jsx';

// Lock the data shape and rendered output for every game's rules.jsx.
// B7.2 converted each rules.jsx into a `rulesData` object + `renderRules(rulesData)`
// invocation. These tests guard the content so future edits cannot silently drop
// headings, paragraphs, or list items.

const cases = [
  {
    name: 'blackjack',
    rules: blackjackRules,
    data: blackjackData,
    sectionHeadings: ['How to play', 'Payouts', 'Things to know'],
    firstParagraphContains: "you're dealt two cards face-up",
    firstListItemContains: 'Face cards are worth 10',
  },
  {
    name: 'crash',
    rules: crashRules,
    data: crashData,
    sectionHeadings: ['How to play', 'Payouts', 'Things to know'],
    firstParagraphContains: 'multiplier climb from 1.00x',
    firstListItemContains: 'Every round can crash at any time',
  },
  {
    name: 'dice',
    rules: diceRules,
    data: diceData,
    sectionHeadings: ['How to play', 'Payouts', 'Things to know'],
    firstParagraphContains: 'pick a target between 1.00 and 99.00',
    firstListItemContains: 'Each roll is independent',
  },
  {
    name: 'landmines',
    rules: landminesRules,
    data: landminesData,
    sectionHeadings: ['How to play', 'Payouts', 'Things to know'],
    firstParagraphContains: 'choose how many mines to hide on the board',
    firstListItemContains: 'Mines are placed at the start of the round',
  },
  {
    name: 'plinko',
    rules: plinkoRules,
    data: plinkoData,
    sectionHeadings: ['How to play', 'Payouts', 'Things to know'],
    firstParagraphContains: 'Choose a risk level and the number of rows',
    firstListItemContains: 'More rows = more bounces and more variance',
  },
  {
    name: 'roulette',
    rules: rouletteRules,
    data: rouletteData,
    sectionHeadings: ['How to play', 'Payouts', 'Things to know'],
    firstParagraphContains: 'Place one or more bets on the table',
    firstListItemContains: 'European wheel',
  },
  {
    name: 'slots',
    rules: slotsRules,
    data: slotsData,
    sectionHeadings: ['How to play', 'Paylines', 'Payouts', 'Things to know'],
    firstParagraphContains: 'Pick your bet per line and the number of active paylines',
    firstListItemContains: 'Every reel is sampled independently each spin',
  },
  {
    name: 'wheel',
    rules: wheelRules,
    data: wheelData,
    sectionHeadings: ['How to play', 'Payouts', 'Things to know'],
    firstParagraphContains: 'Pick a difficulty (Easy, Medium, or Hard)',
    firstListItemContains: 'Some segments may return less than your stake',
  },
];

describe('game rulesData (B7.2)', () => {
  it.each(cases)('$name exports a rulesData object with the expected sections', ({ data, sectionHeadings }) => {
    expect(data).toBeTruthy();
    expect(Array.isArray(data.sections)).toBe(true);
    expect(data.sections.map((s) => s.heading)).toEqual(sectionHeadings);
    for (const section of data.sections) {
      expect(Array.isArray(section.blocks)).toBe(true);
      expect(section.blocks.length).toBeGreaterThan(0);
      for (const block of section.blocks) {
        expect(['paragraph', 'list', 'table', 'example']).toContain(block.type);
      }
    }
  });

  it.each(cases)(
    '$name default export renders headings, first paragraph, and first list item',
    ({ rules, sectionHeadings, firstParagraphContains, firstListItemContains }) => {
      const { container } = render(<div>{rules}</div>);

      // Every section heading renders as an <h4> in the expected order.
      const h4s = Array.from(container.querySelectorAll('h4')).map((el) => el.textContent);
      expect(h4s).toEqual(sectionHeadings);

      for (const heading of sectionHeadings) {
        expect(screen.getByText(heading)).toBeInTheDocument();
      }

      // First paragraph text is preserved verbatim (substring match).
      const firstParagraph = container.querySelector('section p');
      expect(firstParagraph).not.toBeNull();
      expect(firstParagraph.textContent).toContain(firstParagraphContains);

      // First list item text is preserved verbatim (substring match).
      const firstList = container.querySelector('section ul, section ol');
      expect(firstList).not.toBeNull();
      const firstLi = within(firstList).getAllByRole('listitem')[0];
      expect(firstLi.textContent).toContain(firstListItemContains);
    },
  );

  it('renders the expected number of sections for each game', () => {
    expect(blackjackData.sections).toHaveLength(3);
    expect(crashData.sections).toHaveLength(3);
    expect(diceData.sections).toHaveLength(3);
    expect(landminesData.sections).toHaveLength(3);
    expect(plinkoData.sections).toHaveLength(3);
    expect(rouletteData.sections).toHaveLength(3);
    expect(slotsData.sections).toHaveLength(4); // slots adds "Paylines"
    expect(wheelData.sections).toHaveLength(3);
  });
});
