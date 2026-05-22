import React from 'react';
import { MIN_HOUSE_EDGE_FRACTION } from '../../../lib/payoutMath';

const RtpPreview = ({ rtp, label = 'Estimated RTP', testId }) => {
  const safe = Number.isFinite(rtp) ? rtp : 0;
  const edge = 1 - safe;
  const belowFloor = edge < MIN_HOUSE_EDGE_FRACTION;
  return (
    <div
      data-testid={testId || 'rtp-preview'}
      className="flex items-center justify-between bg-bg-base border border-border rounded-lg px-4 py-3 mb-4"
    >
      <div>
        <div className="text-xs uppercase tracking-wide text-text-muted">{label}</div>
        <div className="font-mono text-lg text-accent-gold" data-testid="rtp-value">
          {(safe * 100).toFixed(2)}%
        </div>
        <div className="text-xs text-text-muted" data-testid="house-edge-value">
          House edge: {(edge * 100).toFixed(2)}%
        </div>
      </div>
      {belowFloor && (
        <span
          data-testid="rtp-warning"
          className="text-xs font-semibold bg-status-error/20 text-status-error border border-status-error/40 px-2 py-1 rounded"
        >
          Below {(MIN_HOUSE_EDGE_FRACTION * 100).toFixed(0)}% edge floor
        </span>
      )}
    </div>
  );
};

export default RtpPreview;
