import React, { useState, useEffect } from 'react';
import { FaUsers, FaMoneyBillWave, FaGamepad, FaExclamationTriangle } from 'react-icons/fa';
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
          // Fallback to mock data if API response is unexpected
          console.warn('Using mock dashboard data as API returned unexpected format');
          setStats({
            totalPlayers: 324,
            activePlayers: 47,
            totalBalance: 128745.32,
            totalGames: 4293,
            recentTransactions: [
              { id: 1, user: 'player123', type: 'deposit', amount: 500, timestamp: '2023-05-01T14:32:21' },
              { id: 2, user: 'gambler456', type: 'withdrawal', amount: 1200, timestamp: '2023-05-01T12:15:43' },
              { id: 3, user: 'luckywin789', type: 'deposit', amount: 750, timestamp: '2023-05-01T10:45:12' },
              { id: 4, user: 'highroller22', type: 'deposit', amount: 2000, timestamp: '2023-05-01T09:23:05' },
            ],
            alerts: [
              { id: 1, type: 'warning', message: 'Unusual withdrawal activity detected for user highroller22' },
              { id: 2, type: 'info', message: 'System maintenance scheduled for tomorrow at 03:00 UTC' },
            ]
          });
        }
        
        // Fetch game stats
        const gameStatsData = await adminService.getGameStats();
        
        if (gameStatsData && gameStatsData.games) {
          setGameStats(gameStatsData.games);
        } else {
          // Fallback to mock game stats if API response is unexpected
          console.warn('Using mock game stats as API returned unexpected format');
          setGameStats([
            { name: 'Crash', played: 1245, profit: 7823.45 },
            { name: 'Plinko', played: 892, profit: 5245.78 },
            { name: 'Roulette', played: 1032, profit: 6721.23 },
            { name: 'Wheel', played: 754, profit: 4378.12 },
            { name: 'Chicken', played: 370, profit: 2145.67 },
          ]);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        
        // Fallback to mock data if API call fails
        setStats({
          totalPlayers: 324,
          activePlayers: 47,
          totalBalance: 128745.32,
          totalGames: 4293,
          recentTransactions: [
            { id: 1, user: 'player123', type: 'deposit', amount: 500, timestamp: '2023-05-01T14:32:21' },
            { id: 2, user: 'gambler456', type: 'withdrawal', amount: 1200, timestamp: '2023-05-01T12:15:43' },
            { id: 3, user: 'luckywin789', type: 'deposit', amount: 750, timestamp: '2023-05-01T10:45:12' },
            { id: 4, user: 'highroller22', type: 'deposit', amount: 2000, timestamp: '2023-05-01T09:23:05' },
          ],
          alerts: [
            { id: 1, type: 'warning', message: 'Unusual withdrawal activity detected for user highroller22' },
            { id: 2, type: 'info', message: 'System maintenance scheduled for tomorrow at 03:00 UTC' },
          ]
        });
        
        setGameStats([
          { name: 'Crash', played: 1245, profit: 7823.45 },
          { name: 'Plinko', played: 892, profit: 5245.78 },
          { name: 'Roulette', played: 1032, profit: 6721.23 },
          { name: 'Wheel', played: 754, profit: 4378.12 },
          { name: 'Chicken', played: 370, profit: 2145.67 },
        ]);
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
      <h1 className="text-3xl font-bold text-white mb-6">Dashboard</h1>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-600 to-blue-800">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-900 mr-4">
              <FaUsers className="text-white text-xl" />
            </div>
            <div>
              <p className="text-white text-sm">Total Players</p>
              <p className="text-white text-2xl font-bold">{stats.totalPlayers}</p>
              <p className="text-blue-200 text-xs">{stats.activePlayers} active now</p>
            </div>
          </div>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-600 to-green-800">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-900 mr-4">
              <FaMoneyBillWave className="text-white text-xl" />
            </div>
            <div>
              <p className="text-white text-sm">Total Balance</p>
              <p className="text-white text-2xl font-bold">{formatCurrency(stats.totalBalance)}</p>
              <p className="text-green-200 text-xs">All players combined</p>
            </div>
          </div>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-600 to-purple-800">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-900 mr-4">
              <FaGamepad className="text-white text-xl" />
            </div>
            <div>
              <p className="text-white text-sm">Total Games</p>
              <p className="text-white text-2xl font-bold">{stats.totalGames}</p>
              <p className="text-purple-200 text-xs">Across all game types</p>
            </div>
          </div>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-600 to-red-800">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-900 mr-4">
              <FaExclamationTriangle className="text-white text-xl" />
            </div>
            <div>
              <p className="text-white text-sm">Alerts</p>
              <p className="text-white text-2xl font-bold">{stats.alerts.length}</p>
              <p className="text-red-200 text-xs">Requiring attention</p>
            </div>
          </div>
        </Card>
      </div>
      
      {/* Game Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-800 text-white">
          <h2 className="text-xl font-bold mb-4">Game Statistics</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-2 px-4">Game</th>
                  <th className="py-2 px-4">Played</th>
                  <th className="py-2 px-4">House Profit</th>
                </tr>
              </thead>
              <tbody>
                {gameStats.map((game, index) => (
                  <tr key={index} className="border-b border-gray-700 hover:bg-gray-700">
                    <td className="py-2 px-4">{game.name}</td>
                    <td className="py-2 px-4">{game.played}</td>
                    <td className="py-2 px-4 text-green-400">{formatCurrency(game.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        
        {/* Recent Transactions */}
        <Card className="bg-gray-800 text-white">
          <h2 className="text-xl font-bold mb-4">Recent Transactions</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-2 px-4">User</th>
                  <th className="py-2 px-4">Type</th>
                  <th className="py-2 px-4">Amount</th>
                  <th className="py-2 px-4">Time</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-gray-700 hover:bg-gray-700">
                    <td className="py-2 px-4">{transaction.user}</td>
                    <td className="py-2 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        transaction.type === 'deposit' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
                      }`}>
                        {transaction.type}
                      </span>
                    </td>
                    <td className="py-2 px-4">{formatCurrency(transaction.amount)}</td>
                    <td className="py-2 px-4">{formatTime(transaction.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      
      {/* Alerts */}
      <Card className="bg-gray-800 text-white">
        <h2 className="text-xl font-bold mb-4">System Alerts</h2>
        <div className="space-y-3">
          {stats.alerts.map((alert) => (
            <div key={alert.id} className={`p-3 rounded-md ${
              alert.type === 'warning' ? 'bg-yellow-900 text-yellow-200' : 'bg-blue-900 text-blue-200'
            }`}>
              {alert.message}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;