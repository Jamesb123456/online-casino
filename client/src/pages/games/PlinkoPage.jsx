import React from 'react';
import MainLayout from '../../layouts/MainLayout';
import PlinkoGame from '../../games/plinko/PlinkoGame';

const PlinkoPage = () => {
  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Plinko</h1>
        <p className="text-gray-400">
          Drop the ball and watch it bounce through pins to determine your payout multiplier.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Higher risk levels mean higher potential payouts, but also lower chances of winning.
          Choose your risk level and bet amount carefully!
        </p>
      </div>
      
      <PlinkoGame />
      
      <div className="mt-12 bg-[#1a2c3d] rounded-lg p-6 border border-[#2a3f52]">
        <h2 className="text-xl font-bold mb-4">How to Play</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-300">
          <li><span className="text-[#ffc107] font-semibold">Choose Risk Level</span> - Select from low, medium, or high risk</li>
          <li><span className="text-[#ffc107] font-semibold">Set Bet Amount</span> - Enter the amount you want to wager</li>
          <li><span className="text-[#ffc107] font-semibold">Drop Ball</span> - Click the button to start the game</li>
          <li><span className="text-[#ffc107] font-semibold">Watch Results</span> - See which bucket your ball lands in</li>
          <li><span className="text-[#ffc107] font-semibold">Collect Winnings</span> - Your winnings are automatically credited based on the multiplier</li>
        </ol>
      </div>
    </MainLayout>
  );
};

export default PlinkoPage;