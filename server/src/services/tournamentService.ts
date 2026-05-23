import Decimal from 'decimal.js';
import { sql, type SQL } from 'drizzle-orm';
import { db } from '../../drizzle/db.js';
import LoggingService from './loggingService.js';
import balanceService from './balanceService.js';
import type { Tournament, TournamentEntry } from '../../drizzle/schema.js';

// ---------------------------------------------------------------------------
// Internal structural types
// ---------------------------------------------------------------------------

/**
 * Raw row shape returned from the mysql2 driver via Drizzle's `db.execute`.
 * We accept both snake_case (driver default) and camelCase (in case the driver
 * is configured to camelize) keys. Everything is permissively typed because
 * mysql2 returns mixed scalar types depending on column type (number/string/Date).
 */
type RawRow = Record<string, unknown>;
type TournamentRow = RawRow;
type TournamentEntryRow = RawRow;

/**
 * mysql2 / Drizzle `db.execute` returns `[rows, fields]` for SELECT and
 * `{ insertId, affectedRows, ... }` (wrapped in a tuple) for INSERT/UPDATE.
 * Tests also pass plain arrays. This permissive type covers all of those.
 */
type RawExecuteResult = unknown;

interface InsertExecResult {
  insertId?: number | string;
  [key: string]: unknown;
}

function rowsOf(result: RawExecuteResult): RawRow[] {
  // Drizzle/mysql2 returns [rows, fields]; tests pass [rows]. Both safe.
  const r = result as unknown as RawRow[][] | undefined;
  return (r && r[0]) || [];
}

function firstRow(result: RawExecuteResult): RawRow | undefined {
  return rowsOf(result)[0];
}

function extractInsertId(result: RawExecuteResult): number | string | null {
  const r = result as unknown as (InsertExecResult | InsertExecResult[]);
  if (Array.isArray(r)) return r[0]?.insertId ?? null;
  return (r && (r as InsertExecResult).insertId) ?? null;
}

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export const KNOWN_GAMES = ['crash', 'plinko', 'wheel', 'roulette', 'blackjack', 'landmines', 'dice', 'slots'] as const;
export const SCORING_RULES = ['biggest_win', 'total_wagered', 'best_roi'] as const;
export const STATUSES = ['scheduled', 'active', 'finalized', 'cancelled'] as const;

const ACTIVE_CACHE_TTL_MS = 15_000;

export type ScoringRule = typeof SCORING_RULES[number];
export type TournamentStatus = typeof STATUSES[number];

export interface CreateTournamentInput {
  name: string;
  gameType: string;
  scoring: ScoringRule;
  startTime: Date | string;
  endTime: Date | string;
  prizePool: number | string;
  prizeDistribution: Record<string, number>;
  createdBy?: number | null;
}

export interface UpdateTournamentPatch {
  name?: string;
  gameType?: string;
  scoring?: ScoringRule;
  startTime?: Date | string;
  endTime?: Date | string;
  prizePool?: number | string;
  prizeDistribution?: Record<string, number>;
}

export interface FinalizeResult {
  prizesAwarded: number;
  prizesFailed: number;
  totalDebited: number;
}

function toDate(v: Date | string): Date {
  if (v instanceof Date) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error('invalid_date');
  return d;
}

function toMySqlDateTime(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function parsePrizeDistribution(raw: unknown): Record<string, number> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw as Record<string, number>;
}

/**
 * Coerce a raw column value (string/number/Date/null) into a Date or null.
 * mysql2 may return any of those depending on column type and driver options.
 */
function toDateOrNull(v: unknown): Date | null {
  if (v == null) return null;
  return new Date(v as string | number | Date);
}

function hydrate(row: TournamentRow): Tournament {
  const startRaw = row.start_time ?? row.startTime;
  const endRaw = row.end_time ?? row.endTime;
  return {
    id: Number(row.id),
    name: row.name,
    gameType: row.game_type ?? row.gameType,
    scoring: row.scoring,
    startTime: toDateOrNull(startRaw),
    endTime: toDateOrNull(endRaw),
    prizePool: String(row.prize_pool ?? row.prizePool ?? '0'),
    prizeDistribution: parsePrizeDistribution(row.prize_distribution ?? row.prizeDistribution),
    status: row.status,
    createdBy: row.created_by == null ? null : Number(row.created_by ?? row.createdBy),
    finalizedAt: toDateOrNull(row.finalized_at ?? row.finalizedAt),
    finalizedBy: (row.finalized_by ?? row.finalizedBy) == null ? null : Number(row.finalized_by ?? row.finalizedBy),
    createdAt: toDateOrNull(row.created_at ?? row.createdAt) ?? new Date(),
    updatedAt: toDateOrNull(row.updated_at ?? row.updatedAt) ?? new Date(),
  } as Tournament;
}

function hydrateEntry(row: TournamentEntryRow): TournamentEntry {
  return {
    id: Number(row.id),
    tournamentId: Number(row.tournament_id ?? row.tournamentId),
    userId: Number(row.user_id ?? row.userId),
    score: String(row.score ?? '0'),
    totalWagered: String(row.total_wagered ?? row.totalWagered ?? '0'),
    totalWon: String(row.total_won ?? row.totalWon ?? '0'),
    biggestWin: String(row.biggest_win ?? row.biggestWin ?? '0'),
    rank: (row.rank ?? row.entryRank) == null ? null : Number(row.rank ?? row.entryRank),
    prizeAmount: (row.prize_amount ?? row.prizeAmount) == null ? null : String(row.prize_amount ?? row.prizeAmount),
    createdAt: toDateOrNull(row.created_at ?? row.createdAt) ?? new Date(),
    updatedAt: toDateOrNull(row.updated_at ?? row.updatedAt) ?? new Date(),
  } as TournamentEntry;
}

class TournamentService {
  // Cache: gameType -> { tournament | null, expiresAt }
  _activeCache: Map<string, { value: Tournament | null; expiresAt: number }> = new Map();

  // ---------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------
  validateCreateInput(input: CreateTournamentInput): void {
    if (!input || typeof input.name !== 'string' || input.name.length < 1 || input.name.length > 120) {
      throw new Error('invalid_name');
    }
    if (!(KNOWN_GAMES as readonly string[]).includes(input.gameType)) {
      throw new Error('invalid_game_type');
    }
    if (!(SCORING_RULES as readonly string[]).includes(input.scoring)) {
      throw new Error('invalid_scoring');
    }
    const start = toDate(input.startTime);
    const end = toDate(input.endTime);
    if (!(start.getTime() < end.getTime())) {
      throw new Error('start_must_precede_end');
    }
    const pool = new Decimal(input.prizePool || 0);
    if (!pool.isFinite() || pool.lte(0)) {
      throw new Error('prize_pool_must_be_positive');
    }
    this.validatePrizeDistribution(input.prizeDistribution);
  }

  validatePrizeDistribution(dist: Record<string, number>): void {
    if (!dist || typeof dist !== 'object' || Array.isArray(dist)) {
      throw new Error('invalid_prize_distribution');
    }
    const keys = Object.keys(dist);
    if (keys.length === 0) {
      throw new Error('invalid_prize_distribution');
    }
    let sum = new Decimal(0);
    for (const k of keys) {
      if (!/^[1-9]\d*$/.test(k)) {
        throw new Error('invalid_prize_distribution_key');
      }
      const v = dist[k];
      const dv = new Decimal(v);
      if (!dv.isFinite() || dv.lte(0) || dv.gt(1)) {
        throw new Error('invalid_prize_distribution_value');
      }
      sum = sum.plus(dv);
    }
    if (sum.minus(1).abs().gt(new Decimal('0.001'))) {
      throw new Error('prize_distribution_must_sum_to_one');
    }
  }

  // ---------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------
  async create(input: CreateTournamentInput): Promise<Tournament> {
    this.validateCreateInput(input);
    const start = toDate(input.startTime);
    const end = toDate(input.endTime);
    const pool = new Decimal(input.prizePool).toFixed(2);
    const distJson = JSON.stringify(input.prizeDistribution);

    const result: RawExecuteResult = await db.execute(
      sql`INSERT INTO tournaments
            (name, game_type, scoring, start_time, end_time, prize_pool, prize_distribution, status, created_by, created_at, updated_at)
          VALUES
            (${input.name}, ${input.gameType}, ${input.scoring}, ${toMySqlDateTime(start)}, ${toMySqlDateTime(end)},
             ${pool}, ${distJson}, 'scheduled', ${input.createdBy ?? null}, NOW(), NOW())`
    );
    const insertId = extractInsertId(result);
    if (!insertId) throw new Error('tournament_create_failed');

    // Invalidate active cache for this game.
    this._activeCache.delete(input.gameType);

    const row = await this.getById(Number(insertId));
    if (!row) throw new Error('tournament_create_failed');
    return row;
  }

  async update(id: number, patch: UpdateTournamentPatch): Promise<Tournament> {
    const existing = await this.getById(id);
    if (!existing) throw new Error('tournament_not_found');
    if (existing.status !== 'scheduled') {
      throw new Error('tournament_not_editable');
    }

    const sets: SQL[] = [];
    if (Object.prototype.hasOwnProperty.call(patch, 'name')) {
      if (typeof patch.name !== 'string' || patch.name.length < 1 || patch.name.length > 120) {
        throw new Error('invalid_name');
      }
      sets.push(sql`name = ${patch.name}`);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'gameType')) {
      if (!(KNOWN_GAMES as readonly string[]).includes(patch.gameType as string)) throw new Error('invalid_game_type');
      sets.push(sql`game_type = ${patch.gameType}`);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'scoring')) {
      if (!(SCORING_RULES as readonly string[]).includes(patch.scoring as string)) throw new Error('invalid_scoring');
      sets.push(sql`scoring = ${patch.scoring}`);
    }

    // For start/end, require both-or-neither consistency check using the
    // resulting values (existing values may stay).
    const newStart = patch.startTime != null ? toDate(patch.startTime) : new Date(existing.startTime as Date);
    const newEnd = patch.endTime != null ? toDate(patch.endTime) : new Date(existing.endTime as Date);
    if (!(newStart.getTime() < newEnd.getTime())) {
      throw new Error('start_must_precede_end');
    }
    if (patch.startTime != null) sets.push(sql`start_time = ${toMySqlDateTime(newStart)}`);
    if (patch.endTime != null) sets.push(sql`end_time = ${toMySqlDateTime(newEnd)}`);

    if (Object.prototype.hasOwnProperty.call(patch, 'prizePool')) {
      const pool = new Decimal(patch.prizePool as Decimal.Value);
      if (!pool.isFinite() || pool.lte(0)) throw new Error('prize_pool_must_be_positive');
      sets.push(sql`prize_pool = ${pool.toFixed(2)}`);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'prizeDistribution')) {
      this.validatePrizeDistribution(patch.prizeDistribution as Record<string, number>);
      sets.push(sql`prize_distribution = ${JSON.stringify(patch.prizeDistribution)}`);
    }

    if (sets.length === 0) {
      return existing;
    }
    sets.push(sql`updated_at = NOW()`);
    const setClause = sql.join(sets, sql`, `);
    await db.execute(sql`UPDATE tournaments SET ${setClause} WHERE id = ${id}`);

    this._activeCache.delete(existing.gameType);
    if (patch.gameType) this._activeCache.delete(patch.gameType);

    const updated = await this.getById(id);
    if (!updated) throw new Error('tournament_not_found');
    return updated;
  }

  async cancel(id: number, adminId: number | null): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) throw new Error('tournament_not_found');
    if (existing.status !== 'scheduled' && existing.status !== 'active') {
      throw new Error('tournament_not_cancellable');
    }
    await db.execute(
      sql`UPDATE tournaments SET status = 'cancelled', updated_at = NOW() WHERE id = ${id}`
    );
    LoggingService.logSystemEvent('tournament_cancelled', { id, adminId });
    this._activeCache.delete(existing.gameType);
  }

  async list(opts: { status?: string; gameType?: string; limit?: number; offset?: number } = {}): Promise<{ rows: Tournament[]; total: number }> {
    const limit = Math.min(Math.max(Number(opts.limit ?? 50) || 50, 1), 200);
    const offset = Math.max(Number(opts.offset ?? 0) || 0, 0);

    const params: { status: string | null; gameType: string | null } = {
      status: opts.status ?? null,
      gameType: opts.gameType ?? null,
    };

    const countOf = (result: RawExecuteResult): number => Number(firstRow(result)?.c ?? 0);

    // We assemble the WHERE clause via tagged SQL to keep parameterisation safe.
    if (opts.status && opts.gameType) {
      const result: RawExecuteResult = await db.execute(
        sql`SELECT * FROM tournaments WHERE status = ${params.status} AND game_type = ${params.gameType}
            ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
      );
      const totalRes: RawExecuteResult = await db.execute(
        sql`SELECT COUNT(*) AS c FROM tournaments WHERE status = ${params.status} AND game_type = ${params.gameType}`
      );
      return { rows: rowsOf(result).map(hydrate), total: countOf(totalRes) };
    }
    if (opts.status) {
      const result: RawExecuteResult = await db.execute(
        sql`SELECT * FROM tournaments WHERE status = ${params.status}
            ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
      );
      const totalRes: RawExecuteResult = await db.execute(
        sql`SELECT COUNT(*) AS c FROM tournaments WHERE status = ${params.status}`
      );
      return { rows: rowsOf(result).map(hydrate), total: countOf(totalRes) };
    }
    if (opts.gameType) {
      const result: RawExecuteResult = await db.execute(
        sql`SELECT * FROM tournaments WHERE game_type = ${params.gameType}
            ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
      );
      const totalRes: RawExecuteResult = await db.execute(
        sql`SELECT COUNT(*) AS c FROM tournaments WHERE game_type = ${params.gameType}`
      );
      return { rows: rowsOf(result).map(hydrate), total: countOf(totalRes) };
    }
    const result: RawExecuteResult = await db.execute(
      sql`SELECT * FROM tournaments ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
    );
    const totalRes: RawExecuteResult = await db.execute(sql`SELECT COUNT(*) AS c FROM tournaments`);
    return { rows: rowsOf(result).map(hydrate), total: countOf(totalRes) };
  }

  async getById(id: number): Promise<Tournament | null> {
    const result: RawExecuteResult = await db.execute(sql`SELECT * FROM tournaments WHERE id = ${id} LIMIT 1`);
    const row = firstRow(result);
    return row ? hydrate(row) : null;
  }

  /**
   * Returns the currently-active tournament for a given game (status='active'
   * AND NOW() between start_time and end_time). Cached per game for
   * ACTIVE_CACHE_TTL_MS so the per-bet/per-win lookup is cheap.
   */
  async getActiveForGame(gameType: string): Promise<Tournament | null> {
    const now = Date.now();
    const cached = this._activeCache.get(gameType);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }
    const result: RawExecuteResult = await db.execute(
      sql`SELECT * FROM tournaments
          WHERE status = 'active' AND game_type = ${gameType}
            AND start_time <= NOW() AND end_time >= NOW()
          ORDER BY end_time ASC LIMIT 1`
    );
    const row = firstRow(result);
    const value = row ? hydrate(row) : null;
    this._activeCache.set(gameType, { value, expiresAt: now + ACTIVE_CACHE_TTL_MS });
    return value;
  }

  // ---------------------------------------------------------------------
  // Score updates
  // ---------------------------------------------------------------------

  /**
   * Recompute a single entry's `score` field per the tournament's scoring rule.
   * Best ROI guards divide-by-zero by clamping the denominator to >= 1.
   */
  _computeScore(scoring: ScoringRule, totalWagered: Decimal, totalWon: Decimal, biggestWin: Decimal): Decimal {
    if (scoring === 'biggest_win') return biggestWin;
    if (scoring === 'total_wagered') return totalWagered;
    // best_roi: (totalWon - totalWagered) / max(totalWagered, 1)
    const denom = Decimal.max(totalWagered, new Decimal(1));
    return totalWon.minus(totalWagered).div(denom);
  }

  /**
   * Upsert an entry row and return the current aggregates plus the resolved
   * scoring rule. Idempotent re: row existence — duplicate inserts hit the
   * unique index and we re-select.
   */
  async _ensureEntry(tournamentId: number, userId: number): Promise<{
    entry: TournamentEntry;
    scoring: ScoringRule;
  } | null> {
    const t = await this.getById(tournamentId);
    if (!t) return null;

    // Try insert with ON DUPLICATE KEY no-op so we always have a row.
    await db.execute(
      sql`INSERT INTO tournament_entries
            (tournament_id, user_id, score, total_wagered, total_won, biggest_win, created_at, updated_at)
          VALUES (${tournamentId}, ${userId}, '0', '0', '0', '0', NOW(), NOW())
          ON DUPLICATE KEY UPDATE updated_at = updated_at`
    );

    const result: RawExecuteResult = await db.execute(
      sql`SELECT * FROM tournament_entries WHERE tournament_id = ${tournamentId} AND user_id = ${userId} LIMIT 1`
    );
    const row = firstRow(result);
    if (!row) return null;
    return { entry: hydrateEntry(row), scoring: t.scoring as ScoringRule };
  }

  async recordBet(tournamentId: number, userId: number, betAmount: number | string): Promise<void> {
    const bet = new Decimal(betAmount).abs();
    if (!bet.isFinite() || bet.isZero()) return;

    const ctx = await this._ensureEntry(tournamentId, userId);
    if (!ctx) return;

    const newTotalWagered = new Decimal(ctx.entry.totalWagered).plus(bet);
    const totalWon = new Decimal(ctx.entry.totalWon);
    const biggestWin = new Decimal(ctx.entry.biggestWin);
    const newScore = this._computeScore(ctx.scoring, newTotalWagered, totalWon, biggestWin);

    await db.execute(
      sql`UPDATE tournament_entries
          SET total_wagered = ${newTotalWagered.toFixed(2)},
              score = ${newScore.toFixed(4)},
              updated_at = NOW()
          WHERE tournament_id = ${tournamentId} AND user_id = ${userId}`
    );
  }

  async recordWin(tournamentId: number, userId: number, winAmount: number | string): Promise<void> {
    const win = new Decimal(winAmount).abs();
    if (!win.isFinite() || win.isZero()) return;

    const ctx = await this._ensureEntry(tournamentId, userId);
    if (!ctx) return;

    const totalWagered = new Decimal(ctx.entry.totalWagered);
    const newTotalWon = new Decimal(ctx.entry.totalWon).plus(win);
    const currentBiggest = new Decimal(ctx.entry.biggestWin);
    const newBiggest = win.gt(currentBiggest) ? win : currentBiggest;
    const newScore = this._computeScore(ctx.scoring, totalWagered, newTotalWon, newBiggest);

    await db.execute(
      sql`UPDATE tournament_entries
          SET total_won = ${newTotalWon.toFixed(2)},
              biggest_win = ${newBiggest.toFixed(2)},
              score = ${newScore.toFixed(4)},
              updated_at = NOW()
          WHERE tournament_id = ${tournamentId} AND user_id = ${userId}`
    );
  }

  async getLeaderboard(tournamentId: number, limit = 50): Promise<TournamentEntry[]> {
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 500);
    const result: RawExecuteResult = await db.execute(
      sql`SELECT * FROM tournament_entries
          WHERE tournament_id = ${tournamentId}
          ORDER BY score DESC, total_wagered DESC, id ASC
          LIMIT ${lim}`
    );
    return rowsOf(result).map(hydrateEntry);
  }

  async getUserEntry(tournamentId: number, userId: number): Promise<TournamentEntry | null> {
    const result: RawExecuteResult = await db.execute(
      sql`SELECT * FROM tournament_entries WHERE tournament_id = ${tournamentId} AND user_id = ${userId} LIMIT 1`
    );
    const row = firstRow(result);
    return row ? hydrateEntry(row) : null;
  }

  /**
   * Determine the rank of one user within a tournament by counting entries
   * with a strictly-higher score. Returns 1-indexed rank or null when no
   * entry exists.
   */
  async getUserRank(tournamentId: number, userId: number): Promise<number | null> {
    const entry = await this.getUserEntry(tournamentId, userId);
    if (!entry) return null;
    const result: RawExecuteResult = await db.execute(
      sql`SELECT COUNT(*) AS c FROM tournament_entries
          WHERE tournament_id = ${tournamentId} AND score > ${entry.score}`
    );
    const better = Number(firstRow(result)?.c ?? 0);
    return better + 1;
  }

  // ---------------------------------------------------------------------
  // Finalize
  // ---------------------------------------------------------------------

  /**
   * Awards prize_pool fractions to the top-ranked entries per
   * prizeDistribution. Uses balanceService.manualAdjustment which debits the
   * house atomically. Continues on per-prize failures (partial distribution
   * is acceptable).
   */
  async finalize(tournamentId: number, adminId: number | null): Promise<FinalizeResult> {
    const t = await this.getById(tournamentId);
    if (!t) throw new Error('tournament_not_found');
    if (t.status !== 'active') throw new Error('tournament_not_active');
    // TZ-safe end-time gate. The mysql2 driver returns timestamps in the host's
    // local TZ, so comparing `new Date(row.end_time).getTime()` to `Date.now()`
    // on a non-UTC host is off by the UTC offset. Always compare against
    // the database's clock instead.
    const endCheck: RawExecuteResult = await db.execute(
      sql`SELECT (end_time <= NOW()) AS ended FROM tournaments WHERE id = ${tournamentId} LIMIT 1`
    );
    const endedFlag = firstRow(endCheck)?.ended;
    if (endedFlag == null) throw new Error('tournament_not_found');
    // MySQL boolean returns are driver-dependent (1/0, true/false, '1'/'0').
    if (!(endedFlag === 1 || endedFlag === true || endedFlag === '1')) {
      throw new Error('tournament_not_ended');
    }

    const leaderboard = await this.getLeaderboard(tournamentId, 500);
    const dist = parsePrizeDistribution(t.prizeDistribution);
    const pool = new Decimal(t.prizePool);

    let prizesAwarded = 0;
    let prizesFailed = 0;
    let totalDebited = new Decimal(0);

    for (const rankKey of Object.keys(dist)) {
      const rank = Number(rankKey);
      const fraction = new Decimal(dist[rankKey]);
      const entry = leaderboard[rank - 1];
      if (!entry) continue;
      const prize = pool.times(fraction).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      if (prize.lte(0)) continue;

      try {
        // Tag the underlying balance/transaction row with the sentinel
        // 'tournament_prize' game_type so the row is queryable + the enum
        // constraint on `balances.game_type` is satisfied (it is NOT NULL
        // in the DB schema even though Drizzle types it as nullable).
        await balanceService.manualAdjustment(
          entry.userId,
          prize.toNumber(),
          `tournament_prize: ${tournamentId}`,
          adminId,
          'tournament_prize',
        );
        await db.execute(
          sql`UPDATE tournament_entries
              SET \`rank\` = ${rank}, prize_amount = ${prize.toFixed(2)}, updated_at = NOW()
              WHERE id = ${entry.id}`
        );
        prizesAwarded++;
        totalDebited = totalDebited.plus(prize);
      } catch (err) {
        prizesFailed++;
        // Log loudly at error severity — a failed prize payout is a real
        // operator concern (player expected money, didn't get it).
        LoggingService.logSystemEvent('tournament_prize_failed', {
          tournamentId,
          userId: entry.userId,
          rank,
          prize: prize.toNumber(),
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        }, 'error');
      }
    }

    // Also stamp the remaining leaderboard with their final ranks (no prize)
    // so the historical view is readable.
    for (let i = 0; i < leaderboard.length; i++) {
      const entry = leaderboard[i];
      const rank = i + 1;
      if (dist[String(rank)] != null) continue; // already updated above
      await db.execute(
        sql`UPDATE tournament_entries
            SET \`rank\` = ${rank}, updated_at = NOW()
            WHERE id = ${entry.id} AND (\`rank\` IS NULL)`
      );
    }

    await db.execute(
      sql`UPDATE tournaments
          SET status = 'finalized', finalized_at = NOW(), finalized_by = ${adminId ?? null}, updated_at = NOW()
          WHERE id = ${tournamentId}`
    );

    this._activeCache.delete(t.gameType);

    LoggingService.logSystemEvent('tournament_finalized', {
      tournamentId,
      adminId,
      prizesAwarded,
      prizesFailed,
      totalDebited: totalDebited.toNumber(),
    }, prizesFailed > 0 ? 'warning' : 'info');

    return { prizesAwarded, prizesFailed, totalDebited: totalDebited.toNumber() };
  }

  // ---------------------------------------------------------------------
  // Status transitions
  // ---------------------------------------------------------------------

  /**
   * Move `scheduled` → `active` when start_time has passed. Does NOT touch
   * `active` rows whose end_time has passed — finalize is admin-driven.
   */
  async sweepStatusTransitions(): Promise<void> {
    try {
      // Find scheduled tournaments whose start has passed; bump to active.
      const result: RawExecuteResult = await db.execute(
        sql`SELECT id, game_type FROM tournaments
            WHERE status = 'scheduled' AND start_time <= NOW()`
      );
      const rows = rowsOf(result);
      if (rows.length === 0) return;

      await db.execute(
        sql`UPDATE tournaments SET status = 'active', updated_at = NOW()
            WHERE status = 'scheduled' AND start_time <= NOW()`
      );
      for (const r of rows) {
        const gameType = (r.game_type ?? r.gameType) as string | undefined;
        if (gameType) this._activeCache.delete(gameType);
        LoggingService.logSystemEvent('tournament_activated', { id: Number(r.id), gameType });
      }
    } catch (err) {
      LoggingService.logSystemEvent('tournament_sweep_failed', {
        error: err instanceof Error ? err.message : String(err),
      }, 'warning');
    }
  }

  // ---------------------------------------------------------------------
  // Test hooks
  // ---------------------------------------------------------------------
  _resetCache(): void {
    this._activeCache.clear();
  }
}

const tournamentService = new TournamentService();
export default tournamentService;
export { TournamentService };
