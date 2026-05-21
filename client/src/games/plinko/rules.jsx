import React from 'react';

const rules = (
  <>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">How to play</h4>
      <p>
        Choose a risk level and the number of rows, set your bet, then drop a ball. The ball bounces through
        the pins and lands in one of the buckets at the bottom — the bucket it lands in determines your payout.
      </p>
    </section>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">Payouts</h4>
      <p>
        Buckets on the outside pay larger multipliers, buckets in the middle pay smaller ones (and sometimes
        less than your stake). The bigger the risk level, the larger the top-end multipliers — but the harder
        the outer buckets are to hit.
      </p>
    </section>
    <section>
      <h4 className="text-text-primary font-semibold mb-1">Things to know</h4>
      <ul className="list-disc list-inside space-y-1">
        <li>More rows = more bounces and more variance.</li>
        <li>Each drop is independent — past results don't change the odds.</li>
      </ul>
    </section>
  </>
);

export default rules;
