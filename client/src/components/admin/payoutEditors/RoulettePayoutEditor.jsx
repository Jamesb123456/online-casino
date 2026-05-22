import React, { useMemo, useState } from 'react';
import Button from '../../ui/Button';
import { rouletteRtp, MIN_HOUSE_EDGE_FRACTION } from '../../../lib/payoutMath';
import RtpPreview from './RtpPreview';

const sortedKeys = (table) => Object.keys(table || {}).sort((a, b) => a.localeCompare(b));

const RoulettePayoutEditor = ({ payoutTable, onChange, houseEdge = 0 }) => {
  const [newKey, setNewKey] = useState('');
  const [newMult, setNewMult] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const keys = sortedKeys(payoutTable);
  const rtp = useMemo(() => rouletteRtp(payoutTable, houseEdge), [payoutTable, houseEdge]);
  const belowFloor = (1 - rtp) < MIN_HOUSE_EDGE_FRACTION;

  const handleEdit = (key, raw) => {
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n) || n < 0) return;
    onChange({ ...payoutTable, [key]: n });
  };

  const handleDelete = (key) => {
    const next = { ...payoutTable };
    delete next[key];
    onChange(next);
    setConfirmDelete(null);
  };

  const handleAdd = () => {
    const key = newKey.trim().toUpperCase();
    const mult = Number(newMult);
    if (!key || !Number.isFinite(mult) || mult < 0) return;
    if (payoutTable && Object.prototype.hasOwnProperty.call(payoutTable, key)) return;
    onChange({ ...payoutTable, [key]: mult });
    setNewKey('');
    setNewMult('');
  };

  return (
    <div data-testid="roulette-payout-editor">
      <RtpPreview rtp={rtp} testId="roulette-rtp" />
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-base">
            <tr>
              <th className="px-3 py-2 text-left text-text-muted font-medium">Bet type</th>
              <th className="px-3 py-2 text-left text-text-muted font-medium">Multiplier (x)</th>
              <th className="px-3 py-2 text-right text-text-muted font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key} className="border-t border-border" data-testid={`row-${key}`}>
                <td className="px-3 py-2 font-mono text-text-primary">{key}</td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={payoutTable[key]}
                    aria-label={`${key} multiplier`}
                    data-testid={`input-${key}`}
                    onChange={(e) => handleEdit(key, e.target.value)}
                    className="w-28 px-2 py-1 rounded bg-bg-surface border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold/50"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  {confirmDelete === key ? (
                    <span className="inline-flex gap-2">
                      <Button size="xs" variant="danger" onClick={() => handleDelete(key)}>
                        Confirm
                      </Button>
                      <Button size="xs" variant="subtle" onClick={() => setConfirmDelete(null)}>
                        Cancel
                      </Button>
                    </span>
                  ) : (
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={() => setConfirmDelete(key)}
                    >
                      Delete
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-text-muted text-sm">
                  No bet types defined.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 bg-bg-base/60 p-3 rounded-lg border border-border">
        <div>
          <label htmlFor="new-bet-key" className="block text-xs text-text-muted mb-1">New bet type</label>
          <input
            id="new-bet-key"
            type="text"
            value={newKey}
            placeholder="e.g. STRAIGHT"
            onChange={(e) => setNewKey(e.target.value)}
            className="w-40 px-2 py-1 rounded bg-bg-surface border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold/50"
          />
        </div>
        <div>
          <label htmlFor="new-bet-mult" className="block text-xs text-text-muted mb-1">Multiplier</label>
          <input
            id="new-bet-mult"
            type="number"
            min="0"
            step="any"
            value={newMult}
            onChange={(e) => setNewMult(e.target.value)}
            className="w-28 px-2 py-1 rounded bg-bg-surface border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold/50"
          />
        </div>
        <Button size="sm" variant="primary" onClick={handleAdd} data-testid="add-bet-type">
          Add bet type
        </Button>
      </div>

      {belowFloor && (
        <p className="mt-3 text-xs text-status-error" data-testid="floor-warning">
          Estimated RTP exceeds the {(1 - MIN_HOUSE_EDGE_FRACTION) * 100}% ceiling. Save is disabled until adjusted.
        </p>
      )}
    </div>
  );
};

export default RoulettePayoutEditor;
