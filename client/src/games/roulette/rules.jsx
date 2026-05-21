import React from 'react';

const rules = (
  <>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">How to play</h4>
      <p>
        Place one or more bets on the table before the betting timer ends — single numbers, colours, columns,
        dozens, or odd/even. When the wheel stops on a pocket, all bets that cover that pocket win.
      </p>
    </section>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">Payouts</h4>
      <p>
        Inside bets (straight, split, street, corner, line) cover fewer numbers and pay much more. Outside bets
        (red/black, odd/even, columns, dozens) cover many numbers and pay less. The narrower the bet, the
        larger the multiplier.
      </p>
    </section>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">Things to know</h4>
      <ul className="list-disc list-inside space-y-1">
        <li>European wheel — single zero, no double-zero pocket.</li>
        <li>If the ball lands on zero, even-money outside bets simply lose (no la-partage rule here).</li>
        <li>You can place multiple bets in the same round.</li>
      </ul>
    </section>
  </>
);

export default rules;
