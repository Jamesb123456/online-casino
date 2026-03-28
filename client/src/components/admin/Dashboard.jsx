import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import adminService from '../../services/admin/adminService';

/**
 * Admin Dashboard Overview Component
 * Displays key statistics and metrics for the casino
 */
const Dashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPlayers: 0,
    activePlayers: 0,
    totalBalance: 0,
    totalGames: 0,
    recentTransactions: [],
    alerts: []
  });
  const [gameStats, setGameStats] = useState([]);

  // Fetch dashboard data from API
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);

        // Fetch both in parallel since they're independent
        const [dashboardStats, gameStatsData] = await Promise.all([
          adminService.getDashboardStats(),
          adminService.getGameStats()
        ]);

        if (dashboardStats) {
          setStats(dashboardStats);
        } else {
          setStats({
            totalPlayers: 0,
            activePlayers: 0,
            totalBalance: 0,
            totalGames: 0,
            recentTransactions: [],
            alerts: []
          });
        }

        if (gameStatsData && gameStatsData.games) {
          setGameStats(gameStatsData.games);
        } else {
          setGameStats([]);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);

        // Empty state data if API call fails
        setStats({
          totalPlayers: 0,
          activePlayers: 0,
          totalBalance: 0,
          totalGames: 0,
          recentTransactions: [],
          alerts: [{
            id: Date.now(),
            type: 'warning',
            message: 'Failed to load dashboard data. Please try again later.'
          }]
        });

        setGameStats([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-text-primary mb-6">Dashboard</h1>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">Total Players</p>
              <p className="text-white text-2xl font-bold">{stats.totalPlayers}</p>
              <p className="text-blue-200 text-xs">{stats.activePlayers} active now</p>
            </div>
            <div className="text-3xl" aria-hidden="true">{'\uD83D\uDC65'}</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">Total Balance</p>
              <p className="text-white text-2xl font-bold">{formatCurrency(stats.totalBalance)}</p>
              <p className="text-emerald-200 text-xs">All players combined</p>
            </div>
            <div className="text-3xl" aria-hidden="true">{'\uD83D\uDCB0'}</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">Total Games</p>
              <p className="text-white text-2xl font-bold">{stats.totalGames}</p>
              <p className="text-purple-200 text-xs">Across all game types</p>
            </div>
            <div className="text-3xl" aria-hidden="true">{'\uD83C\uDFAE'}</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">Alerts</p>
              <p className="text-white text-2xl font-bold">{stats.alerts?.length ?? 0}</p>
              <p className="text-red-200 text-xs">Requiring attention</p>
            </div>
            <div className="text-3xl" aria-hidden="true">{'\u26A0\uFE0F'}</div>
          </div>
        </div>
      </div>

      {/* Game Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-bg-card rounded-xl p-6 shadow-card border border-border">
          <h2 className="text-xl font-bold mb-4 text-text-primary flex items-center">
            <span className="mr-2" aria-hidden="true">{'\uD83D\uDCC8'}</span>
            Game Statistics
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 px-4 text-text-secondary font-medium">Game</th>
                  <th className="py-3 px-4 text-text-secondary font-medium">Played</th>
                  <th className="py-3 px-4 text-text-secondary font-medium">House Profit</th>
                </tr>
              </thead>
              <tbody>
                {gameStats.map((game, index) => (
                  <tr key={index} className="border-b border-border hover:bg-bg-elevated/50 transition-colors">
                    <td className="py-3 px-4 text-text-primary font-medium">{game.name}</td>
                    <td className="py-3 px-4 text-text-secondary">{game.played.toLocaleString()}</td>
                    <td className="py-3 px-4 text-status-success font-semibold">{formatCurrency(game.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-bg-card rounded-xl p-6 shadow-card border border-border">
          <h2 className="text-xl font-bold mb-4 text-text-primary flex items-center">
            <span className="mr-2" aria-hidden="true">{'\uD83D\uDCB3'}</span>
            Recent Transactions
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 px-4 text-text-secondary font-medium">User</th>
                  <th className="py-3 px-4 text-text-secondary font-medium">Type</th>
                  <th className="py-3 px-4 text-text-secondary font-medium">Amount</th>
                  <th className="py-3 px-4 text-text-secondary font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {(stats.recentTransactions ?? []).map((transaction) => (
                  <tr key={transaction.id} className="border-b border-border hover:bg-bg-elevated/50 transition-colors">
                    <td className="py-3 px-4 text-text-primary font-medium">{transaction.user}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        transaction.type === 'deposit' ? 'bg-status-success/15 text-status-success border border-status-success/30' : 'bg-status-error/15 text-status-error border border-status-error/30'
                      }`}>
                        {transaction.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-text-secondary font-semibold">{formatCurrency(transaction.amount)}</td>
                    <td className="py-3 px-4 text-text-muted">{formatTime(transaction.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-bg-card rounded-xl p-6 shadow-card border border-border">
        <h2 className="text-xl font-bold mb-4 text-text-primary flex items-center">
          <span className="mr-2" aria-hidden="true">{'\uD83D\uDD14'}</span>
          System Alerts
        </h2>
        <div className="space-y-3">
          {(stats.alerts ?? []).map((alert) => (
            <div key={alert.id} className={`p-4 rounded-lg border ${
              alert.type === 'warning'
                ? 'bg-status-warning/10 text-status-warning border-status-warning/30'
                : 'bg-status-info/10 text-status-info border-status-info/30'
            }`}>
              <div className="flex items-start">
                <span className="mr-2 text-lg" aria-hidden="true">
                  {alert.type === 'warning' ? '\u26A0\uFE0F' : '\u2139\uFE0F'}
                </span>
                <span>{alert.message}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
