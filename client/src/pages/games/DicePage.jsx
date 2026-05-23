import React, { useEffect } from 'react';
import MainLayout from '../../layouts/MainLayout';
import DiceGame from '../../games/dice/DiceGame';
import RulesButton from '../../components/games/RulesButton';
import { rulesData as diceRulesData } from '../../games/dice/rules.jsx';

const DicePage = () => {
  useEffect(() => {
    document.title = 'Dice | Platinum Casino';
  }, []);
  return (
    <MainLayout>
      <div className="mb-6 mt-4">
        <div className="flex items-start justify-between mb-6">
          <h1 className="text-3xl md:text-4xl font-heading font-bold tracking-tight text-text-primary">
            <span className="text-game-dice drop-shadow-[0_0_18px_rgba(20,184,166,0.55)]">Dice</span>
          </h1>
          <RulesButton gameType="dice" gameName="Dice" rulesData={diceRulesData} />
        </div>
        <div className="mb-6">
          <p className="text-text-secondary">
            Predict whether the next roll will land above or below your chosen target.
            Smaller targets, bigger multipliers — pick your risk.
          </p>
        </div>
        <DiceGame />
      </div>
    </MainLayout>
  );
};

export default DicePage;
