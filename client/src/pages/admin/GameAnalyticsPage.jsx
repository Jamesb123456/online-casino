import React, { useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import GameAnalytics from '../../components/admin/GameAnalytics';

/**
 * Game Analytics Page
 * Overview of all game performance metrics and profitability
 */
const GameAnalyticsPage = () => {
  useEffect(() => {
    document.title = 'Game Analytics | Platinum Casino';
  }, []);

  return (
    <AdminLayout>
      <GameAnalytics />
    </AdminLayout>
  );
};

export default GameAnalyticsPage;
