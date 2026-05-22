import express, { Request, Response } from 'express';
import { authenticate as auth, adminOnly, adminOrOperatorOrViewer } from '../middleware/auth.js';
import LoggingService from '../src/services/loggingService.js';
import GameConfigService, { KNOWN_GAMES } from '../src/services/gameConfigService.js';

const router = express.Router();

function isKnownGame(gameType: string): boolean {
  return KNOWN_GAMES.includes(gameType);
}

function validatePatch(patch: any): { ok: true; clean: any } | { ok: false; error: string } {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { ok: false, error: 'invalid_payload' };
  }
  const clean: any = {};

  if (patch.houseEdge != null) {
    const n = Number(patch.houseEdge);
    if (!Number.isFinite(n) || n < 0 || n > 0.5) {
      return { ok: false, error: 'houseEdge must be between 0 and 0.5' };
    }
    clean.houseEdge = n;
  }

  if (patch.maxBet != null) {
    const n = Number(patch.maxBet);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: 'maxBet must be >= 0' };
    }
    clean.maxBet = n;
  }

  if (patch.payoutTable != null) {
    if (typeof patch.payoutTable !== 'object' || Array.isArray(patch.payoutTable)) {
      return { ok: false, error: 'payoutTable must be a JSON object' };
    }
    clean.payoutTable = patch.payoutTable;
  }

  if (patch.enabled != null) {
    if (typeof patch.enabled !== 'boolean') {
      return { ok: false, error: 'enabled must be a boolean' };
    }
    clean.enabled = patch.enabled;
  }

  if (Object.keys(clean).length === 0) {
    return { ok: false, error: 'no_updatable_fields' };
  }

  return { ok: true, clean };
}

// List all six configs
router.get('/configs', auth, adminOrOperatorOrViewer, async (_req: Request, res: Response) => {
  try {
    const configs = await GameConfigService.listConfigs();
    res.json({ configs });
  } catch (error) {
    LoggingService.logSystemEvent('admin_game_configs_list_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error fetching game configs' });
  }
});

// Get one config
router.get('/:gameType/config', auth, adminOrOperatorOrViewer, async (req: Request, res: Response) => {
  try {
    const gameType = String(req.params.gameType);
    if (!isKnownGame(gameType)) {
      return res.status(404).json({ message: 'Unknown game type' });
    }
    const cfg = await GameConfigService.getConfig(gameType);
    res.json({ gameType, ...cfg });
  } catch (error) {
    LoggingService.logSystemEvent('admin_game_config_read_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error fetching game config' });
  }
});

// Update one config
router.put('/:gameType/config', auth, adminOnly, async (req: any, res: Response) => {
  try {
    const gameType = String(req.params.gameType);
    if (!isKnownGame(gameType)) {
      return res.status(404).json({ message: 'Unknown game type' });
    }

    const validation: any = validatePatch(req.body);
    if (!validation.ok) {
      return res.status(400).json({ message: validation.error });
    }

    const adminId = req.user?.id ?? req.user?.userId ?? null;
    await GameConfigService.setConfig(gameType, validation.clean, adminId);

    LoggingService.logSystemEvent('admin_game_config_updated', {
      gameType,
      adminId,
      patch: validation.clean,
    });

    const updated = await GameConfigService.getConfig(gameType);
    res.json({ gameType, ...updated });
  } catch (error) {
    LoggingService.logSystemEvent('admin_game_config_update_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error updating game config' });
  }
});

export default router;
