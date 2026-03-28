import React, { useEffect } from 'react';
import MainLayout from '../../layouts/MainLayout';
import WheelGame from '../../games/wheel/WheelGame';

const WheelPage = () => {
  useEffect(() => {
    document.title = 'Wheel | Platinum Casino';
  }, []);
  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Wheel of Fortune</h1>
        <p className="text-gray-400">
          Spin the wheel and win big with multipliers up to 10x your bet!
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Choose your difficulty level to adjust risk and potential rewards.
          Higher difficulty means bigger potential wins but lower chances of hitting them.
        </p>
      </div>
      
      <WheelGame />
      
      <div className="mt-12 bg-[#1a2c3d] rounded-lg p-6 border border-[#2a3f52]">
        <h2 className="text-xl font-bold mb-4">How to Play</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-300">
          <li><span className="text-[#ffc107] font-semibold">Choose Difficulty</span> - Select your preferred risk level</li>
          <li><span className="text-[#ffc107] font-semibold">Set Bet Amount</span> - Enter how much you want to wager</li>
          <li><span className="text-[#ffc107] font-semibold">Spin the Wheel</span> - Click to spin and see where it lands</li>
          <li><span className="text-[#ffc107] font-semibold">Collect Winnings</span> - Your winnings are calculated based on the multiplier</li>
        </ol>
        
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Difficulty Levels</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#213749] p-4 rounded border border-[#2a4359]">
              <div className="text-green-400 font-bold mb-1">Easy</div>
              <p className="text-sm text-gray-300">Lower max multiplier (3x), but higher chances of winning.</p>
            </div>
            <div className="bg-[#213749] p-4 rounded border border-[#2a4359]">
              <div className="text-blue-400 font-bold mb-1">Medium</div>
              <p className="text-sm text-gray-300">Balanced risk with medium multipliers up to 5x.</p>
            </div>
            <div className="bg-[#213749] p-4 rounded border border-[#2a4359]">
              <div className="text-red-400 font-bold mb-1">Hard</div>
              <p className="text-sm text-gray-300">High risk with potential multipliers up to 10x.</p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default WheelPage;