import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Link } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';

const RewardsPage = () => {
  useEffect(() => {
    document.title = 'Rewards | Platinum Casino';
  }, []);
  const { isAuthenticated, user } = useContext(AuthContext);
  const [rewardStatus, setRewardStatus] = useState({ canClaim: false, nextRewardTime: null });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [claimResult, setClaimResult] = useState(null);
  const [rewardHistory, setRewardHistory] = useState([]);
  const [totalRewards, setTotalRewards] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  // Function to fetch reward status from API
  const fetchRewardStatus = async () => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      const data = await api.get('/rewards/status');
      setRewardStatus(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching reward status:', err);
      setError('Failed to load reward status. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to fetch reward history from API
  const fetchRewardHistory = async () => {
    if (!isAuthenticated) return;

    try {
      const data = await api.get('/rewards/history');
      setRewardHistory(data.rewards);
      setTotalRewards(data.totalRewards);
    } catch (err) {
      console.error('Error fetching reward history:', err);
    }
  };

  // Function to claim daily reward
  const claimDailyReward = async () => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      const data = await api.post('/rewards/claim', {});

      if (data.success) {
        setClaimResult({
          success: true,
          rewardAmount: data.rewardAmount,
          newBalance: data.newBalance
        });
        setShowConfetti(true);

        // Refresh reward status and history after claiming
        await fetchRewardStatus();
        await fetchRewardHistory();

        // Hide confetti after 5 seconds
        setTimeout(() => {
          setShowConfetti(false);
        }, 5000);
      }
    } catch (err) {
      console.error('Error claiming reward:', err);
      setClaimResult({
        success: false,
        error: err.message || 'Failed to claim reward. Please try again later.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchRewardStatus();
      fetchRewardHistory();
    }
  }, [isAuthenticated]);

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Calculate time until next reward
  const getTimeUntilNextReward = () => {
    if (!rewardStatus.nextRewardTime) return null;

    const nextReward = new Date(rewardStatus.nextRewardTime);
    const now = new Date();
    const diffMs = nextReward - now;

    if (diffMs <= 0) return "Available now";

    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${diffHrs} hours, ${diffMins} minutes`;
  };

  if (!isAuthenticated) {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto">
          <div className="bg-bg-card rounded-xl border border-border p-8 flex flex-col items-center text-center shadow-card">
            <h1 className="text-3xl font-heading font-bold text-gold-gradient mb-4">Daily Rewards</h1>
            <p className="text-text-secondary mb-6">Log in to claim your daily reward and earn up to $100 every day!</p>
            <div className="flex space-x-4">
              <Link to="/login" className="bg-gradient-to-r from-accent-gold to-accent-gold-light text-bg-base py-2.5 px-6 rounded-lg font-semibold transition-all hover:shadow-glow-gold">
                Login
              </Link>
              <Link to="/register" className="glass text-text-primary py-2.5 px-6 rounded-lg font-semibold transition-colors hover:bg-white/10">
                Register
              </Link>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Confetti effect when reward is claimed */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 confetti-container">
          {/* This would be implemented with a confetti library like canvas-confetti */}
          {/* For now, this is just a placeholder for the effect */}
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-heading font-bold text-text-primary mb-2">Daily Rewards</h1>
        <p className="text-text-secondary mb-8">Claim your daily bonus and track your reward history</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily Reward Card */}
          <div className="bg-bg-card rounded-xl overflow-hidden shadow-card border border-border col-span-1 lg:col-span-2">
            <div className="p-6">
              <h2 className="text-2xl font-heading font-bold text-text-primary mb-4">Daily Login Reward</h2>

              <div className="bg-bg-elevated p-6 rounded-xl border border-accent-gold/20">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-gold"></div>
                  </div>
                ) : error ? (
                  <div className="text-status-error text-center py-4">{error}</div>
                ) : (
                  <div className="flex flex-col items-center">
                    {rewardStatus.canClaim ? (
                      <>
                        <div className="text-center mb-6">
                          <p className="text-lg text-text-secondary mb-2">You have a daily reward waiting!</p>
                          <p className="text-xl font-heading font-bold text-text-primary">Win between $0 and $100</p>
                        </div>

                        <button
                          onClick={claimDailyReward}
                          disabled={isLoading}
                          className="bg-gradient-to-r from-accent-gold to-accent-gold-light disabled:from-bg-elevated disabled:to-bg-elevated disabled:text-text-muted text-bg-base py-3 px-8 rounded-lg font-bold text-lg transition-all shadow-glow-gold hover:shadow-glow-gold-lg animate-pulse-gold"
                        >
                          {isLoading ? 'Claiming...' : 'Claim Reward'}
                        </button>
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-lg text-text-secondary mb-2">You've already claimed your daily reward</p>
                        <p className="text-sm text-text-muted">Next reward available in:</p>
                        <p className="text-xl font-heading font-bold text-accent-gold mt-1">{getTimeUntilNextReward()}</p>
                      </div>
                    )}

                    {claimResult && (
                      <div className={`mt-6 p-4 rounded-xl w-full ${claimResult.success ? 'bg-status-success/10 border border-status-success/20' : 'bg-status-error/10 border border-status-error/20'}`}>
                        {claimResult.success ? (
                          <div className="text-center">
                            <p className="text-xl font-heading font-bold text-text-primary mb-1">Congratulations!</p>
                            <p className="text-2xl font-heading font-bold text-accent-gold mb-2">
                              ${claimResult.rewardAmount.toFixed(2)}
                            </p>
                            <p className="text-text-secondary">has been added to your account</p>
                            <p className="mt-2 text-sm text-text-muted">New balance: ${claimResult.newBalance.toFixed(2)}</p>
                          </div>
                        ) : (
                          <p className="text-status-error text-center">{claimResult.error}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reward History Card */}
          <div className="bg-bg-card rounded-xl overflow-hidden shadow-card border border-border">
            <div className="p-6">
              <h2 className="text-xl font-heading font-bold text-text-primary mb-4">Reward History</h2>

              <div className="mb-4 p-4 bg-bg-elevated rounded-xl border border-accent-gold/20">
                <p className="text-text-secondary text-sm">Total Rewards Earned:</p>
                <p className="text-2xl font-heading font-bold text-accent-gold">${totalRewards.toFixed(2)}</p>
              </div>

              <div className="overflow-hidden rounded-xl border border-border">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-bg-elevated">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-heading font-medium text-text-secondary uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-right text-xs font-heading font-medium text-text-secondary uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rewardHistory.length === 0 ? (
                      <tr>
                        <td colSpan="2" className="px-4 py-4 text-center text-text-muted">No rewards claimed yet</td>
                      </tr>
                    ) : (
                      rewardHistory.map((reward) => (
                        <tr key={reward.id} className="hover:bg-bg-elevated/50 transition-colors">
                          <td className="px-4 py-3 text-sm text-text-secondary">{formatDate(reward.createdAt)}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-accent-gold">${parseFloat(reward.amount).toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 text-center text-sm text-text-muted">
                <p>Rewards can be claimed once every 24 hours</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default RewardsPage;
