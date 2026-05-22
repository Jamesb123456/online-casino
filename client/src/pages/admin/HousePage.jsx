import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { formatCredits } from '../../lib/formatCredits';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import useAuth from '../../hooks/useAuth';

const LOW_BALANCE_THRESHOLD = 100000;
const TX_PAGE_SIZE = 25;

const emptyCaps = { perRound: '', perUserPerDay: '', perDay: '' };

const HousePage = () => {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [balance, setBalance] = useState(0);
  const [capsForm, setCapsForm] = useState(emptyCaps);
  const [loading, setLoading] = useState(true);

  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpReason, setTopUpReason] = useState('');
  const [topUpSubmitting, setTopUpSubmitting] = useState(false);

  const [setBalanceValue, setSetBalanceValue] = useState('');
  const [setBalanceReason, setSetBalanceReason] = useState('');
  const [confirmSetBalance, setConfirmSetBalance] = useState(false);
  const [setBalanceSubmitting, setSetBalanceSubmitting] = useState(false);

  const [capsSubmitting, setCapsSubmitting] = useState(false);

  const [transactions, setTransactions] = useState([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txOffset, setTxOffset] = useState(0);
  const [txLoading, setTxLoading] = useState(false);

  useEffect(() => {
    document.title = 'House Management | Platinum Casino';
  }, []);

  const fetchTransactions = useCallback(async (offset = 0) => {
    try {
      setTxLoading(true);
      const res = await api.get('/admin/house/transactions', {
        params: { limit: TX_PAGE_SIZE, offset },
      });
      setTransactions(res.rows || []);
      setTxTotal(res.total || 0);
      setTxOffset(offset);
    } catch (error) {
      toast.error(`Failed to load transactions: ${error.message}`);
    } finally {
      setTxLoading(false);
    }
  }, [toast]);

  const fetchHouseState = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/house');
      setBalance(res.balance || 0);
      setCapsForm({
        perRound: String(res.caps?.perRound ?? ''),
        perUserPerDay: String(res.caps?.perUserPerDay ?? ''),
        perDay: res.caps?.perDay == null ? '' : String(res.caps.perDay),
      });
    } catch (error) {
      toast.error(`Failed to load house state: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchHouseState();
    fetchTransactions(0);
  }, [fetchHouseState, fetchTransactions]);

  const refreshAll = async () => {
    await Promise.all([fetchHouseState(), fetchTransactions(0)]);
  };

  const handleTopUp = async (e) => {
    e.preventDefault();
    const amount = Number(topUpAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a positive amount');
      return;
    }
    try {
      setTopUpSubmitting(true);
      await api.post('/admin/house/topup', { amount, reason: topUpReason || undefined });
      toast.success(`House topped up by ${formatCredits(amount)}`);
      setTopUpAmount('');
      setTopUpReason('');
      await refreshAll();
    } catch (error) {
      toast.error(`Top-up failed: ${error.message}`);
    } finally {
      setTopUpSubmitting(false);
    }
  };

  const handleSetBalanceClick = (e) => {
    e.preventDefault();
    const v = Number(setBalanceValue);
    if (!Number.isFinite(v) || v < 0) {
      toast.error('Enter a non-negative number');
      return;
    }
    setConfirmSetBalance(true);
  };

  const handleSetBalanceConfirm = async () => {
    const v = Number(setBalanceValue);
    try {
      setSetBalanceSubmitting(true);
      await api.post('/admin/house/set-balance', { balance: v, reason: setBalanceReason || undefined });
      toast.success(`House balance set to ${formatCredits(v)}`);
      setSetBalanceValue('');
      setSetBalanceReason('');
      setConfirmSetBalance(false);
      await refreshAll();
    } catch (error) {
      toast.error(`Set balance failed: ${error.message}`);
    } finally {
      setSetBalanceSubmitting(false);
    }
  };

  const handleSaveCaps = async (e) => {
    e.preventDefault();
    const patch = {};
    for (const key of ['perRound', 'perUserPerDay', 'perDay']) {
      const raw = capsForm[key];
      if (raw === '' || raw == null) {
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
    try {
      setCapsSubmitting(true);
      await api.put('/admin/house/caps', patch);
      toast.success('Payout caps updated');
    } catch (error) {
      toast.error(`Caps update failed: ${error.message}`);
    } finally {
      setCapsSubmitting(false);
    }
  };

  const lowBalance = balance < LOW_BALANCE_THRESHOLD;

  const formatType = (t) => {
    const map = {
      admin_topup: 'Top-up',
      admin_withdraw: 'Withdraw',
      bet_credit: 'Bet credit',
      payout_debit: 'Payout debit',
    };
    return map[t] || t || 'â€”';
  };

  const formatDate = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleString(); } catch { return String(d); }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-text-primary">House Treasury</h1>
        </div>

        {/* Balance card */}
        <div className={`bg-bg-card rounded-xl p-6 shadow-card border ${lowBalance ? 'border-status-warning' : 'border-border'}`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-text-secondary text-sm font-medium uppercase tracking-wide">House balance</p>
              {loading ? (
                <p className="text-text-muted mt-2">Loadingâ€¦</p>
              ) : (
                <p className="text-text-primary text-4xl font-bold mt-2" data-testid="house-balance">
                  {formatCredits(balance)}
                </p>
              )}
              {lowBalance && !loading && (
                <p className="text-status-warning text-sm mt-2">
                  Balance is below {formatCredits(LOW_BALANCE_THRESHOLD)} â€” consider topping up.
                </p>
              )}
            </div>
            <div className="text-2xl text-accent-gold font-bold" aria-hidden="true">HOUSE</div>
          </div>
        </div>

        {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top-up */}
          <div className="bg-bg-card rounded-xl p-6 shadow-card border border-border" data-testid="house-topup-card">
            <h2 className="text-xl font-semibold text-text-primary mb-4">Top up the house</h2>
            <form onSubmit={handleTopUp} className="space-y-2">
              <Input
                type="number"
                name="topup-amount"
                label="Amount"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                min={0}
                step="any"
                placeholder="e.g. 100000"
              />
              <Input
                type="text"
                name="topup-reason"
                label="Reason (optional)"
                value={topUpReason}
                onChange={(e) => setTopUpReason(e.target.value)}
                placeholder="e.g. Treasury injection"
              />
              <Button type="submit" variant="primary" disabled={topUpSubmitting}>
                {topUpSubmitting ? 'Topping upâ€¦' : 'Top up'}
              </Button>
            </form>
          </div>

          {/* Set balance */}
          <div className="bg-bg-card rounded-xl p-6 shadow-card border border-border">
            <h2 className="text-xl font-semibold text-text-primary mb-4">Set balance (override)</h2>
            <p className="text-text-muted text-sm mb-3">
              Hard set the house balance. Use with caution â€” writes an audit row.
            </p>
            <form onSubmit={handleSetBalanceClick} className="space-y-2">
              <Input
                type="number"
                name="set-balance-value"
                label="New balance"
                value={setBalanceValue}
                onChange={(e) => setSetBalanceValue(e.target.value)}
                min={0}
                step="any"
                placeholder="e.g. 1000000"
              />
              <Input
                type="text"
                name="set-balance-reason"
                label="Reason (optional)"
                value={setBalanceReason}
                onChange={(e) => setSetBalanceReason(e.target.value)}
                placeholder="e.g. Quarterly rebase"
              />
              <Button type="submit" variant="danger" disabled={setBalanceSubmitting}>
                Override balanceâ€¦
              </Button>
            </form>
          </div>
        </div>
        )}

        {isAdmin && (
        <div className="bg-bg-card rounded-xl p-6 shadow-card border border-border" data-testid="house-caps-card">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Payout caps</h2>
          <p className="text-text-muted text-sm mb-4">
            Limits the casino enforces on every payout. Leave the global daily cap blank for unlimited.
          </p>
          <form onSubmit={handleSaveCaps} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              type="number"
              name="cap-per-round"
              label="Per round"
              value={capsForm.perRound}
              onChange={(e) => setCapsForm((s) => ({ ...s, perRound: e.target.value }))}
              min={0}
              step="any"
            />
            <Input
              type="number"
              name="cap-per-user-per-day"
              label="Per user per day"
              value={capsForm.perUserPerDay}
              onChange={(e) => setCapsForm((s) => ({ ...s, perUserPerDay: e.target.value }))}
              min={0}
              step="any"
            />
            <Input
              type="number"
              name="cap-per-day"
              label="Per day (global) â€” blank = unlimited"
              value={capsForm.perDay}
              onChange={(e) => setCapsForm((s) => ({ ...s, perDay: e.target.value }))}
              min={0}
              step="any"
            />
            <div className="md:col-span-3">
              <Button type="submit" variant="primary" disabled={capsSubmitting}>
                {capsSubmitting ? 'Savingâ€¦' : 'Save caps'}
              </Button>
            </div>
          </form>
        </div>
        )}

        {/* Transactions */}
        <div className="bg-bg-card rounded-xl p-6 shadow-card border border-border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-text-primary">House transactions</h2>
            <div className="text-sm text-text-muted">
              {txTotal} total
            </div>
          </div>
          {txLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-accent-gold"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-text-primary">
                <thead className="bg-bg-elevated">
                  <tr>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">Time</th>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">Type</th>
                    <th className="py-3 px-4 text-right text-text-secondary font-medium">Amount</th>
                    <th className="py-3 px-4 text-right text-text-secondary font-medium">Balance after</th>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">User</th>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">Reason</th>
                    <th className="py-3 px-4 text-left text-text-secondary font-medium">Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 px-4 text-center text-text-muted">
                        No transactions yet.
                      </td>
                    </tr>
                  ) : transactions.map((tx) => (
                    <tr key={tx.id} className="border-t border-border hover:bg-bg-elevated/50">
                      <td className="py-3 px-4 text-text-muted text-sm">{formatDate(tx.createdAt)}</td>
                      <td className="py-3 px-4 text-text-secondary">{formatType(tx.type)}</td>
                      <td className={`py-3 px-4 text-right ${tx.amount >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                        {tx.amount >= 0 ? '+' : ''}{formatCredits(tx.amount)}
                      </td>
                      <td className="py-3 px-4 text-right text-text-primary">{formatCredits(tx.balanceAfter)}</td>
                      <td className="py-3 px-4">
                        {tx.userId ? (
                          <Link to={`/admin/analytics/players/${tx.userId}`} className="text-accent-gold hover:underline">
                            {tx.userUsername || `#${tx.userId}`}
                          </Link>
                        ) : <span className="text-text-muted">â€”</span>}
                      </td>
                      <td className="py-3 px-4 text-text-muted text-sm">{tx.reason || 'â€”'}</td>
                      <td className="py-3 px-4 text-text-secondary text-sm">
                        {tx.adminUsername || (tx.adminId ? `#${tx.adminId}` : 'â€”')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-text-muted">
              Showing {transactions.length === 0 ? 0 : txOffset + 1}â€“{txOffset + transactions.length} of {txTotal}
            </div>
            <div className="flex gap-2">
              <Button
                variant="subtle"
                size="sm"
                disabled={txOffset === 0 || txLoading}
                onClick={() => fetchTransactions(Math.max(0, txOffset - TX_PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                variant="subtle"
                size="sm"
                disabled={txOffset + TX_PAGE_SIZE >= txTotal || txLoading}
                onClick={() => fetchTransactions(txOffset + TX_PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={confirmSetBalance}
        onClose={() => setConfirmSetBalance(false)}
        title="Confirm balance override"
        variant="primary"
        footer={
          <>
            <Button variant="subtle" onClick={() => setConfirmSetBalance(false)} disabled={setBalanceSubmitting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleSetBalanceConfirm} disabled={setBalanceSubmitting}>
              {setBalanceSubmitting ? 'Settingâ€¦' : 'Confirm override'}
            </Button>
          </>
        }
      >
        <p className="text-text-primary">
          Set the house balance to{' '}
          <span className="font-semibold text-accent-gold">
            {Number.isFinite(Number(setBalanceValue)) ? formatCredits(Number(setBalanceValue)) : 'â€”'}
          </span>?
        </p>
        <p className="text-text-muted text-sm mt-3">
          This writes an audit row and replaces the current balance of {formatCredits(balance)}.
        </p>
      </Modal>
    </AdminLayout>
  );
};

export default HousePage;
