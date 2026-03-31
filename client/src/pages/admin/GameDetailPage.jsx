import React, { useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import GameDetail from '../../components/admin/GameDetail';

/**
 * Game Detail Page
 * Deep dive analytics for a specific game type
 */
const GameDetailPage = () => {
  useEffect(() => {
    document.title = 'Game Detail | Platinum Casino';
  }, []);

  return (
    <AdminLayout>
      <GameDetail />
    </AdminLayout>
  );
};

export default GameDetailPage;
