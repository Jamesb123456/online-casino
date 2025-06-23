import React, { useContext, useState } from 'react';
import MainLayout from '../../components/layouts/MainLayout';
import BlackjackGame from '../../components/games/blackjack/BlackjackGame';
import { AuthContext } from '../../contexts/AuthContext'; // Assuming you have an auth context

/**
 * BlackjackPage Component
 * Page container for the Blackjack game
 */
const BlackjackPage = () => {
  const { user } = useContext(AuthContext) || { user: null };
  const [useMock, setUseMock] = useState(true);
  
  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Blackjack</h1>
          
          {/* Toggle between mock and real mode */}
          <div className="flex items-center">
            <span className="text-gray-300 mr-3">Mock Mode</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useMock}
                onChange={() => setUseMock(!useMock)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>
        </div>
        
        {/* Game instructions */}
        <div className="mb-6 p-4 bg-gray-800 rounded-lg">
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
        <div className="bg-gray-800 p-4 rounded-lg shadow-xl">
          <BlackjackGame 
            initialBalance={user?.balance || 1000} 
            useMock={useMock} 
          />
        </div>
      </div>
    </MainLayout>
  );
};

export default BlackjackPage;