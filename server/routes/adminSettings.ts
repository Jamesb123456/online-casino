/**
 * Generic admin settings routes
 *
 * Mounted at /api/admin/settings. Provides a minimal generic GET/PUT layer
 * over the `settings` table for keys that are NOT already managed by a
 * dedicated service-owned endpoint (e.g. payout caps, alert thresholds,
 * login reward config, profanity wordlist).
 *
 * Allowlist policy
 * ----------------
 * To prevent a future bug from letting an admin shadow a setting that is
 * owned by another service (which has its own cache and cross-field
 * validation), PUT only accepts:
 *   - keys in ALLOWED_SETTING_KEYS (explicit safelist)
 *   - keys matching /^custom\./ (admin scratch namespace)
 *
 * Service-owned keys (max_payout_*, alert_*, login_reward_*, profanity_words)
 * are explicitly rejected.
 *
 * Values must be JSON-serialisable; the column is `json NOT NULL`.
 */

import express, { Request, Response } from 'express';
import { authenticate as auth, adminOnly, adminOrOperatorOrViewer } from '../middleware/auth.js';
import LoggingService from '../src/services/loggingService.js';
import responsibleGamingService from '../src/services/responsibleGamingService.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = express.Router();

// Explicit safelist of generic keys that may be written via this route.
const ALLOWED_SETTING_KEYS = new Set<string>([
  'default_new_user_balance',
  'min_house_edge_floor',
]);

// Keys that are owned by another service — these MUST NOT be written here.
// Prefix matches catch any future variants without breaking this guard.
const SERVICE_OWNED_PREFIXES = ['max_payout_', 'alert_', 'login_reward_'];
const SERVICE_OWNED_EXACT = new Set<string>(['profanity_words']);

function isKeyWriteAllowed(key: string): boolean {
  if (SERVICE_OWNED_EXACT.has(key)) return false;
  if (SERVICE_OWNED_PREFIXES.some((p) => key.startsWith(p))) return false;
  if (ALLOWED_SETTING_KEYS.has(key)) return true;
  if (/^custom\./.test(key)) return true;
  return false;
}

function isValidKey(key: string): boolean {
  // Match the schema's varchar(100) column and a conservative charset.
  return typeof key === 'string' && key.length > 0 && key.length <= 100 && /^[A-Za-z0-9_.\-]+$/.test(key);
}

function isJsonSerialisable(value: any): boolean {
  // settings.value is `json NOT NULL` — null is rejected at the DB level,
  // and undefined would be lost in JSON. We accept everything else that
  // serialises to a non-undefined string.
  if (value === undefined) return false;
  if (value === null) return false;
  try {
    const s = JSON.stringify(value);
    return typeof s === 'string';
  } catch {
    return false;
  }
}

function parseStoredValue(raw: any): any {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/settings — list all rows (viewer+)
// ---------------------------------------------------------------------------
router.get('/', auth, adminOrOperatorOrViewer, async (_req: Request, res: Response) => {
  try {
    const rawRows = await responsibleGamingService.listSettings();
    const rows = rawRows.map((r: any) => ({
      key: r.key,
      value: parseStoredValue(r.value),
      updatedAt: r.updated_at,
      updatedBy: r.updated_by,
    }));
    res.json({ rows });
  } catch (error) {
    LoggingService.logSystemEvent('admin_settings_list_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error reading settings' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/settings/:key — read a single setting (viewer+)
// ---------------------------------------------------------------------------
router.get('/:key', auth, adminOrOperatorOrViewer, async (req: Request, res: Response) => {
  try {
    const key = String(req.params.key || '');
    if (!isValidKey(key)) {
      return res.status(400).json({ message: 'Invalid setting key' });
    }

    const row = await responsibleGamingService.getSetting(key);
    if (!row) {
      return res.status(404).json({ message: 'Setting not found' });
    }

    res.json({
      key: row.key,
      value: parseStoredValue(row.value),
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    });
  } catch (error) {
    LoggingService.logSystemEvent('admin_settings_read_error', {
      error: (error as Error)?.message,
      key: req.params.key,
    }, 'error');
    res.status(500).json({ message: 'Error reading setting' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/settings/:key — write a single setting (admin-only)
// Body: { value: <JSON-serialisable> }
// ---------------------------------------------------------------------------
router.put('/:key', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const key = String(req.params.key || '');
    if (!isValidKey(key)) {
      return res.status(400).json({ message: 'Invalid setting key' });
    }
    if (!isKeyWriteAllowed(key)) {
      // Either a service-owned key (use its dedicated endpoint) or an
      // unknown key that isn't on the safelist or in the custom.* namespace.
      return res.status(400).json({
        message: 'Setting key is not writable via this endpoint. Use the dedicated admin endpoint for service-owned keys, or use the custom.* namespace.',
      });
    }

    const body = req.body || {};
    if (!Object.prototype.hasOwnProperty.call(body, 'value')) {
      return res.status(400).json({ message: 'Missing "value" in body' });
    }
    if (!isJsonSerialisable(body.value)) {
      return res.status(400).json({ message: 'Value must be a non-null JSON-serialisable type' });
    }

    const adminId = (req as AuthenticatedRequest).user?.userId ?? null;
    const json = JSON.stringify(body.value);

    await responsibleGamingService.upsertSetting(key, json, adminId);

    LoggingService.logSystemEvent('admin_setting_updated', { adminId, key });

    res.json({ key, value: body.value });
  } catch (error) {
    LoggingService.logSystemEvent('admin_settings_write_error', {
      error: (error as Error)?.message,
      key: req.params.key,
    }, 'error');
    res.status(500).json({ message: 'Error updating setting' });
  }
});

export default router;
