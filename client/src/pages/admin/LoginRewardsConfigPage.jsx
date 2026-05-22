import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import useAuth from '../../hooks/useAuth';

const emptyForm = { min: '', max: '', streakBonus: '', capPerDay: '' };

const LoginRewardsConfigPage = () => {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Login Rewards | Platinum Casino';
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/login-rewards/config');
      setForm({
        min: res.min == null ? '' : String(res.min),
        max: res.max == null ? '' : String(res.max),
        streakBonus: res.streakBonus == null ? '' : String(res.streakBonus),
        capPerDay: res.capPerDay == null ? '' : String(res.capPerDay),
      });
    } catch (error) {
      toast.error(`Failed to load login reward config: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async (e) => {
    e.preventDefault();
    const patch = {};
    for (const key of ['min', 'max', 'streakBonus']) {
      const raw = form[key];
      if (raw === '' || raw == null) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        toast.error(`${key} must be a non-negative number`);
        return;
      }
      patch[key] = n;
    }
    // capPerDay: blank = null (unlimited)
    const capRaw = form.capPerDay;
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
      setSubmitting(true);
      const fresh = await api.put('/admin/login-rewards/config', patch);
      setForm({
        min: fresh.min == null ? '' : String(fresh.min),
        max: fresh.max == null ? '' : String(fresh.max),
        streakBonus: fresh.streakBonus == null ? '' : String(fresh.streakBonus),
        capPerDay: fresh.capPerDay == null ? '' : String(fresh.capPerDay),
      });
      toast.success('Login reward config updated');
    } catch (error) {
      toast.error(`Save failed: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-text-primary">Login Rewards</h1>
        </div>

        <div className="bg-bg-card rounded-xl p-6 shadow-card border border-border" data-testid="login-rewards-config-card">
          <h2 className="text-xl font-semibold text-text-primary mb-2">Daily reward configuration</h2>
          <p className="text-text-muted text-sm mb-4">
            Controls the daily login reward amount range, streak bonus, and the global per-day cap.
            Leave the cap blank for unlimited.
          </p>

          {loading ? (
            <p className="text-text-muted">Loading...</p>
          ) : (
            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="number"
                name="min"
                label="Minimum reward (Credits)"
                value={form.min}
                onChange={(e) => setForm((s) => ({ ...s, min: e.target.value }))}
                min={0}
                step="any"
                disabled={!isAdmin}
              />
              <Input
                type="number"
                name="max"
                label="Maximum reward (Credits)"
                value={form.max}
                onChange={(e) => setForm((s) => ({ ...s, max: e.target.value }))}
                min={0}
                step="any"
                disabled={!isAdmin}
              />
              <Input
                type="number"
                name="streakBonus"
                label="Streak bonus (Credits)"
                value={form.streakBonus}
                onChange={(e) => setForm((s) => ({ ...s, streakBonus: e.target.value }))}
                min={0}
                step="any"
                disabled={!isAdmin}
              />
              <Input
                type="number"
                name="capPerDay"
                label="Per-day cap (blank = unlimited)"
                value={form.capPerDay}
                onChange={(e) => setForm((s) => ({ ...s, capPerDay: e.target.value }))}
                min={0}
                step="any"
                disabled={!isAdmin}
              />
              <div className="md:col-span-2">
                <Button type="submit" variant="primary" disabled={!isAdmin || submitting}>
                  {submitting ? 'Saving...' : 'Save'}
                </Button>
                {!isAdmin && (
                  <p className="text-text-muted text-sm mt-2">
                    Read-only — only admins can edit login reward configuration.
                  </p>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default LoginRewardsConfigPage;
