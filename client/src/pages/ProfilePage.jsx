import React, { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import MainLayout from '../layouts/MainLayout';

const ProfilePage = () => {
  const { user } = useContext(AuthContext);
  const toast = useToast();

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-bg-card border border-border rounded-xl p-8 text-center shadow-card">
            <h2 className="text-xl font-heading font-bold text-text-primary mb-4">Not Logged In</h2>
            <p className="text-text-secondary">Please log in to view your profile.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-heading font-bold text-text-primary mb-8">Your Profile</h1>

        <div className="bg-bg-card rounded-xl shadow-card overflow-hidden border border-border">
          {/* Profile Header - gradient banner */}
          <div className="bg-gradient-to-r from-accent-purple to-accent-gold p-6 relative">
            <div className="flex items-center">
              <div className="w-20 h-20 rounded-full bg-bg-elevated flex items-center justify-center text-3xl font-heading font-bold text-accent-gold border-4 border-bg-card">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="ml-6">
                <h2 className="text-2xl font-heading font-bold text-text-primary">{user.username}</h2>
                <p className="text-text-primary/70 capitalize">{user.role}</p>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Account Information */}
              <div className="glass rounded-xl p-5">
                <h3 className="text-lg font-heading font-semibold text-text-primary mb-4">Account Information</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-text-muted text-sm">Username</p>
                    <p className="text-text-primary font-medium">{user.username}</p>
                  </div>
                  <div>
                    <p className="text-text-muted text-sm">Account Type</p>
                    <p className="text-text-primary font-medium capitalize">{user.role}</p>
                  </div>
                  <div>
                    <p className="text-text-muted text-sm">Member Since</p>
                    <p className="text-text-primary font-medium">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Balance Information */}
              <div className="glass rounded-xl p-5">
                <h3 className="text-lg font-heading font-semibold text-text-primary mb-4">Balance</h3>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-text-secondary">Current Balance</p>
                  <p className="text-3xl font-heading font-bold text-accent-gold">
                    ${user.balance?.toLocaleString() || 0}
                  </p>
                </div>

                {user.role === 'user' && (
                  <p className="text-sm text-text-muted mt-2">
                    Note: Balance can only be modified by administrators.
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-4">
              <button
                onClick={() => toast.info('Profile editing will be available in a future update.')}
                className="bg-accent-gold/15 text-accent-gold hover:bg-accent-gold hover:text-bg-base px-5 py-2.5 rounded-lg font-medium transition-all duration-200 cursor-pointer"
              >
                Edit Profile
              </button>
              {user.role === 'admin' && (
                <a
                  href="/admin/dashboard"
                  className="bg-accent-purple/15 text-accent-purple-light hover:bg-accent-purple hover:text-text-primary px-5 py-2.5 rounded-lg font-medium transition-all duration-200 text-center"
                >
                  Admin Dashboard
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Game History */}
        <div className="mt-8 bg-bg-card rounded-xl shadow-card border border-border p-6">
          <h3 className="text-xl font-heading font-bold text-text-primary mb-4">Recent Game Activity</h3>
          <div className="text-center py-8">
            <p className="text-text-secondary mb-2">No game history yet.</p>
            <p className="text-text-muted text-sm">Your results will appear here once you start playing.</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ProfilePage;
