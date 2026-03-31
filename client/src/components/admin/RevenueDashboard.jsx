import React, { useState, useEffect } from 'react';
import StatCard from './charts/StatCard';
import PeriodSelector from './charts/PeriodSelector';
import AnalyticsLineChart from './charts/AnalyticsLineChart';
import AnalyticsBarChart from './charts/AnalyticsBarChart';
import AnalyticsPieChart from './charts/AnalyticsPieChart';
import AnalyticsAreaChart from './charts/AnalyticsAreaChart';
import analyticsService from '../../services/admin/analyticsService';
import Loading from '../ui/Loading';

/** Formatting helpers */
const formatCurrency = (val) =>
  `$${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

/** Granularity options for time-series resolution */
const GRANULARITY_OPTIONS = [
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
];

/**
 * RevenueDashboard - Financial analytics overview for admin users.
 * Displays KPIs, revenue trends, game revenue breakdown,
 * deposit/withdrawal comparison, player activity, and a period summary.
 */
const RevenueDashboard = () => {
  const [period, setPeriod] = useState('30d');
  const [granularity, setGranularity] = useState('day');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await analyticsService.getRevenue({ period, granularity });
        setData(result);
      } catch (err) {
        console.error('Failed to fetch revenue data:', err);
        setError('Failed to load revenue data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period, granularity]);

  /* ---------- Loading state ---------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading size="lg" message="Loading revenue data..." />
      </div>
    );
  }

  /* ---------- Error state ---------- */
  if (error) {
    return (
      <div className="space-y-6">
        <Header
          period={period}
          setPeriod={setPeriod}
          granularity={granularity}
          setGranularity={setGranularity}
        />
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
          <p className="text-status-error text-lg">{error}</p>
          <button
            type="button"
            onClick={() => { setLoading(true); setError(null); }}
            className="px-4 py-2 bg-accent-gold text-bg-base rounded-lg font-medium hover:bg-accent-gold/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Empty state ---------- */
  if (!data || !data.timeSeries || data.timeSeries.length === 0) {
    return (
      <div className="space-y-6">
        <Header
          period={period}
          setPeriod={setPeriod}
          granularity={granularity}
          setGranularity={setGranularity}
        />
        <div className="flex items-center justify-center min-h-[300px]">
          <p className="text-text-secondary text-lg">
            No revenue data available for this period.
          </p>
        </div>
      </div>
    );
  }

  const { summary, timeSeries, revenueByGame } = data;

  /* Derived values for the summary table */
  const totalGamesPlayed = timeSeries.reduce((sum, d) => sum + Number(d.gamesPlayed || 0), 0);
  const netRevenue = Number(summary.grossGamingRevenue || 0) - Number(summary.totalBonusesPaid || 0);
  const depositWithdrawalRatio =
    Number(summary.totalWithdrawals || 0) > 0
      ? (Number(summary.totalDeposits || 0) / Number(summary.totalWithdrawals || 0)).toFixed(2)
      : 'N/A';
  const avgGamesPerPlayer =
    Number(summary.activePlayerCount || 0) > 0
      ? (totalGamesPlayed / Number(summary.activePlayerCount)).toFixed(1)
      : '0';

  /* Pie chart data - filter out zero-revenue games */
  const pieData = (revenueByGame || [])
    .filter((g) => Number(g.revenue || 0) > 0)
    .map((g) => ({
      name: capitalize(g.gameType),
      value: Number(g.revenue || 0),
      color: GAME_COLORS[g.gameType] || '#6B7280',
    }));

  return (
    <div className="space-y-6">
      {/* 1. Header Row */}
      <Header
        period={period}
        setPeriod={setPeriod}
        granularity={granularity}
        setGranularity={setGranularity}
      />

      {/* 2. KPI Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(summary.totalRevenue)}
          icon={'\uD83D\uDCC8'}
          className={Number(summary.totalRevenue) >= 0 ? 'border-status-success/30' : ''}
        />
        <StatCard
          label="Total Deposits"
          value={formatCurrency(summary.totalDeposits)}
          icon={'\uD83D\uDCB5'}
        />
        <StatCard
          label="Total Withdrawals"
          value={formatCurrency(summary.totalWithdrawals)}
          icon={'\uD83D\uDCB8'}
        />
        <StatCard
          label="Net Cashflow"
          value={formatCurrency(summary.netCashflow)}
          icon={'\uD83D\uDD04'}
          className={
            Number(summary.netCashflow) > 0
              ? 'border-status-success/30'
              : Number(summary.netCashflow) < 0
                ? 'border-status-error/30'
                : ''
          }
        />
        <StatCard
          label="ARPU"
          value={formatCurrency(summary.arpu)}
          icon={'\uD83D\uDC64'}
        />
        <StatCard
          label="Active Players"
          value={formatNumber(summary.activePlayerCount)}
          icon={'\uD83D\uDC65'}
        />
      </div>

      {/* 3. Revenue Trend Chart */}
      <section className="bg-bg-card rounded-xl border border-white/5 p-6">
        <h2 className="text-lg font-bold text-text-primary font-heading mb-4">
          Revenue Trend
        </h2>
        <AnalyticsAreaChart
          data={timeSeries}
          xKey="date"
          areas={[
            { dataKey: 'revenue', color: '#10B981', name: 'Revenue' },
            { dataKey: 'deposits', color: '#F59E0B', name: 'Deposits' },
          ]}
          height={320}
          yAxisFormatter={(v) => `$${v}`}
          tooltipFormatter={formatCurrency}
        />
      </section>

      {/* 4. Two-column row: Pie + Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Revenue by Game */}
        <section className="bg-bg-card rounded-xl border border-white/5 p-6">
          <h2 className="text-lg font-bold text-text-primary font-heading mb-4">
            Revenue by Game
          </h2>
          <AnalyticsPieChart
            data={pieData}
            height={300}
            tooltipFormatter={formatCurrency}
          />
          {/* Custom legend with revenue + percentage */}
          {pieData.length > 0 && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(revenueByGame || []).map((g) => (
                <div key={g.gameType} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: GAME_COLORS[g.gameType] || '#6B7280' }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary font-medium truncate">
                      {capitalize(g.gameType)}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {formatCurrency(g.revenue)} ({Number(g.percentOfTotal || 0).toFixed(1)}%)
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right: Deposits vs Withdrawals */}
        <section className="bg-bg-card rounded-xl border border-white/5 p-6">
          <h2 className="text-lg font-bold text-text-primary font-heading mb-4">
            Deposits vs Withdrawals
          </h2>
          <AnalyticsBarChart
            data={timeSeries}
            xKey="date"
            bars={[
              { dataKey: 'deposits', color: '#10B981', name: 'Deposits' },
              { dataKey: 'withdrawals', color: '#EF4444', name: 'Withdrawals' },
            ]}
            height={300}
            yAxisFormatter={(v) => `$${v}`}
            tooltipFormatter={formatCurrency}
          />
        </section>
      </div>

      {/* 5. Player Activity Chart */}
      <section className="bg-bg-card rounded-xl border border-white/5 p-6">
        <h2 className="text-lg font-bold text-text-primary font-heading mb-4">
          Player Activity
        </h2>
        <AnalyticsLineChart
          data={timeSeries}
          xKey="date"
          lines={[
            { dataKey: 'activePlayers', color: '#F59E0B', name: 'Active Players' },
            { dataKey: 'newPlayers', color: '#7C3AED', name: 'New Players' },
          ]}
          height={250}
        />
      </section>

      {/* 6. Period Summary Table */}
      <section className="bg-bg-card rounded-xl border border-white/5 p-6">
        <h2 className="text-lg font-bold text-text-primary font-heading mb-4">
          Period Summary
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SummaryRow label="Gross Gaming Revenue" value={formatCurrency(summary.grossGamingRevenue)} />
          <SummaryRow label="Total Bonuses Paid" value={formatCurrency(summary.totalBonusesPaid)} />
          <SummaryRow
            label="Net Revenue (GGR - Bonuses)"
            value={formatCurrency(netRevenue)}
            highlight={netRevenue >= 0 ? 'positive' : 'negative'}
          />
          <SummaryRow label="Deposit / Withdrawal Ratio" value={`${depositWithdrawalRatio}x`} />
          <SummaryRow label="Total Games Played" value={formatNumber(totalGamesPlayed)} />
          <SummaryRow label="Avg Games Per Player" value={avgGamesPerPlayer} />
        </div>
      </section>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

/**
 * Header row with title, period selector, and granularity toggle.
 */
const Header = ({ period, setPeriod, granularity, setGranularity }) => (
  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
    <h1 className="text-2xl font-bold text-text-primary font-heading">
      Revenue Dashboard
    </h1>
    <div className="flex items-center gap-3 flex-wrap">
      <PeriodSelector value={period} onChange={setPeriod} />
      <div
        className="inline-flex bg-bg-elevated rounded-lg p-1 gap-1"
        role="group"
        aria-label="Granularity selector"
      >
        {GRANULARITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setGranularity(opt.value)}
            aria-pressed={granularity === opt.value}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              granularity === opt.value
                ? 'bg-accent-purple text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  </div>
);

/**
 * Single metric row in the Period Summary table.
 * @param {object} props
 * @param {string} props.label - Metric name
 * @param {string} props.value - Pre-formatted metric value
 * @param {'positive'|'negative'} [props.highlight] - Optional color highlight
 */
const SummaryRow = ({ label, value, highlight }) => {
  const valueColor =
    highlight === 'positive'
      ? 'text-status-success'
      : highlight === 'negative'
        ? 'text-status-error'
        : 'text-text-primary';

  return (
    <div className="bg-bg-elevated rounded-lg p-4">
      <p className="text-sm text-text-secondary mb-1">{label}</p>
      <p className={`text-lg font-bold font-heading ${valueColor}`}>
        {value}
      </p>
    </div>
  );
};

export default RevenueDashboard;
