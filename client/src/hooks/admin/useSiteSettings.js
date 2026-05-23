import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

/**
 * useSiteSettings
 *
 * Owns the five independent fetch effects used by the consolidated admin
 * Settings page. Each domain has its own loading flag and form state so a
 * single failure doesn't blank the page.
 *
 * @param {Object} opts
 * @param {(message: string) => void} opts.onError - toast.error callback
 *
 * Returns one slice per card:
 *   defaults: { defaultNewUserBalance, setDefaultNewUserBalance, loading }
 *   caps:     { capsForm, setCapsForm, loading }
 *   alerts:   { alertsForm, setAlertsForm, loading }
 *   rewards:  { rewardsForm, setRewardsForm, loading }
 *   floor:    { houseEdgeFloor, setHouseEdgeFloor, loading }
 *
 * Plus refetch callbacks: refetchDefaults, refetchCaps, refetchAlerts,
 * refetchRewards, refetchFloor.
 */
export default function useSiteSettings({ onError } = {}) {
  // ---- Card 1: Currency & defaults ----
  const [defaultNewUserBalance, setDefaultNewUserBalance] = useState('');
  const [defaultsLoading, setDefaultsLoading] = useState(true);

  // ---- Card 2: Payout caps ----
  const [capsForm, setCapsForm] = useState({ perRound: '', perUserPerDay: '', perDay: '' });
  const [capsLoading, setCapsLoading] = useState(true);

  // ---- Card 3: Alert thresholds ----
  const [alertsForm, setAlertsForm] = useState({ bigWin: '', houseLow: '', rapidBetsPerMin: '' });
  const [alertsLoading, setAlertsLoading] = useState(true);

  // ---- Card 4: Login rewards ----
  const [rewardsForm, setRewardsForm] = useState({ min: '', max: '', streakBonus: '', capPerDay: '' });
  const [rewardsLoading, setRewardsLoading] = useState(true);

  // ---- Card 5: Min house edge floor ----
  const [houseEdgeFloor, setHouseEdgeFloor] = useState('');
  const [floorLoading, setFloorLoading] = useState(true);

  const fetchDefaultNewUserBalance = useCallback(async () => {
    try {
      setDefaultsLoading(true);
      const res = await api.get('/admin/settings/default_new_user_balance');
      const v = res?.value;
      setDefaultNewUserBalance(v == null ? '' : String(v));
    } catch (err) {
      // 404 just means the setting hasn't been written yet — show blank.
      if (!/HTTP 404/.test(err?.message || '') && !/not found/i.test(err?.message || '')) {
        if (onError) onError(`Failed to load default new-user balance: ${err.message}`);
      }
      setDefaultNewUserBalance('');
    } finally {
      setDefaultsLoading(false);
    }
  }, [onError]);

  const fetchCaps = useCallback(async () => {
    try {
      setCapsLoading(true);
      const res = await api.get('/admin/house/caps');
      const caps = res?.caps || {};
      setCapsForm({
        perRound: caps.perRound == null ? '' : String(caps.perRound),
        perUserPerDay: caps.perUserPerDay == null ? '' : String(caps.perUserPerDay),
        perDay: caps.perDay == null ? '' : String(caps.perDay),
      });
    } catch (err) {
      if (onError) onError(`Failed to load payout caps: ${err.message}`);
    } finally {
      setCapsLoading(false);
    }
  }, [onError]);

  const fetchAlerts = useCallback(async () => {
    try {
      setAlertsLoading(true);
      const res = await api.get('/admin/alerts/settings');
      setAlertsForm({
        bigWin: res?.bigWin == null ? '' : String(res.bigWin),
        houseLow: res?.houseLow == null ? '' : String(res.houseLow),
        rapidBetsPerMin: res?.rapidBetsPerMin == null ? '' : String(res.rapidBetsPerMin),
      });
    } catch (err) {
      if (onError) onError(`Failed to load alert thresholds: ${err.message}`);
    } finally {
      setAlertsLoading(false);
    }
  }, [onError]);

  const fetchRewards = useCallback(async () => {
    try {
      setRewardsLoading(true);
      const res = await api.get('/admin/login-rewards/config');
      setRewardsForm({
        min: res?.min == null ? '' : String(res.min),
        max: res?.max == null ? '' : String(res.max),
        streakBonus: res?.streakBonus == null ? '' : String(res.streakBonus),
        capPerDay: res?.capPerDay == null ? '' : String(res.capPerDay),
      });
    } catch (err) {
      if (onError) onError(`Failed to load login reward config: ${err.message}`);
    } finally {
      setRewardsLoading(false);
    }
  }, [onError]);

  const fetchHouseEdgeFloor = useCallback(async () => {
    try {
      setFloorLoading(true);
      const res = await api.get('/admin/settings/min_house_edge_floor');
      const v = res?.value;
      setHouseEdgeFloor(v == null ? '' : String(v));
    } catch {
      // Setting may not exist yet — silently default to empty.
      setHouseEdgeFloor('');
    } finally {
      setFloorLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDefaultNewUserBalance();
    fetchCaps();
    fetchAlerts();
    fetchRewards();
    fetchHouseEdgeFloor();
  }, [fetchDefaultNewUserBalance, fetchCaps, fetchAlerts, fetchRewards, fetchHouseEdgeFloor]);

  return {
    defaults: {
      defaultNewUserBalance,
      setDefaultNewUserBalance,
      loading: defaultsLoading,
    },
    caps: {
      capsForm,
      setCapsForm,
      loading: capsLoading,
    },
    alerts: {
      alertsForm,
      setAlertsForm,
      loading: alertsLoading,
    },
    rewards: {
      rewardsForm,
      setRewardsForm,
      loading: rewardsLoading,
    },
    floor: {
      houseEdgeFloor,
      setHouseEdgeFloor,
      loading: floorLoading,
    },
    refetchDefaults: fetchDefaultNewUserBalance,
    refetchCaps: fetchCaps,
    refetchAlerts: fetchAlerts,
    refetchRewards: fetchRewards,
    refetchFloor: fetchHouseEdgeFloor,
  };
}
