import React from 'react';

const rules = (
  <>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">How to play</h4>
      <p>
        Pick your bet per line and the number of active paylines (1 to 5). Each spin
        independently lands three visible symbols per reel across five reels. Active
        paylines are evaluated left-to-right; matching the same symbol on consecutive
        reels starting from the leftmost reel wins.
      </p>
    </section>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">Paylines</h4>
      <p>
        Five paylines are available. The first line runs along the middle row, the
        second across the top row, the third across the bottom row, and the last two
        zig-zag (V-shape and inverted V) across the grid.
      </p>
    </section>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">Payouts</h4>
      <p>
        Winnings depend on the matching symbol and how many consecutive reels it
        appears on (3, 4 or 5). Rarer symbols pay more. Each line pays independently
        and your total bet equals bet-per-line times the number of active lines.
      </p>
    </section>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">Things to know</h4>
      <ul className="list-disc list-inside space-y-1">
        <li>Every reel is sampled independently each spin.</li>
        <li>Only the leftmost-starting run on a line counts — breaks end the run.</li>
        <li>House edge applies to the overall return; individual spins can pay big.</li>
      </ul>
    </section>
  </>
);

export default rules;
