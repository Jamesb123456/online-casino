import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import AnalyticsLineChart from '../../components/admin/charts/AnalyticsLineChart';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { formatCredits } from '../../lib/formatCredits';
import useAuth from '../../hooks/useAuth';

const DAY_MS = 24 * 60 * 60 * 1000;

const toUtcDateString = (d) => {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const presetRange = (days) => {
  const today = new Date();
  const yesterday = new Date(today.getTime() - DAY_MS);
  const start = new Date(yesterday.getTime() - (days - 1) * DAY_MS);
  return { from: toUtcDateString(start), to: toUtcDateString(yesterday) };
};

const formatCurrency = (v) => formatCredits(Number(v || 0));
const formatNumber = (v) => Number(v || 0).toLocaleString();

const PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

const HouseTrendsPage = () => {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const initial = useMemo(() => presetRange(30), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(null);

  useEffect(() => {
    document.title = 'House Trends | Platinum Casino';
  }, []);

  const fetchSnapshots = useCallback(async (fromDate, toDate) => {
    try {
      setLoading(true);
      const res = await api.get('/admin/snapshots', { params: { from: fromDate, to: toDate } });
      setSnapshots(res.snapshots || []);
    } catch (err) {
      toast.error(`Failed to load snapshots: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSnapshots(from, to);
  }, [from, to, fetchSnapshots]);

  const handlePreset = (days) => {
    const range = presetRange(days);
    setFrom(range.from);
    setTo(range.to);
  };

  const handleRecompute = async (date) => {
    try {
      setRecomputing(date);
      await api.post('/admin/snapshots/recompute', { date });
      toast.success(`Recomputed snapshot for ${date}`);
      await fetchSnapshots(from, to);
    } catch (err) {
      toast.error(`Recompute failed: ${err.message}`);
    } finally {
      setRecomputing(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-text-primary font-heading">House Trends</h1>
          <div className="flex items-center gap-2 flex-wrap" data-testid="trends-controls">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => handlePreset(p.days)}
                className="px-3 py-1.5 text-xs rounded-md bg-bg-elevated hover:bg-bg-surface text-text-secondary hover:text-text-primary transition-colors"
              >
                {p.label}
              </button>
            ))}
            <label className="text-xs text-text-secondary flex items-center gap-1">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="bg-bg-elevated border border-border rounded px-2 py-1 text-text-primary text-xs"
                aria-label="From date"
              />
            </label>
            <label className="text-xs text-text-secondary flex items-center gap-1">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="bg-bg-elevated border border-border rounded px-2 py-1 text-text-primary text-xs"
                aria-label="To date"
              />
            </label>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loading size="lg" message="Loading snapshots..." />
          </div>
        ) : snapshots.length === 0 ? (
          <div className="bg-bg-card rounded-xl border border-white/5 p-6">
            <p className="text-text-secondary text-center">No snapshots in this range. Run the backfill script to populate history.</p>
          </div>
        ) : (
          <>
            <section className="bg-bg-card rounded-xl border border-white/5 p-6" data-testid="chart-house-balance">
              <h2 className="text-lg font-bold text-text-primary font-heading mb-4">House Balance (close)</h2>
              <AnalyticsLineChart
                data={snapshots}
                xKey="snapshotDate"
                lines={[{ dataKey: 'houseBalanceClose', color: '#F59E0B', name: 'House Balance' }]}
                height={280}
                yAxisFormatter={(v) => `$${v}`}
                tooltipFormatter={formatCurrency}
              />
            </section>

            <section className="bg-bg-card rounded-xl border border-white/5 p-6" data-testid="chart-ggr-ngr">
              <h2 className="text-lg font-bold text-text-primary font-heading mb-4">GGR vs NGR</h2>
              <AnalyticsLineChart
                data={snapshots}
                xKey="snapshotDate"
                lines={[
                  { dataKey: 'ggr', color: '#10B981', name: 'GGR' },
                  { dataKey: 'ngr', color: '#3B82F6', name: 'NGR' },
                ]}
                height={280}
                yAxisFormatter={(v) => `$${v}`}
                tooltipFormatter={formatCurrency}
              />
            </section>

            <section className="bg-bg-card rounded-xl border border-white/5 p-6" data-testid="chart-players">
              <h2 className="text-lg font-bold text-text-primary font-heading mb-4">Active vs New Players</h2>
              <AnalyticsLineChart
                data={snapshots}
                xKey="snapshotDate"
                lines={[
                  { dataKey: 'activePlayerCount', color: '#F59E0B', name: 'Active Players' },
                  { dataKey: 'newPlayerCount', color: '#8B5CF6', name: 'New Players' },
                ]}
                height={280}
                tooltipFormatter={formatNumber}
              />
            </section>

            <section className="bg-bg-card rounded-xl border border-white/5 p-6" data-testid="snapshots-table">
              <h2 className="text-lg font-bold text-text-primary font-heading mb-4">Daily Snapshots</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-secondary border-b border-border">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3 text-right">House Close</th>
                      <th className="py-2 pr-3 text-right">Bets</th>
                      <th className="py-2 pr-3 text-right">Wins</th>
                      <th className="py-2 pr-3 text-right">GGR</th>
                      <th className="py-2 pr-3 text-right">Bonuses</th>
                      <th className="py-2 pr-3 text-right">NGR</th>
                      <th className="py-2 pr-3 text-right">Active</th>
                      <th className="py-2 pr-3 text-right">New</th>
                      {isAdmin && <th className="py-2 pr-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((s) => (
                      <tr key={s.id} className="border-b border-border/40 text-text-primary">
                        <td className="py-2 pr-3 font-mono text-xs">{s.snapshotDate}</td>
                        <td className="py-2 pr-3 text-right">{formatCurrency(s.houseBalanceClose)}</td>
                        <td className="py-2 pr-3 text-right">{formatCurrency(s.totalBets)}</td>
                        <td className="py-2 pr-3 text-right">{formatCurrency(s.totalWins)}</td>
                        <td className="py-2 pr-3 text-right text-status-success">{formatCurrency(s.ggr)}</td>
                        <td className="py-2 pr-3 text-right">{formatCurrency(s.bonusesPaid)}</td>
                        <td className="py-2 pr-3 text-right text-status-success">{formatCurrency(s.ngr)}</td>
                        <td className="py-2 pr-3 text-right">{formatNumber(s.activePlayerCount)}</td>
                        <td className="py-2 pr-3 text-right">{formatNumber(s.newPlayerCount)}</td>
                        {isAdmin && (
                          <td className="py-2 pr-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRecompute(s.snapshotDate)}
                              disabled={recomputing === s.snapshotDate}
                            >
                              {recomputing === s.snapshotDate ? '...' : 'Recompute'}
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default HouseTrendsPage;
