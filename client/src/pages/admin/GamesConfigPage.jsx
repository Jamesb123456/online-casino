import React, { useState, useEffect, useCallback, useMemo } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import useAuth from '../../hooks/useAuth';
import {
  RoulettePayoutEditor,
  WheelPayoutEditor,
  PlinkoPayoutEditor,
  BlackjackPayoutEditor,
  FormulaOnlyMessage,
} from '../../components/admin/payoutEditors';
import {
  rouletteRtp,
  wheelRtp,
  plinkoRtp,
  blackjackRtp,
  MIN_HOUSE_EDGE_FRACTION,
} from '../../lib/payoutMath';

const GAME_LABELS = {
  crash: 'Crash',
  roulette: 'Roulette',
  wheel: 'Wheel',
  plinko: 'Plinko',
  landmines: 'Landmines',
  blackjack: 'Blackjack',
  dice: 'Dice',
  slots: 'Slots',
};

const FORMULA_ONLY_GAMES = new Set(['crash', 'landmines', 'dice']);

const cloneTable = (table) => JSON.parse(JSON.stringify(table ?? {}));

// Returns true if the current draft payoutTable would violate the RTP/edge floor.
const violatesFloor = (gameType, draft, houseEdge) => {
  if (FORMULA_ONLY_GAMES.has(gameType)) return false;
  if (gameType === 'roulette') {
    return (1 - rouletteRtp(draft, houseEdge)) < MIN_HOUSE_EDGE_FRACTION;
  }
  if (gameType === 'wheel') {
    // Worst case across difficulties — the most player-favourable difficulty must still respect the floor.
    return ['easy', 'medium', 'hard'].some(
      (d) => (1 - wheelRtp(draft, d, houseEdge)) < MIN_HOUSE_EDGE_FRACTION
    );
  }
  if (gameType === 'plinko') {
    for (const risk of ['low', 'medium', 'high']) {
      const rowsObj = draft?.[risk] || {};
      for (const rowKey of Object.keys(rowsObj)) {
        const rtp = plinkoRtp(draft, risk, Number(rowKey), houseEdge);
        if ((1 - rtp) < MIN_HOUSE_EDGE_FRACTION) return true;
      }
    }
    return false;
  }
  if (gameType === 'blackjack') {
    return (1 - blackjackRtp(draft, houseEdge)) < MIN_HOUSE_EDGE_FRACTION;
  }
  return false;
};

const GameConfigCard = ({ config, onSaved, canEdit }) => {
  const toast = useToast();
  const [houseEdgePct, setHouseEdgePct] = useState(((config.houseEdge ?? 0) * 100).toFixed(2));
  const [maxBet, setMaxBet] = useState(String(config.maxBet ?? 0));
  const [enabled, setEnabled] = useState(Boolean(config.enabled));
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [draftPayoutTable, setDraftPayoutTable] = useState(() => cloneTable(config.payoutTable));
  const [savingPayout, setSavingPayout] = useState(false);
  const disabled = saving || !canEdit;

  useEffect(() => {
    setHouseEdgePct(((config.houseEdge ?? 0) * 100).toFixed(2));
    setMaxBet(String(config.maxBet ?? 0));
    setEnabled(Boolean(config.enabled));
    setDraftPayoutTable(cloneTable(config.payoutTable));
  }, [config]);

  const saveField = async (patch, successMessage) => {
    try {
      setSaving(true);
      const res = await api.put(`/admin/games/${config.gameType}/config`, patch);
      onSaved(config.gameType, res);
      toast.success(successMessage || `${GAME_LABELS[config.gameType]} updated`);
    } catch (error) {
      toast.error(`Update failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEdgeCommit = () => {
    if (!canEdit) return;
    const pct = Number(houseEdgePct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 50) {
      toast.error('House edge must be between 0% and 50%');
      return;
    }
    const decimal = pct / 100;
    if (Math.abs(decimal - (config.houseEdge ?? 0)) < 1e-9) return;
    saveField({ houseEdge: decimal }, `${GAME_LABELS[config.gameType]} edge set to ${pct.toFixed(2)}%`);
  };

  const handleMaxBetSave = () => {
    if (!canEdit) return;
    const n = Number(maxBet);
    if (!Number.isFinite(n) || n < 0) {
      toast.error('Max bet must be a non-negative number');
      return;
    }
    saveField({ maxBet: n });
  };

  const handleEnabledToggle = () => {
    if (!canEdit) return;
    const next = !enabled;
    setEnabled(next);
    saveField({ enabled: next }, `${GAME_LABELS[config.gameType]} ${next ? 'enabled' : 'disabled'}`);
  };

  const handleAdvancedOpen = () => {
    setDraftPayoutTable(cloneTable(config.payoutTable));
    setShowAdvanced(true);
  };

  const handleAdvancedCancel = () => {
    setDraftPayoutTable(cloneTable(config.payoutTable));
    setShowAdvanced(false);
  };

  const handlePayoutSave = async () => {
    if (!canEdit) return;
    try {
      setSavingPayout(true);
      const res = await api.put(`/admin/games/${config.gameType}/config`, {
        payoutTable: draftPayoutTable,
      });
      onSaved(config.gameType, res);
      toast.success(`${GAME_LABELS[config.gameType]} payout table updated`);
      setShowAdvanced(false);
    } catch (error) {
      toast.error(`Update failed: ${error.message}`);
    } finally {
      setSavingPayout(false);
    }
  };

  const isFormulaOnly = FORMULA_ONLY_GAMES.has(config.gameType);
  const floorViolated = useMemo(
    () => violatesFloor(config.gameType, draftPayoutTable, config.houseEdge ?? 0),
    [config.gameType, draftPayoutTable, config.houseEdge]
  );
  const saveDisabled = !canEdit || savingPayout || isFormulaOnly || floorViolated;

  const renderEditor = () => {
    if (isFormulaOnly) return <FormulaOnlyMessage gameType={config.gameType} />;
    if (config.gameType === 'roulette') {
      return (
        <RoulettePayoutEditor
          payoutTable={draftPayoutTable}
          onChange={setDraftPayoutTable}
          houseEdge={config.houseEdge ?? 0}
        />
      );
    }
    if (config.gameType === 'wheel') {
      return (
        <WheelPayoutEditor
          payoutTable={draftPayoutTable}
          onChange={setDraftPayoutTable}
          houseEdge={config.houseEdge ?? 0}
        />
      );
    }
    if (config.gameType === 'plinko') {
      return (
        <PlinkoPayoutEditor
          payoutTable={draftPayoutTable}
          onChange={setDraftPayoutTable}
          houseEdge={config.houseEdge ?? 0}
        />
      );
    }
    if (config.gameType === 'blackjack') {
      return (
        <BlackjackPayoutEditor
          payoutTable={draftPayoutTable}
          onChange={setDraftPayoutTable}
          houseEdge={config.houseEdge ?? 0}
        />
      );
    }
    return (
      <pre className="bg-bg-base p-4 rounded-lg overflow-auto text-xs text-text-secondary max-h-[60vh] border border-border">
        {JSON.stringify(draftPayoutTable ?? {}, null, 2)}
      </pre>
    );
  };

  return (
    <div className="bg-bg-card rounded-xl p-6 shadow-card border border-border">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-text-primary">{GAME_LABELS[config.gameType] || config.gameType}</h3>
          <p className="text-text-muted text-xs uppercase tracking-wide mt-1">{config.gameType}</p>
        </div>
        <label className="flex items-center cursor-pointer">
          <span className="text-text-secondary text-sm mr-2">{enabled ? 'Enabled' : 'Disabled'}</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleEnabledToggle}
            disabled={disabled}
            data-testid={`enabled-toggle-${config.gameType}`}
            className="w-10 h-6 cursor-pointer accent-accent-gold"
          />
        </label>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label htmlFor={`edge-${config.gameType}`} className="text-sm font-medium text-text-secondary">
            House edge
          </label>
          <span className="text-accent-gold font-mono font-semibold" data-testid={`edge-value-${config.gameType}`}>
            {Number(houseEdgePct).toFixed(2)}%
          </span>
        </div>
        <input
          id={`edge-${config.gameType}`}
          type="range"
          min="0"
          max="50"
          step="0.1"
          value={houseEdgePct}
          onChange={(e) => setHouseEdgePct(e.target.value)}
          onMouseUp={handleEdgeCommit}
          onTouchEnd={handleEdgeCommit}
          onKeyUp={handleEdgeCommit}
          disabled={disabled}
          className="w-full accent-accent-gold cursor-pointer"
        />
      </div>

      <div className="mb-4">
        <Input
          type="number"
          name={`maxbet-${config.gameType}`}
          label="Max bet (0 = no cap)"
          value={maxBet}
          onChange={(e) => setMaxBet(e.target.value)}
          min={0}
          step="any"
          disabled={disabled}
        />
        <Button variant="primary" size="sm" onClick={handleMaxBetSave} disabled={disabled}>
          Save max bet
        </Button>
      </div>

      <div className="flex justify-end">
        <Button variant="subtle" size="sm" onClick={handleAdvancedOpen} data-testid={`advanced-${config.gameType}`}>
          Advanced
        </Button>
      </div>

      <Modal
        isOpen={showAdvanced}
        onClose={handleAdvancedCancel}
        title={`${GAME_LABELS[config.gameType] || config.gameType} — payout table`}
        size="3xl"
        footer={
          <>
            <Button variant="subtle" onClick={handleAdvancedCancel} disabled={savingPayout}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handlePayoutSave}
              disabled={saveDisabled}
              data-testid={`save-payout-${config.gameType}`}
            >
              {savingPayout ? 'Saving…' : 'Save Payout Table'}
            </Button>
          </>
        }
      >
        {renderEditor()}
      </Modal>
    </div>
  );
};

const GamesConfigPage = () => {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Game Config | Platinum Casino';
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/games/configs');
      setConfigs(res.configs || []);
    } catch (error) {
      toast.error(`Failed to load game configs: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSaved = (gameType, updated) => {
    setConfigs((prev) => prev.map((c) => (c.gameType === gameType ? { ...updated, gameType } : c)));
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-text-primary">Game Configuration</h1>
        </div>
        <p className="text-text-muted">
          Live odds and limits for every game. Changes apply on the next round (config has a short TTL cache).
        </p>
        {!isAdmin && (
          <div
            data-testid="config-readonly-banner"
            className="bg-bg-card border border-border rounded-lg p-3 text-sm text-text-secondary"
          >
            You have read-only access to game configuration. Only admins can change these values.
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-gold"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" data-testid="game-config-grid">
            {configs.map((cfg) => (
              <GameConfigCard key={cfg.gameType} config={cfg} onSaved={handleSaved} canEdit={isAdmin} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default GamesConfigPage;
