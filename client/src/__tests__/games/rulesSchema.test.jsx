import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import React from 'react';

import { renderRules } from '@/games/_shared/rulesSchema.jsx';

describe('renderRules', () => {
  it('returns null for missing or malformed data', () => {
    const { container: c1 } = render(<div>{renderRules(null)}</div>);
    expect(c1.querySelector('section')).toBeNull();

    const { container: c2 } = render(<div>{renderRules({})}</div>);
    expect(c2.querySelector('section')).toBeNull();

    const { container: c3 } = render(<div>{renderRules({ sections: 'nope' })}</div>);
    expect(c3.querySelector('section')).toBeNull();
  });

  it('renders sections with heading + paragraph + unordered list (matches existing rules.jsx shape)', () => {
    const data = {
      title: 'Test Game',
      sections: [
        {
          heading: 'How to play',
          blocks: [{ type: 'paragraph', text: 'Place a bet and play the round.' }],
        },
        {
          heading: 'Things to know',
          blocks: [
            {
              type: 'list',
              items: ['Every round is independent.', 'House edge applies overall.'],
            },
          ],
        },
      ],
    };

    const { container } = render(<div>{renderRules(data)}</div>);

    const sections = container.querySelectorAll('section');
    expect(sections).toHaveLength(2);

    // Headings are h4 with the expected typography classes
    const headings = container.querySelectorAll('h4');
    expect(headings).toHaveLength(2);
    expect(headings[0]).toHaveTextContent('How to play');
    expect(headings[0].className).toContain('text-text-primary');
    expect(headings[0].className).toContain('font-semibold');

    // Paragraph rendered as <p>
    expect(screen.getByText('Place a bet and play the round.').tagName).toBe('P');

    // Unordered list with the legacy styling classes
    const ul = container.querySelector('ul');
    expect(ul).not.toBeNull();
    expect(ul.className).toContain('list-disc');
    expect(ul.className).toContain('list-inside');
    const items = within(ul).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Every round is independent.');
    expect(items[1]).toHaveTextContent('House edge applies overall.');
  });

  it('renders ordered lists as <ol> when ordered: true', () => {
    const data = {
      sections: [
        {
          heading: 'Steps',
          blocks: [{ type: 'list', ordered: true, items: ['First', 'Second'] }],
        },
      ],
    };
    const { container } = render(<div>{renderRules(data)}</div>);
    expect(container.querySelector('ol')).not.toBeNull();
    expect(container.querySelector('ul')).toBeNull();
    expect(container.querySelector('ol').className).toContain('list-decimal');
  });

  it('renders table blocks with columns and rows', () => {
    const data = {
      sections: [
        {
          heading: 'Payouts',
          blocks: [
            {
              type: 'table',
              caption: 'Symbol payouts',
              columns: ['Symbol', '3 in a row', '5 in a row'],
              rows: [
                ['Cherry', '2x', '10x'],
                ['Seven', '5x', '50x'],
              ],
            },
          ],
        },
      ],
    };
    const { container } = render(<div>{renderRules(data)}</div>);
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    const headers = table.querySelectorAll('thead th');
    expect(headers).toHaveLength(3);
    expect(headers[0]).toHaveTextContent('Symbol');
    const bodyRows = table.querySelectorAll('tbody tr');
    expect(bodyRows).toHaveLength(2);
    expect(within(bodyRows[1]).getByText('Seven')).toBeInTheDocument();
    expect(within(bodyRows[1]).getByText('50x')).toBeInTheDocument();
    expect(table.querySelector('caption')).toHaveTextContent('Symbol payouts');
  });

  it('renders example blocks with a labelled prefix', () => {
    const data = {
      sections: [
        {
          heading: 'Example',
          blocks: [{ type: 'example', label: 'Bet 100', content: 'win 250 at 2.5x' }],
        },
      ],
    };
    render(<div>{renderRules(data)}</div>);
    // The label and content are separate spans inside a <p>, so use a flexible matcher.
    expect(screen.getByText(/Bet 100/)).toBeInTheDocument();
    expect(screen.getByText(/win 250 at 2.5x/)).toBeInTheDocument();
  });

  it('ignores unknown block types without crashing', () => {
    const data = {
      sections: [
        {
          heading: 'Mixed',
          blocks: [
            { type: 'paragraph', text: 'Visible paragraph.' },
            { type: 'bogus', text: 'should be skipped' },
            null,
          ],
        },
      ],
    };
    const { container } = render(<div>{renderRules(data)}</div>);
    expect(screen.getByText('Visible paragraph.')).toBeInTheDocument();
    // Only one rendered <p> inside the section (the unknown block produced nothing).
    expect(container.querySelectorAll('section > p')).toHaveLength(1);
  });

  it('mirrors the multi-section pattern used by every existing rules.jsx', () => {
    // Shape modelled on client/src/games/blackjack/rules.jsx etc.: 3 sections,
    // headings "How to play", "Payouts", "Things to know".
    const data = {
      sections: [
        { heading: 'How to play', blocks: [{ type: 'paragraph', text: 'Intro.' }] },
        { heading: 'Payouts', blocks: [{ type: 'paragraph', text: 'Payout info.' }] },
        {
          heading: 'Things to know',
          blocks: [{ type: 'list', items: ['Fact one', 'Fact two'] }],
        },
      ],
    };
    render(<div>{renderRules(data)}</div>);
    expect(screen.getByText('How to play')).toBeInTheDocument();
    expect(screen.getByText('Payouts')).toBeInTheDocument();
    expect(screen.getByText('Things to know')).toBeInTheDocument();
    expect(screen.getByText('Fact one')).toBeInTheDocument();
  });
});
