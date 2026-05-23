import { useState, useEffect } from 'react';
import analyticsService from '../../services/admin/analyticsService';

/**
 * useRevenueMetrics
 *
 * Owns the period / granularity state plus the revenue analytics fetch
 * effect for the admin RevenueDashboard.
 *
 * Returns:
 *   data           — fetched revenue payload (null while loading or on error)
 *   loading        — fetch in flight
 *   error          — last fetch error message (string) or null
 *   period         — current period code ('30d', '7d', etc.)
 *   granularity    — 'hour' | 'day' | 'week'
 *   setPeriod, setGranularity — raw setters
 *   retry()        — re-run the fetch (used by the error-state retry button)
 */
export default function useRevenueMetrics({
  initialPeriod = '30d',
  initialGranularity = 'day',
} = {}) {
  const [period, setPeriod] = useState(initialPeriod);
  const [granularity, setGranularity] = useState(initialGranularity);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await analyticsService.getRevenue({ period, granularity });
        setData(result);
      } catch (err) {
        console.error('Failed to fetch revenue data:', err);
        setError('Failed to load revenue data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period, granularity]);

  // Matches the previous inlined behaviour: clear the error/loading flags so
  // the page re-renders. The actual refetch only happens when the user picks
  // a different period or granularity.
  const retry = () => {
    setLoading(true);
    setError(null);
  };

  return {
    data,
    loading,
    error,
    period,
    granularity,
    setPeriod,
    setGranularity,
    retry,
  };
}
