import React, { useContext } from 'react';
import MainLayout from '../../layouts/MainLayout';
import BlackjackGame from '../../games/blackjack/BlackjackGame';
import { AuthContext } from '../../contexts/AuthContext';

/**
 * BlackjackPage Component
 * Page container for the Blackjack game
 */
const BlackjackPage = () => {
  const { user } = useContext(AuthContext) || { user: null };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Blackjack</h1>
        </div>

        {/* Game instructions */}
        <div className="mb-6 p-4 bg-[#1a2c3d] rounded-lg border border-[#2a3f52]">
          <h2 className="text-xl font-semibold text-white mb-2">How to Play</h2>
          <ul className="list-disc pl-5 text-gray-300 space-y-1">
            <li>Place your bet and click "Deal Cards" to start</li>
            <li>Get as close to 21 as possible without going over</li>
            <li>Face cards are worth 10, Aces are worth 1 or 11</li>
            <li>Blackjack (Ace + 10-value card) pays 3:2</li>
            <li>Dealer hits on 16 or less, stands on 17 or more</li>
          </ul>
        </div>

        {/* Blackjack game */}
        <div className="bg-[#1a2c3d] p-4 rounded-lg shadow-xl border border-[#2a3f52]">
          <BlackjackGame initialBalance={user?.balance || 1000} />
        </div>
      </div>
    </MainLayout>
  );
};

export default BlackjackPage;