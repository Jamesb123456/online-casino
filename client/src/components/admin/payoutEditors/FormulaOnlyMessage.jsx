import React from 'react';

const FormulaOnlyMessage = ({ gameType }) => (
  <div
    data-testid={`formula-only-${gameType}`}
    className="bg-bg-base border border-border rounded-lg px-4 py-3 text-sm text-text-secondary"
  >
    This game uses a formula based on House Edge. Edit the slider on the main card to adjust.
  </div>
);

export default FormulaOnlyMessage;
