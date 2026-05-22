import React, { useMemo, useState } from 'react';
import Button from '../../ui/Button';
import { wheelRtp, MIN_HOUSE_EDGE_FRACTION } from '../../../lib/payoutMath';
import RtpPreview from './RtpPreview';

const DIFFICULTIES = ['easy', 'medium', 'hard'];

const WheelPayoutEditor = ({ payoutTable, onChange, houseEdge = 0 }) => {
  const [tab, setTab] = useState('easy');
  const segments = Array.isArray(payoutTable?.[tab]) ? payoutTable[tab] : [];
  const rtp = useMemo(() => wheelRtp(payoutTable, tab, houseEdge), [payoutTable, tab, houseEdge]);
  const belowFloor = (1 - rtp) < MIN_HOUSE_EDGE_FRACTION;

  const updateSegments = (next) => {
    onChange({ ...payoutTable, [tab]: next });
  };

  const handleSegmentEdit = (idx, raw) => {
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n) || n < 0) return;
    const next = segments.slice();
    next[idx] = n;
    updateSegments(next);
  };

  const handleAdd = () => updateSegments([...segments, 0]);
  const handleRemoveLast = () => {
    if (segments.length === 0) return;
    updateSegments(segments.slice(0, -1));
  };

  return (
    <div data-testid="wheel-payout-editor">
      <div role="tablist" aria-label="Difficulty" className="flex gap-2 mb-4">
        {DIFFICULTIES.map((d) => {
          const active = tab === d;
          return (
            <button
              key={d}
              role="tab"
              type="button"
              aria-selected={active}
              data-testid={`wheel-tab-${d}`}
              onClick={() => setTab(d)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                active
                  ? 'bg-accent-gold text-bg-base'
                  : 'bg-bg-elevated text-text-secondary hover:bg-bg-surface'
              }`}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          );
        })}
      </div>

      <RtpPreview rtp={rtp} label={`Estimated RTP (${tab})`} testId="wheel-rtp" />

      <div className="border border-border rounded-lg p-3 bg-bg-base/40">
        <div className="flex flex-wrap gap-2" data-testid="wheel-segments">
          {segments.map((value, idx) => (
            <div key={`${tab}-${idx}`} className="flex flex-col items-center">
              <span className="text-[10px] text-text-muted mb-1">#{idx}</span>
              <input
                type="number"
                min="0"
                step="any"
                value={value}
                aria-label={`${tab} segment ${idx}`}
                data-testid={`wheel-input-${tab}-${idx}`}
                onChange={(e) => handleSegmentEdit(idx, e.target.value)}
                className="w-16 px-2 py-1 rounded bg-bg-surface border border-border text-text-primary text-center focus:outline-none focus:ring-2 focus:ring-accent-gold/50"
              />
            </div>
          ))}
          {segments.length === 0 && (
            <span className="text-sm text-text-muted">No segments defined.</span>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="primary" onClick={handleAdd} data-testid={`wheel-add-${tab}`}>
            Add segment
          </Button>
          <Button
            size="sm"
            variant="subtle"
            onClick={handleRemoveLast}
            disabled={segments.length === 0}
            data-testid={`wheel-remove-${tab}`}
          >
            Remove last
          </Button>
        </div>
      </div>

      {belowFloor && (
        <p className="mt-3 text-xs text-status-error" data-testid="floor-warning">
          Estimated RTP exceeds the {(1 - MIN_HOUSE_EDGE_FRACTION) * 100}% ceiling. Save is disabled until adjusted.
        </p>
      )}
    </div>
  );
};

export default WheelPayoutEditor;
