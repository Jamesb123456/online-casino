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
  
  // Mock statistics data - would be fetched from API in real app
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
          // Fallback to mock data if API response is unexpected
          console.warn('Using mock game statistics as API returned unexpected format');
          const mockData = generateMockData(timeRange, gameFilter);
          setStatistics(mockData);
        }
      } catch (error) {
        console.error('Error fetching game statistics:', error);
        // Fallback to mock data if API call fails
        const mockData = generateMockData(timeRange, gameFilter);
        setStatistics(mockData);
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
  
  // Generate mock data based on filters
  const generateMockData = (timeRange, gameFilter) => {
    // Base data
    const games = ['Crash', 'Plinko', 'Wheel', 'Roulette', 'Chicken'];
    let multiplier = 1;
    
    // Adjust data volume based on time range
    switch (timeRange) {
      case 'day':
        multiplier = 1;
        break;
      case 'week':
        multiplier = 7;
        break;
      case 'month':
        multiplier = 30;
        break;
      case 'year':
        multiplier = 365;
        break;
      default:
        multiplier = 7;
    }
    
    // Generate game breakdown
    const gameBreakdown = games.map(game => {
      const bets = Math.floor(Math.random() * 1000 + 100) * multiplier;
      const wagered = Math.floor(Math.random() * 10000 + 1000) * multiplier;
      const profit = wagered * (Math.random() * 0.1 + 0.02); // 2-12% house edge
      
      return {
        name: game,
        bets,
        wagered,
        profit,
        edge: profit / wagered
      };
    });
    
    // Filter by game if needed
    const filteredBreakdown = gameFilter === 'all' 
      ? gameBreakdown 
      : gameBreakdown.filter(game => game.name.toLowerCase() === gameFilter.toLowerCase());
    
    // Daily data for charts (last 7 days or adjusted based on timeRange)
    const days = timeRange === 'day' ? 1 : 
                timeRange === 'week' ? 7 : 
                timeRange === 'month' ? 30 : 365;
                
    const dailyData = Array(days).fill(0).map((_, index) => {
      // Get date string
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - index));
      
      return {
        date: date.toISOString().split('T')[0],
        bets: Math.floor(Math.random() * 1000 + 100),
        profit: Math.floor(Math.random() * 1000 + 100),
        uniquePlayers: Math.floor(Math.random() * 100 + 10)
      };
    });
    
    // Top players
    const topPlayers = [
      {
        username: 'highroller22',
        totalWagered: 75000 * multiplier,
        gamesPlayed: 450 * multiplier,
        netProfit: -5200 * multiplier
      },
      {
        username: 'luckywin789',
        totalWagered: 52000 * multiplier,
        gamesPlayed: 320 * multiplier,
        netProfit: 3700 * multiplier
      },
      {
        username: 'gambler456',
        totalWagered: 47500 * multiplier,
        gamesPlayed: 290 * multiplier,
        netProfit: -1850 * multiplier
      },
      {
        username: 'player123',
        totalWagered: 31000 * multiplier,
        gamesPlayed: 210 * multiplier,
        netProfit: -950 * multiplier
      },
      {
        username: 'casinoking',
        totalWagered: 28500 * multiplier,
        gamesPlayed: 180 * multiplier,
        netProfit: -1200 * multiplier
      }
    ];
    
    // Calculate totals
    const totalBets = filteredBreakdown.reduce((sum, game) => sum + game.bets, 0);
    const totalWagered = filteredBreakdown.reduce((sum, game) => sum + game.wagered, 0);
    const houseProfit = filteredBreakdown.reduce((sum, game) => sum + game.profit, 0);
    const averageBet = totalBets > 0 ? totalWagered / totalBets : 0;
    
    return {
      totalBets,
      totalWagered,
      houseProfit,
      averageBet,
      gameBreakdown: filteredBreakdown,
      dailyData,
      topPlayers
    };
  };
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Game Statistics</h1>
      
      {/* Filters */}
      <Card className="bg-gray-800 text-white">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center">
            <FaCalendarAlt className="mr-2 text-gray-400" />
            <select
              className="bg-gray-700 border border-gray-600 rounded-md p-2"
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
            <FaFilter className="mr-2 text-gray-400" />
            <select
              className="bg-gray-700 border border-gray-600 rounded-md p-2"
              value={gameFilter}
              onChange={(e) => setGameFilter(e.target.value)}
            >
              <option value="all">All Games</option>
              <option value="crash">Crash</option>
              <option value="plinko">Plinko</option>
              <option value="wheel">Wheel</option>
              <option value="roulette">Roulette</option>
              <option value="chicken">Chicken</option>
            </select>
          </div>
        </div>
      </Card>
      
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gray-800 text-white">
              <div className="text-center">
                <h3 className="text-gray-400">Total Bets</h3>
                <p className="text-3xl font-bold">{statistics.totalBets.toLocaleString()}</p>
              </div>
            </Card>
            
            <Card className="bg-gray-800 text-white">
              <div className="text-center">
                <h3 className="text-gray-400">Total Wagered</h3>
                <p className="text-3xl font-bold">{formatCurrency(statistics.totalWagered)}</p>
              </div>
            </Card>
            
            <Card className="bg-gray-800 text-white">
              <div className="text-center">
                <h3 className="text-gray-400">House Profit</h3>
                <p className="text-3xl font-bold text-green-400">{formatCurrency(statistics.houseProfit)}</p>
              </div>
            </Card>
            
            <Card className="bg-gray-800 text-white">
              <div className="text-center">
                <h3 className="text-gray-400">Average Bet</h3>
                <p className="text-3xl font-bold">{formatCurrency(statistics.averageBet)}</p>
              </div>
            </Card>
          </div>
          
          {/* Game Breakdown */}
          <Card className="bg-gray-800 text-white">
            <div className="flex items-center mb-4">
              <FaChartBar className="mr-2 text-blue-400" />
              <h2 className="text-xl font-bold">Game Performance</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="py-3 px-4">Game</th>
                    <th className="py-3 px-4">Bets Placed</th>
                    <th className="py-3 px-4">Total Wagered</th>
                    <th className="py-3 px-4">House Profit</th>
                    <th className="py-3 px-4">Effective Edge</th>
                  </tr>
                </thead>
                <tbody>
                  {statistics.gameBreakdown.map((game, index) => (
                    <tr key={index} className="border-b border-gray-700 hover:bg-gray-700">
                      <td className="py-3 px-4 font-medium">{game.name}</td>
                      <td className="py-3 px-4">{game.bets.toLocaleString()}</td>
                      <td className="py-3 px-4">{formatCurrency(game.wagered)}</td>
                      <td className="py-3 px-4 text-green-400">{formatCurrency(game.profit)}</td>
                      <td className="py-3 px-4">{formatPercentage(game.edge)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          
          {/* Visual Representation - In a real app would use Chart.js or similar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-800 text-white">
              <h2 className="text-xl font-bold mb-4">Daily Activity</h2>
              <div className="h-64 flex items-end justify-between pt-4 px-2">
                {statistics.dailyData.slice(-7).map((day, index) => {
                  // Maximum value for scaling
                  const maxBets = Math.max(...statistics.dailyData.slice(-7).map(d => d.bets));
                  const height = `${(day.bets / maxBets) * 100}%`;
                  
                  return (
                    <div key={index} className="flex flex-col items-center">
                      <div className="relative mb-2" style={{ height: "200px" }}>
                        <div 
                          className="w-8 bg-blue-600 hover:bg-blue-500 transition-all rounded-t-sm"
                          style={{ height, marginTop: `calc(200px - ${height})` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-400">{day.date.split('-')[2]}</div>
                    </div>
                  );
                })}
              </div>
              <div className="text-center mt-2 text-sm text-gray-400">Daily Bets</div>
            </Card>
            
            <Card className="bg-gray-800 text-white">
              <h2 className="text-xl font-bold mb-4">Distribution by Game</h2>
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
                        'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
                        'bg-purple-500', 'bg-red-500', 'bg-indigo-500'
                      ];
                      
                      return (
                        <div 
                          key={index}
                          className="absolute text-xs text-white p-1 text-center"
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
                    <div className="bg-gray-700 h-24 w-24 rounded-full flex items-center justify-center">
                      <span className="text-lg font-bold">
                        {formatCurrency(statistics.totalWagered)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
          
          {/* Top Players */}
          <Card className="bg-gray-800 text-white">
            <h2 className="text-xl font-bold mb-4">Top Players by Volume</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">Total Wagered</th>
                    <th className="py-3 px-4">Games Played</th>
                    <th className="py-3 px-4">Net Profit/Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {statistics.topPlayers.map((player, index) => (
                    <tr key={index} className="border-b border-gray-700 hover:bg-gray-700">
                      <td className="py-3 px-4 font-medium">{player.username}</td>
                      <td className="py-3 px-4">{formatCurrency(player.totalWagered)}</td>
                      <td className="py-3 px-4">{player.gamesPlayed.toLocaleString()}</td>
                      <td className={`py-3 px-4 ${player.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(player.netProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default GameStatistics;