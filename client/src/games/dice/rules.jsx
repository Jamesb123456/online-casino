import React from 'react';

const rules = (
  <>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">How to play</h4>
      <p>
        Set your bet, pick a target between 1.00 and 99.00, and choose to roll under or over.
        The server picks a fair random number between 0.00 and 99.99. If the roll lands on
        your side of the target, you win your bet times the multiplier.
      </p>
    </section>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">Payouts</h4>
      <p>
        The multiplier is determined by the chance of winning. A coin-flip target (50.00)
        pays ~1.92x at the default 4% house edge. The smaller your chance of winning,
        the bigger the multiplier — capped at 50x.
      </p>
    </section>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">Things to know</h4>
      <ul className="list-disc list-inside space-y-1">
        <li>Each roll is independent — there is no streak memory.</li>
        <li>Result is a 2-decimal number sampled uniformly from 0.00 to 99.99.</li>
        <li>A result exactly equal to the target counts as a loss.</li>
      </ul>
    </section>
  </>
);

export default rules;
