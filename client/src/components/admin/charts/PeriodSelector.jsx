import React from 'react';

const defaultOptions = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All' },
];

/**
 * Time period toggle for analytics pages.
 * Renders a pill-shaped button group with an active gold highlight.
 *
 * @param {object} props
 * @param {string} props.value - Currently selected period value
 * @param {function} props.onChange - Callback receiving the new period value
 * @param {Array<{value: string, label: string}>} [props.options] - Override default period options
 */
const PeriodSelector = ({ value, onChange, options = defaultOptions }) => {
  return (
    <div className="inline-flex bg-bg-elevated rounded-lg p-1 gap-1" role="group" aria-label="Time period selector">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            value === opt.value
              ? 'bg-accent-gold text-bg-base'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

export default PeriodSelector;
