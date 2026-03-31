import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StatCard from './charts/StatCard';
import PeriodSelector from './charts/PeriodSelector';
import AnalyticsLineChart from './charts/AnalyticsLineChart';
import Loading from '../../components/ui/Loading';
import analyticsService from '../../services/admin/analyticsService';

/** Formatting helpers */
const formatCurrency = (val) =>
  `$${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatPercent = (val) => `${Number(val || 0).toFixed(1)}%`;
const formatNumber = (val) => Number(val || 0).toLocaleString();
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/**
 * Format seconds into "Xm Ys" display string.
 * @param {number} seconds
 */
const formatDuration = (seconds) => {
  const s = Number(seconds || 0);
  const m = Math.floor(s / 60);
  const remainder = Math.round(s % 60);
  if (m === 0) return `${remainder}s`;
  return `${m}m ${remainder}s`;
};

/**
 * Format a date string (YYYY-MM-DD) to a shorter display format.
 */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * GameDetail - Per-game deep dive analytics component.
 * Reads gameType from URL params and shows detailed metrics,
 * time-series charts, and top players table.
 */
const GameDetail = () => {
  const { gameType } = useParams();
  const navigate = useNavigate();
  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await analyticsService.getGameDetail(gameType, { period });
        setData(result);
      } catch (err) {
        console.error(`Failed to fetch detail for ${gameType}:`, err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [gameType, period]);

  // Update page title when gameType changes
  useEffect(() => {
    if (gameType) {
      document.title = `${capitalize(gameType)} Analytics | Platinum Casino`;
    }
  }, [gameType]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading size="lg" message={`Loading ${capitalize(gameType)} analytics...`} />
      </div>
    );
  }

  if (!data || !data.summary) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/admin/analytics/games')}
            className="text-text-secondary hover:text-text-primary transition-colors text-sm font-medium cursor-pointer"
          >
            &larr; All Games
          </button>
          <h1 className="text-3xl font-bold text-text-primary font-heading">
            {capitalize(gameType)}
          </h1>
        </div>
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-text-secondary text-lg">No data available for this game and period.</p>
        </div>
      </div>
    );
  }

  const { summary, timeSeries = [], topPlayers = [] } = data;

  /** Prepare time-series data with formatted dates */
  const chartData = timeSeries.map((d) => ({
    ...d,
    label: formatDate(d.date),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/admin/analytics/games')}
            className="text-text-secondary hover:text-text-primary transition-colors text-sm font-medium cursor-pointer"
          >
            &larr; All Games
          </button>
          <h1 className="text-3xl font-bold text-text-primary font-heading">
            {capitalize(gameType)}
          </h1>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Sessions"
          value={formatNumber(summary.totalSessions)}
          icon={'\uD83C\uDFAE'}
        />
        <StatCard
          label="Total Wagered"
          value={formatCurrency(summary.totalBetsAmount)}
          icon={'\uD83D\uDCB0'}
        />
        <StatCard
          label="House Profit"
          value={formatCurrency(summary.houseProfit)}
          icon={'\uD83D\uDCC8'}
          className={Number(summary.houseProfit) >= 0 ? 'border-status-success/30' : 'border-status-error/30'}
        />
        <StatCard
          label="House Edge"
          value={formatPercent(summary.houseEdge)}
          icon={'%'}
        />
        <StatCard
          label="Win Rate"
          value={formatPercent(summary.winRate)}
          icon={'\u2705'}
        />
        <StatCard
          label="Unique Players"
          value={formatNumber(summary.uniquePlayers)}
          icon={'\uD83D\uDC65'}
        />
      </div>

      {/* Win / Loss / Push Breakdown Badges */}
      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-status-success/10 text-status-success border border-status-success/20">
          Win: {formatPercent(summary.winRate)}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-status-error/10 text-status-error border border-status-error/20">
          Loss: {formatPercent(summary.lossRate)}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-bg-elevated text-text-muted border border-white/10">
          Push: {formatPercent(summary.pushRate)}
        </span>
      </div>

      {/* Time Series Chart */}
      <div className="bg-bg-card rounded-xl border border-white/5 p-6">
        <h2 className="text-lg font-bold text-text-primary font-heading mb-4">
          Performance Over Time
        </h2>
        <AnalyticsLineChart
          data={chartData}
          xKey="label"
          lines={[
            { dataKey: 'betsAmount', color: '#F59E0B', name: 'Bets' },
            { dataKey: 'payoutsAmount', color: '#7C3AED', name: 'Payouts' },
            { dataKey: 'profit', color: '#10B981', name: 'Profit' },
          ]}
          height={350}
          yAxisFormatter={(v) => `$${v}`}
          tooltipFormatter={formatCurrency}
        />
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Detailed Stats Card */}
        <div className="bg-bg-card rounded-xl border border-white/5 p-6">
          <h2 className="text-lg font-bold text-text-primary font-heading mb-4">
            Detailed Statistics
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-text-muted mb-1">Average Bet</p>
              <p className="text-xl font-bold text-text-primary font-heading">
                {formatCurrency(summary.averageBet)}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-muted mb-1">Max Bet</p>
              <p className="text-xl font-bold text-text-primary font-heading">
                {formatCurrency(summary.maxBet)}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-muted mb-1">Avg Multiplier</p>
              <p className="text-xl font-bold text-text-primary font-heading">
                {Number(summary.averageMultiplier || 0).toFixed(2)}x
              </p>
            </div>
            <div>
              <p className="text-sm text-text-muted mb-1">Avg Session Duration</p>
              <p className="text-xl font-bold text-text-primary font-heading">
                {formatDuration(summary.avgSessionDuration)}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats Mini Card */}
        <div className="bg-bg-card rounded-xl border border-white/5 p-6">
          <h2 className="text-lg font-bold text-text-primary font-heading mb-4">
            Quick Stats
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Total Payouts</span>
              <span className="text-sm font-semibold text-text-primary">
                {formatCurrency(summary.totalPayoutsAmount)}
              </span>
            </div>
            <div className="border-t border-white/5" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Profit Margin</span>
              <span className={`text-sm font-semibold ${Number(summary.houseProfit) >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                {formatPercent(summary.houseEdge)}
              </span>
            </div>
            <div className="border-t border-white/5" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Sessions per Player</span>
              <span className="text-sm font-semibold text-text-primary">
                {summary.uniquePlayers > 0
                  ? (Number(summary.totalSessions) / Number(summary.uniquePlayers)).toFixed(1)
                  : '0'}
              </span>
            </div>
            <div className="border-t border-white/5" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Revenue per Player</span>
              <span className="text-sm font-semibold text-text-primary">
                {summary.uniquePlayers > 0
                  ? formatCurrency(Number(summary.houseProfit) / Number(summary.uniquePlayers))
                  : '$0.00'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Players Table */}
      {topPlayers.length > 0 && (
        <div className="bg-bg-card rounded-xl border border-white/5 p-6">
          <h2 className="text-lg font-bold text-text-primary font-heading mb-4">
            Top Players
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-3 px-4 text-text-secondary text-sm font-medium">Rank</th>
                  <th className="py-3 px-4 text-text-secondary text-sm font-medium">Username</th>
                  <th className="py-3 px-4 text-text-secondary text-sm font-medium text-right">Sessions</th>
                  <th className="py-3 px-4 text-text-secondary text-sm font-medium text-right">Wagered</th>
                  <th className="py-3 px-4 text-text-secondary text-sm font-medium text-right">Won</th>
                  <th className="py-3 px-4 text-text-secondary text-sm font-medium text-right">Net P/L</th>
                </tr>
              </thead>
              <tbody>
                {topPlayers.map((player, index) => {
                  const netProfit = Number(player.netProfit || 0);
                  return (
                    <tr
                      key={player.userId}
                      className="border-b border-white/5 hover:bg-bg-elevated/50 transition-colors"
                    >
                      <td className="py-3 px-4 text-text-muted text-sm font-medium">
                        #{index + 1}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/analytics/players/${player.userId}`)}
                          className="text-accent-gold hover:text-accent-gold/80 transition-colors text-sm font-medium cursor-pointer bg-transparent border-none p-0"
                        >
                          {player.username}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-text-primary text-sm text-right">
                        {formatNumber(player.sessionsPlayed)}
                      </td>
                      <td className="py-3 px-4 text-text-primary text-sm text-right">
                        {formatCurrency(player.totalWagered)}
                      </td>
                      <td className="py-3 px-4 text-text-primary text-sm text-right">
                        {formatCurrency(player.totalWon)}
                      </td>
                      <td className={`py-3 px-4 text-sm font-semibold text-right ${netProfit >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                        {netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameDetail;
