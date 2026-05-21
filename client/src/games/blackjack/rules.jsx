import React from 'react';

const rules = (
  <>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">How to play</h4>
      <p>
        Place a bet and you're dealt two cards face-up while the dealer takes one face-up and one face-down.
        Hit to take another card, stand to keep your total. Get closer to 21 than the dealer without busting
        (going over 21).
      </p>
    </section>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">Payouts</h4>
      <p>
        A regular win pays even money on your stake. A natural blackjack (Ace + 10-value card on your first two
        cards) pays more. A push (tie with the dealer) returns your stake. Busting loses the bet immediately.
      </p>
    </section>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">Things to know</h4>
      <ul className="list-disc list-inside space-y-1">
        <li>Face cards are worth 10. Aces are worth 1 or 11 — whichever helps your hand.</li>
        <li>The dealer hits on 16 and stands on 17 (including soft 17 unless otherwise indicated).</li>
        <li>One hand per round.</li>
      </ul>
    </section>
  </>
);

export default rules;
