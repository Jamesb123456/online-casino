import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import useAuth from '../../hooks/useAuth';
import { CURRENCY_NAME } from '../../lib/formatCredits';
import { MIN_HOUSE_EDGE_FRACTION } from '../../lib/payoutMath';

/**
 * Admin Settings — consolidated quick-edit surface.
 *
 * Reads each domain from its existing per-domain endpoint and writes back via
 * the same endpoints. Each card has its own Save button so a single failure
 * doesn't blank the page. Two cards (default new-user balance, min house edge
 * floor) use the generic /admin/settings/:key endpoint.
 *
 * Dedicated deep-edit pages still exist at /admin/house, /admin/login-rewards,
 * /admin/alerts, /admin/chat, /admin/games-config.
 */
const SettingsPage = () => {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  // ------------------------- Card 1: Currency & defaults -------------------
  const [defaultNewUserBalance, setDefaultNewUserBalance] = useState('');
  const [defaultsLoading, setDefaultsLoading] = useState(true);
  const [defaultsSaving, setDefaultsSaving] = useState(false);

  // ------------------------- Card 2: Payout caps ----------------------------
  const [capsForm, setCapsForm] = useState({ perRound: '', perUserPerDay: '', perDay: '' });
  const [capsLoading, setCapsLoading] = useState(true);
  const [capsSaving, setCapsSaving] = useState(false);

  // ------------------------- Card 3: Alert thresholds -----------------------
  const [alertsForm, setAlertsForm] = useState({ bigWin: '', houseLow: '', rapidBetsPerMin: '' });
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsSaving, setAlertsSaving] = useState(false);

  // ------------------------- Card 4: Login rewards --------------------------
  const [rewardsForm, setRewardsForm] = useState({ min: '', max: '', streakBonus: '', capPerDay: '' });
  const [rewardsLoading, setRewardsLoading] = useState(true);
  const [rewardsSaving, setRewardsSaving] = useState(false);

  // ------------------------- Card 5: Min house edge floor -------------------
  const [houseEdgeFloor, setHouseEdgeFloor] = useState('');
  const [floorLoading, setFloorLoading] = useState(true);
  const [floorSaving, setFloorSaving] = useState(false);

  useEffect(() => {
    document.title = 'Settings | Platinum Casino';
  }, []);

  // ------------------------- Fetchers (per card, isolated) ------------------
  const fetchDefaultNewUserBalance = useCallback(async () => {
    try {
      setDefaultsLoading(true);
      const res = await api.get('/admin/settings/default_new_user_balance');
      const v = res?.value;
      setDefaultNewUserBalance(v == null ? '' : String(v));
    } catch (err) {
      // 404 just means the setting hasn't been written yet — show blank.
      if (!/HTTP 404/.test(err?.message || '') && !/not found/i.test(err?.message || '')) {
        toast.error(`Failed to load default new-user balance: ${err.message}`);
      }
      setDefaultNewUserBalance('');
    } finally {
      setDefaultsLoading(false);
    }
  }, [toast]);

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
      toast.error(`Failed to load payout caps: ${err.message}`);
    } finally {
      setCapsLoading(false);
    }
  }, [toast]);

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
      toast.error(`Failed to load alert thresholds: ${err.message}`);
    } finally {
      setAlertsLoading(false);
    }
  }, [toast]);

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
      toast.error(`Failed to load login reward config: ${err.message}`);
    } finally {
      setRewardsLoading(false);
    }
  }, [toast]);

  const fetchHouseEdgeFloor = useCallback(async () => {
    try {
      setFloorLoading(true);
      const res = await api.get('/admin/settings/min_house_edge_floor');
      const v = res?.value;
      setHouseEdgeFloor(v == null ? '' : String(v));
    } catch (err) {
      if (!/HTTP 404/.test(err?.message || '') && !/not found/i.test(err?.message || '')) {
        toast.error(`Failed to load min house edge floor: ${err.message}`);
      }
      setHouseEdgeFloor('');
    } finally {
      setFloorLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDefaultNewUserBalance();
    fetchCaps();
    fetchAlerts();
    fetchRewards();
    fetchHouseEdgeFloor();
  }, [fetchDefaultNewUserBalance, fetchCaps, fetchAlerts, fetchRewards, fetchHouseEdgeFloor]);

  // ------------------------- Savers (per card, isolated) --------------------
  const handleSaveDefaults = async (e) => {
    e.preventDefault();
    const raw = defaultNewUserBalance;
    if (raw === '' || raw == null) {
      toast.error('Enter a non-negative number');
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      toast.error('Default new-user balance must be a non-negative number');
      return;
    }
    try {
      setDefaultsSaving(true);
      await api.put('/admin/settings/default_new_user_balance', { value: n });
      toast.success('Default new-user balance updated');
    } catch (err) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setDefaultsSaving(false);
    }
  };

  const handleSaveCaps = async (e) => {
    e.preventDefault();
    const patch = {};
    for (const key of ['perRound', 'perUserPerDay', 'perDay']) {
      const raw = capsForm[key];
      if (raw === '' || raw == null) {
        // Only perDay supports unlimited (null). For the other two, skip.
        if (key === 'perDay') patch[key] = null;
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        toast.error(`${key} must be a non-negative number`);
        return;
      }
      patch[key] = n;
    }
    if (Object.keys(patch).length === 0) {
      toast.error('No cap fields provided');
      return;
    }
    try {
      setCapsSaving(true);
      await api.put('/admin/house/caps', patch);
      toast.success('Payout caps updated');
    } catch (err) {
      toast.error(`Caps update failed: ${err.message}`);
    } finally {
      setCapsSaving(false);
    }
  };

  const handleSaveAlerts = async (e) => {
    e.preventDefault();
    const patch = {};
    for (const key of ['bigWin', 'houseLow', 'rapidBetsPerMin']) {
      const raw = alertsForm[key];
      if (raw === '' || raw == null) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        toast.error(`${key} must be a non-negative number`);
        return;
      }
      patch[key] = n;
    }
    if (Object.keys(patch).length === 0) {
      toast.error('No threshold fields provided');
      return;
    }
    try {
      setAlertsSaving(true);
      await api.put('/admin/alerts/settings', patch);
      toast.success('Alert thresholds updated');
    } catch (err) {
      toast.error(`Alerts update failed: ${err.message}`);
    } finally {
      setAlertsSaving(false);
    }
  };

  const handleSaveRewards = async (e) => {
    e.preventDefault();
    const patch = {};
    for (const key of ['min', 'max', 'streakBonus']) {
      const raw = rewardsForm[key];
      if (raw === '' || raw == null) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        toast.error(`${key} must be a non-negative number`);
        return;
      }
      patch[key] = n;
    }
    const capRaw = rewardsForm.capPerDay;
    if (capRaw === '' || capRaw == null) {
      patch.capPerDay = null;
    } else {
      const n = Number(capRaw);
      if (!Number.isFinite(n) || n < 0) {
        toast.error('capPerDay must be null or a non-negative number');
        return;
      }
      patch.capPerDay = n;
    }
    if (patch.min !== undefined && patch.max !== undefined && patch.max < patch.min) {
      toast.error('max must be greater than or equal to min');
      return;
    }
    try {
      setRewardsSaving(true);
      await api.put('/admin/login-rewards/config', patch);
      toast.success('Login reward config updated');
    } catch (err) {
      toast.error(`Login reward update failed: ${err.message}`);
    } finally {
      setRewardsSaving(false);
    }
  };

  const handleSaveHouseEdgeFloor = async (e) => {
    e.preventDefault();
    const raw = houseEdgeFloor;
    if (raw === '' || raw == null) {
      toast.error('Enter a value between 0 and 1');
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      toast.error('Min house edge floor must be between 0 and 1');
      return;
    }
    try {
      setFloorSaving(true);
      await api.put('/admin/settings/min_house_edge_floor', { value: n });
      toast.success('Min house edge floor updated');
    } catch (err) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setFloorSaving(false);
    }
  };

  const cardClass = 'bg-bg-card rounded-xl p-6 shadow-card border border-border';

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-text-primary">Settings</h1>
        </div>
        <p className="text-text-muted text-sm -mt-3">
          At-a-glance edits for the most-used operational knobs. Deep editing
          still lives on the dedicated pages (House, Login Rewards, Alerts,
          Chat Moderation, Games Config).
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* --------------------------- Card 1 --------------------------- */}
          <div className={cardClass} data-testid="settings-defaults-card">
            <h2 className="text-xl font-semibold text-text-primary mb-2">Currency &amp; defaults</h2>
            <p className="text-text-muted text-sm mb-4">
              Display name and the starting balance applied to admin-created users.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Currency name
              </label>
              <div
                className="px-3 py-2 rounded-md bg-bg-elevated text-text-primary border border-border"
                data-testid="currency-name"
              >
                {CURRENCY_NAME}
              </div>
              <p className="text-text-muted text-xs mt-1">
                Set via the <code>VITE_CURRENCY_NAME</code> build-time env var.
              </p>
            </div>

            {defaultsLoading ? (
              <p className="text-text-muted">Loading...</p>
            ) : (
              <form onSubmit={handleSaveDefaults}>
                <Input
                  type="number"
                  name="default-new-user-balance"
                  label={`Default new-user balance (${CURRENCY_NAME})`}
                  value={defaultNewUserBalance}
                  onChange={(e) => setDefaultNewUserBalance(e.target.value)}
                  min={0}
                  step="any"
                  disabled={!isAdmin}
                />
                <Button type="submit" variant="primary" disabled={!isAdmin || defaultsSaving}>
                  {defaultsSaving ? 'Saving...' : 'Save defaults'}
                </Button>
              </form>
            )}
          </div>

          {/* --------------------------- Card 2 --------------------------- */}
          <div className={cardClass} data-testid="settings-caps-card">
            <h2 className="text-xl font-semibold text-text-primary mb-2">Payout caps</h2>
            <p className="text-text-muted text-sm mb-4">
              Limits enforced on every payout. Leave the global daily cap blank
              for unlimited.
            </p>
            {capsLoading ? (
              <p className="text-text-muted">Loading...</p>
            ) : (
              <form onSubmit={handleSaveCaps} className="grid grid-cols-1 gap-2">
                <Input
                  type="number"
                  name="cap-per-round"
                  label="Per round"
                  value={capsForm.perRound}
                  onChange={(e) => setCapsForm((s) => ({ ...s, perRound: e.target.value }))}
                  min={0}
                  step="any"
                  disabled={!isAdmin}
                />
                <Input
                  type="number"
                  name="cap-per-user-per-day"
                  label="Per user per day"
                  value={capsForm.perUserPerDay}
                  onChange={(e) => setCapsForm((s) => ({ ...s, perUserPerDay: e.target.value }))}
                  min={0}
                  step="any"
                  disabled={!isAdmin}
                />
                <Input
                  type="number"
                  name="cap-per-day"
                  label="Per day (global) — blank = unlimited"
                  value={capsForm.perDay}
                  onChange={(e) => setCapsForm((s) => ({ ...s, perDay: e.target.value }))}
                  min={0}
                  step="any"
                  disabled={!isAdmin}
                />
                <Button type="submit" variant="primary" disabled={!isAdmin || capsSaving}>
                  {capsSaving ? 'Saving...' : 'Save caps'}
                </Button>
              </form>
            )}
          </div>

          {/* --------------------------- Card 3 --------------------------- */}
          <div className={cardClass} data-testid="settings-alerts-card">
            <h2 className="text-xl font-semibold text-text-primary mb-2">Alert thresholds</h2>
            <p className="text-text-muted text-sm mb-4">
              When the anomaly detector trips an alert. All non-negative numbers.
            </p>
            {alertsLoading ? (
              <p className="text-text-muted">Loading...</p>
            ) : (
              <form onSubmit={handleSaveAlerts} className="grid grid-cols-1 gap-2">
                <Input
                  type="number"
                  name="alert-big-win"
                  label="Big win threshold"
                  value={alertsForm.bigWin}
                  onChange={(e) => setAlertsForm((s) => ({ ...s, bigWin: e.target.value }))}
                  min={0}
                  step="any"
                  disabled={!isAdmin}
                />
                <Input
                  type="number"
                  name="alert-house-low"
                  label="House low threshold"
                  value={alertsForm.houseLow}
                  onChange={(e) => setAlertsForm((s) => ({ ...s, houseLow: e.target.value }))}
                  min={0}
                  step="any"
                  disabled={!isAdmin}
                />
                <Input
                  type="number"
                  name="alert-rapid-bets"
                  label="Rapid bets per minute"
                  value={alertsForm.rapidBetsPerMin}
                  onChange={(e) => setAlertsForm((s) => ({ ...s, rapidBetsPerMin: e.target.value }))}
                  min={0}
                  step="any"
                  disabled={!isAdmin}
                />
                <Button type="submit" variant="primary" disabled={!isAdmin || alertsSaving}>
                  {alertsSaving ? 'Saving...' : 'Save thresholds'}
                </Button>
              </form>
            )}
          </div>

          {/* --------------------------- Card 4 --------------------------- */}
          <div className={cardClass} data-testid="settings-login-rewards-card">
            <h2 className="text-xl font-semibold text-text-primary mb-2">Login reward config</h2>
            <p className="text-text-muted text-sm mb-4">
              Daily login reward range, streak bonus, and per-day cap.
              Leave the cap blank for unlimited.
            </p>
            {rewardsLoading ? (
              <p className="text-text-muted">Loading...</p>
            ) : (
              <form onSubmit={handleSaveRewards} className="grid grid-cols-1 gap-2">
                <Input
                  type="number"
                  name="reward-min"
                  label="Minimum reward"
                  value={rewardsForm.min}
                  onChange={(e) => setRewardsForm((s) => ({ ...s, min: e.target.value }))}
                  min={0}
                  step="any"
                  disabled={!isAdmin}
                />
                <Input
                  type="number"
                  name="reward-max"
                  label="Maximum reward"
                  value={rewardsForm.max}
                  onChange={(e) => setRewardsForm((s) => ({ ...s, max: e.target.value }))}
                  min={0}
                  step="any"
                  disabled={!isAdmin}
                />
                <Input
                  type="number"
                  name="reward-streak-bonus"
                  label="Streak bonus"
                  value={rewardsForm.streakBonus}
                  onChange={(e) => setRewardsForm((s) => ({ ...s, streakBonus: e.target.value }))}
                  min={0}
                  step="any"
                  disabled={!isAdmin}
                />
                <Input
                  type="number"
                  name="reward-cap-per-day"
                  label="Per-day cap (blank = unlimited)"
                  value={rewardsForm.capPerDay}
                  onChange={(e) => setRewardsForm((s) => ({ ...s, capPerDay: e.target.value }))}
                  min={0}
                  step="any"
                  disabled={!isAdmin}
                />
                <Button type="submit" variant="primary" disabled={!isAdmin || rewardsSaving}>
                  {rewardsSaving ? 'Saving...' : 'Save login rewards'}
                </Button>
              </form>
            )}
          </div>

          {/* --------------------------- Card 5 --------------------------- */}
          <div className={cardClass} data-testid="settings-house-edge-floor-card">
            <h2 className="text-xl font-semibold text-text-primary mb-2">Min house edge floor</h2>
            <p className="text-text-muted text-sm mb-4">
              The payout-table editor blocks saving any table whose estimated
              house edge falls below this floor. Decimal fraction — e.g.{' '}
              <code>0.01</code> for 1%, <code>0.05</code> for 5%. Default:{' '}
              <code>{MIN_HOUSE_EDGE_FRACTION}</code>.
            </p>
            {floorLoading ? (
              <p className="text-text-muted">Loading...</p>
            ) : (
              <form onSubmit={handleSaveHouseEdgeFloor}>
                <Input
                  type="number"
                  name="house-edge-floor"
                  label="Min house edge (fraction)"
                  value={houseEdgeFloor}
                  onChange={(e) => setHouseEdgeFloor(e.target.value)}
                  min={0}
                  max={1}
                  step="any"
                  disabled={!isAdmin}
                />
                <Button type="submit" variant="primary" disabled={!isAdmin || floorSaving}>
                  {floorSaving ? 'Saving...' : 'Save floor'}
                </Button>
              </form>
            )}
          </div>
        </div>

        {!isAdmin && (
          <p className="text-text-muted text-sm">
            Read-only — only admins can edit these settings.
          </p>
        )}
      </div>
    </AdminLayout>
  );
};

export default SettingsPage;
