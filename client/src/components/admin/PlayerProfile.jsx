import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StatCard from './charts/StatCard';
import AnalyticsAreaChart from './charts/AnalyticsAreaChart';
import Loading from '../ui/Loading';
import Badge from '../ui/Badge';
import analyticsService from '../../services/admin/analyticsService';

/* ------------------------------------------------------------------ */
/*  Formatting helpers                                                 */
/* ------------------------------------------------------------------ */

const formatCurrency = (val) =>
  `$${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatPercent = (val) => `${Number(val || 0).toFixed(1)}%`;

const formatNumber = (val) => Number(val || 0).toLocaleString();

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'N/A';

const formatDateTime = (d) =>
  d
    ? new Date(d).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'N/A';

const formatDuration = (secs) => {
  if (!secs) return 'N/A';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
};

/** Per-game brand colours matching the analytics design system. */
const GAME_COLORS = {
  crash: '#EF4444',
  roulette: '#10B981',
  blackjack: '#3B82F6',
  plinko: '#F59E0B',
  wheel: '#8B5CF6',
  landmines: '#F97316',
};

/** Map risk level to Badge variant + extra styling. */
const RISK_STYLES = {
  low: {
    variant: 'success',
    bg: 'bg-status-success/10',
    text: 'text-status-success',
    border: 'border-status-success/20',
    animate: '',
  },
  medium: {
    variant: 'warning',
    bg: 'bg-status-warning/10',
    text: 'text-status-warning',
    border: 'border-status-warning/20',
    animate: '',
  },
  high: {
    variant: 'danger',
    bg: 'bg-status-error/10',
    text: 'text-status-error',
    border: 'border-status-error/20',
    animate: '',
  },
  critical: {
    variant: 'danger',
    bg: 'bg-status-error/20',
    text: 'text-status-error',
    border: 'border-status-error/40',
    animate: 'animate-pulse',
  },
};

/** Sort presets exposed to the user. */
const SORT_OPTIONS = [
  { label: 'Newest First', sortBy: 'startTime', sortOrder: 'desc' },
  { label: 'Oldest First', sortBy: 'startTime', sortOrder: 'asc' },
  { label: 'Highest Bet', sortBy: 'totalBet', sortOrder: 'desc' },
  { label: 'Lowest Bet', sortBy: 'totalBet', sortOrder: 'asc' },
  { label: 'Highest Payout', sortBy: 'outcome', sortOrder: 'desc' },
  { label: 'Lowest Payout', sortBy: 'outcome', sortOrder: 'asc' },
];

/* ------------------------------------------------------------------ */
/*  Section wrapper - reusable card with heading                       */
/* ------------------------------------------------------------------ */

const Section = ({ title, extra, children }) => (
  <section className="bg-bg-card rounded-xl border border-white/5 p-6">
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
      <h2 className="text-lg font-bold text-text-primary font-heading">{title}</h2>
      {extra}
    </div>
    {children}
  </section>
);

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const PlayerProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();

  /* ---- state ---- */
  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [gameFilter, setGameFilter] = useState('');
  const [sortBy, setSortBy] = useState('startTime');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const limit = 15;

  /* ---- fetch profile on mount ---- */
  useEffect(() => {
    let cancelled = false;
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await analyticsService.getPlayerProfile(userId);
        if (!cancelled) setProfile(result);
      } catch (err) {
        console.error('Failed to load player profile:', err);
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchProfile();
    return () => { cancelled = true; };
  }, [userId]);

  /* ---- fetch sessions when filters / page change ---- */
  useEffect(() => {
    let cancelled = false;
    const fetchSessions = async () => {
      setSessionsLoading(true);
      try {
        const params = { page, limit, sortBy, sortOrder };
        if (gameFilter) params.gameType = gameFilter;
        const result = await analyticsService.getPlayerSessions(userId, params);
        if (!cancelled) setSessions(result);
      } catch (err) {
        console.error('Failed to load player sessions:', err);
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    };
    fetchSessions();
    return () => { cancelled = true; };
  }, [userId, page, gameFilter, sortBy, sortOrder]);

  /* ---- reset page when filters change ---- */
  const handleGameFilterChange = (value) => {
    setGameFilter(value);
    setPage(1);
  };

  const handleSortChange = (value) => {
    const opt = SORT_OPTIONS[Number(value)] || SORT_OPTIONS[0];
    setSortBy(opt.sortBy);
    setSortOrder(opt.sortOrder);
    setPage(1);
  };

  /* ---- derived sort index for the select ---- */
  const currentSortIndex = SORT_OPTIONS.findIndex(
    (o) => o.sortBy === sortBy && o.sortOrder === sortOrder
  );

  /* ---------------------------------------------------------------- */
  /*  Loading state                                                    */
  /* ---------------------------------------------------------------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading size="lg" message="Loading player profile..." />
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Error / not-found state                                          */
  /* ---------------------------------------------------------------- */
  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-6xl" aria-hidden="true">
          {'\uD83D\uDC64'}
        </div>
        <h2 className="text-xl font-bold text-text-primary font-heading">Player not found</h2>
        <p className="text-text-secondary text-sm">
          The player profile could not be loaded. They may not exist or there was a server error.
        </p>
        <button
          type="button"
          onClick={() => navigate('/admin/players')}
          className="mt-2 px-4 py-2 rounded-lg bg-accent-gold/15 text-accent-gold hover:bg-accent-gold/25 transition-colors font-medium text-sm cursor-pointer"
        >
          {'\u2190'} Back to Players
        </button>
      </div>
    );
  }

  /* ---- destructure profile data ---- */
  const { overallStats, favoriteGame, perGameBreakdown, riskIndicators, activityTimeline, recentActivity } = profile;
  const risk = RISK_STYLES[riskIndicators?.riskLevel] || RISK_STYLES.low;

  /* ---- format timeline dates for the area chart ---- */
  const timelineData = (activityTimeline || []).map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  /* ---- pagination helpers ---- */
  const totalPages = sessions?.totalPages || 1;
  const totalSessions = sessions?.total || 0;
  const sessionRows = sessions?.sessions || [];
  const startRow = (page - 1) * limit + 1;
  const endRow = Math.min(page * limit, totalSessions);

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */
  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------- */}
      {/*  1. Player Header                                           */}
      {/* ---------------------------------------------------------- */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/admin/players')}
          className="text-sm text-text-secondary hover:text-accent-gold transition-colors mb-4 inline-flex items-center gap-1 cursor-pointer"
          aria-label="Navigate back to players list"
        >
          {'\u2190'} Back to Players
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-text-primary font-heading">{profile.username}</h1>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="primary" size="sm" pill>
              {formatCurrency(profile.balance)}
            </Badge>

            <Badge
              variant={profile.isActive ? 'success' : 'danger'}
              size="sm"
              pill
            >
              {profile.isActive ? 'Active' : 'Inactive'}
            </Badge>

            {riskIndicators && (
              <Badge
                variant={risk.variant}
                size="sm"
                pill
                glow={riskIndicators.riskLevel === 'critical'}
              >
                {capitalize(riskIndicators.riskLevel)} Risk
              </Badge>
            )}
          </div>
        </div>

        <p className="text-sm text-text-secondary mt-1">
          Member since {formatDate(profile.memberSince)}
          {' \u00B7 '}
          Last active {formatDate(profile.lastLogin)}
        </p>
      </div>

      {/* ---------------------------------------------------------- */}
      {/*  2. Overall Stats Grid                                      */}
      {/* ---------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Total Wagered"
          value={formatCurrency(overallStats?.totalWagered)}
          icon={'\uD83D\uDCB0'}
        />
        <StatCard
          label="Net P/L"
          value={formatCurrency(overallStats?.netProfitLoss)}
          icon={Number(overallStats?.netProfitLoss) >= 0 ? '\uD83D\uDCC8' : '\uD83D\uDCC9'}
          className={
            Number(overallStats?.netProfitLoss) >= 0
              ? 'border-status-success/30'
              : 'border-status-error/30'
          }
        />
        <StatCard
          label="Win Rate"
          value={formatPercent(overallStats?.winRate)}
          icon={'\uD83C\uDFC6'}
        />
        <StatCard
          label="Avg Bet"
          value={formatCurrency(overallStats?.avgBetSize)}
          icon={'\uD83C\uDFB2'}
        />
        <StatCard
          label="Favorite Game"
          value={capitalize(favoriteGame?.gameType || 'N/A')}
          icon={'\u2B50'}
        />
        <StatCard
          label="Total Deposits"
          value={formatCurrency(overallStats?.totalDeposits)}
          icon={'\uD83D\uDCE5'}
        />
      </div>

      {/* ---------------------------------------------------------- */}
      {/*  3. Activity Timeline                                       */}
      {/* ---------------------------------------------------------- */}
      <Section title="Activity Timeline (30 Days)">
        <AnalyticsAreaChart
          data={timelineData}
          xKey="date"
          areas={[
            { dataKey: 'wagered', color: '#F59E0B', name: 'Wagered' },
            { dataKey: 'netResult', color: '#7C3AED', name: 'Net Result' },
          ]}
          height={280}
          yAxisFormatter={(v) => `$${v}`}
          tooltipFormatter={formatCurrency}
        />
      </Section>

      {/* ---------------------------------------------------------- */}
      {/*  4. Per-Game Breakdown Table                                 */}
      {/* ---------------------------------------------------------- */}
      <Section title="Performance by Game">
        {perGameBreakdown && perGameBreakdown.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b border-white/5 text-text-secondary">
                  <th className="text-left py-3 px-3 font-medium">Game</th>
                  <th className="text-right py-3 px-3 font-medium">Sessions</th>
                  <th className="text-right py-3 px-3 font-medium">Wagered</th>
                  <th className="text-right py-3 px-3 font-medium">Won</th>
                  <th className="text-right py-3 px-3 font-medium">Net P/L</th>
                  <th className="text-right py-3 px-3 font-medium">Win Rate</th>
                  <th className="text-right py-3 px-3 font-medium">Avg Bet</th>
                </tr>
              </thead>
              <tbody>
                {perGameBreakdown.map((g) => {
                  const color = GAME_COLORS[g.gameType] || '#6B7280';
                  const netVal = Number(g.netResult || 0);
                  const winRateVal = Number(g.winRate || 0);

                  return (
                    <tr
                      key={g.gameType}
                      className="border-b border-white/5 hover:bg-bg-elevated/50 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-2 text-text-primary font-medium">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                            aria-hidden="true"
                          />
                          {capitalize(g.gameType)}
                        </span>
                      </td>
                      <td className="text-right py-3 px-3 text-text-primary">
                        {formatNumber(g.sessions)}
                      </td>
                      <td className="text-right py-3 px-3 text-text-primary">
                        {formatCurrency(g.wagered)}
                      </td>
                      <td className="text-right py-3 px-3 text-text-primary">
                        {formatCurrency(g.won)}
                      </td>
                      <td
                        className={`text-right py-3 px-3 font-medium ${
                          netVal >= 0 ? 'text-status-success' : 'text-status-error'
                        }`}
                      >
                        {netVal >= 0 ? '+' : ''}
                        {formatCurrency(g.netResult)}
                      </td>
                      <td
                        className={`text-right py-3 px-3 font-medium ${
                          winRateVal >= 50
                            ? 'text-status-success'
                            : winRateVal >= 30
                              ? 'text-status-warning'
                              : 'text-status-error'
                        }`}
                      >
                        {formatPercent(g.winRate)}
                      </td>
                      <td className="text-right py-3 px-3 text-text-primary">
                        {formatCurrency(g.avgBet)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-text-secondary text-sm py-4 text-center">No game data available.</p>
        )}
      </Section>

      {/* ---------------------------------------------------------- */}
      {/*  5. Risk Indicators Panel                                    */}
      {/* ---------------------------------------------------------- */}
      {riskIndicators && (
        <Section title="Risk Assessment">
          {/* Risk level badge */}
          <div className="mb-5">
            <span
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${risk.bg} ${risk.text} ${risk.border} ${risk.animate}`}
              role="status"
              aria-label={`Risk level: ${riskIndicators.riskLevel}`}
            >
              {riskIndicators.riskLevel === 'critical' && (
                <span aria-hidden="true">{'\u26A0\uFE0F'}</span>
              )}
              {capitalize(riskIndicators.riskLevel)} Risk
            </span>
          </div>

          {/* Metrics 2x2 grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <div className="bg-bg-elevated rounded-lg p-4">
              <p className="text-xs text-text-muted mb-1">Avg Daily Wager</p>
              <p className="text-lg font-bold text-text-primary font-heading">
                {formatCurrency(riskIndicators.avgDailyWager)}
              </p>
            </div>
            <div className="bg-bg-elevated rounded-lg p-4">
              <p className="text-xs text-text-muted mb-1">Max Loss Streak</p>
              <p className="text-lg font-bold text-text-primary font-heading">
                {formatNumber(riskIndicators.lossStreakMax)}
              </p>
            </div>
            <div className="bg-bg-elevated rounded-lg p-4">
              <p className="text-xs text-text-muted mb-1">Longest Session</p>
              <p className="text-lg font-bold text-text-primary font-heading">
                {formatDuration(riskIndicators.longestSession)}
              </p>
            </div>
            <div className="bg-bg-elevated rounded-lg p-4">
              <p className="text-xs text-text-muted mb-1">Total Flags</p>
              <p className="text-lg font-bold text-text-primary font-heading">
                {riskIndicators.flags?.length || 0}
              </p>
            </div>
          </div>

          {/* Flags list */}
          {riskIndicators.flags && riskIndicators.flags.length > 0 && (
            <div className="space-y-2" role="list" aria-label="Risk flags">
              {riskIndicators.flags.map((flag, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 bg-bg-elevated/50 rounded-lg px-4 py-3"
                  role="listitem"
                >
                  <span className="text-status-warning shrink-0 mt-0.5" aria-hidden="true">
                    {'\u26A0\uFE0F'}
                  </span>
                  <span className="text-sm text-text-secondary">{flag}</span>
                </div>
              ))}
            </div>
          )}

          {(!riskIndicators.flags || riskIndicators.flags.length === 0) && (
            <p className="text-text-secondary text-sm">No risk flags detected.</p>
          )}
        </Section>
      )}

      {/* ---------------------------------------------------------- */}
      {/*  6. Game History Table (paginated)                           */}
      {/* ---------------------------------------------------------- */}
      <Section
        title="Game History"
        extra={
          sessionsLoading && (
            <div className="flex items-center gap-2 text-text-secondary text-xs">
              <div className="h-4 w-4 rounded-full border-2 border-accent-gold border-t-transparent animate-spin" />
              Loading...
            </div>
          )
        }
      >
        {/* Controls row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Game type filter */}
          <div>
            <label htmlFor="game-filter" className="sr-only">
              Filter by game type
            </label>
            <select
              id="game-filter"
              value={gameFilter}
              onChange={(e) => handleGameFilterChange(e.target.value)}
              className="bg-bg-elevated border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-gold/50 cursor-pointer"
            >
              <option value="">All Games</option>
              {Object.keys(GAME_COLORS).map((game) => (
                <option key={game} value={game}>
                  {capitalize(game)}
                </option>
              ))}
            </select>
          </div>

          {/* Sort dropdown */}
          <div>
            <label htmlFor="sort-select" className="sr-only">
              Sort sessions
            </label>
            <select
              id="sort-select"
              value={currentSortIndex >= 0 ? currentSortIndex : 0}
              onChange={(e) => handleSortChange(e.target.value)}
              className="bg-bg-elevated border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-gold/50 cursor-pointer"
            >
              {SORT_OPTIONS.map((opt, idx) => (
                <option key={idx} value={idx}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sessions table */}
        {sessionRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b border-white/5 text-text-secondary">
                  <th className="text-left py-3 px-3 font-medium">Game</th>
                  <th className="text-left py-3 px-3 font-medium">Date/Time</th>
                  <th className="text-right py-3 px-3 font-medium">Bet</th>
                  <th className="text-right py-3 px-3 font-medium">Payout</th>
                  <th className="text-right py-3 px-3 font-medium">Net</th>
                  <th className="text-right py-3 px-3 font-medium">Multiplier</th>
                  <th className="text-right py-3 px-3 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {sessionRows.map((s) => {
                  const color = GAME_COLORS[s.gameType] || '#6B7280';
                  const netVal = Number(s.netResult || 0);

                  return (
                    <tr
                      key={s.id}
                      className="border-b border-white/5 hover:bg-bg-elevated/50 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-2 text-text-primary font-medium">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                            aria-hidden="true"
                          />
                          {capitalize(s.gameType)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-text-secondary whitespace-nowrap">
                        {formatDateTime(s.startTime)}
                      </td>
                      <td className="text-right py-3 px-3 text-text-primary">
                        {formatCurrency(s.totalBet)}
                      </td>
                      <td className="text-right py-3 px-3 text-text-primary">
                        {formatCurrency(s.outcome)}
                      </td>
                      <td
                        className={`text-right py-3 px-3 font-medium ${
                          netVal >= 0 ? 'text-status-success' : 'text-status-error'
                        }`}
                      >
                        {netVal >= 0 ? '+' : ''}
                        {formatCurrency(s.netResult)}
                      </td>
                      <td className="text-right py-3 px-3 text-text-primary">
                        {s.finalMultiplier != null ? `${Number(s.finalMultiplier).toFixed(2)}x` : 'N/A'}
                      </td>
                      <td className="text-right py-3 px-3 text-text-secondary">
                        {formatDuration(s.durationSeconds)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-text-secondary text-sm py-8 text-center">
            {sessionsLoading ? 'Loading sessions...' : 'No game sessions found.'}
          </p>
        )}

        {/* Pagination */}
        {totalSessions > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-white/5">
            <p className="text-sm text-text-secondary">
              Showing {startRow}-{endRow} of {formatNumber(totalSessions)}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-bg-elevated hover:bg-bg-surface text-text-primary border border-white/10"
                aria-label="Previous page"
              >
                Previous
              </button>

              <span className="text-sm text-text-secondary px-2">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-bg-elevated hover:bg-bg-surface text-text-primary border border-white/10"
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
};

export default PlayerProfile;
