import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useAudio } from '../hooks/useAudio';
import { api } from '../services/api';
import MainLayout from '../layouts/MainLayout';

const ProfilePage = () => {
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const { muted, volume, setMuted, setVolume } = useAudio();

  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [sessionLimit, setSessionLimit] = useState(null);

  useEffect(() => {
    document.title = 'Profile | Platinum Casino';
  }, []);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || user.username || '');
      setAvatar(user.avatar || '');
    }
  }, [user]);

  // Fetch session limit so the "Session limit" row can show a value.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/users/me/limits');
        if (!cancelled) {
          setSessionLimit(res?.sessionLimitMinutes ?? null);
        }
      } catch {
        if (!cancelled) setSessionLimit(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      await api.put('/users/profile', { displayName, avatar });
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(`Profile update failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    try {
      setChangingPassword(true);
      await api.put('/users/profile', { currentPassword, newPassword });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(`Change password failed: ${err.message || 'Unknown error'}`);
    } finally {
      setChangingPassword(false);
    }
  };

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
                <h2 className="text-2xl font-heading font-bold text-text-primary">Account</h2>
                <p className="text-text-primary/70 capitalize">{user.role}</p>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Account Information */}
              <div className="glass rounded-xl p-5" data-testid="account-information-card">
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
                  <div data-testid="session-limit-row" className="flex items-center justify-between">
                    <p className="text-text-muted text-sm">Session limit</p>
                    <p className="text-text-primary font-medium">
                      {sessionLimit == null ? 'None' : `${sessionLimit} minutes`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Balance Information */}
              <div className="glass rounded-xl p-5" data-testid="balance-card">
                <h3 className="text-lg font-heading font-semibold text-text-primary mb-4">Wallet</h3>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-text-secondary">Current Balance</p>
                  <p className="text-3xl font-heading font-bold text-accent-gold">
                    {Number(user.balance || 0).toLocaleString()} Credits
                  </p>
                </div>

                {user.role === 'user' && (
                  <p className="text-sm text-text-muted mt-2">
                    Note: funds can only be modified by administrators.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Profile settings card */}
        <div
          className="mt-8 bg-bg-card rounded-xl shadow-card border border-border p-6"
          data-testid="profile-settings-card"
        >
          <h3 className="text-xl font-heading font-bold text-text-primary mb-4">Profile Settings</h3>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label htmlFor="display-name" className="block text-text-secondary text-sm mb-1">
                Display name
              </label>
              <input
                id="display-name"
                name="display-name"
                type="text"
                className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2.5 text-text-primary"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="avatar" className="block text-text-secondary text-sm mb-1">
                Avatar URL
              </label>
              <input
                id="avatar"
                name="avatar"
                type="text"
                className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2.5 text-text-primary"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="bg-accent-gold/15 text-accent-gold hover:bg-accent-gold hover:text-bg-base px-5 py-2.5 rounded-lg font-medium transition-all"
            >
              {savingProfile ? 'Saving...' : 'Save profile'}
            </button>
          </form>
        </div>

        {/* Change password card */}
        <div
          className="mt-8 bg-bg-card rounded-xl shadow-card border border-border p-6"
          data-testid="change-password-card"
        >
          <h3 className="text-xl font-heading font-bold text-text-primary mb-4">Change Password</h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="current-password" className="block text-text-secondary text-sm mb-1">
                Current password
              </label>
              <input
                id="current-password"
                name="current-password"
                type="password"
                className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2.5 text-text-primary"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="new-password" className="block text-text-secondary text-sm mb-1">
                New password (min 8 characters)
              </label>
              <input
                id="new-password"
                name="new-password"
                type="password"
                className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2.5 text-text-primary"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-text-secondary text-sm mb-1">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2.5 text-text-primary"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={changingPassword}
              className="bg-accent-purple/15 text-accent-purple-light hover:bg-accent-purple hover:text-text-primary px-5 py-2.5 rounded-lg font-medium transition-all"
            >
              {changingPassword ? 'Changing...' : 'Change password'}
            </button>
          </form>
        </div>

        {/* Sound settings card */}
        <div
          className="mt-8 bg-bg-card rounded-xl shadow-card border border-border p-6"
          data-testid="sound-settings-card"
        >
          <h3 className="text-xl font-heading font-bold text-text-primary mb-4">Sound Settings</h3>

          <div className="flex items-center justify-between mb-4">
            <label className="text-text-secondary">Mute all audio</label>
            <button
              type="button"
              data-testid="audio-mute-toggle"
              onClick={() => setMuted(!muted)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                muted ? 'bg-accent-gold text-bg-base' : 'bg-bg-surface text-text-primary border border-border'
              }`}
            >
              {muted ? 'Muted' : 'Unmuted'}
            </button>
          </div>

          <div className="flex items-center gap-4">
            <label htmlFor="audio-volume-slider" className="text-text-secondary whitespace-nowrap">
              Volume
            </label>
            <input
              id="audio-volume-slider"
              data-testid="audio-volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="flex-1"
            />
            <span className="text-text-muted text-sm w-12 text-right">{Math.round(volume * 100)}%</span>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ProfilePage;
