import React from 'react';

const rules = (
  <>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">How to play</h4>
      <p>
        Pick a difficulty (Easy, Medium, or Hard), set your bet, and spin the wheel. Where the pointer
        lands decides the multiplier applied to your stake.
      </p>
    </section>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">Payouts</h4>
      <p>
        Each segment carries a multiplier. Easy mode has more winning segments with smaller multipliers;
        Hard mode has fewer winning segments but much larger multipliers. The bigger the risk, the larger
        the top prize.
      </p>
    </section>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">Things to know</h4>
      <ul className="list-disc list-inside space-y-1">
        <li>Some segments may return less than your stake (or zero) — that's the trade-off for the big ones.</li>
        <li>Every spin is independent.</li>
      </ul>
    </section>
  </>
);

export default rules;
