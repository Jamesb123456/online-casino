import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatCard from './charts/StatCard';
import PeriodSelector from './charts/PeriodSelector';
import AnalyticsBarChart from './charts/AnalyticsBarChart';
import AnalyticsPieChart from './charts/AnalyticsPieChart';
import Loading from '../../components/ui/Loading';
import analyticsService from '../../services/admin/analyticsService';

/** Formatting helpers */
const formatCurrency = (val) =>
  `$${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatPercent = (val) => `${Number(val || 0).toFixed(1)}%`;
const formatNumber = (val) => Number(val || 0).toLocaleString();
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/** Per-game brand colors */
const GAME_COLORS = {
  crash: '#EF4444',
  roulette: '#10B981',
  blackjack: '#3B82F6',
  plinko: '#F59E0B',
  wheel: '#8B5CF6',
  landmines: '#F97316',
};

/**
 * GameAnalytics - All-games overview component.
 * Shows summary KPIs, revenue charts, and per-game cards.
 */
const GameAnalytics = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await analyticsService.getAllGamesOverview({ period });
        setData(result);
      } catch (err) {
        console.error('Failed to fetch game analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading size="lg" message="Loading game analytics..." />
      </div>
    );
  }

  if (!data || !data.games || data.games.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-text-primary font-heading">Game Analytics</h1>
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-text-secondary text-lg">No game data available for this period.</p>
        </div>
      </div>
    );
  }

  const { games, totals } = data;

  /** Data for bar chart: house profit per game */
  const barData = games.map((g) => ({
    game: capitalize(g.gameType),
    houseProfit: Number(g.houseProfit || 0),
  }));

  /** Data for pie chart: revenue distribution per game */
  const pieData = games
    .filter((g) => Number(g.houseProfit || 0) > 0)
    .map((g) => ({
      name: capitalize(g.gameType),
      value: Number(g.houseProfit || 0),
      color: GAME_COLORS[g.gameType] || '#6B7280',
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-text-primary font-heading">Game Analytics</h1>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Sessions"
          value={formatNumber(totals.totalSessions)}
          icon={'\uD83C\uDFAE'}
        />
        <StatCard
          label="Total Wagered"
          value={formatCurrency(totals.totalBetsAmount)}
          icon={'\uD83D\uDCB0'}
        />
        <StatCard
          label="House Profit"
          value={formatCurrency(totals.houseProfit)}
          icon={'\uD83D\uDCC8'}
          className={Number(totals.houseProfit) >= 0 ? 'border-status-success/30' : 'border-status-error/30'}
        />
        <StatCard
          label="House Edge"
          value={formatPercent(totals.overallHouseEdge)}
          icon={'%'}
        />
      </div>

      {/* Revenue Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - House Profit by Game */}
        <div className="bg-bg-card rounded-xl border border-white/5 p-6">
          <h2 className="text-lg font-bold text-text-primary font-heading mb-4">
            House Profit by Game
          </h2>
          <AnalyticsBarChart
            data={barData}
            xKey="game"
            bars={[{ dataKey: 'houseProfit', color: '#F59E0B', name: 'House Profit' }]}
            height={300}
            yAxisFormatter={(v) => `$${v}`}
            tooltipFormatter={formatCurrency}
          />
        </div>

        {/* Pie Chart - Revenue Distribution */}
        <div className="bg-bg-card rounded-xl border border-white/5 p-6">
          <h2 className="text-lg font-bold text-text-primary font-heading mb-4">
            Revenue Distribution
          </h2>
          <AnalyticsPieChart
            data={pieData}
            height={300}
            tooltipFormatter={formatCurrency}
          />
        </div>
      </div>

      {/* Per-Game Cards Grid */}
      <div>
        <h2 className="text-lg font-bold text-text-primary font-heading mb-4">
          Games Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {games.map((game) => {
            const color = GAME_COLORS[game.gameType] || '#6B7280';
            const avgBet =
              game.totalSessions > 0
                ? Number(game.totalBetsAmount) / Number(game.totalSessions)
                : 0;

            return (
              <button
                key={game.gameType}
                type="button"
                onClick={() => navigate(`/admin/analytics/games/${game.gameType}`)}
                className="bg-bg-card rounded-xl border border-white/5 hover:border-accent-gold/30 transition-all duration-200 text-left w-full cursor-pointer group"
                aria-label={`View details for ${capitalize(game.gameType)}`}
              >
                <div className="flex h-full">
                  {/* Colored left border */}
                  <div
                    className="w-1.5 rounded-l-xl shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div className="p-5 flex-1 min-w-0">
                    {/* Game name */}
                    <h3 className="text-lg font-bold text-text-primary font-heading mb-3">
                      {capitalize(game.gameType)}
                    </h3>

                    {/* Stats 2x2 mini grid */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <p className="text-xs text-text-muted">Sessions</p>
                        <p className="text-sm font-semibold text-text-primary">
                          {formatNumber(game.totalSessions)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted">House Edge</p>
                        <p className="text-sm font-semibold text-text-primary">
                          {formatPercent(game.houseEdge)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted">Win Rate</p>
                        <p className="text-sm font-semibold text-text-primary">
                          {formatPercent(game.winRate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted">Avg Bet</p>
                        <p className="text-sm font-semibold text-text-primary">
                          {formatCurrency(avgBet)}
                        </p>
                      </div>
                    </div>

                    {/* View Details link */}
                    <p className="text-sm text-accent-gold group-hover:text-accent-gold/80 transition-colors font-medium">
                      View Details &rarr;
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GameAnalytics;
