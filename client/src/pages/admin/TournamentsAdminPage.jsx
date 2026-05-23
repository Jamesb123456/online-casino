import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import useAuth from '../../hooks/useAuth';
import useTournamentsList from '../../hooks/admin/useTournamentsList';

const GAME_OPTIONS = ['crash', 'plinko', 'wheel', 'roulette', 'blackjack', 'landmines', 'dice'];
const SCORING_OPTIONS = [
  { value: 'biggest_win', label: 'Biggest single win' },
  { value: 'total_wagered', label: 'Total wagered' },
  { value: 'best_roi', label: 'Best ROI (net profit / wagered)' },
];
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'active', label: 'Active' },
  { value: 'finalized', label: 'Finalized' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_STYLES = {
  scheduled: 'bg-blue-500/20 text-blue-300',
  active: 'bg-status-success/20 text-status-success',
  finalized: 'bg-bg-elevated text-text-secondary',
  cancelled: 'bg-status-error/20 text-status-error',
};

const formatDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleString(); } catch { return String(d); }
};

const isWriteRole = (role) => role === 'admin' || role === 'operator';

const emptyDistRow = () => ({ rank: '', fraction: '' });

const rowsToDist = (rows) => {
  const out = {};
  for (const r of rows) {
    const k = String(r.rank ?? '').trim();
    const v = Number(r.fraction);
    if (!k || !Number.isFinite(v)) continue;
    out[k] = v;
  }
  return out;
};

const distSum = (rows) => {
  let s = 0;
  for (const r of rows) {
    const v = Number(r.fraction);
    if (Number.isFinite(v)) s += v;
  }
  return s;
};

const TournamentsAdminPage = () => {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const canWrite = isWriteRole(currentUser?.role);

  const {
    rows,
    total,
    loading,
    statusFilter,
    setStatusFilter,
    fetchList,
  } = useTournamentsList({ onError: toast.error });

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    gameType: 'crash',
    scoring: 'biggest_win',
    startTime: '',
    endTime: '',
    prizePool: '',
  });
  const [distRows, setDistRows] = useState([
    { rank: '1', fraction: '0.5' },
    { rank: '2', fraction: '0.3' },
    { rank: '3', fraction: '0.2' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  // Detail modal state
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    document.title = 'Tournaments | Platinum Casino';
  }, []);

  const handleDistChange = (idx, field, value) => {
    setDistRows((s) => s.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const handleAddDistRow = () => {
    setDistRows((s) => [...s, emptyDistRow()]);
  };

  const handleRemoveDistRow = (idx) => {
    setDistRows((s) => s.filter((_, i) => i !== idx));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    const dist = rowsToDist(distRows);
    const sum = distSum(distRows);
    if (Math.abs(sum - 1) > 0.001) {
      toast.error(`Distribution must sum to 1.0 (currently ${sum.toFixed(3)})`);
      return;
    }
    const pool = Number(createForm.prizePool);
    if (!Number.isFinite(pool) || pool <= 0) {
      toast.error('Prize pool must be a positive number');
      return;
    }
    const payload = {
      name: createForm.name.trim(),
      gameType: createForm.gameType,
      scoring: createForm.scoring,
      startTime: createForm.startTime ? new Date(createForm.startTime).toISOString() : null,
      endTime: createForm.endTime ? new Date(createForm.endTime).toISOString() : null,
      prizePool: pool,
      prizeDistribution: dist,
    };
    if (!payload.name) {
      toast.error('Name is required');
      return;
    }
    if (!payload.startTime || !payload.endTime) {
      toast.error('Start and end times are required');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/admin/tournaments', payload);
      toast.success('Tournament created');
      setCreateForm({ name: '', gameType: 'crash', scoring: 'biggest_win', startTime: '', endTime: '', prizePool: '' });
      setDistRows([
        { rank: '1', fraction: '0.5' },
        { rank: '2', fraction: '0.3' },
        { rank: '3', fraction: '0.2' },
      ]);
      fetchList();
    } catch (error) {
      toast.error(`Create failed: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (id) => {
    try {
      setDetailLoading(true);
      const res = await api.get(`/admin/tournaments/${id}`);
      setDetail(res);
    } catch (error) {
      toast.error(`Failed to load tournament: ${error.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => setDetail(null);

  const handleCancel = async (id) => {
    if (!canWrite) return;
    try {
      setActionBusy(true);
      await api.post(`/admin/tournaments/${id}/cancel`);
      toast.success('Tournament cancelled');
      fetchList();
      if (detail?.tournament?.id === id) closeDetail();
    } catch (error) {
      toast.error(`Cancel failed: ${error.message}`);
    } finally {
      setActionBusy(false);
    }
  };

  const handleFinalize = async (id) => {
    if (!isAdmin) return;
    try {
      setActionBusy(true);
      const res = await api.post(`/admin/tournaments/${id}/finalize`);
      toast.success(`Finalized: ${res.prizesAwarded} prizes, ${res.totalDebited.toFixed(2)} debited`);
      fetchList();
      if (detail?.tournament?.id === id) closeDetail();
    } catch (error) {
      toast.error(`Finalize failed: ${error.message}`);
    } finally {
      setActionBusy(false);
    }
  };

  const canFinalize = (t) => {
    if (!isAdmin) return false;
    if (t.status !== 'active') return false;
    return new Date(t.endTime).getTime() <= Date.now();
  };

  const canCancel = (t) => canWrite && (t.status === 'scheduled' || t.status === 'active');

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-text-primary">Tournaments</h1>
          <span className="text-text-muted text-sm">{total} total</span>
        </div>

        {/* Create form */}
        {canWrite && (
          <section
            className="bg-bg-card rounded-xl p-6 shadow-card border border-border"
            data-testid="tournaments-create-card"
          >
            <h2 className="text-xl font-semibold text-text-primary mb-4">Create tournament</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  name="name"
                  label="Name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))}
                  required
                />
                <Input
                  type="number"
                  name="prizePool"
                  label="Prize pool (credits)"
                  value={createForm.prizePool}
                  onChange={(e) => setCreateForm((s) => ({ ...s, prizePool: e.target.value }))}
                  min={0}
                  step="1"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex flex-col text-text-secondary text-sm">
                  Game
                  <select
                    value={createForm.gameType}
                    onChange={(e) => setCreateForm((s) => ({ ...s, gameType: e.target.value }))}
                    data-testid="game-select"
                    className="mt-1 rounded-lg bg-bg-elevated border border-border text-text-primary px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent-gold"
                  >
                    {GAME_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </label>
                <label className="flex flex-col text-text-secondary text-sm">
                  Scoring rule
                  <select
                    value={createForm.scoring}
                    onChange={(e) => setCreateForm((s) => ({ ...s, scoring: e.target.value }))}
                    data-testid="scoring-select"
                    className="mt-1 rounded-lg bg-bg-elevated border border-border text-text-primary px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent-gold"
                  >
                    {SCORING_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="datetime-local"
                  name="startTime"
                  label="Start time"
                  value={createForm.startTime}
                  onChange={(e) => setCreateForm((s) => ({ ...s, startTime: e.target.value }))}
                  required
                />
                <Input
                  type="datetime-local"
                  name="endTime"
                  label="End time"
                  value={createForm.endTime}
                  onChange={(e) => setCreateForm((s) => ({ ...s, endTime: e.target.value }))}
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-text-secondary text-sm font-medium">Prize distribution</span>
                  <span
                    data-testid="dist-sum"
                    className={`text-xs ${Math.abs(distSum(distRows) - 1) < 0.001 ? 'text-status-success' : 'text-status-error'}`}
                  >
                    Sum: {distSum(distRows).toFixed(3)}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-text-muted">
                      <th className="text-left py-1 px-2 font-medium">Rank</th>
                      <th className="text-left py-1 px-2 font-medium">Fraction (0–1)</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {distRows.map((r, i) => (
                      <tr key={i}>
                        <td className="py-1 px-2">
                          <input
                            type="number"
                            value={r.rank}
                            onChange={(e) => handleDistChange(i, 'rank', e.target.value)}
                            min={1}
                            step={1}
                            data-testid={`dist-rank-${i}`}
                            className="w-20 bg-bg-elevated border border-border rounded px-2 py-1 text-text-primary"
                          />
                        </td>
                        <td className="py-1 px-2">
                          <input
                            type="number"
                            value={r.fraction}
                            onChange={(e) => handleDistChange(i, 'fraction', e.target.value)}
                            min={0}
                            max={1}
                            step="0.01"
                            data-testid={`dist-fraction-${i}`}
                            className="w-28 bg-bg-elevated border border-border rounded px-2 py-1 text-text-primary"
                          />
                        </td>
                        <td className="py-1 px-2">
                          {distRows.length > 1 && (
                            <Button
                              type="button"
                              variant="subtle"
                              size="sm"
                              onClick={() => handleRemoveDistRow(i)}
                            >
                              Remove
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2">
                  <Button type="button" variant="subtle" size="sm" onClick={handleAddDistRow}>
                    Add rank
                  </Button>
                </div>
              </div>

              <div>
                <Button type="submit" variant="primary" disabled={submitting} data-testid="create-submit-btn">
                  {submitting ? 'Creating...' : 'Submit'}
                </Button>
              </div>
            </form>
          </section>
        )}

        {/* Filter */}
        <section
          className="bg-bg-card rounded-xl p-4 shadow-card border border-border"
          data-testid="tournaments-filter-card"
        >
          <label className="flex items-center gap-2 text-text-secondary text-sm">
            Status filter
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              data-testid="status-filter"
              className="rounded-lg bg-bg-elevated border border-border text-text-primary px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-gold"
            >
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </section>

        {/* List */}
        <section
          className="bg-bg-card rounded-xl p-6 shadow-card border border-border"
          data-testid="tournaments-list-card"
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
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">Name</th>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">Game</th>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">Scoring</th>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">Status</th>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">Start</th>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">End</th>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">Prize pool</th>
                    <th className="py-3 px-4 text-right text-text-secondary font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 px-4 text-center text-text-muted">
                        No tournaments.
                      </td>
                    </tr>
                  ) : (
                    rows.map((t) => (
                      <tr
                        key={t.id}
                        className="border-t border-border hover:bg-bg-elevated/50 cursor-pointer"
                        data-testid={`tournament-row-${t.id}`}
                        onClick={() => openDetail(t.id)}
                      >
                        <td className="py-3 px-4 font-medium">{t.name}</td>
                        <td className="py-3 px-4 text-text-secondary">{t.gameType}</td>
                        <td className="py-3 px-4 text-text-secondary">{t.scoring}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[t.status] || 'bg-bg-elevated text-text-secondary'}`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-text-muted text-sm">{formatDate(t.startTime)}</td>
                        <td className="py-3 px-4 text-text-muted text-sm">{formatDate(t.endTime)}</td>
                        <td className="py-3 px-4 text-accent-gold">{Number(t.prizePool).toFixed(2)}</td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2 justify-end">
                            {canCancel(t) && (
                              <Button
                                variant="subtle"
                                size="sm"
                                onClick={() => handleCancel(t.id)}
                                disabled={actionBusy}
                                data-testid={`cancel-btn-${t.id}`}
                              >
                                Cancel
                              </Button>
                            )}
                            {canFinalize(t) && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleFinalize(t.id)}
                                disabled={actionBusy}
                                data-testid={`finalize-btn-${t.id}`}
                              >
                                Finalize
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Detail modal */}
        {detail && (
          <Modal
            isOpen={!!detail}
            onClose={closeDetail}
            title={`${detail.tournament?.name || 'Tournament'} — Leaderboard`}
          >
            {detailLoading ? (
              <div className="py-8 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent-gold" />
              </div>
            ) : (
              <div className="space-y-4" data-testid="tournament-detail">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-text-muted">Game:</span> {detail.tournament?.gameType}</div>
                  <div><span className="text-text-muted">Status:</span> {detail.tournament?.status}</div>
                  <div><span className="text-text-muted">Scoring:</span> {detail.tournament?.scoring}</div>
                  <div><span className="text-text-muted">Prize pool:</span> {Number(detail.tournament?.prizePool).toFixed(2)}</div>
                  <div><span className="text-text-muted">Start:</span> {formatDate(detail.tournament?.startTime)}</div>
                  <div><span className="text-text-muted">End:</span> {formatDate(detail.tournament?.endTime)}</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-bg-elevated">
                      <tr>
                        <th className="py-2 px-3 text-left text-text-secondary">#</th>
                        <th className="py-2 px-3 text-left text-text-secondary">User</th>
                        <th className="py-2 px-3 text-right text-text-secondary">Score</th>
                        <th className="py-2 px-3 text-right text-text-secondary">Wagered</th>
                        <th className="py-2 px-3 text-right text-text-secondary">Won</th>
                        <th className="py-2 px-3 text-right text-text-secondary">Biggest win</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.leaderboard || []).length === 0 ? (
                        <tr><td colSpan={6} className="py-4 text-center text-text-muted">No entries yet.</td></tr>
                      ) : (
                        detail.leaderboard.map((e, i) => (
                          <tr key={e.id} className="border-t border-border">
                            <td className="py-2 px-3">{i + 1}</td>
                            <td className="py-2 px-3">
                              <Link to={`/admin/analytics/players/${e.userId}`} className="text-accent-gold hover:underline">
                                #{e.userId}
                              </Link>
                            </td>
                            <td className="py-2 px-3 text-right">{Number(e.score).toFixed(2)}</td>
                            <td className="py-2 px-3 text-right">{Number(e.totalWagered).toFixed(2)}</td>
                            <td className="py-2 px-3 text-right">{Number(e.totalWon).toFixed(2)}</td>
                            <td className="py-2 px-3 text-right">{Number(e.biggestWin).toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-2">
                  {canCancel(detail.tournament) && (
                    <Button
                      variant="subtle"
                      onClick={() => handleCancel(detail.tournament.id)}
                      disabled={actionBusy}
                      data-testid="detail-cancel-btn"
                    >
                      Cancel
                    </Button>
                  )}
                  {canFinalize(detail.tournament) && (
                    <Button
                      variant="primary"
                      onClick={() => handleFinalize(detail.tournament.id)}
                      disabled={actionBusy}
                      data-testid="detail-finalize-btn"
                    >
                      Finalize tournament
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Modal>
        )}
      </div>
    </AdminLayout>
  );
};

export default TournamentsAdminPage;
