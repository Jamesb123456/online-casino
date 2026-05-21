import React, { useCallback, useMemo } from 'react';
import Button from '@/components/ui/Button';

/**
 * BetControls — config-driven bet input that replaces the per-game
 * BettingPanel variants. Drop into the GameLayout `controls` slot.
 *
 * Props
 *   value             current bet (number)
 *   onChange(next)    setter; component always emits a clamped number
 *   min, max          inclusive bounds (numbers)
 *   balance           current player balance (number); disables actions when < min
 *   quickAmounts      optional array of numbers; rendered as chips
 *   halveDouble       if truthy, show /2 and ×2 buttons
 *   primaryAction     callback for the main CTA (Bet / Spin / Drop / Roll)
 *   primaryDisabled   forces disable in addition to balance check
 *   primaryLabel      string label for the main CTA
 *   primaryVariant    Button variant (default 'primary')
 *   secondaryAction   optional callback (e.g. Cashout)
 *   secondaryLabel    label for the secondary action
 *   secondaryVariant  Button variant (default 'accent')
 *   secondaryDisabled optional override
 *   status            small text under the controls (announcements, errors)
 *   children          slot for game-specific custom controls
 */
const BetControls = ({
  value,
  onChange,
  min = 1,
  max = 1000,
  balance = 0,
  quickAmounts = null,
  halveDouble = false,
  primaryAction,
  primaryDisabled = false,
  primaryLabel = 'Bet',
  primaryVariant = 'primary',
  secondaryAction = null,
  secondaryLabel = '',
  secondaryVariant = 'accent',
  secondaryDisabled = false,
  status = null,
  children = null,
}) => {
  const clamp = useCallback(
    (n) => {
      if (Number.isNaN(n) || !Number.isFinite(n)) return min;
      return Math.min(max, Math.max(min, Math.floor(n)));
    },
    [min, max]
  );

  const handleInput = useCallback(
    (e) => {
      const raw = e.target.value;
      if (raw === '') {
        onChange(min);
        return;
      }
      const parsed = Number(raw);
      onChange(clamp(parsed));
    },
    [clamp, onChange, min]
  );

  const setAmount = useCallback(
    (n) => onChange(clamp(n)),
    [clamp, onChange]
  );

  const insufficient = balance < min;
  const ctaDisabled = primaryDisabled || insufficient;

  const safeValue = useMemo(() => {
    if (typeof value !== 'number' || Number.isNaN(value)) return min;
    return value;
  }, [value, min]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="bet-amount"
          className="text-xs uppercase tracking-wider text-text-secondary"
        >
          Bet amount
        </label>
        <div className="flex items-stretch gap-2">
          <input
            id="bet-amount"
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={1}
            value={safeValue}
            onChange={handleInput}
            disabled={insufficient}
            className="flex-1 bg-bg-base border border-border-light rounded-md px-3 py-2 text-text-primary font-mono tabular-nums focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:border-accent-gold focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            aria-describedby="bet-balance"
          />
          {halveDouble ? (
            <div className="flex gap-1">
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setAmount(safeValue / 2)}
                disabled={insufficient}
                aria-label="Halve bet"
              >
                ½
              </Button>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setAmount(safeValue * 2)}
                disabled={insufficient}
                aria-label="Double bet"
              >
                2×
              </Button>
            </div>
          ) : null}
        </div>
        <div
          id="bet-balance"
          className="flex items-center justify-between text-xs text-text-secondary"
        >
          <span>
            Min {min} · Max {max}
          </span>
          <span className="font-mono tabular-nums">
            Balance: <span className="text-accent-gold">{balance.toLocaleString()}</span>
          </span>
        </div>
      </div>

      {Array.isArray(quickAmounts) && quickAmounts.length > 0 ? (
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Quick bet amounts"
        >
          {quickAmounts.map((amt) => (
            <Button
              key={amt}
              variant="outline"
              size="xs"
              onClick={() => setAmount(amt)}
              disabled={insufficient || amt > max || amt < min}
            >
              {amt}
            </Button>
          ))}
        </div>
      ) : null}

      {children ? <div className="flex flex-col gap-2">{children}</div> : null}

      <div className="flex flex-col gap-2 pt-1">
        <Button
          variant={primaryVariant}
          size="lg"
          fullWidth
          onClick={primaryAction}
          disabled={ctaDisabled}
        >
          {primaryLabel}
        </Button>
        {secondaryAction ? (
          <Button
            variant={secondaryVariant}
            size="lg"
            fullWidth
            onClick={secondaryAction}
            disabled={secondaryDisabled}
          >
            {secondaryLabel}
          </Button>
        ) : null}
      </div>

      {status ? (
        <p className="text-xs text-text-secondary" role="status">
          {status}
        </p>
      ) : null}
      {insufficient ? (
        <p className="text-xs text-status-error" role="alert">
          Balance below minimum bet.
        </p>
      ) : null}
    </div>
  );
};

export default BetControls;
