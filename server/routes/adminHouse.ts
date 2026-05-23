import express, { Request, Response } from 'express';
import { authenticate as auth, adminOnly, adminOrOperatorOrViewer } from '../middleware/auth.js';
import LoggingService from '../src/services/loggingService.js';
import HouseService, { CAP_KEYS } from '../src/services/houseService.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = express.Router();

const PUBLIC_CAP_KEYS = ['perRound', 'perUserPerDay', 'perDay'] as const;
type PublicCapKey = (typeof PUBLIC_CAP_KEYS)[number];

function parseAmount(raw: any): number | null {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return n;
}

function validateCapsPatch(body: any):
  | { ok: true; clean: Partial<Record<PublicCapKey, number | null>> }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'invalid_payload' };
  }
  const clean: Partial<Record<PublicCapKey, number | null>> = {};
  for (const key of PUBLIC_CAP_KEYS) {
    if (body[key] === undefined) continue;
    if (body[key] === null) {
      clean[key] = null;
      continue;
    }
    const n = Number(body[key]);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: `${key} must be a non-negative number or null` };
    }
    clean[key] = n;
  }
  if (Object.keys(clean).length === 0) {
    return { ok: false, error: 'no_cap_fields_provided' };
  }
  return { ok: true, clean };
}

// GET /api/admin/house — current balance + caps
router.get('/', auth, adminOrOperatorOrViewer, async (_req: Request, res: Response) => {
  try {
    const [balance, caps] = await Promise.all([
      HouseService.getHouseBalance(),
      HouseService.getCaps(),
    ]);
    res.json({ balance, caps });
  } catch (error) {
    LoggingService.logSystemEvent('admin_house_read_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error reading house state' });
  }
});

// POST /api/admin/house/topup — add to the house balance
router.post('/topup', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const adminId = (req as AuthenticatedRequest).user?.userId ?? null;
    const amount = parseAmount(req.body?.amount);
    if (amount === null || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive finite number' });
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : null;

    const { balanceAfter } = await HouseService.topUp(amount, adminId, reason);

    LoggingService.logSystemEvent('admin_house_topup', { adminId, amount, balanceAfter, reason });
    res.json({ balance: balanceAfter });
  } catch (error) {
    LoggingService.logSystemEvent('admin_house_topup_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error topping up house balance' });
  }
});

// POST /api/admin/house/set-balance — hard override
router.post('/set-balance', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const adminId = (req as AuthenticatedRequest).user?.userId ?? null;
    const balance = parseAmount(req.body?.balance);
    if (balance === null || balance < 0) {
      return res.status(400).json({ message: 'Balance must be a non-negative finite number' });
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : null;

    const { balanceAfter } = await HouseService.setHouseBalance(balance, adminId, reason);

    LoggingService.logSystemEvent('admin_house_set_balance', { adminId, balanceAfter, reason });
    res.json({ balance: balanceAfter });
  } catch (error) {
    LoggingService.logSystemEvent('admin_house_set_balance_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error setting house balance' });
  }
});

// GET /api/admin/house/caps
router.get('/caps', auth, adminOrOperatorOrViewer, async (_req: Request, res: Response) => {
  try {
    const caps = await HouseService.getCaps();
    res.json({ caps });
  } catch (error) {
    LoggingService.logSystemEvent('admin_house_caps_read_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error reading payout caps' });
  }
});

// PUT /api/admin/house/caps
router.put('/caps', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const adminId = (req as AuthenticatedRequest).user?.userId ?? null;
    const validation: any = validateCapsPatch(req.body);
    if (!validation.ok) {
      return res.status(400).json({ message: validation.error });
    }

    for (const [publicKey, value] of Object.entries(validation.clean)) {
      const settingKey = CAP_KEYS[publicKey as PublicCapKey];
      await HouseService.setCap(settingKey, value, adminId);
    }

    LoggingService.logSystemEvent('admin_house_caps_updated', {
      adminId,
      patch: validation.clean,
    });

    const caps = await HouseService.getCaps();
    res.json({ caps });
  } catch (error) {
    LoggingService.logSystemEvent('admin_house_caps_update_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error updating payout caps' });
  }
});

// GET /api/admin/house/transactions — paginated audit log
router.get('/transactions', auth, adminOrOperatorOrViewer, async (req: Request, res: Response) => {
  try {
    const limitRaw = Number(req.query.limit ?? 50);
    const offsetRaw = Number(req.query.offset ?? 0);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 200);
    const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);
    const type = typeof req.query.type === 'string' && req.query.type ? String(req.query.type) : null;
    const from = typeof req.query.from === 'string' && req.query.from ? String(req.query.from) : null;
    const to = typeof req.query.to === 'string' && req.query.to ? String(req.query.to) : null;

    const { rawRows, total } = await HouseService.getTransactions({ limit, offset, type, from, to });

    const rows = rawRows.map((r: any) => ({
      id: r.id,
      type: r.type,
      amount: Number(r.amount),
      balanceBefore: Number(r.balance_before),
      balanceAfter: Number(r.balance_after),
      userId: r.user_id,
      userUsername: r.user_username,
      adminId: r.admin_id,
      adminUsername: r.admin_username,
      gameType: r.game_type,
      gameSessionId: r.game_session_id,
      transactionId: r.transaction_id,
      reason: r.reason,
      metadata: r.metadata,
      createdAt: r.created_at,
    }));

    res.json({ rows, total, limit, offset });
  } catch (error) {
    LoggingService.logSystemEvent('admin_house_transactions_read_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error reading house transactions' });
  }
});

export default router;
