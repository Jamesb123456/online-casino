/**
 * Admin Chat Moderation routes
 *
 * Mounted at /api/admin/chat. Allows admins/operators to:
 *  - browse recent chat messages (including soft-deleted)
 *  - soft-delete a message
 *  - mute / unmute a user
 *  - list active mutes
 *  - manage the profanity wordlist (admin-only writes)
 *
 * Soft-deletions and mute changes are also broadcast on the main socket
 * namespace so connected clients can update their UI in real time.
 */

import express, { Request, Response } from 'express';
import { authenticate as auth, adminOnly, adminOrOperator, adminOrOperatorOrViewer } from '../middleware/auth.js';
import chatModerationService from '../src/services/chatModerationService.js';
import LoggingService from '../src/services/loggingService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type { Server as SocketIOServer } from 'socket.io';

const router = express.Router();

// The Socket.IO server is injected at mount time so the route can emit
// real-time moderation events. We store it in a module-local so tests can
// register a mock without needing a real Socket.IO server.
let ioRef: SocketIOServer | null = null;

export function setIo(io: SocketIOServer | null): void {
  ioRef = io;
}

function emitModerationEvent(event: string, payload: unknown): void {
  try {
    if (ioRef) {
      ioRef.emit(event, payload);
    }
  } catch (error) {
    LoggingService.logSystemEvent('admin_chat_emit_error', {
      event,
      error: (error as Error)?.message,
    }, 'warning');
  }
}

// ---------------------------------------------------------------------------
// GET /messages
// ---------------------------------------------------------------------------
router.get('/messages', auth, adminOrOperatorOrViewer, async (req: Request, res: Response) => {
  try {
    const limitRaw = Number(req.query.limit ?? 100);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 100, 1), 500);
    const includeDeleted = String(req.query.includeDeleted ?? 'true') !== 'false';

    const rows = await chatModerationService.getRecentMessagesForAdmin(limit, includeDeleted);
    res.json({ rows, limit });
  } catch (error) {
    LoggingService.logSystemEvent('admin_chat_messages_read_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error reading messages' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /messages/:id — soft-delete a chat message
// ---------------------------------------------------------------------------
router.delete('/messages/:id', auth, adminOrOperator, async (req: Request, res: Response) => {
  try {
    const messageId = Number(req.params.id);
    if (!Number.isFinite(messageId) || messageId <= 0) {
      return res.status(400).json({ message: 'Invalid message id' });
    }
    const adminId = (req as AuthenticatedRequest).user?.userId ?? null;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : null;

    await chatModerationService.softDeleteMessage(messageId, adminId, reason);

    emitModerationEvent('chat_message_deleted', { messageId, reason });
    LoggingService.logSystemEvent('admin_chat_message_deleted', {
      adminId,
      messageId,
      reason,
    });

    res.json({ ok: true, messageId });
  } catch (error) {
    LoggingService.logSystemEvent('admin_chat_message_delete_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error deleting message' });
  }
});

// ---------------------------------------------------------------------------
// POST /mute — mute a user (15m / 1h / 24h / forever)
// ---------------------------------------------------------------------------
router.post('/mute', auth, adminOrOperator, async (req: Request, res: Response) => {
  try {
    const userIdRaw = req.body?.userId;
    const userId = Number(userIdRaw);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId' });
    }
    const durationMinutesRaw = req.body?.durationMinutes;
    const durationMinutes = Number(durationMinutesRaw);
    const MAX_DURATION_MINUTES = 525_600; // 1 year — use -1 for forever instead
    if (
      !Number.isFinite(durationMinutes) ||
      (durationMinutes !== -1 && (durationMinutes <= 0 || durationMinutes > MAX_DURATION_MINUTES))
    ) {
      return res.status(400).json({
        message: 'durationMinutes must be -1 (forever) or a positive number not exceeding 525600 (1 year)',
      });
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : null;
    const adminId = (req as AuthenticatedRequest).user?.userId ?? null;

    const durationMs = durationMinutes === -1 ? -1 : durationMinutes * 60 * 1000;
    const mute = await chatModerationService.muteUser(userId, durationMs, adminId, reason);

    emitModerationEvent('chat_user_muted', {
      userId,
      mutedUntil: mute.mutedUntil,
      reason,
    });
    LoggingService.logSystemEvent('admin_chat_user_muted', {
      adminId,
      userId,
      durationMinutes,
      reason,
    });

    res.json({ ok: true, mute });
  } catch (error) {
    LoggingService.logSystemEvent('admin_chat_mute_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error muting user' });
  }
});

// ---------------------------------------------------------------------------
// POST /unmute
// ---------------------------------------------------------------------------
router.post('/unmute', auth, adminOrOperator, async (req: Request, res: Response) => {
  try {
    const userId = Number(req.body?.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid userId' });
    }
    const adminId = (req as AuthenticatedRequest).user?.userId ?? null;

    await chatModerationService.unmuteUser(userId);

    emitModerationEvent('chat_user_unmuted', { userId });
    LoggingService.logSystemEvent('admin_chat_user_unmuted', { adminId, userId });

    res.json({ ok: true, userId });
  } catch (error) {
    LoggingService.logSystemEvent('admin_chat_unmute_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error unmuting user' });
  }
});

// ---------------------------------------------------------------------------
// GET /mutes — list active mutes
// ---------------------------------------------------------------------------
router.get('/mutes', auth, adminOrOperatorOrViewer, async (_req: Request, res: Response) => {
  try {
    const rows = await chatModerationService.getActiveMutes();
    res.json({ rows });
  } catch (error) {
    LoggingService.logSystemEvent('admin_chat_mutes_read_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error reading mutes' });
  }
});

// ---------------------------------------------------------------------------
// Profanity wordlist
// ---------------------------------------------------------------------------
router.get('/profanity-words', auth, adminOrOperatorOrViewer, async (_req: Request, res: Response) => {
  try {
    const words = await chatModerationService.getProfanityWords();
    res.json({ words });
  } catch (error) {
    LoggingService.logSystemEvent('admin_chat_profanity_read_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error reading profanity words' });
  }
});

router.put('/profanity-words', auth, adminOnly, async (req: Request, res: Response) => {
  try {
    const words = req.body?.words;
    const MAX_WORDS = 1000;
    const MAX_WORD_LEN = 100;
    if (!Array.isArray(words)) {
      return res.status(400).json({ message: 'words must be an array of strings' });
    }
    if (words.length > MAX_WORDS) {
      return res.status(400).json({ message: `Too many words (max ${MAX_WORDS})` });
    }
    if (words.some((w) => typeof w !== 'string' || w.length > MAX_WORD_LEN)) {
      return res.status(400).json({ message: `Each word must be a string of at most ${MAX_WORD_LEN} characters` });
    }
    const adminId = (req as AuthenticatedRequest).user?.userId ?? null;
    await chatModerationService.setProfanityWords(words, adminId);
    const stored = await chatModerationService.getProfanityWords();
    LoggingService.logSystemEvent('admin_chat_profanity_updated', { adminId, count: stored.length });
    res.json({ words: stored });
  } catch (error) {
    LoggingService.logSystemEvent('admin_chat_profanity_update_error', {
      error: (error as Error)?.message,
    }, 'error');
    res.status(500).json({ message: 'Error updating profanity words' });
  }
});

export default router;
