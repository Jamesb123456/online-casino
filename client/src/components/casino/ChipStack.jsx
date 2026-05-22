import React, { useMemo } from 'react';

/**
 * ChipStack — SVG render of stacked poker chips.
 *
 * Props:
 *   amount   number — total bet; chip count scales logarithmically (max 5).
 *   color    one of 'violet' | 'gold' | 'lime' | 'rose' | 'blue'. Default 'violet'.
 *   size     number — pixel diameter of each chip. Default 36.
 *   ariaLabel for screen readers.
 */

const PALETTE = {
  violet: { face: '#7C3AED', edge: '#5B21B6', accent: '#C4B5FD' },
  gold: { face: '#FBBF24', edge: '#B45309', accent: '#FDE68A' },
  lime: { face: '#A3E635', edge: '#3F6212', accent: '#D9F99D' },
  rose: { face: '#F43F5E', edge: '#9F1239', accent: '#FECDD3' },
  blue: { face: '#3B82F6', edge: '#1E3A8A', accent: '#BFDBFE' },
};

function chipCountFor(amount) {
  const a = Number(amount);
  if (!Number.isFinite(a) || a <= 0) return 0;
  if (a < 5) return 1;
  if (a < 25) return 2;
  if (a < 100) return 3;
  if (a < 500) return 4;
  return 5;
}

function Chip({ color, size, yOffset }) {
  const p = PALETTE[color] || PALETTE.violet;
  const r = size / 2;
  const cx = r;
  const cy = r + yOffset;
  return (
    <g>
      {/* Edge (under) */}
      <ellipse cx={cx} cy={cy + size * 0.08} rx={r * 0.92} ry={r * 0.3} fill={p.edge} />
      {/* Face */}
      <circle cx={cx} cy={cy} r={r * 0.92} fill={p.face} />
      {/* Inner ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.62}
        fill="none"
        stroke={p.accent}
        strokeDasharray="4 3"
        strokeWidth={Math.max(1, r * 0.08)}
        opacity="0.85"
      />
      {/* Centre dot */}
      <circle cx={cx} cy={cy} r={r * 0.18} fill={p.accent} />
    </g>
  );
}

function ChipStack({
  amount = 0,
  color = 'violet',
  size = 36,
  className = '',
  ariaLabel,
}) {
  const count = chipCountFor(amount);
  const stackHeight = size + (Math.max(1, count) - 1) * (size * 0.18);

  const chips = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i += 1) {
      // Bottom chip first → top chip last (so highest yOffset sits at the bottom).
      const yOffset = (count - 1 - i) * size * 0.18;
      arr.push(yOffset);
    }
    return arr;
  }, [count, size]);

  const label = ariaLabel || `Chip stack worth ${Number(amount).toFixed(2)}`;

  return (
    <span
      className={`inline-block transition-transform duration-200 ease-out hover:-translate-y-0.5 ${className}`}
      role="img"
      aria-label={label}
    >
      {count === 0 ? (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={size * 0.4} fill="none" stroke="#2D3B4F" strokeDasharray="2 3" />
        </svg>
      ) : (
        <svg
          width={size}
          height={stackHeight + size * 0.18}
          viewBox={`0 0 ${size} ${stackHeight + size * 0.18}`}
          aria-hidden="true"
        >
          {chips.map((yOffset, idx) => (
            <Chip key={idx} color={color} size={size} yOffset={yOffset} />
          ))}
        </svg>
      )}
    </span>
  );
}

export default ChipStack;
