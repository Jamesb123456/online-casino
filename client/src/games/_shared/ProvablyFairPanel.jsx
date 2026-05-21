import React, { useCallback, useState } from 'react';
import Button from '@/components/ui/Button';
import { verifyResult } from '@/lib/provablyFair';

/**
 * ProvablyFairPanel — verifier UI for the rebuilt games.
 *
 * Props
 *   currentHash           latest serverSeedHash from gameState (string|null)
 *   clientSeed            current client seed (string)
 *   onClientSeedChange    setter; receives the new seed string
 *   history               array of { id, gameType, serverSeedHash, serverSeed,
 *                                    clientSeed, nonce, outcome, multiplier,
 *                                    timestamp }
 *
 * The component is presentational + verification — it does not fetch.
 */
const ProvablyFairPanel = ({
  currentHash = null,
  clientSeed = '',
  onClientSeedChange,
  history = [],
}) => {
  const [seedDraft, setSeedDraft] = useState(clientSeed);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [verifications, setVerifications] = useState({});

  // Sync local draft when the external seed changes.
  React.useEffect(() => {
    setSeedDraft(clientSeed);
  }, [clientSeed]);

  const rotate = useCallback(() => {
    if (typeof onClientSeedChange !== 'function') return;
    const next = seedDraft.trim() || generateSeed();
    onClientSeedChange(next);
  }, [onClientSeedChange, seedDraft]);

  const copyHash = useCallback(async () => {
    if (!currentHash) return;
    try {
      await navigator.clipboard.writeText(currentHash);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  }, [currentHash]);

  const verifyRow = useCallback((row) => {
    try {
      const result = verifyResult({
        serverSeed: row.serverSeed,
        serverSeedHash: row.serverSeedHash,
        clientSeed: row.clientSeed,
        nonce: row.nonce,
      });
      setVerifications((prev) => ({ ...prev, [row.id]: result }));
    } catch (err) {
      setVerifications((prev) => ({
        ...prev,
        [row.id]: { valid: false, error: err?.message || 'verify_failed' },
      }));
    }
  }, []);

  const hasHistory = Array.isArray(history) && history.length > 0;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs uppercase tracking-wider text-text-secondary">
          Provably fair
        </h2>
        <span className="text-[10px] text-accent-gold uppercase tracking-wider">
          SHA-256
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="pf-current-hash"
          className="text-[11px] uppercase tracking-wider text-text-secondary"
        >
          Server seed hash (next round)
        </label>
        <div className="flex items-stretch gap-2">
          <input
            id="pf-current-hash"
            readOnly
            value={currentHash || ''}
            placeholder="awaiting round…"
            className="flex-1 min-w-0 bg-bg-base border border-border-light rounded-md px-2 py-1.5 font-mono text-xs text-text-primary truncate focus-visible:ring-2 focus-visible:ring-accent-gold focus:outline-none"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={copyHash}
            disabled={!currentHash}
            aria-label="Copy server seed hash"
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="pf-client-seed"
          className="text-[11px] uppercase tracking-wider text-text-secondary"
        >
          Your client seed
        </label>
        <div className="flex items-stretch gap-2">
          <input
            id="pf-client-seed"
            type="text"
            value={seedDraft}
            onChange={(e) => setSeedDraft(e.target.value)}
            className="flex-1 min-w-0 bg-bg-base border border-border-light rounded-md px-2 py-1.5 font-mono text-xs text-text-primary focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:border-accent-gold focus:outline-none"
          />
          <Button
            variant="outlineAccent"
            size="sm"
            onClick={rotate}
            aria-label="Rotate client seed"
          >
            Rotate
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="pf-history-list"
          className="flex items-center justify-between text-xs text-text-secondary hover:text-accent-gold transition-colors focus-visible:ring-2 focus-visible:ring-accent-gold focus:outline-none rounded px-1 py-0.5"
        >
          <span>
            Recent rounds {hasHistory ? `(${history.length})` : ''}
          </span>
          <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
        </button>

        {expanded ? (
          <div
            id="pf-history-list"
            className="flex flex-col gap-1 max-h-60 overflow-y-auto pr-1"
          >
            {!hasHistory ? (
              <p className="text-xs text-text-secondary italic px-1 py-2">
                No rounds played yet
              </p>
            ) : (
              history.map((row) => {
                const v = verifications[row.id];
                return (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-2 bg-bg-base border border-border-light rounded-md px-2 py-1.5"
                  >
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 text-[11px] text-text-secondary">
                        <span className="uppercase tracking-wider">
                          {row.gameType || 'round'}
                        </span>
                        <span className="font-mono">#{row.nonce}</span>
                        {typeof row.multiplier === 'number' ? (
                          <span className="font-mono text-accent-gold">
                            {row.multiplier.toFixed(2)}×
                          </span>
                        ) : null}
                      </div>
                      <div className="font-mono text-[10px] text-text-secondary truncate">
                        {row.serverSeedHash}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {v ? (
                        <span
                          className={
                            v.valid
                              ? 'text-status-success text-xs font-mono'
                              : 'text-status-error text-xs font-mono'
                          }
                          aria-label={v.valid ? 'Verified' : 'Verification failed'}
                        >
                          {v.valid ? '✓' : '✗'}
                        </span>
                      ) : null}
                      <Button
                        variant="subtle"
                        size="xs"
                        onClick={() => verifyRow(row)}
                        disabled={!row.serverSeed}
                      >
                        Verify
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

function generateSeed() {
  // 16 hex chars; cryptographically random if available.
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const buf = new Uint8Array(8);
    window.crypto.getRandomValues(buf);
    return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(16).slice(2, 18);
}

export default ProvablyFairPanel;
