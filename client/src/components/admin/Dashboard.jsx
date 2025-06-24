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
        
        // Fetch dashboard stats
        const dashboardStats = await adminService.getDashboardStats();
        
        if (dashboardStats) {
          setStats(dashboardStats);
        } else {
          console.error('API returned unexpected format for dashboard stats');
          setStats({
            totalPlayers: 0,
            activePlayers: 0,
            totalBalance: 0,
            totalGames: 0,
            recentTransactions: [],
            alerts: []
          });
        }
        
        // Fetch game stats
        const gameStatsData = await adminService.getGameStats();
        
        if (gameStatsData && gameStatsData.games) {
          setGameStats(gameStatsData.games);
        } else {
          console.error('API returned unexpected format for game stats');
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
      <h1 className="text-3xl font-bold text-white mb-6">📊 Dashboard</h1>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">Total Players</p>
              <p className="text-white text-2xl font-bold">{stats.totalPlayers}</p>
              <p className="text-blue-200 text-xs">{stats.activePlayers} active now</p>
            </div>
            <div className="text-3xl">👥</div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">Total Balance</p>
              <p className="text-white text-2xl font-bold">{formatCurrency(stats.totalBalance)}</p>
              <p className="text-green-200 text-xs">All players combined</p>
            </div>
            <div className="text-3xl">💰</div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">Total Games</p>
              <p className="text-white text-2xl font-bold">{stats.totalGames}</p>
              <p className="text-purple-200 text-xs">Across all game types</p>
            </div>
            <div className="text-3xl">🎮</div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">Alerts</p>
              <p className="text-white text-2xl font-bold">{stats.alerts.length}</p>
              <p className="text-red-200 text-xs">Requiring attention</p>
            </div>
            <div className="text-3xl">⚠️</div>
          </div>
        </div>
      </div>
      
      {/* Game Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
          <h2 className="text-xl font-bold mb-4 text-white flex items-center">
            <span className="mr-2">📈</span>
            Game Statistics
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="py-3 px-4 text-gray-300 font-medium">Game</th>
                  <th className="py-3 px-4 text-gray-300 font-medium">Played</th>
                  <th className="py-3 px-4 text-gray-300 font-medium">House Profit</th>
                </tr>
              </thead>
              <tbody>
                {gameStats.map((game, index) => (
                  <tr key={index} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                    <td className="py-3 px-4 text-white font-medium">{game.name}</td>
                    <td className="py-3 px-4 text-gray-300">{game.played.toLocaleString()}</td>
                    <td className="py-3 px-4 text-green-400 font-semibold">{formatCurrency(game.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Recent Transactions */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
          <h2 className="text-xl font-bold mb-4 text-white flex items-center">
            <span className="mr-2">💳</span>
            Recent Transactions
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="py-3 px-4 text-gray-300 font-medium">User</th>
                  <th className="py-3 px-4 text-gray-300 font-medium">Type</th>
                  <th className="py-3 px-4 text-gray-300 font-medium">Amount</th>
                  <th className="py-3 px-4 text-gray-300 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                    <td className="py-3 px-4 text-white font-medium">{transaction.user}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        transaction.type === 'deposit' ? 'bg-green-900/50 text-green-300 border border-green-700' : 'bg-red-900/50 text-red-300 border border-red-700'
                      }`}>
                        {transaction.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-300 font-semibold">{formatCurrency(transaction.amount)}</td>
                    <td className="py-3 px-4 text-gray-400">{formatTime(transaction.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Alerts */}
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
        <h2 className="text-xl font-bold mb-4 text-white flex items-center">
          <span className="mr-2">🔔</span>
          System Alerts
        </h2>
        <div className="space-y-3">
          {stats.alerts.map((alert) => (
            <div key={alert.id} className={`p-4 rounded-md border ${
              alert.type === 'warning' 
                ? 'bg-yellow-900/30 text-yellow-200 border-yellow-700' 
                : 'bg-blue-900/30 text-blue-200 border-blue-700'
            }`}>
              <div className="flex items-start">
                <span className="mr-2 text-lg">
                  {alert.type === 'warning' ? '⚠️' : 'ℹ️'}
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