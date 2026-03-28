import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Link } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';

const ResponsibleGamingPage = () => {
  const { isAuthenticated, user, logout } = useContext(AuthContext);
  const [limits, setLimits] = useState(null);
  const [activitySummary, setActivitySummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selfExcludeDays, setSelfExcludeDays] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isExcluding, setIsExcluding] = useState(false);
  const [result, setResult] = useState(null);

  const fetchData = async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoading(true);
      const [limitsData, activityData] = await Promise.all([
        api.get('/responsible-gaming/limits').catch(() => null),
        api.get('/responsible-gaming/activity-summary').catch(() => null),
      ]);
      setLimits(limitsData);
      setActivitySummary(activityData);
    } catch (err) {
      console.error('Error fetching responsible gaming data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const handleSelfExclude = async () => {
    try {
      setIsExcluding(true);
      const data = await api.post('/responsible-gaming/self-exclude', { days: selfExcludeDays });
      setResult({
        success: true,
        message: data.message,
        reactivateAt: data.reactivateAt,
      });
      setShowConfirm(false);
      // Log out after short delay so user can see the confirmation
      setTimeout(() => {
        if (logout) logout();
      }, 3000);
    } catch (err) {
      setResult({
        success: false,
        message: err.message || 'Failed to process self-exclusion.',
      });
    } finally {
      setIsExcluding(false);
    }
  };

  const formatCurrency = (value) => {
    const num = parseFloat(value || 0);
    return '$' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Unauthenticated view
  if (!isAuthenticated) {
    return (
      <MainLayout>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-heading font-bold text-text-primary mb-6">Responsible Gaming</h1>

          <div className="bg-bg-card rounded-xl p-8 border border-border shadow-card">
            <h2 className="text-xl font-heading font-bold text-text-primary mb-4">Play Responsibly</h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              Gambling should be fun and entertaining. If it stops being fun, it is time to stop.
              We provide tools to help you stay in control of your gaming activity.
            </p>
            <ul className="text-text-secondary space-y-2 mb-6 list-disc list-inside">
              <li>Set deposit and loss limits</li>
              <li>View your activity summary</li>
              <li>Self-exclude if you need a break</li>
              <li>Access support resources</li>
            </ul>
            <div className="flex space-x-4">
              <Link
                to="/login"
                className="px-6 py-2.5 bg-gradient-to-r from-accent-gold to-accent-gold-light text-bg-base font-bold rounded-lg transition-all hover:shadow-glow-gold"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="glass px-6 py-2.5 text-text-primary font-bold rounded-lg transition-colors hover:bg-white/10"
              >
                Register
              </Link>
            </div>
          </div>

          {/* General resources always visible */}
          <ResourcesSection />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-heading font-bold text-text-primary mb-2">Responsible Gaming</h1>
        <p className="text-text-secondary mb-8">Tools to help you stay in control</p>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-accent-gold"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Activity Summary */}
            {activitySummary && (
              <div className="bg-bg-card rounded-xl p-6 border border-border shadow-card">
                <h2 className="text-xl font-heading font-bold text-text-primary mb-4">Your Activity Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Last 7 Days */}
                  <div className="bg-bg-elevated rounded-xl p-4 border border-border">
                    <h3 className="text-sm font-heading font-medium text-text-muted uppercase tracking-wider mb-3">Last 7 Days</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Games Played</span>
                        <span className="text-text-primary font-medium">{activitySummary.last7Days.totalGames}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Total Wins</span>
                        <span className="text-status-success font-medium">{formatCurrency(activitySummary.last7Days.totalWins)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Total Losses</span>
                        <span className="text-status-error font-medium">{formatCurrency(activitySummary.last7Days.totalLosses)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-border">
                        <span className="text-text-secondary font-medium">Net Result</span>
                        <span className={`font-bold ${activitySummary.last7Days.netResult >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                          {activitySummary.last7Days.netResult >= 0 ? '+' : ''}{formatCurrency(activitySummary.last7Days.netResult)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Last 30 Days */}
                  <div className="bg-bg-elevated rounded-xl p-4 border border-border">
                    <h3 className="text-sm font-heading font-medium text-text-muted uppercase tracking-wider mb-3">Last 30 Days</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Games Played</span>
                        <span className="text-text-primary font-medium">{activitySummary.last30Days.totalGames}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Total Wins</span>
                        <span className="text-status-success font-medium">{formatCurrency(activitySummary.last30Days.totalWins)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Total Losses</span>
                        <span className="text-status-error font-medium">{formatCurrency(activitySummary.last30Days.totalLosses)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-border">
                        <span className="text-text-secondary font-medium">Net Result</span>
                        <span className={`font-bold ${activitySummary.last30Days.netResult >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                          {activitySummary.last30Days.netResult >= 0 ? '+' : ''}{formatCurrency(activitySummary.last30Days.netResult)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Self-Exclusion */}
            <div className="bg-bg-card rounded-xl p-6 border border-border shadow-card">
              <h2 className="text-xl font-heading font-bold text-text-primary mb-2">Self-Exclusion</h2>
              <p className="text-text-secondary leading-relaxed mb-4">
                If you feel you need a break from gambling, you can temporarily disable your account.
                During the exclusion period you will not be able to log in or place bets.
              </p>

              {result && (
                <div className={`mb-4 p-4 rounded-xl ${result.success ? 'bg-status-success/10 border border-status-success/20' : 'bg-status-error/10 border border-status-error/20'}`}>
                  <p className={result.success ? 'text-status-success' : 'text-status-error'}>{result.message}</p>
                  {result.success && result.reactivateAt && (
                    <p className="text-text-muted text-sm mt-1">
                      You will be logged out shortly. Account can be reactivated after {new Date(result.reactivateAt).toLocaleDateString()}.
                    </p>
                  )}
                </div>
              )}

              {!showConfirm ? (
                <div className="flex items-center space-x-4">
                  <label className="text-text-secondary text-sm">Exclude for:</label>
                  <select
                    value={selfExcludeDays}
                    onChange={(e) => setSelfExcludeDays(Number(e.target.value))}
                    className="bg-bg-surface text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold transition-colors"
                  >
                    <option value={1}>1 day</option>
                    <option value={3}>3 days</option>
                    <option value={7}>1 week</option>
                    <option value={14}>2 weeks</option>
                    <option value={30}>1 month</option>
                    <option value={90}>3 months</option>
                    <option value={180}>6 months</option>
                    <option value={365}>1 year</option>
                  </select>
                  <button
                    onClick={() => setShowConfirm(true)}
                    className="px-4 py-2 bg-status-error hover:bg-status-error/80 text-text-primary rounded-lg text-sm font-medium transition-colors"
                  >
                    Self-Exclude
                  </button>
                </div>
              ) : (
                <div className="bg-status-error/10 border border-status-error/20 rounded-xl p-4">
                  <p className="text-status-error font-medium mb-3">
                    Are you sure you want to self-exclude for {selfExcludeDays} day(s)?
                  </p>
                  <p className="text-text-muted text-sm mb-4">
                    Your account will be deactivated and you will be logged out immediately.
                    Contact support to reactivate your account after the exclusion period.
                  </p>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleSelfExclude}
                      disabled={isExcluding}
                      className="px-4 py-2 bg-status-error hover:bg-status-error/80 disabled:bg-bg-elevated disabled:text-text-muted text-text-primary rounded-lg text-sm font-medium transition-colors"
                    >
                      {isExcluding ? 'Processing...' : 'Confirm Self-Exclusion'}
                    </button>
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="px-4 py-2 bg-bg-surface hover:bg-bg-elevated text-text-primary rounded-lg text-sm font-medium transition-colors border border-border"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Gaming Tips */}
            <div className="bg-bg-card rounded-xl p-6 border border-border shadow-card">
              <h2 className="text-xl font-heading font-bold text-text-primary mb-4">Tips for Responsible Gaming</h2>
              <ul className="space-y-3">
                {[
                  'Set a budget before you start playing and stick to it.',
                  'Set a time limit for your gaming sessions.',
                  'Never gamble money you cannot afford to lose.',
                  'Do not chase your losses -- take a break instead.',
                  'Gambling should be entertainment, not a way to make money.',
                  'If gambling is no longer fun, it is time to stop.',
                  'Talk to someone if you are worried about your gambling.',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start text-text-secondary">
                    <span className="text-accent-gold mr-3 mt-0.5 flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <ResourcesSection />
          </div>
        )}
      </div>
    </MainLayout>
  );
};

/**
 * Shared resources section shown to both authenticated and guest users.
 */
const ResourcesSection = () => (
  <div className="bg-bg-card rounded-xl p-6 border border-border shadow-card mt-6">
    <h2 className="text-xl font-heading font-bold text-text-primary mb-4">Support Resources</h2>
    <p className="text-text-secondary leading-relaxed mb-4">
      If you or someone you know has a gambling problem, help is available.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[
        {
          name: 'National Council on Problem Gambling',
          url: 'https://www.ncpgambling.org',
          phone: '1-800-522-4700',
        },
        {
          name: 'Gamblers Anonymous',
          url: 'https://www.gamblersanonymous.org',
          phone: null,
        },
        {
          name: 'GamCare',
          url: 'https://www.gamcare.org.uk',
          phone: '0808 8020 133',
        },
        {
          name: 'BeGambleAware',
          url: 'https://www.begambleaware.org',
          phone: '0808 8020 133',
        },
      ].map((resource) => (
        <a
          key={resource.name}
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-bg-elevated p-4 rounded-xl hover:bg-bg-surface transition-colors border border-border"
        >
          <h3 className="text-text-primary font-medium mb-1">{resource.name}</h3>
          {resource.phone && (
            <p className="text-accent-gold text-sm">{resource.phone}</p>
          )}
          <p className="text-text-muted text-xs mt-1">{resource.url}</p>
        </a>
      ))}
    </div>
  </div>
);

export default ResponsibleGamingPage;
