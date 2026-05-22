import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import useAuth from '../hooks/useAuth';

const SCORING_LABELS = {
  biggest_win: 'Biggest single win',
  total_wagered: 'Total wagered',
  best_roi: 'Best ROI',
};

const formatDate = (d) => {
  if (!d) return '';
  try { return new Date(d).toLocaleString(); } catch { return String(d); }
};

const formatTimeRemaining = (endTime) => {
  if (!endTime) return '—';
  const ms = new Date(endTime).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const TournamentsPage = () => {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Tournaments | Platinum Casino';
  }, []);

  const fetchActive = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/tournaments/active');
      setTournaments(res.tournaments || []);
    } catch (error) {
      toast.error(`Failed to load tournaments: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchActive(); }, [fetchActive]);

  // Refresh time-remaining display every minute.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <MainLayout>
      <div className="space-y-6" data-testid="tournaments-page">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-text-primary">Active Tournaments</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-accent-gold" />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="bg-bg-card rounded-xl p-12 shadow-card border border-border text-center text-text-muted">
            No active tournaments right now. Check back soon!
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {tournaments.map((t) => (
              <div
                key={t.id}
                className="bg-bg-card rounded-xl p-6 shadow-card border border-border"
                data-testid={`tournament-card-${t.id}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-text-primary">{t.name}</h2>
                    <div className="mt-1 flex flex-wrap gap-3 text-sm">
                      <Link
                        to={`/games/${t.gameType}`}
                        className="text-accent-gold hover:underline"
                      >
                        Play {t.gameType}
                      </Link>
                      <span className="text-text-muted">·</span>
                      <span className="text-text-secondary">{SCORING_LABELS[t.scoring] || t.scoring}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-accent-gold font-bold text-lg">
                      {Number(t.prizePool).toFixed(2)}
                    </div>
                    <div className="text-text-muted text-xs">prize pool</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div>
                    <div className="text-text-muted">Ends</div>
                    <div className="text-text-primary">{formatDate(t.endTime)}</div>
                  </div>
                  <div>
                    <div className="text-text-muted">Time left</div>
                    <div className="text-text-primary font-semibold" data-testid={`time-left-${t.id}`}>
                      {formatTimeRemaining(t.endTime)}
                    </div>
                  </div>
                </div>

                {t.myEntry && (
                  <div
                    className="mb-4 p-3 rounded-lg bg-accent-gold/10 border border-accent-gold/30 text-sm"
                    data-testid={`my-entry-${t.id}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary">Your rank</span>
                      <span className="font-bold text-accent-gold">
                        #{t.myEntry.rank ?? '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-text-secondary">Your score</span>
                      <span className="text-text-primary">{Number(t.myEntry.score).toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-2">
                    Top 10
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-text-muted">
                        <th className="text-left py-1 px-2 font-medium">#</th>
                        <th className="text-left py-1 px-2 font-medium">Player</th>
                        <th className="text-right py-1 px-2 font-medium">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(t.leaderboard || []).length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-3 text-center text-text-muted">
                            No entries yet — be the first!
                          </td>
                        </tr>
                      ) : (
                        t.leaderboard.map((e, i) => {
                          const isMe = currentUser && Number(e.userId) === Number(currentUser.userId ?? currentUser.id);
                          return (
                            <tr
                              key={e.userId}
                              className={`border-t border-border ${isMe ? 'bg-accent-gold/5' : ''}`}
                              data-testid={`leaderboard-row-${t.id}-${e.userId}`}
                            >
                              <td className="py-1.5 px-2 font-medium">{i + 1}</td>
                              <td className="py-1.5 px-2">
                                {isMe ? <span className="text-accent-gold font-medium">You</span> : `#${e.userId}`}
                              </td>
                              <td className="py-1.5 px-2 text-right">{Number(e.score).toFixed(2)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default TournamentsPage;
