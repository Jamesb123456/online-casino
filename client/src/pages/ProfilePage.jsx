import React, { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import MainLayout from '../layouts/MainLayout';

const ProfilePage = () => {
  const { user } = useContext(AuthContext);

  if (!user) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-bg-card p-6 rounded-lg shadow-lg text-center">
            <h2 className="text-xl font-bold text-white mb-4">Not Logged In</h2>
            <p className="text-gray-300">Please log in to view your profile.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-8">Your Profile</h1>
          
          <div className="bg-bg-card rounded-lg shadow-lg overflow-hidden">
            {/* Profile Header */}
            <div className="bg-gradient-to-r from-primary to-accent p-6">
              <div className="flex items-center">
                <div className="w-20 h-20 rounded-full bg-bg-elevated flex items-center justify-center text-3xl font-bold text-white border-2 border-white">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="ml-6">
                  <h2 className="text-2xl font-bold text-white">{user.username}</h2>
                  <p className="text-white opacity-80 capitalize">{user.role}</p>
                </div>
              </div>
            </div>
            
            {/* Profile Details */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Account Information */}
                <div className="bg-bg-elevated p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-4">Account Information</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-gray-400 text-sm">Username</p>
                      <p className="text-white font-medium">{user.username}</p>
                    </div>
                    {user.email && (
                      <div>
                        <p className="text-gray-400 text-sm">Email</p>
                        <p className="text-white font-medium">{user.email || 'Not provided'}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-400 text-sm">Account Type</p>
                      <p className="text-white font-medium capitalize">{user.role}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Member Since</p>
                      <p className="text-white font-medium">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Balance Information */}
                <div className="bg-bg-elevated p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-4">Balance</h3>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-gray-400">Current Balance</p>
                    <p className="text-2xl font-bold text-accent">₵ {user.balance?.toLocaleString() || 0}</p>
                  </div>
                  
                  {user.role === 'user' && (
                    <p className="text-sm text-gray-400 mt-2">
                      Note: Balance can only be modified by administrators.
                    </p>
                  )}
                </div>
              </div>
              
              {/* Actions */}
              <div className="mt-6 flex flex-wrap gap-4">
                <button 
                  onClick={() => alert('Profile editing will be available in a future update!')}
                  className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-md transition-colors"
                >
                  Edit Profile
                </button>
                {user.role === 'admin' && (
                  <a 
                    href="/admin/dashboard" 
                    className="bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-md transition-colors text-center"
                  >
                    Admin Dashboard
                  </a>
                )}
              </div>
            </div>
          </div>
          
          {/* Game History Placeholder */}
          <div className="mt-8 bg-bg-card rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">Recent Game Activity</h3>
            <p className="text-gray-400">Your recent game history will appear here.</p>
            {/* This would be populated with actual game history in a future update */}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ProfilePage;