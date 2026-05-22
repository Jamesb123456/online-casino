import React, { useMemo } from 'react';
import { blackjackRtp, MIN_HOUSE_EDGE_FRACTION } from '../../../lib/payoutMath';
import RtpPreview from './RtpPreview';

const FIELDS = [
  { key: 'win', label: 'Win payout (x)' },
  { key: 'blackjack', label: 'Blackjack payout (x)' },
  { key: 'push', label: 'Push payout (x)' },
];

const BlackjackPayoutEditor = ({ payoutTable, onChange, houseEdge = 0 }) => {
  const rtp = useMemo(() => blackjackRtp(payoutTable, houseEdge), [payoutTable, houseEdge]);
  const belowFloor = (1 - rtp) < MIN_HOUSE_EDGE_FRACTION;

  const handleEdit = (key, raw) => {
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n) || n < 0) return;
    onChange({ ...payoutTable, [key]: n });
  };

  return (
    <div data-testid="blackjack-payout-editor">
      <RtpPreview rtp={rtp} testId="blackjack-rtp" />
      <p className="text-xs text-text-muted mb-3">
        RTP is approximate (heuristic outcome mix).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={`bj-${f.key}`} className="block text-xs text-text-muted mb-1">
              {f.label}
            </label>
            <input
              id={`bj-${f.key}`}
              type="number"
              min="0"
              step="any"
              value={Number(payoutTable?.[f.key] ?? 0)}
              data-testid={`blackjack-input-${f.key}`}
              onChange={(e) => handleEdit(f.key, e.target.value)}
              className="w-full px-3 py-2 rounded bg-bg-surface border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold/50"
            />
          </div>
        ))}
      </div>

      {belowFloor && (
        <p className="mt-3 text-xs text-status-error" data-testid="floor-warning">
          Estimated RTP exceeds the {(1 - MIN_HOUSE_EDGE_FRACTION) * 100}% ceiling. Save is disabled until adjusted.
        </p>
      )}
    </div>
  );
};

export default BlackjackPayoutEditor;
