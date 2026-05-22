import React, { useState } from 'react';
import RulesModal from './RulesModal';

const RulesButton = ({ gameType, gameName, rules, className = '' }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${gameName} rules`}
        data-testid="rules-button"
        className={`inline-flex items-center justify-center w-9 h-9 rounded-full border border-border-light text-text-secondary hover:border-accent-gold hover:text-accent-gold transition-colors focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base focus:outline-none cursor-pointer ${className}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093V14m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      <RulesModal
        gameType={gameType}
        gameName={gameName}
        open={open}
        onClose={() => setOpen(false)}
      >
        {rules}
      </RulesModal>
    </>
  );
};

export default RulesButton;
