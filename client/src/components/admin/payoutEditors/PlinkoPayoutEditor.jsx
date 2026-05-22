import React, { useMemo, useState } from 'react';
import { plinkoRtp, MIN_HOUSE_EDGE_FRACTION } from '../../../lib/payoutMath';
import RtpPreview from './RtpPreview';

const RISKS = ['low', 'medium', 'high'];
const ROW_COUNTS = ['8', '9', '10', '11', '12', '13', '14', '15', '16'];

const PlinkoPayoutEditor = ({ payoutTable, onChange, houseEdge = 0 }) => {
  const [risk, setRisk] = useState('low');
  const [rows, setRows] = useState('8');

  const buckets = payoutTable?.[risk]?.[rows];
  const safeBuckets = Array.isArray(buckets) ? buckets : [];
  const rtp = useMemo(
    () => plinkoRtp(payoutTable, risk, Number(rows), houseEdge),
    [payoutTable, risk, rows, houseEdge]
  );
  const belowFloor = (1 - rtp) < MIN_HOUSE_EDGE_FRACTION;

  const handleEdit = (idx, raw) => {
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n) || n < 0) return;
    const next = safeBuckets.slice();
    next[idx] = n;
    onChange({
      ...payoutTable,
      [risk]: {
        ...(payoutTable?.[risk] || {}),
        [rows]: next,
      },
    });
  };

  return (
    <div data-testid="plinko-payout-editor">
      <div role="tablist" aria-label="Risk" className="flex gap-2 mb-3">
        {RISKS.map((r) => {
          const active = risk === r;
          return (
            <button
              key={r}
              role="tab"
              type="button"
              aria-selected={active}
              data-testid={`plinko-risk-${r}`}
              onClick={() => setRisk(r)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                active
                  ? 'bg-accent-gold text-bg-base'
                  : 'bg-bg-elevated text-text-secondary hover:bg-bg-surface'
              }`}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          );
        })}
      </div>

      <div role="tablist" aria-label="Rows" className="flex flex-wrap gap-1 mb-4">
        {ROW_COUNTS.map((r) => {
          const active = rows === r;
          return (
            <button
              key={r}
              role="tab"
              type="button"
              aria-selected={active}
              data-testid={`plinko-rows-${r}`}
              onClick={() => setRows(r)}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                active
                  ? 'bg-accent-purple text-white'
                  : 'bg-bg-elevated text-text-secondary hover:bg-bg-surface'
              }`}
            >
              {r}
            </button>
          );
        })}
      </div>

      <RtpPreview rtp={rtp} label={`Estimated RTP (${risk} / ${rows} rows)`} testId="plinko-rtp" />

      <div className="border border-border rounded-lg p-3 bg-bg-base/40">
        <div className="flex flex-wrap gap-2" data-testid="plinko-buckets">
          {safeBuckets.map((value, idx) => (
            <div key={`${risk}-${rows}-${idx}`} className="flex flex-col items-center">
              <span className="text-[10px] text-text-muted mb-1">#{idx}</span>
              <input
                type="number"
                min="0"
                step="any"
                value={value}
                aria-label={`${risk} ${rows} bucket ${idx}`}
                data-testid={`plinko-input-${risk}-${rows}-${idx}`}
                onChange={(e) => handleEdit(idx, e.target.value)}
                className="w-16 px-2 py-1 rounded bg-bg-surface border border-border text-text-primary text-center focus:outline-none focus:ring-2 focus:ring-accent-gold/50"
              />
            </div>
          ))}
          {safeBuckets.length === 0 && (
            <span className="text-sm text-text-muted">
              No buckets defined for this combination.
            </span>
          )}
        </div>
        <p className="text-xs text-text-muted mt-3">
          Structure is fixed: {rows}-row plinko has {Number(rows) + 1} buckets.
        </p>
      </div>

      {belowFloor && (
        <p className="mt-3 text-xs text-status-error" data-testid="floor-warning">
          Estimated RTP exceeds the {(1 - MIN_HOUSE_EDGE_FRACTION) * 100}% ceiling. Save is disabled until adjusted.
        </p>
      )}
    </div>
  );
};

export default PlinkoPayoutEditor;
