import React from 'react';

const rules = (
  <>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">How to play</h4>
      <p>
        Place a bet before the round starts and watch the multiplier climb from 1.00x. Cash out at any moment
        to lock in your bet times the current multiplier. If the round crashes before you cash out, your bet is lost.
      </p>
    </section>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">Payouts</h4>
      <p>
        Your payout is your stake multiplied by the multiplier at the moment you cash out. You can set an
        automatic cash-out target so the game pulls you out as soon as the multiplier reaches it.
      </p>
    </section>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">Things to know</h4>
      <ul className="list-disc list-inside space-y-1">
        <li>Every round can crash at any time — even at 1.00x.</li>
        <li>The longer you wait, the bigger the potential win and the bigger the risk.</li>
        <li>Auto cash-out only triggers if the round reaches your target before crashing.</li>
      </ul>
    </section>
  </>
);

export default rules;
