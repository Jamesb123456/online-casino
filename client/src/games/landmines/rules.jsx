import React from 'react';

const rules = (
  <>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">How to play</h4>
      <p>
        Set your bet and choose how many mines to hide on the board. Reveal tiles one at a time — each safe
        tile raises your multiplier. Cash out at any point to claim your stake times the current multiplier.
      </p>
    </section>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">Payouts</h4>
      <p>
        The more tiles you successfully reveal, the higher the multiplier climbs. More mines on the board
        means a larger multiplier per safe tile — but also a bigger chance of hitting one. Hit a mine and you
        lose the bet.
      </p>
    </section>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">Things to know</h4>
      <ul className="list-disc list-inside space-y-1">
        <li>Mines are placed at the start of the round and stay fixed.</li>
        <li>You can cash out after any safe tile — there's no minimum reveal count.</li>
      </ul>
    </section>
  </>
);

export default rules;
