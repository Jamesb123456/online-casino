import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import MainLayout from '../layouts/MainLayout';

const PERIODS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'allTime', label: 'All Time' },
];

const LeaderboardPage = () => {
  useEffect(() => {
    document.title = 'Leaderboard | Platinum Casino';
  }, []);

  const [period, setPeriod] = useState('allTime');
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeaderboard = async (selectedPeriod) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.get('/leaderboard', {
        params: { period: selectedPeriod, limit: 20 },
      });
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError('Failed to load leaderboard. Please try again later.');
      setLeaderboard([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(period);
  }, [period]);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
  };

  // Rank badge styles for top 3
  const getRankDisplay = (index) => {
    if (index === 0) {
      return (
        <div className="w-8 h-8 rounded-full bg-accent-gold flex items-center justify-center text-bg-base font-bold text-sm shadow-glow-gold">
          1
        </div>
      );
    }
    if (index === 1) {
      return (
        <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-bg-base font-bold text-sm shadow-lg">
          2
        </div>
      );
    }
    if (index === 2) {
      return (
        <div className="w-8 h-8 rounded-full bg-amber-700 flex items-center justify-center text-text-primary font-bold text-sm shadow-lg">
          3
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center text-text-secondary font-medium text-sm">
        {index + 1}
      </div>
    );
  };

  // Row highlight for top 3
  const getRowClass = (index) => {
    if (index === 0) return 'bg-accent-gold/10 border-l-2 border-accent-gold';
    if (index === 1) return 'bg-gray-400/5 border-l-2 border-gray-400';
    if (index === 2) return 'bg-amber-700/10 border-l-2 border-amber-700';
    return 'border-l-2 border-transparent';
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-heading font-bold text-text-primary mb-2">Leaderboard</h1>
        <p className="text-text-secondary mb-8">See who is winning the most at Platinum Casino</p>

        {/* Period Tabs */}
        <div className="flex space-x-1 mb-6 bg-bg-elevated rounded-lg p-1 w-fit">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => handlePeriodChange(p.key)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors duration-200 cursor-pointer ${
                period === p.key
                  ? 'bg-accent-gold text-bg-base'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Leaderboard Table */}
        <div className="bg-bg-card rounded-xl overflow-hidden border border-border shadow-card">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-accent-gold"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12 px-4">
              <p className="text-status-error mb-4">{error}</p>
              <button
                onClick={() => fetchLeaderboard(period)}
                className="px-4 py-2 bg-bg-surface hover:bg-bg-elevated text-text-primary rounded-lg transition-colors text-sm"
              >
                Try Again
              </button>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-text-secondary text-lg mb-2">No data yet</p>
              <p className="text-text-muted text-sm">
                {period === 'daily'
                  ? 'No winners today yet. Be the first!'
                  : period === 'weekly'
                  ? 'No winners this week yet. Start playing!'
                  : 'No winners recorded yet. Play a game to get on the board!'}
              </p>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-bg-elevated text-xs font-heading font-medium text-text-secondary uppercase tracking-wider">
                <div className="col-span-1">Rank</div>
                <div className="col-span-5">Player</div>
                <div className="col-span-3 text-right">Winnings</div>
                <div className="col-span-3 text-right">Games</div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-border">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-bg-elevated/50 transition-colors ${getRowClass(index)}`}
                  >
                    <div className="col-span-1 flex items-center">
                      {getRankDisplay(index)}
                    </div>
                    <div className="col-span-5 flex items-center">
                      <div className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center text-sm font-bold text-accent-gold mr-3 flex-shrink-0">
                        {entry.username?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <span className={`font-medium truncate ${index < 3 ? 'text-text-primary' : 'text-text-secondary'}`}>
                        {entry.username}
                      </span>
                    </div>
                    <div className={`col-span-3 text-right font-bold ${index === 0 ? 'text-accent-gold-light' : index < 3 ? 'text-accent-gold' : 'text-status-success'}`}>
                      ${parseFloat(entry.totalWinnings || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="col-span-3 text-right text-text-muted">
                      {Number(entry.totalGames || 0).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Info text */}
        <p className="text-center text-text-muted text-sm mt-4">
          Leaderboard updates in real time. Only active players are shown.
        </p>
      </div>
    </MainLayout>
  );
};

export default LeaderboardPage;
