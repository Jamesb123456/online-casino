import React from 'react';

/**
 * KPI stat card component for admin analytics pages.
 * Displays a metric value with optional change indicator and icon.
 *
 * @param {object} props
 * @param {string} props.label - Metric name
 * @param {string|number} props.value - Pre-formatted metric value
 * @param {number} [props.change] - Percentage change (e.g. +12.5 or -3.2)
 * @param {string} [props.changeLabel] - Context for the change (e.g. "vs last period")
 * @param {string} [props.icon] - Emoji icon displayed in top-left
 * @param {string} [props.className] - Additional CSS classes
 */
const StatCard = ({ label, value, change, changeLabel, icon, className = '' }) => {
  const isPositive = change > 0;
  const isNegative = change < 0;

  return (
    <div
      className={`bg-bg-card rounded-xl border border-white/5 p-5 hover:border-accent-gold/20 transition-colors ${className}`}
    >
      <div className="flex items-start justify-between mb-3">
        {icon && (
          <div className="bg-bg-elevated rounded-lg p-2 text-lg" aria-hidden="true">
            {icon}
          </div>
        )}
        {change !== undefined && change !== null && (
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              isPositive
                ? 'bg-status-success/10 text-status-success'
                : isNegative
                  ? 'bg-status-error/10 text-status-error'
                  : 'bg-bg-elevated text-text-muted'
            }`}
            aria-label={`${isPositive ? 'Up' : isNegative ? 'Down' : 'No change'} ${Math.abs(change).toFixed(1)} percent`}
          >
            {isPositive ? '+' : ''}{change.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-text-primary font-heading">
        {value}
      </div>
      <div className="text-sm text-text-secondary mt-1">
        {label}
      </div>
      {changeLabel && (
        <div className="text-xs text-text-muted mt-1">
          {changeLabel}
        </div>
      )}
    </div>
  );
};

export default StatCard;
