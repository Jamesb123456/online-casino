import React from 'react';
import MainLayout from '../components/layouts/MainLayout';

const HomePage = () => {
  return (
    <MainLayout>
      <section className="hero mb-12">
        <div className="py-12 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-amber-500 mb-4">
            Virtual Casino
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8">
            Experience the thrill of casino games without real money
          </p>
          <div className="flex justify-center gap-4">
            <a href="/games" className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-bold transition-all">
              Play Now
            </a>
            <a href="/register" className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-bold transition-all">
              Sign Up
            </a>
          </div>
        </div>
      </section>

      <section className="featured-games mb-16">
        <h2 className="text-3xl font-bold mb-6 text-center">Featured Games</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {['Crash', 'Roulette', 'Blackjack'].map(game => (
            <div key={game} className="bg-gray-800 rounded-xl overflow-hidden shadow-lg transform hover:scale-105 transition-transform">
              <div className="h-48 bg-gradient-to-r from-purple-900 to-indigo-800 flex items-center justify-center">
                <span className="text-4xl">{game === 'Crash' ? '📈' : game === 'Roulette' ? '🎡' : '🃏'}</span>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-amber-400 mb-2">{game}</h3>
                <p className="text-gray-400 mb-4">Try your luck at {game} with virtual currency!</p>
                <a href={`/games/${game.toLowerCase()}`} className="block text-center bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded transition-all">
                  Play {game}
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="how-it-works bg-gray-800 rounded-xl p-8 mb-16">
        <h2 className="text-3xl font-bold mb-6 text-center">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-5xl mb-4 text-amber-500">1</div>
            <h3 className="text-xl font-bold mb-2">Create an Account</h3>
            <p className="text-gray-400">Sign up for free and get virtual currency to start playing.</p>
          </div>
          <div className="text-center">
            <div className="text-5xl mb-4 text-amber-500">2</div>
            <h3 className="text-xl font-bold mb-2">Choose a Game</h3>
            <p className="text-gray-400">Pick from a variety of exciting casino games.</p>
          </div>
          <div className="text-center">
            <div className="text-5xl mb-4 text-amber-500">3</div>
            <h3 className="text-xl font-bold mb-2">Have Fun!</h3>
            <p className="text-gray-400">Play, win, and top the leaderboards with no real money at stake.</p>
          </div>
        </div>
      </section>
    </MainLayout>
  );
};

export default HomePage;