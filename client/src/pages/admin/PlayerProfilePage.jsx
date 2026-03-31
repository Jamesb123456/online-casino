import React, { useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import PlayerProfile from '../../components/admin/PlayerProfile';

/**
 * Player Profile Page
 * Detailed analytics profile for a single player
 */
const PlayerProfilePage = () => {
  useEffect(() => {
    document.title = 'Player Profile | Platinum Casino';
  }, []);

  return (
    <AdminLayout>
      <PlayerProfile />
    </AdminLayout>
  );
};

export default PlayerProfilePage;
