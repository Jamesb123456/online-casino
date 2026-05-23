import React, { useEffect } from 'react';
import MainLayout from '../../layouts/MainLayout';
import SlotsGame from '../../games/slots/SlotsGame';
import RulesButton from '../../components/games/RulesButton';
import { rulesData as slotsRulesData } from '../../games/slots/rules.jsx';

const SlotsPage = () => {
  useEffect(() => {
    document.title = 'Slots | Platinum Casino';
  }, []);
  return (
    <MainLayout>
      <div className="mb-6 mt-4">
        <div className="flex items-start justify-between mb-6">
          <h1 className="text-3xl md:text-4xl font-heading font-bold tracking-tight text-text-primary">
            <span className="text-game-slots drop-shadow-[0_0_18px_rgba(236,72,153,0.55)]">Slots</span>
          </h1>
          <RulesButton gameType="slots" gameName="Slots" rulesData={slotsRulesData} />
        </div>
        <div className="mb-6">
          <p className="text-text-secondary">
            A classic 5-reel slot machine — pick your paylines and chase matching symbols.
          </p>
        </div>
        <SlotsGame />
      </div>
    </MainLayout>
  );
};

export default SlotsPage;
