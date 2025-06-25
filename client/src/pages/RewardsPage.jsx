import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import axios from 'axios';
// Import from the existing API service file
import api from '../services/api';

// Get API_URL from the same place other services use it
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
import { Link } from 'react-router-dom';

const RewardsPage = () => {
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
      const response = await axios.get(`${API_URL}/api/rewards/status`, {
        withCredentials: true
      });
      setRewardStatus(response.data);
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
      const response = await axios.get(`${API_URL}/api/rewards/history`, {
        withCredentials: true
      });
      setRewardHistory(response.data.rewards);
      setTotalRewards(response.data.totalRewards);
    } catch (err) {
      console.error('Error fetching reward history:', err);
    }
  };

  // Function to claim daily reward
  const claimDailyReward = async () => {
    if (!isAuthenticated) return;
    
    try {
      setIsLoading(true);
      const response = await axios.post(`${API_URL}/api/rewards/claim`, {}, {
        withCredentials: true
      });
      
      if (response.data.success) {
        setClaimResult({
          success: true,
          rewardAmount: response.data.rewardAmount,
          newBalance: response.data.newBalance
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
        error: err.response?.data?.error || 'Failed to claim reward. Please try again later.'
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
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="bg-bg-card rounded-lg p-8 flex flex-col items-center text-center shadow-glow-sm max-w-lg mx-auto">
          <h1 className="text-3xl font-bold bg-gradient-primary text-transparent bg-clip-text mb-4">Daily Rewards</h1>
          <p className="text-gray-300 mb-6">Log in to claim your daily reward and earn up to $100 every day!</p>
          <div className="flex space-x-4">
            <Link to="/login" className="bg-accent hover:bg-accent-dark text-white py-2 px-6 rounded-md transition-colors font-medium">
              Login
            </Link>
            <Link to="/register" className="bg-primary hover:bg-primary-dark text-white py-2 px-6 rounded-md transition-colors font-medium">
              Register
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-24 pb-12">
      {/* Confetti effect when reward is claimed */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 confetti-container">
          {/* This would be implemented with a confetti library like canvas-confetti */}
          {/* For now, this is just a placeholder for the effect */}
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Reward Card */}
        <div className="bg-bg-card rounded-lg overflow-hidden shadow-glow-sm col-span-1 lg:col-span-2">
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-4 bg-gradient-primary text-transparent bg-clip-text">Daily Login Reward</h1>
            
            <div className="bg-bg-elevated p-6 rounded-lg mb-6 border border-accent border-opacity-20">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
                </div>
              ) : error ? (
                <div className="text-red-500 text-center py-4">{error}</div>
              ) : (
                <div className="flex flex-col items-center">
                  {rewardStatus.canClaim ? (
                    <>
                      <div className="text-center mb-6">
                        <p className="text-lg text-gray-300 mb-2">You have a daily reward waiting!</p>
                        <p className="text-xl font-bold text-white">Win between $0 and $100</p>
                      </div>
                      
                      <button 
                        onClick={claimDailyReward}
                        disabled={isLoading}
                        className="bg-accent hover:bg-accent-dark disabled:bg-gray-600 text-white py-3 px-8 rounded-md font-bold text-lg transition-colors shadow-glow-sm"
                      >
                        {isLoading ? 'Claiming...' : 'Claim Reward'}
                      </button>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-lg text-gray-300 mb-2">You've already claimed your daily reward</p>
                      <p className="text-sm text-gray-400">Next reward available in:</p>
                      <p className="text-xl font-bold text-accent mt-1">{getTimeUntilNextReward()}</p>
                    </div>
                  )}
                  
                  {claimResult && (
                    <div className={`mt-6 p-4 rounded-lg ${claimResult.success ? 'bg-green-900 bg-opacity-30' : 'bg-red-900 bg-opacity-30'}`}>
                      {claimResult.success ? (
                        <div className="text-center">
                          <p className="text-xl font-bold text-white mb-1">Congratulations!</p>
                          <p className="text-2xl font-bold text-accent mb-2">
                            ${claimResult.rewardAmount.toFixed(2)}
                          </p>
                          <p className="text-gray-300">has been added to your account</p>
                          <p className="mt-2 text-sm text-gray-400">New balance: ${claimResult.newBalance.toFixed(2)}</p>
                        </div>
                      ) : (
                        <p className="text-red-400 text-center">{claimResult.error}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Reward History Card */}
        <div className="bg-bg-card rounded-lg overflow-hidden shadow-glow-sm">
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4 bg-gradient-accent text-transparent bg-clip-text">Reward History</h2>
            
            <div className="mb-4 p-4 bg-bg-elevated rounded-lg border border-accent border-opacity-20">
              <p className="text-gray-300">Total Rewards Earned:</p>
              <p className="text-2xl font-bold text-accent">${totalRewards.toFixed(2)}</p>
            </div>
            
            <div className="overflow-hidden rounded-lg border border-gray-800">
              <table className="min-w-full divide-y divide-gray-800">
                <thead className="bg-bg-elevated">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {rewardHistory.length === 0 ? (
                    <tr>
                      <td colSpan="2" className="px-4 py-4 text-center text-gray-400">No rewards claimed yet</td>
                    </tr>
                  ) : (
                    rewardHistory.map((reward) => (
                      <tr key={reward.id} className="hover:bg-bg-elevated transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-300">{formatDate(reward.createdAt)}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-accent">${parseFloat(reward.amount).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 text-center text-sm text-gray-500">
              <p>Rewards can be claimed once every 24 hours</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RewardsPage;
