import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import useAuth from '../../hooks/useAuth';

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'big_win', label: 'Big win' },
  { value: 'house_low', label: 'House low' },
  { value: 'rapid_bets', label: 'Rapid bets' },
];

const SEVERITY_STYLES = {
  info: 'bg-blue-500/20 text-blue-300',
  warning: 'bg-amber-500/20 text-amber-300',
  critical: 'bg-status-error/20 text-status-error',
};

const TYPE_LABELS = {
  big_win: 'Big win',
  house_low: 'House low',
  rapid_bets: 'Rapid bets',
};

const formatDate = (d) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d);
  }
};

const summarize = (alert) => {
  const d = alert.details || {};
  if (typeof d.message === 'string') return d.message;
  switch (alert.type) {
    case 'big_win':
      return `Win of ${d.winAmount} exceeded threshold ${d.threshold}`;
    case 'house_low':
      return `Balance ${d.balance} below threshold ${d.threshold}`;
    case 'rapid_bets':
      return `${d.count} bets in ${d.windowMs}ms (threshold ${d.threshold})`;
    default:
      return JSON.stringify(d);
  }
};

const isWriteRole = (role) => role === 'admin' || role === 'operator';

const AlertsPage = () => {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const canWrite = isWriteRole(currentUser?.role);

  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');

  const [thresholds, setThresholds] = useState({ bigWin: '', houseLow: '', rapidBetsPerMin: '' });
  const [thresholdsSubmitting, setThresholdsSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Alerts | Platinum Casino';
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const params = { limit: 100 };
      if (unreadOnly) params.unreadOnly = 'true';
      if (typeFilter) params.type = typeFilter;
      const res = await api.get('/admin/alerts', { params });
      setAlerts(res.rows || []);
      setUnreadCount(Number(res.unreadCount) || 0);
    } catch (error) {
      toast.error(`Failed to load alerts: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [unreadOnly, typeFilter, toast]);

  const fetchThresholds = useCallback(async () => {
    try {
      const res = await api.get('/admin/alerts/settings');
      setThresholds({
        bigWin: String(res?.bigWin ?? ''),
        houseLow: String(res?.houseLow ?? ''),
        rapidBetsPerMin: String(res?.rapidBetsPerMin ?? ''),
      });
    } catch (error) {
      toast.error(`Failed to load thresholds: ${error.message}`);
    }
  }, [toast]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    fetchThresholds();
  }, [fetchThresholds]);

  const handleAcknowledge = async (id) => {
    try {
      await api.post(`/admin/alerts/${id}/acknowledge`);
      toast.success('Alert acknowledged');
      await fetchAlerts();
    } catch (error) {
      toast.error(`Acknowledge failed: ${error.message}`);
    }
  };

  const handleAcknowledgeAll = async () => {
    try {
      const res = await api.post('/admin/alerts/acknowledge-all');
      toast.success(`Acknowledged ${res?.count ?? 0} alerts`);
      await fetchAlerts();
    } catch (error) {
      toast.error(`Acknowledge-all failed: ${error.message}`);
    }
  };

  const handleSaveThresholds = async (e) => {
    e.preventDefault();
    const update = {};
    for (const key of ['bigWin', 'houseLow', 'rapidBetsPerMin']) {
      const raw = thresholds[key];
      if (raw === '' || raw == null) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        toast.error(`Invalid ${key}: must be a non-negative number`);
        return;
      }
      update[key] = n;
    }
    if (Object.keys(update).length === 0) {
      toast.error('No fields to update');
      return;
    }
    try {
      setThresholdsSubmitting(true);
      const res = await api.put('/admin/alerts/settings', update);
      setThresholds({
        bigWin: String(res?.bigWin ?? ''),
        houseLow: String(res?.houseLow ?? ''),
        rapidBetsPerMin: String(res?.rapidBetsPerMin ?? ''),
      });
      toast.success('Thresholds saved');
    } catch (error) {
      toast.error(`Save failed: ${error.message}`);
    } finally {
      setThresholdsSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-text-primary">Alerts</h1>
          {unreadCount > 0 && (
            <span
              data-testid="unread-count-pill"
              className="px-3 py-1 rounded-full bg-status-error/20 text-status-error text-sm font-semibold"
            >
              {unreadCount} unread
            </span>
          )}
        </div>

        {/* Filter row */}
        <section
          className="bg-bg-card rounded-xl p-6 shadow-card border border-border"
          data-testid="alerts-filter-card"
        >
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-text-secondary text-sm">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
                data-testid="unread-only-toggle"
              />
              Unread only
            </label>
            <label className="flex items-center gap-2 text-text-secondary text-sm">
              Type
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                data-testid="type-filter"
                className="rounded-lg bg-bg-elevated border border-border text-text-primary px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-gold"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            {canWrite && (
              <div className="ml-auto">
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={handleAcknowledgeAll}
                  data-testid="ack-all-btn"
                >
                  Acknowledge all
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Alerts list */}
        <section
          className="bg-bg-card rounded-xl p-6 shadow-card border border-border"
          data-testid="alerts-list-card"
        >
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-accent-gold" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-text-primary">
                <thead className="bg-bg-elevated">
                  <tr>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">Time</th>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">Type</th>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">Severity</th>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">User</th>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">Game</th>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">Summary</th>
                    {canWrite && <th className="py-3 px-4 text-right text-text-secondary font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {alerts.length === 0 ? (
                    <tr>
                      <td colSpan={canWrite ? 7 : 6} className="py-8 px-4 text-center text-text-muted">
                        No alerts.
                      </td>
                    </tr>
                  ) : (
                    alerts.map((a) => (
                      <tr
                        key={a.id}
                        className={`border-t border-border hover:bg-bg-elevated/50 ${a.acknowledged ? 'opacity-60' : ''}`}
                        data-testid={`alert-row-${a.id}`}
                      >
                        <td className="py-3 px-4 text-text-muted text-sm whitespace-nowrap">{formatDate(a.createdAt)}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-bg-elevated text-text-secondary">
                            {TYPE_LABELS[a.type] || a.type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_STYLES[a.severity] || 'bg-bg-elevated text-text-secondary'}`}>
                            {a.severity}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {a.userId ? (
                            <Link
                              to={`/admin/analytics/players/${a.userId}`}
                              className="text-accent-gold hover:underline"
                            >
                              #{a.userId}
                            </Link>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-text-secondary text-sm">{a.gameType || '—'}</td>
                        <td className="py-3 px-4 text-text-primary text-sm">{summarize(a)}</td>
                        {canWrite && (
                          <td className="py-3 px-4 text-right">
                            {!a.acknowledged && (
                              <Button
                                variant="subtle"
                                size="sm"
                                onClick={() => handleAcknowledge(a.id)}
                                data-testid={`ack-btn-${a.id}`}
                              >
                                Acknowledge
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Thresholds (admin-only edit) */}
        <section
          className="bg-bg-card rounded-xl p-6 shadow-card border border-border"
          data-testid="alerts-thresholds-card"
        >
          <h2 className="text-xl font-semibold text-text-primary mb-4">Thresholds</h2>
          <form onSubmit={handleSaveThresholds} className="space-y-4">
            <Input
              type="number"
              name="bigWin"
              label="Big win (credits)"
              value={thresholds.bigWin}
              onChange={(e) => setThresholds((s) => ({ ...s, bigWin: e.target.value }))}
              min={0}
              step="1"
              disabled={!isAdmin}
            />
            <Input
              type="number"
              name="houseLow"
              label="House low (credits)"
              value={thresholds.houseLow}
              onChange={(e) => setThresholds((s) => ({ ...s, houseLow: e.target.value }))}
              min={0}
              step="1"
              disabled={!isAdmin}
            />
            <Input
              type="number"
              name="rapidBetsPerMin"
              label="Rapid bets per minute"
              value={thresholds.rapidBetsPerMin}
              onChange={(e) => setThresholds((s) => ({ ...s, rapidBetsPerMin: e.target.value }))}
              min={0}
              step="1"
              disabled={!isAdmin}
            />
            {isAdmin && (
              <Button type="submit" variant="primary" disabled={thresholdsSubmitting} data-testid="save-thresholds-btn">
                {thresholdsSubmitting ? 'Saving...' : 'Save thresholds'}
              </Button>
            )}
          </form>
        </section>
      </div>
    </AdminLayout>
  );
};

export default AlertsPage;
