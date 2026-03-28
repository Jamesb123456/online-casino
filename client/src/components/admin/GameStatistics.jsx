import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import adminService from '../../services/admin/adminService';

/**
 * Game Statistics Component
 * Displays detailed statistics and metrics for casino games
 */
const GameStatistics = () => {
  // Time filter state
  const [timeRange, setTimeRange] = useState('week');
  const [gameFilter, setGameFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Statistics data fetched from API
  const [statistics, setStatistics] = useState({
    totalBets: 0,
    totalWagered: 0,
    houseProfit: 0,
    averageBet: 0,
    gameBreakdown: [],
    dailyData: [],
    topPlayers: []
  });

  useEffect(() => {
    // Fetch game statistics from API
    const fetchGameStatistics = async () => {
      setIsLoading(true);

      try {
        // Call the API with timeRange and gameFilter as parameters
        const response = await adminService.getGameStats({
          timeRange: timeRange,
          gameType: gameFilter !== 'all' ? gameFilter : undefined
        });

        if (response && response.statistics) {
          // Use the real statistics data from the API
          setStatistics(response.statistics);
        } else {
          // Return empty data if API response is unexpected
          console.error('API returned unexpected format for game statistics');
          setStatistics({
            totalBets: 0,
            totalWagered: 0,
            houseProfit: 0,
            averageBet: 0,
            gameBreakdown: [],
            dailyData: [],
            topPlayers: []
          });
        }
      } catch (error) {
        console.error('Error fetching game statistics:', error);
        // Return empty data if API call fails
        setStatistics({
          totalBets: 0,
          totalWagered: 0,
          houseProfit: 0,
          averageBet: 0,
          gameBreakdown: [],
          dailyData: [],
          topPlayers: [],
          error: 'Failed to load statistics. Please try again later.'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchGameStatistics();
  }, [timeRange, gameFilter]);

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-text-primary">Game Statistics</h1>

      {/* Filters */}
      <div className="bg-bg-card rounded-xl p-4 border border-border shadow-card">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center">
            <label htmlFor="admin-time-range" className="mr-2 text-text-muted" aria-hidden="true">{'\uD83D\uDCC5'}</label>
            <select
              id="admin-time-range"
              className="bg-bg-elevated border border-border-light rounded-lg p-2 text-text-primary cursor-pointer"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <option value="day">Last 24 Hours</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="year">Last Year</option>
            </select>
          </div>

          <div className="flex items-center">
            <label htmlFor="admin-game-filter" className="mr-2 text-text-muted" aria-hidden="true">{'\uD83D\uDD0D'}</label>
            <select
              id="admin-game-filter"
              className="bg-bg-elevated border border-border-light rounded-lg p-2 text-text-primary cursor-pointer"
              value={gameFilter}
              onChange={(e) => setGameFilter(e.target.value)}
            >
              <option value="all">All Games</option>
              <option value="crash">Crash</option>
              <option value="plinko">Plinko</option>
              <option value="wheel">Wheel</option>
              <option value="roulette">Roulette</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-gold"></div>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-bg-card rounded-xl p-5 border border-border shadow-card">
              <div className="text-center">
                <h2 className="text-text-muted text-sm">Total Bets</h2>
                <p className="text-3xl font-bold text-text-primary">{statistics.totalBets.toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-bg-card rounded-xl p-5 border border-border shadow-card">
              <div className="text-center">
                <h2 className="text-text-muted text-sm">Total Wagered</h2>
                <p className="text-3xl font-bold text-text-primary">{formatCurrency(statistics.totalWagered)}</p>
              </div>
            </div>

            <div className="bg-bg-card rounded-xl p-5 border border-border shadow-card">
              <div className="text-center">
                <h2 className="text-text-muted text-sm">House Profit</h2>
                <p className="text-3xl font-bold text-status-success">{formatCurrency(statistics.houseProfit)}</p>
              </div>
            </div>

            <div className="bg-bg-card rounded-xl p-5 border border-border shadow-card">
              <div className="text-center">
                <h2 className="text-text-muted text-sm">Average Bet</h2>
                <p className="text-3xl font-bold text-text-primary">{formatCurrency(statistics.averageBet)}</p>
              </div>
            </div>
          </div>

          {/* Game Breakdown */}
          <div className="bg-bg-card rounded-xl p-6 border border-border shadow-card">
            <div className="flex items-center mb-4">
              <span className="mr-2 text-accent-gold text-xl" aria-hidden="true">{'\uD83D\uDCCA'}</span>
              <h2 className="text-xl font-bold text-text-primary">Game Performance</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-3 px-4 text-text-secondary font-medium">Game</th>
                    <th className="py-3 px-4 text-text-secondary font-medium">Bets Placed</th>
                    <th className="py-3 px-4 text-text-secondary font-medium">Total Wagered</th>
                    <th className="py-3 px-4 text-text-secondary font-medium">House Profit</th>
                    <th className="py-3 px-4 text-text-secondary font-medium">Effective Edge</th>
                  </tr>
                </thead>
                <tbody>
                  {statistics.gameBreakdown.map((game, index) => (
                    <tr key={index} className="border-b border-border hover:bg-bg-elevated/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-text-primary">{game.name}</td>
                      <td className="py-3 px-4 text-text-secondary">{game.bets.toLocaleString()}</td>
                      <td className="py-3 px-4 text-text-secondary">{formatCurrency(game.wagered)}</td>
                      <td className="py-3 px-4 text-status-success">{formatCurrency(game.profit)}</td>
                      <td className="py-3 px-4 text-text-secondary">{formatPercentage(game.edge)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Visual Representation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-bg-card rounded-xl p-6 border border-border shadow-card">
              <h2 className="text-xl font-bold mb-4 text-text-primary">Daily Activity</h2>
              <div className="h-64 flex items-end justify-between pt-4 px-2">
                {statistics.dailyData.slice(-7).map((day, index) => {
                  // Maximum value for scaling
                  const maxBets = Math.max(...statistics.dailyData.slice(-7).map(d => d.bets));
                  const height = `${(day.bets / maxBets) * 100}%`;

                  return (
                    <div key={index} className="flex flex-col items-center">
                      <div className="relative mb-2" style={{ height: "200px" }}>
                        <div
                          className="w-8 bg-accent-gold hover:bg-accent-gold-light transition-all rounded-t-sm"
                          style={{ height, marginTop: `calc(200px - ${height})` }}
                        ></div>
                      </div>
                      <div className="text-xs text-text-muted">{day.date.split('-')[2]}</div>
                    </div>
                  );
                })}
              </div>
              <div className="text-center mt-2 text-sm text-text-muted">Daily Bets</div>
            </div>

            <div className="bg-bg-card rounded-xl p-6 border border-border shadow-card">
              <h2 className="text-xl font-bold mb-4 text-text-primary">Distribution by Game</h2>
              {statistics.gameBreakdown.length > 0 && (
                <div className="h-64 flex items-center justify-center">
                  <div className="relative h-48 w-48 rounded-full overflow-hidden flex flex-col justify-center items-center">
                    {/* Simplified pie chart representation */}
                    {statistics.gameBreakdown.map((game, index) => {
                      const totalWagered = statistics.gameBreakdown.reduce(
                        (sum, g) => sum + g.wagered, 0
                      );
                      const percentage = game.wagered / totalWagered;

                      // Generate colors based on index
                      const colors = [
                        'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
                        'bg-purple-500', 'bg-red-500', 'bg-indigo-500'
                      ];

                      return (
                        <div
                          key={index}
                          className="absolute text-xs text-text-primary p-1 text-center"
                          style={{
                            left: `${50 + Math.cos(index * (2 * Math.PI / statistics.gameBreakdown.length)) * 70}px`,
                            top: `${50 + Math.sin(index * (2 * Math.PI / statistics.gameBreakdown.length)) * 70}px`,
                          }}
                        >
                          <span className={`inline-block w-3 h-3 rounded-full mr-1 ${colors[index % colors.length]}`}></span>
                          {game.name}
                          <br/>
                          {formatPercentage(percentage)}
                        </div>
                      );
                    })}
                    <div className="bg-bg-elevated h-24 w-24 rounded-full flex items-center justify-center">
                      <span className="text-lg font-bold text-text-primary">
                        {formatCurrency(statistics.totalWagered)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top Players */}
          <div className="bg-bg-card rounded-xl p-6 border border-border shadow-card">
            <h2 className="text-xl font-bold mb-4 text-text-primary">Top Players by Volume</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-3 px-4 text-text-secondary font-medium">Username</th>
                    <th className="py-3 px-4 text-text-secondary font-medium">Total Wagered</th>
                    <th className="py-3 px-4 text-text-secondary font-medium">Games Played</th>
                    <th className="py-3 px-4 text-text-secondary font-medium">Net Profit/Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {statistics.topPlayers.map((player, index) => (
                    <tr key={index} className="border-b border-border hover:bg-bg-elevated/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-text-primary">{player.username}</td>
                      <td className="py-3 px-4 text-text-secondary">{formatCurrency(player.totalWagered)}</td>
                      <td className="py-3 px-4 text-text-secondary">{player.gamesPlayed.toLocaleString()}</td>
                      <td className={`py-3 px-4 ${player.netProfit >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                        {formatCurrency(player.netProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default GameStatistics;
