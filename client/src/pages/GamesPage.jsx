import React from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import Card from '../components/ui/Card';

const GamesPage = () => {
  const games = [
    {
      id: 'crash',
      name: 'Crash',
      description: 'Watch the multiplier increase until it crashes. Cash out before it\'s too late!',
      bgColor: 'bg-gradient-to-br from-game-crash/30 to-bg-card',
      accentColor: 'border-game-crash'
    },
    {
      id: 'plinko',
      name: 'Plinko',
      description: 'Drop the ball and watch it bounce through pins to determine your payout.',
      bgColor: 'bg-gradient-to-br from-game-plinko/30 to-bg-card',
      accentColor: 'border-game-plinko'
    },
    {
      id: 'wheel',
      name: 'Wheel',
      description: 'Spin the wheel and win based on where it stops!',
      bgColor: 'bg-gradient-to-br from-game-wheel/30 to-bg-card',
      accentColor: 'border-game-wheel'
    },
    {
      id: 'roulette',
      name: 'Roulette',
      description: 'Classic casino roulette with multiple betting options.',
      bgColor: 'bg-gradient-to-br from-game-roulette/30 to-bg-card',
      accentColor: 'border-game-roulette'
    },
    {
      id: 'chicken',
      name: 'Chicken',
      description: 'How far will you go? Push your luck to the limit!',
      bgColor: 'bg-gradient-to-br from-game-chicken/30 to-bg-card',
      accentColor: 'border-game-chicken'
    },
    {
      id: 'blackjack',
      name: 'Blackjack',
      description: 'Beat the dealer by getting closer to 21 without going over.',
      bgColor: 'bg-gradient-to-br from-game-blackjack/30 to-bg-card',
      accentColor: 'border-game-blackjack'
    }
  ];

  return (
    <MainLayout>
      <div className="mb-12 mt-6 text-center">
        <h1 className="text-5xl font-bold mb-4">
          <span className="bg-gradient-to-r from-white to-gray-400 text-transparent bg-clip-text">Our Games</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Experience the thrill of casino games with our selection of exciting options. 
          All games use virtual currency - no real money at stake!
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {games.map(game => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </MainLayout>
  );
};

const GameCard = ({ game }) => {
  return (
    <Card
      className="transform transition-all duration-300 hover:-translate-y-2"
      variant="elevated"
    >
      <div className={`h-52 ${game.bgColor} flex items-center justify-center relative overflow-hidden rounded-t-lg`}>
        <div className="absolute inset-0 opacity-20 bg-[url('/src/assets/pattern.png')]"></div>
        <div className={`flex items-center justify-center w-24 h-24 rounded-full relative z-10 ${game.accentColor} border-2 bg-opacity-20 bg-gray-700`}>
          <span className="text-2xl font-bold text-white">{game.name}</span>
        </div>
      </div>
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-3">
          <span className="bg-gradient-to-r from-white to-gray-300 text-transparent bg-clip-text">
            {game.name}
          </span>
        </h2>
        <p className="text-gray-400 mb-6 h-12">{game.description}</p>
        <Link 
          to={`/games/${game.id}`}
          className="block text-center bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white py-3 px-6 rounded-md font-medium transition-all shadow-glow"
        >
          Play Now
        </Link>
      </div>
    </Card>
  );
};

export default GamesPage;