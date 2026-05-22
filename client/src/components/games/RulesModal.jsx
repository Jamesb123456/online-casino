import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { api } from '../../services/api';
import { formatCredits } from '../../lib/formatCredits';

const formatHouseEdge = (edge) => {
  const num = Number(edge);
  if (!Number.isFinite(num)) return '—';
  return `${(num * 100).toFixed(2)}%`;
};

const RulesModal = ({ gameType, gameName, open, onClose, children }) => {
  const [status, setStatus] = useState('idle');
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !gameType) return;
    let cancelled = false;
    setStatus('loading');
    setError(null);
    api
      .get(`/games/config/${gameType}`)
      .then((data) => {
        if (cancelled) return;
        setConfig(data);
        setStatus('success');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load game info');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [open, gameType]);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={`${gameName} — How it works`}
      size="2xl"
      footer={<Button variant="subtle" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-5">
        <div className="text-sm text-text-secondary space-y-4 leading-relaxed">
          {children}
        </div>

        <div className="rounded-lg border border-border bg-bg-base/60 p-4">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Current settings</h4>
          {status === 'loading' && (
            <p className="text-xs text-text-muted" data-testid="rules-config-loading">Loading current odds…</p>
          )}
          {status === 'error' && (
            <p className="text-xs text-status-error" data-testid="rules-config-error">{error}</p>
          )}
          {status === 'success' && config && (
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-text-muted">House edge</dt>
                <dd className="text-text-primary font-semibold" data-testid="rules-house-edge">
                  {formatHouseEdge(config.houseEdge)}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Max bet</dt>
                <dd className="text-text-primary font-semibold" data-testid="rules-max-bet">
                  {Number(config.maxBet) > 0 ? formatCredits(Number(config.maxBet)) : 'No max'}
                </dd>
              </div>
            </dl>
          )}
        </div>

        <p className="text-xs text-text-muted italic">
          Odds are configured by the operator and may change. Values shown above are the most recently published.
        </p>
      </div>
    </Modal>
  );
};

export default RulesModal;
