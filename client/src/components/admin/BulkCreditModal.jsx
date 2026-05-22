import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { formatCredits } from '../../lib/formatCredits';

const FILTER_ALL = 'all';
const FILTER_ACTIVE = 'active';
const FILTER_IDS = 'ids';

const BulkCreditModal = ({ isOpen, onClose, onGranted }) => {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [filterMode, setFilterMode] = useState(FILTER_ALL);
  const [activeDays, setActiveDays] = useState(30);
  const [idListText, setIdListText] = useState('');
  const [preview, setPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setAmount('');
    setReason('');
    setFilterMode(FILTER_ALL);
    setActiveDays(30);
    setIdListText('');
    setPreview(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  const parsedAmount = () => {
    const n = parseFloat(amount);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const buildFilter = () => {
    if (filterMode === FILTER_ACTIVE) {
      const d = parseInt(activeDays, 10);
      return { activeWithinDays: Number.isFinite(d) && d > 0 ? d : 30 };
    }
    if (filterMode === FILTER_IDS) {
      const ids = idListText
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => parseInt(s, 10))
        .filter(n => Number.isFinite(n) && n > 0);
      return { idList: ids };
    }
    return {};
  };

  const validate = () => {
    if (!parsedAmount()) return 'Enter a positive amount.';
    if (!reason.trim()) return 'Reason is required.';
    if (reason.length > 200) return 'Reason must be 200 characters or fewer.';
    if (filterMode === FILTER_IDS) {
      const filter = buildFilter();
      if (!filter.idList || filter.idList.length === 0) return 'Enter at least one valid user ID.';
    }
    return null;
  };

  const handlePreview = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await api.post('/admin/users/bulk-credit', {
        amount: parsedAmount(),
        reason: reason.trim(),
        filter: buildFilter(),
        dryRun: true,
      });
      setPreview(result);
    } catch (e) {
      toast.error(e?.message || 'Preview failed');
      setPreview(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGrant = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    if (!preview) return;
    setIsSubmitting(true);
    try {
      const result = await api.post('/admin/users/bulk-credit', {
        amount: parsedAmount(),
        reason: reason.trim(),
        filter: buildFilter(),
        dryRun: false,
      });
      const credited = result?.credited ?? 0;
      const failed = result?.failed ?? 0;
      const totalDebited = result?.totalDebited ?? 0;
      toast.success(
        `Credited ${credited} users, ${failed} failed, total ${formatCredits(totalDebited)} debited from house`
      );
      onGranted?.(result);
      handleClose();
    } catch (e) {
      toast.error(e?.message || 'Grant failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sampleText = preview && preview.sampleUsernames && preview.sampleUsernames.length > 0
    ? ` (e.g. ${preview.sampleUsernames.join(', ')})`
    : '';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Credit Players" size="lg">
      <div className="space-y-4">
        <div>
          <label htmlFor="bulk-amount" className="block text-sm font-medium text-text-secondary mb-1">
            Amount (Credits)
          </label>
          <input
            type="number"
            id="bulk-amount"
            className="w-full p-2 bg-bg-elevated border border-border-light rounded-lg text-text-primary"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setPreview(null); }}
            min="0"
            step="0.01"
          />
        </div>

        <div>
          <label htmlFor="bulk-reason" className="block text-sm font-medium text-text-secondary mb-1">
            Reason (max 200 chars)
          </label>
          <input
            type="text"
            id="bulk-reason"
            className="w-full p-2 bg-bg-elevated border border-border-light rounded-lg text-text-primary"
            value={reason}
            onChange={(e) => { setReason(e.target.value); setPreview(null); }}
            maxLength={200}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="block text-sm font-medium text-text-secondary mb-1">Target</legend>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="bulk-filter"
              value={FILTER_ALL}
              checked={filterMode === FILTER_ALL}
              onChange={() => { setFilterMode(FILTER_ALL); setPreview(null); }}
            />
            <span>All non-staff players</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="bulk-filter"
              value={FILTER_ACTIVE}
              checked={filterMode === FILTER_ACTIVE}
              onChange={() => { setFilterMode(FILTER_ACTIVE); setPreview(null); }}
            />
            <span>Players active in the last</span>
            <input
              type="number"
              aria-label="Active within days"
              className="w-20 p-1 bg-bg-elevated border border-border-light rounded text-text-primary"
              value={activeDays}
              min="1"
              onChange={(e) => { setActiveDays(e.target.value); setPreview(null); }}
              disabled={filterMode !== FILTER_ACTIVE}
            />
            <span>days</span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="bulk-filter"
              value={FILTER_IDS}
              checked={filterMode === FILTER_IDS}
              onChange={() => { setFilterMode(FILTER_IDS); setPreview(null); }}
              className="mt-2"
            />
            <div className="flex-1">
              <span className="block mb-1">Specific user IDs (comma-separated)</span>
              <input
                type="text"
                aria-label="User IDs"
                placeholder="e.g. 12, 34, 78"
                className="w-full p-2 bg-bg-elevated border border-border-light rounded-lg text-text-primary"
                value={idListText}
                onChange={(e) => { setIdListText(e.target.value); setPreview(null); }}
                disabled={filterMode !== FILTER_IDS}
              />
            </div>
          </label>
        </fieldset>

        {preview && (
          <div
            data-testid="bulk-preview"
            className="p-3 rounded-lg bg-bg-elevated border border-border-light text-sm text-text-primary"
          >
            Will credit {preview.wouldCredit} users{sampleText}.
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button color="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button color="primary" onClick={handlePreview} disabled={isSubmitting}>
            Preview
          </Button>
          <Button
            color="success"
            onClick={handleGrant}
            disabled={isSubmitting || !preview || preview.wouldCredit === 0}
          >
            Grant
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default BulkCreditModal;
