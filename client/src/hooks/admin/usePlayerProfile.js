import { useState, useEffect, useCallback } from 'react';
import analyticsService from '../../services/admin/analyticsService';

const DEFAULT_LIMIT = 15;

/**
 * usePlayerProfile
 *
 * Encapsulates the two data-fetching effects used by the admin
 * PlayerProfile component:
 *   1. profile + risk + per-game breakdown fetched once per userId
 *   2. sessions list fetched whenever userId / paging / sort / filter changes
 *
 * Behaviour is identical to the previous inlined effects.
 *
 * Returns:
 *   profile, sessions          — fetched payloads (may be null while loading)
 *   loading                    — profile fetch in flight
 *   error                      — profile fetch error
 *   sessionsLoading            — sessions fetch in flight
 *   gameFilter, sortBy, sortOrder, page, limit — current query state
 *   setGameFilter, setSortBy, setSortOrder, setPage — raw setters
 *   handleGameFilterChange(value)    — set filter & reset page
 *   handleSortChange(sortBy, order)  — set sort & reset page
 */
export default function usePlayerProfile(userId, { limit = DEFAULT_LIMIT } = {}) {
  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [gameFilter, setGameFilter] = useState('');
  const [sortBy, setSortBy] = useState('startTime');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);

  // Fetch profile when userId changes
  useEffect(() => {
    let cancelled = false;
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await analyticsService.getPlayerProfile(userId);
        if (!cancelled) setProfile(result);
      } catch (err) {
        console.error('Failed to load player profile:', err);
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchProfile();
    return () => { cancelled = true; };
  }, [userId]);

  // Fetch sessions when filters / page change
  useEffect(() => {
    let cancelled = false;
    const fetchSessions = async () => {
      setSessionsLoading(true);
      try {
        const params = { page, limit, sortBy, sortOrder };
        if (gameFilter) params.gameType = gameFilter;
        const result = await analyticsService.getPlayerSessions(userId, params);
        if (!cancelled) setSessions(result);
      } catch (err) {
        console.error('Failed to load player sessions:', err);
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    };
    fetchSessions();
    return () => { cancelled = true; };
  }, [userId, page, gameFilter, sortBy, sortOrder, limit]);

  const handleGameFilterChange = useCallback((value) => {
    setGameFilter(value);
    setPage(1);
  }, []);

  const handleSortChange = useCallback((nextSortBy, nextSortOrder) => {
    setSortBy(nextSortBy);
    setSortOrder(nextSortOrder);
    setPage(1);
  }, []);

  return {
    profile,
    sessions,
    loading,
    error,
    sessionsLoading,
    gameFilter,
    sortBy,
    sortOrder,
    page,
    limit,
    setGameFilter,
    setSortBy,
    setSortOrder,
    setPage,
    handleGameFilterChange,
    handleSortChange,
  };
}
