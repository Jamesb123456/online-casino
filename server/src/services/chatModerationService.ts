/**
 * Chat Moderation Service
 *
 * Centralises the moderation primitives used by the chat handler and the
 * admin moderation routes:
 *   - mute lookup / insertion / clearing
 *   - soft-deletion of messages
 *   - profanity wordlist (read from `settings.profanity_words` with TTL cache)
 *
 * Forever mutes are represented by a far-future timestamp (year 2099) so the
 * lookup query stays a single `mutedUntil > NOW()` comparison whether the
 * mute is timed or permanent.
 */

import { sql, eq, and, gt, desc } from 'drizzle-orm';
import { db } from '../../drizzle/db.js';
import { userMutes, messages, settings, users } from '../../drizzle/schema.js';
import type { UserMute } from '../../drizzle/schema.js';
import LoggingService from './loggingService.js';

const FOREVER_DATE = new Date('2099-12-31T23:59:59Z');
const PROFANITY_CACHE_TTL_MS = 60_000;
const DEFAULT_PROFANITY_WORDS = ['fuck', 'shit', 'asshole', 'bitch'];

export interface MuteStatus {
  muted: boolean;
  until?: Date;
  reason?: string;
}

class ChatModerationService {
  private _profanityCache: { words: string[]; expiresAt: number } | null = null;

  /**
   * Return the current mute state for a user. A user is muted when the most
   * recent row for them has `mutedUntil > NOW()`.
   */
  async isMuted(userId: number): Promise<MuteStatus> {
    try {
      const rows = await db
        .select({
          mutedUntil: userMutes.mutedUntil,
          reason: userMutes.reason,
        })
        .from(userMutes)
        .where(and(eq(userMutes.userId, userId), gt(userMutes.mutedUntil, new Date())))
        .orderBy(desc(userMutes.mutedUntil))
        .limit(1);

      if (rows.length === 0) {
        return { muted: false };
      }

      const row = rows[0];
      return {
        muted: true,
        until: row.mutedUntil as Date,
        reason: row.reason || undefined,
      };
    } catch (error) {
      LoggingService.logSystemEvent('chat_moderation_is_muted_error', {
        userId,
        error: (error as Error)?.message,
      }, 'warning');
      // Fail open — chat must remain usable even if the moderation table is
      // unreachable. Admins can re-issue mutes once the issue is fixed.
      return { muted: false };
    }
  }

  /**
   * Insert a new mute row for the user. `durationMs === -1` means "forever"
   * and writes a far-future timestamp so the same query handles both cases.
   */
  async muteUser(
    userId: number,
    durationMs: number,
    mutedBy: number | null,
    reason: string | null,
  ): Promise<UserMute> {
    const mutedUntil =
      durationMs === -1
        ? FOREVER_DATE
        : new Date(Date.now() + Math.max(0, durationMs));

    const result: any = await db.insert(userMutes).values({
      userId,
      mutedUntil,
      mutedBy: mutedBy ?? null,
      reason: reason ?? null,
    } as any);

    const insertId = result?.insertId ?? result?.[0]?.insertId;
    if (insertId) {
      const rows = await db
        .select()
        .from(userMutes)
        .where(eq(userMutes.id, Number(insertId)))
        .limit(1);
      if (rows[0]) return rows[0] as UserMute;
    }

    // Fallback shape if insertId is not returned (e.g. mocked db). The caller
    // mainly needs to know the mutedUntil, which is deterministic above.
    return {
      id: 0,
      userId,
      mutedUntil,
      mutedBy: mutedBy ?? null,
      reason: reason ?? null,
      createdAt: new Date(),
    } as UserMute;
  }

  /**
   * Clear the most-recent active mute for a user by setting `mutedUntil = NOW()`.
   * Idempotent: a no-op when there is no active mute.
   */
  async unmuteUser(userId: number): Promise<void> {
    await db
      .update(userMutes)
      .set({ mutedUntil: new Date() } as any)
      .where(and(eq(userMutes.userId, userId), gt(userMutes.mutedUntil, new Date())));
  }

  /**
   * Soft-delete a message. The WHERE clause skips rows already deleted so
   * repeat calls are idempotent and don't overwrite the original deletedBy.
   */
  async softDeleteMessage(
    messageId: number,
    deletedBy: number | null,
    reason: string | null,
  ): Promise<void> {
    await db.execute(
      sql`UPDATE messages
          SET deleted_at = NOW(),
              deleted_by = ${deletedBy ?? null},
              deleted_reason = ${reason ?? null}
          WHERE id = ${messageId} AND deleted_at IS NULL`,
    );
  }

  /**
   * Return recent (non-deleted) messages with the sender's username/avatar.
   */
  async getRecentMessages(limit = 100) {
    const rows = await db
      .select({
        id: messages.id,
        content: messages.content,
        userId: messages.userId,
        createdAt: messages.createdAt,
        deletedAt: messages.deletedAt,
        username: users.username,
        avatar: users.avatar,
      })
      .from(messages)
      .leftJoin(users, eq(messages.userId, users.id))
      .where(sql`${messages.deletedAt} IS NULL`)
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    return rows;
  }

  /**
   * Admin view: returns recent messages including deleted ones, with the
   * sender username plus the moderator who deleted (if any).
   */
  async getRecentMessagesForAdmin(limit = 100, includeDeleted = true) {
    const conditions: any[] = [];
    if (!includeDeleted) {
      conditions.push(sql`${messages.deletedAt} IS NULL`);
    }
    const whereClause = conditions.length ? and(...conditions) : undefined;

    let query: any = db
      .select({
        id: messages.id,
        content: messages.content,
        userId: messages.userId,
        createdAt: messages.createdAt,
        deletedAt: messages.deletedAt,
        deletedBy: messages.deletedBy,
        deletedReason: messages.deletedReason,
        username: users.username,
        avatar: users.avatar,
      })
      .from(messages)
      .leftJoin(users, eq(messages.userId, users.id));

    if (whereClause) {
      query = query.where(whereClause);
    }

    return query.orderBy(desc(messages.createdAt)).limit(limit);
  }

  /**
   * List active mutes joined with username for the admin UI.
   */
  async getActiveMutes() {
    return db
      .select({
        id: userMutes.id,
        userId: userMutes.userId,
        mutedUntil: userMutes.mutedUntil,
        mutedBy: userMutes.mutedBy,
        reason: userMutes.reason,
        createdAt: userMutes.createdAt,
        username: users.username,
      })
      .from(userMutes)
      .leftJoin(users, eq(userMutes.userId, users.id))
      .where(gt(userMutes.mutedUntil, new Date()))
      .orderBy(desc(userMutes.createdAt));
  }

  /**
   * Read the profanity wordlist from `settings.profanity_words`. Uses a small
   * TTL cache to avoid hitting the DB on every chat message.
   */
  async getProfanityWords(): Promise<string[]> {
    const now = Date.now();
    if (this._profanityCache && this._profanityCache.expiresAt > now) {
      return this._profanityCache.words;
    }

    try {
      const rows = await db
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, 'profanity_words'))
        .limit(1);

      let words: string[] = DEFAULT_PROFANITY_WORDS;
      const raw = rows[0]?.value;
      if (Array.isArray(raw)) {
        words = raw.filter((w) => typeof w === 'string' && w.length > 0);
      } else if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            words = parsed.filter((w) => typeof w === 'string' && w.length > 0);
          }
        } catch {
          // ignore parse errors; fall through to default
        }
      }

      if (words.length === 0) {
        words = DEFAULT_PROFANITY_WORDS;
      }

      this._profanityCache = { words, expiresAt: now + PROFANITY_CACHE_TTL_MS };
      return words;
    } catch (error) {
      LoggingService.logSystemEvent('chat_profanity_read_error', {
        error: (error as Error)?.message,
      }, 'warning');
      return DEFAULT_PROFANITY_WORDS;
    }
  }

  /**
   * Persist a new profanity wordlist and invalidate the cache so the chat
   * handler picks up the new list immediately.
   */
  async setProfanityWords(words: string[], updatedBy: number | null): Promise<void> {
    const cleaned = Array.isArray(words)
      ? words
          .map((w) => (typeof w === 'string' ? w.trim().toLowerCase() : ''))
          .filter((w) => w.length > 0)
      : [];

    await db.execute(
      sql`INSERT INTO settings (\`key\`, value, updated_by, updated_at)
          VALUES ('profanity_words', ${JSON.stringify(cleaned)}, ${updatedBy ?? null}, NOW())
          ON DUPLICATE KEY UPDATE
            value = VALUES(value),
            updated_by = VALUES(updated_by),
            updated_at = NOW()`,
    );

    this._profanityCache = null;
  }

  /**
   * Replace any profanity-word matches in `content` with asterisks of equal
   * length. Case-insensitive whole-word match.
   */
  applyProfanityFilter(content: string, words: string[]): string {
    if (!content || !words || words.length === 0) return content;
    // Escape regex metacharacters in profanity entries.
    const escaped = words
      .filter((w) => typeof w === 'string' && w.length > 0)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (escaped.length === 0) return content;
    const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
    return content.replace(pattern, (match) => '*'.repeat(match.length));
  }

  /** Test hook — wipes the in-memory cache. */
  _resetCache(): void {
    this._profanityCache = null;
  }
}

const chatModerationService = new ChatModerationService();
export default chatModerationService;
export { ChatModerationService, FOREVER_DATE, DEFAULT_PROFANITY_WORDS };
