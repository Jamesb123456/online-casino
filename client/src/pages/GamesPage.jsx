import React from 'react';
import MainLayout from '../layouts/MainLayout';

const GamesPage = () => {
  const games = [
    {
      id: 'crash',
      name: 'Crash',
      description: 'Watch the multiplier increase until it crashes. Cash out before it\'s too late!',
      icon: '📈',
      color: 'from-red-900 to-red-700'
    },
    {
      id: 'plinko',
      name: 'Plinko',
      description: 'Drop the ball and watch it bounce through pins to determine your payout.',
      icon: '🔵',
      color: 'from-blue-900 to-blue-700'
    },
    {
      id: 'wheel',
      name: 'Wheel',
      description: 'Spin the wheel and win based on where it stops!',
      icon: '🎡',
      color: 'from-yellow-900 to-yellow-700'
    },
    {
      id: 'roulette',
      name: 'Roulette',
      description: 'Classic casino roulette with multiple betting options.',
      icon: '🎲',
      color: 'from-green-900 to-green-700'
    },
    {
      id: 'chicken',
      name: 'Chicken',
      description: 'How far will you go? Push your luck to the limit!',
      icon: '🐔',
      color: 'from-orange-900 to-orange-700'
    },
    {
      id: 'blackjack',
      name: 'Blackjack',
      description: 'Beat the dealer by getting closer to 21 without going over.',
      icon: '🃏',
      color: 'from-purple-900 to-purple-700'
    }
  ];

  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Casino Games</h1>
        <p className="text-gray-400">Pick a game and try your luck!</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {games.map(game => (
          <div 
            key={game.id}
            className="bg-gray-800 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all"
          >
            <div className={`h-40 bg-gradient-to-r ${game.color} flex items-center justify-center`}>
              <span className="text-5xl">{game.icon}</span>
            </div>
            <div className="p-6">
              <h2 className="text-2xl font-bold text-amber-400 mb-2">{game.name}</h2>
              <p className="text-gray-400 mb-4">{game.description}</p>
              <a 
                href={`/games/${game.id}`}
                className="block text-center bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded transition-all"
              >
                Play Now
              </a>
            </div>
          </div>
        ))}
      </div>
    </MainLayout>
  );
};

export default GamesPage;